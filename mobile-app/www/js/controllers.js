/* globals angular: false */
/* globals console: false */

angular.module("MooringLights.controllers", ["ngCordova", "MooringLights.services"])

// EditChaserCtrl: The controller used for adding/editing chasers
.controller("EditChaserCtrl", function($scope, $rootScope, $window, $ionicHistory, $ionicPopup, $stateParams, Chaser, LightsService, Scene, Toast) {
  $scope.Chaser = {};

  $scope.IsController = false; // Flag indicating whether the Chaser is one stored on the controller

  $scope.IsNew = false;

  $scope.doBack = function() {
    $ionicHistory.goBack();
  };

  $scope.doSave = function() {
    if ($scope.IsController) {
      // Write the chaser to the controller
      $scope.Chaser.write($stateParams.id)
      .then(function(response) {
        Toast.showLongBottom("Chaser has been written to Button " + $stateParams.id);
        $ionicHistory.goBack();

      }).catch(function(error) {
        console.log("Couldn't write chaser:");
        console.log(JSON.stringify(error));

        Toast.showLongBottom(error.message);

      });

    } else {
      // Write the chaser to local storage
      LightsService.saveChaser($scope.Chaser);
      $rootScope.$broadcast("chasers-changed", $scope.Chaser);
      $ionicHistory.goBack();
    }
  };

  $scope.getScenes = function() {
    return $scope.Chaser.Scenes.slice(0, $scope.Chaser.Count);
  };

  $scope.showEditScene = function(scene) {
    var scope = $rootScope.$new(true);
    scope.original = scene;
    scope.scene = new Scene(scene); // Create a copy of the scene

    var popup = $ionicPopup.confirm({
      scope: scope,
      title: "Edit Scene",
      templateUrl: "scene-popup.html",

    }).then(function(res) {
      if (res) {
        // Write back the information to the original scene
        scope.original.Mirror = scope.scene.Mirror;
        for (var i = 0; i < scope.scene.Channels.length; i++) {
          scope.original.Channels[i] = scope.scene.Channels[i];
        }
      }
      scope.$destroy();
    });
  };

  $scope.initialize = function() {
    if ($stateParams.id) {
      if (isNaN($stateParams.id)) {
        $scope.Chaser = new Chaser();
        $scope.Chaser.read($stateParams.id)
        .then(function(response) {
          $scope.IsController = true;

        }).catch(function(error) {
          console.log("Couldn't read chaser:");
          console.log(JSON.stringify(error));

          Toast.showLongBottom(error.message);
          $scope.doBack();

        });

      } else {
        $scope.Chaser = LightsService.getChaser($stateParams.id);

      }

    } else {
      $scope.Chaser = new Chaser();
      $scope.IsNew = true;
    }
  };

  $scope.initialize();
})

// EditSceneCtrl: The controller for adding/editing scenes
.controller("EditSceneCtrl", function($scope, $rootScope, $timeout, $window, $ionicHistory, $ionicPopup, $stateParams, LightsService, Scene, Toast) {
  $scope.Scene = {};

  $scope.IsNew = false;

  $scope.Intensity = {Value: 0}; // Needs to be wrapped in an object

  $scope.setLevelTimeout = null;

  // Raised when a channel changes
  $scope.onChannelChange = function() {
    $timeout(function() {
      $scope.setLevels();
    });
  };

  // Raised when the intensity slider value is changed
  $scope.onIntensityChange = function(value) {
    LightsService.saveIntensity(value);

    // Also need to broadcast that the intensity has changed
    $rootScope.$broadcast("intensity-changed", value);

    $scope.setLevels();
  };

  $scope.doBack = function() {
    $ionicHistory.goBack();
  };

  $scope.doSave = function() {
    LightsService.saveScene($scope.Scene);
    $rootScope.$broadcast("scenes-changed", $scope.Scene);
    $ionicHistory.goBack();
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      $window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = $window.setTimeout(function () {
      $scope.setLevelTimout = null;

      $scope.Scene.writeLevels($scope.Intensity.Value)
      .then(function(response) {
        console.log("Set levels successfuly:");
        console.log(JSON.stringify(response));
        Toast.showLongBottom("Lights have been set");

      }).catch(function(error) {
        console.log("Couldn't write levels:");
        console.log(JSON.stringify(error));

        $scope.SelectedSceneID = null;
        Toast.showLongBottom(error.message);
      });
    }, 100);
  };

  $scope.initialize = function() {
    // Fetch the previous settings from localstorage
    $scope.Intensity.Value = LightsService.getIntensity();

    if ($stateParams.id) {
      $scope.Scene = LightsService.getScene($stateParams.id);
    } else {
      $scope.Scene = new Scene();
      $scope.IsNew = true;
    }
  };

  $scope.initialize();
})

// MainCtrl: The controller used for displaying all the scenes
.controller("MainCtrl", function($scope, $rootScope, $timeout, $window, $ionicModal, $ionicPopover, $ionicPopup, Chaser, Scene, LightsService, TCPClient, Toast) {
  $scope.Presets = ["A", "B", "C"];

  // These are the scenes that are currently available
  $scope.Scenes = [];

  $scope.Chasers = [];

  $scope.Settings = {Host: "", Port: 8888, Timeout: 10000};

  $scope.Intensity = {Value: 0}; // Needs to be wrapped in an object

  $scope.SelectedSceneID = null;

  $scope.setLevelTimeout = null;

  // Create the settings modal that we will use later
  $ionicModal.fromTemplateUrl('templates/network-settings.html', {
    scope: $scope,
    animation: "slide-in-up",
    focusFirstInput: true
  }).then(function(modal) {
    $scope.settingsModal = modal;
  });

  $ionicPopover.fromTemplateUrl("menu-popover.html", {
    scope: $scope
  }).then(function(popover) {
    $scope.menuPopover = popover;
  });

  // Remove the settings dialog when cleaning up
  $scope.$on('$destroy', function() {
    $scope.settingsModal.remove();
    $scope.menuPopover.remove();
  });

  $rootScope.$on("chasers-changed", function(event, data) {
    $scope.reloadChasers();
  });

  $rootScope.$on("intensity-changed", function(event, data) {
    // Reload the intensity
    $timeout(function() {
      $scope.Intensity.Value = data;

    });
  });

  $rootScope.$on("scenes-changed", function(event, data) {
    $scope.SelectedSceneID = data.ID;
    $scope.reloadScenes(true);
  });

  $scope.onChaserClick = function(item) {
    var promise;
    if (item && item.write) {
      promise = item.write();

    } else if (typeof item === "string") {
      var client = new TCPClient({
        Logging: true
      });
      promise = client.send("LOAD", [0x30 + item.charCodeAt() - 65]);

    } else {
      return;

    }

    promise.then(function(response) {
      $scope.SelectedSceneID = null;
      Toast.showLongBottom("Chaser loaded");

    }).catch(function(error) {
      console.log("Couldn't load chaser:");
      console.log(JSON.stringify(error));

      Toast.showLongBottom(error.message);
    });
  };

  $scope.onSceneClick = function(item) {
    $scope.SelectedSceneID = item.ID;
    $scope.setLevels();
  };

  // Raised when the intensity slider value is changed
  $scope.onIntensityChange = function(value) {
    LightsService.saveIntensity(value);

    $scope.setLevels();
  };

  $scope.doDeleteChaser = function(item) {
    var popup = $ionicPopup.confirm({
      title: "Delete Chaser",
      template: "Are you sure you want to delete the Chaser '" + item.Name + "'?",
      okText: "Yes",
      cancelText: "No",
    });
    popup.then(function(res) {
      if (res) {
        LightsService.deleteChaser(item.ID);
        $scope.reloadChasers();
      }
    });
  };

  $scope.doDeleteScene = function(item) {
    var popup = $ionicPopup.confirm({
      title: "Delete Lighting Scheme",
      template: "Are you sure you want to delete the Light Scheme '" + item.Name + "'?",
      okText: "Yes",
      cancelText: "No",
    });
    popup.then(function(res) {
      if (res) {
        // Unset the selcted scene if it's the one we've deleted
        if ($scope.SelectedSceneID == item.ID)
          $scope.SelectedSceneID = null;

        LightsService.deleteScene(item.ID);

        // TODO: Implement unsetting the lights
        $scope.reloadScenes(true);
      }
    });
  };

  $scope.reloadChasers = function() {
    $scope.Chasers = LightsService.getChasers();
  };

  $scope.reloadScenes = function(setLevels) {
    $scope.Scenes = LightsService.getScenes();

    if (setLevels)
      $scope.setLevels();
  };

  $scope.setFadeInterval = function(interval) {
    var data = [
      (interval) & 0xff,
      (interval >> 8) & 0xff
      ];

    var client = new TCPClient({
      Logging: true
    });
    client.send("FADE", data)
    .then(function(response) {

    }).catch(function(error) {
      console.log("Couldn't set fade interval:");
      console.log(JSON.stringify(error));

      Toast.showLongBottom(error.message);
    });
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      $window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = $window.setTimeout(function () {
      $scope.setLevelTimout = null;

      var scene;
      if ($scope.SelectedSceneID !== null) {
        scene = LightsService.getScene($scope.SelectedSceneID);

        scene.writeLevels($scope.Intensity.Value)
        .then(function(response) {
          console.log("Set levels successfuly:");
          console.log(JSON.stringify(response));
          Toast.showLongBottom("Lights have been set");

        }).catch(function(error) {
          console.log("Couldn't write levels:");
          console.log(JSON.stringify(error));

          $scope.SelectedSceneID = null;
          Toast.showLongBottom(error.message);
        });
      }

    }, 100);
  };

  $scope.setSleepTimeout = function(timeout) {
    var data = [
      (timeout) & 0xff,
      (timeout >> 8) & 0xff,
      (timeout >> 16) & 0xff,
      (timeout >> 24) & 0xff
      ];

    var client = new TCPClient({
      Logging: true
    });
    client.send("SLEEP", data)
    .then(function(response) {

    }).catch(function(error) {
      console.log("Couldn't set sleep timeout:");
      console.log(JSON.stringify(error));

      Toast.showLongBottom(error.message);
    });
  };

  $scope.showFadeInterval = function(interval) {
    $scope.menuPopover.hide();

    if (interval) {
      var scope = $rootScope.$new(true);
      scope.data = {fadeInterval: interval};

      var popup = $ionicPopup.show({
        template: "<input type='number' min='250' max='10000' step='50' ng-model='data.fadeInterval'>",
        title: "Enter the fade interval",
        subTitle: "The number of milliseconds it takes for the lights to fade.",
        scope: scope,
        buttons: [
          {text: "Cancel"},
          {
            text: "Save",
            type: "button-positive",
            onTap: function(e) {
              if (!scope.data.fadeInterval) {
                e.preventDefault();
              } else {
                return scope.data.fadeInterval;
              }
            }
          }
        ]
      });

      popup.then(function(interval) {
        scope.$destroy();
        if (interval) {
          $scope.setFadeInterval(interval);
        }
      });

    } else {
      var client = new TCPClient({
        Logging: true
      });
      client.send("FADE", null)
      .then(function(response) {
        // Returns a uint16_t
        $scope.showFadeInterval((response.data[5] << 8) + response.data[4]);

      }).catch(function(error) {
        console.log("Couldn't get fade interval:");
        console.log(JSON.stringify(error));

        Toast.showLongBottom(error.message);
      });
    }
  };

  // Show the settings dialog
  $scope.showSettings = function() {
    $scope.menuPopover.hide();
    $scope.settingsModal.show();
  };

  $scope.showSelectChaser = function(button) {
    var scope = $rootScope.$new(true);
    scope.chasers = $scope.Chasers;
    scope.selected = {value: null};

    var popup = $ionicPopup.show({
      scope: scope,
      templateUrl: "chaser-popup.html",
      title: "Select a Chaser",
      buttons: [
        {text: "Cancel"},
        {
          text: "Use",
          type: "button-positive",
          onTap: function(e) {
            if (scope.selected.value) {
              // If there's a selected value, write
              scope.selected.value.write(button)
              .then(function(response) {
                popup.close();
                Toast.showLongBottom("Chaser has been written to Button " + button);

              }).catch(function(error) {
                console.log("Couldn't write chaser:");
                console.log(JSON.stringify(error));

                Toast.showLongBottom(error.message);

              });
            }

            // Don't allow the popup to close
            e.preventDefault();
          }
        }
      ]
    });

    popup.finally(function() {
      scope.$destroy();
    });
  };

  $scope.showSleepTimeout = function(timeout) {
    $scope.menuPopover.hide();

    if (timeout) {
      var scope = $rootScope.$new(true);
      scope.data = {time: new Date(timeout % 86400000)}; // Limit to one day

      var popup = $ionicPopup.show({
        template: "<input type='time' step='60' ng-model='data.time'>",
        title: "Enter the sleep timeout",
        subTitle: "The time after which the lights will automatically turn off.",
        scope: scope,
        buttons: [
          {text: "Cancel"},
          {
            text: "Save",
            type: "button-positive",
            onTap: function(e) {
              var sleepTimeout = scope.data.time.getTime();
              if (!sleepTimeout) {
                e.preventDefault();
              } else {
                return sleepTimeout;
              }
            }
          }
        ]
      });

      popup.then(function(timeout) {
        scope.$destroy();
        if (timeout) {
          $scope.setSleepTimeout(timeout);
        }
      });

    } else {
      var client = new TCPClient({
        Logging: true
      });
      client.send("SLEEP", null)
      .then(function(response) {
        // Returns a uint32_t
        $scope.showSleepTimeout((response.data[7] << 24) + (response.data[6] << 16) + (response.data[5] << 8) + response.data[4]);

      }).catch(function(error) {
        console.log("Couldn't get sleep interval:");
        console.log(JSON.stringify(error));

        Toast.showLongBottom(error.message);
      });
    }
  };

  $scope.showStatus = function(status) {
    $scope.menuPopover.hide();

    if (status && status.length) {
      var scope = $rootScope.$new(true);
      scope.status = status;

      var popup = $ionicPopup.alert({
        scope: scope,
        title: "Current Light Status",
        templateUrl: "status-popup.html"
      }).then(function() {
        scope.$destroy();
      });

    } else {
      var client = new TCPClient({
        Logging: true
      });
      client.send("STATUS", null)
      .then(function(response) {
        var status = [];
        for (var i = 4; i < response.data.length; i++) {
          status.push(response.data[i]);
        }
        $scope.showStatus(status);

      }).catch(function(error) {
        console.log("Couldn't get status:");
        console.log(JSON.stringify(error));

        Toast.showLongBottom(error.message);
      });
    }
  };

  $scope.showTemperature = function() {
    $scope.menuPopover.hide();

    var client = new TCPClient({
      Logging: true
    });
    client.send("TEMP", null)
    .then(function(response) {
      var message = "Controller temperature is ";
      for (var i = 4; i < response.data.length; i++) {
        message += String.fromCharCode(response.data[i]);
      }
      message += "°";
      Toast.showLongBottom(message);

    }).catch(function(error) {
      console.log("Couldn't get temperature:");
      console.log(JSON.stringify(error));

      Toast.showLongBottom(error.message);
    });
  };

  $scope.initialize = function() {
    // Fetch any saved scenes and chasers
    $scope.reloadScenes();
    $scope.reloadChasers();

    // Fetch the previous settings from localstorage
    $scope.Intensity.Value = LightsService.getIntensity();

    // The controller's TCP settings
    angular.extend($scope.Settings, JSON.parse($window.localStorage.getItem("settings") || "{}"));

    // If no host or port is set then prompt the user for the controller location
    if (!$scope.Settings.Host || !$scope.Settings.Port)
      $window.setTimeout($scope.showSettings, 250);
  };

  $scope.initialize();
})

// NetworkSettingsCtrl: The controller used for modifying the network settings
.controller("NetworkSettingsCtrl", function($scope, $window) {
  $scope.closeSettings = function() {
    $scope.settingsModal.hide();
  };

  $scope.doSave = function() {
    $window.localStorage.setItem("settings", JSON.stringify($scope.Settings));
    $scope.closeSettings();
  };
})

;
