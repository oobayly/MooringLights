/* globals angular: false */
/* globals console: false */

angular.module("MooringLights.controllers", ["ngCordova", "MooringLights.services"])

// EditChaserCtrl: The controller used for adding/editing chasers
.controller("EditChaserCtrl", function($scope, $rootScope, $window, $ionicHistory, $ionicPopup, $stateParams, Chaser, LightsService, Scene, Toast) {
  $scope.Chaser = {};

  $scope.Scenes = [];

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
        $ionicHistory.goBack();
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

  $scope.showSelectScene = function(scene) {
    var scope = $rootScope.$new(true);
    scope.scenes = $scope.Scenes;
    scope.selected = {value: null};

    var popup = $ionicPopup.show({
      scope: scope,
      templateUrl: "select-scene-popup.html",
      title: "Select a Scene",
      buttons: [
        {text: "Cancel"},
        {
          text: "Use",
          type: "button-positive",
          onTap: function(e) {
            if (scope.selected.value) {
              scene.Mirror = scope.selected.value.Mirror;
              for (var i = 0; i < scene.Channels.length; i++) {
                scene.Channels[i] = scope.selected.value.Channels[i];
              }
              popup.close();
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

  $scope.initialize = function() {
    $scope.Scenes = LightsService.getScenes();

    if ($stateParams.id) {
      if (isNaN($stateParams.id)) {
        $scope.Chaser = new Chaser();
        $scope.Chaser.read($stateParams.id)
        .then(function(response) {
          $scope.IsController = true;

        }).catch(function() {
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
      $scope.Scene.write($scope.Intensity.Value);
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
      var chaser = new Chaser();
      promise = chaser.load(item);

    } else {
      return;

    }

    promise.then(function(response) {
      $scope.SelectedSceneID = null;
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

        scene.write($scope.Intensity.Value)
        .catch(function(error) {
          $scope.SelectedSceneID = null;
        });
      }

    }, 100);
  };

  $scope.showFadeInterval = function(interval) {
    $scope.menuPopover.hide();

    if (interval) {
      var scope = $rootScope.$new(true);
      scope.data = {fadeInterval: interval};

      var popup = $ionicPopup.show({
        template: "<input type='number' min='200' max='10000' step='100' ng-model='data.fadeInterval'>",
        title: "Enter the fade interval",
        subTitle: "The number of milliseconds it takes for the lights to fade.",
        scope: scope,
        buttons: [
          {text: "Cancel"},
          {
            text: "Save",
            type: "button-positive",
            onTap: function(e) {
              if (scope.data.fadeInterval) {
                LightsService.setFade(scope.data.fadeInterval)
                .then(function() {
                  popup.close();
                });
              }

              e.preventDefault();
            }
          }
        ]
      });

      popup.finally(function() {
        scope.$destroy();
      });

    } else {
      LightsService.getFade()
      .then(function(value) {
        $scope.showFadeInterval(value);
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
      templateUrl: "select-chaser-popup.html",
      title: "Select a Chaser",
      buttons: [
        {text: "Cancel"},
        {
          text: "Use",
          type: "button-positive",
          onTap: function(e) {
            if (scope.selected.value) {
              // If there's a selected value, write it and only close when it succeeds
              scope.selected.value.write(button)
              .then(function(response) {
                popup.close();
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
              if (sleepTimeout) {
                LightsService.setSleep(sleepTimeout)
                .then(function() {
                  popup.close();
                });
              }

              e.preventDefault();
            }
          }
        ]
      });

      popup.finally(function() {
        scope.$destroy();
      });

    } else {
      LightsService.getFade()
      .then(function(value) {
        $scope.showSleepTimeout(value);
      });
    }
  };

  $scope.showStatus = function(current) {
    $scope.menuPopover.hide();

    if (current) {
      var scope = $rootScope.$new(true);
      scope.current = current;

      var popup = $ionicPopup.alert({
        scope: scope,
        title: "Current Light Status",
        templateUrl: "status-popup.html"
      }).then(function() {
        scope.$destroy();
      });

    } else {
      var scene = new Scene();
      scene.read()
      .then(function(scene) {
        $scope.showStatus(scene);
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
