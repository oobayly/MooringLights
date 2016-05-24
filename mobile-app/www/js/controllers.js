angular.module("MooringLights.controllers", ["ngCordova", "MooringLights.services"])

// SceneCtrl: The controller used for displaying all the scenes
.controller("SceneCtrl", function($scope, $rootScope, $ionicModal, $ionicPopover, $ionicPopup, $cordovaToast, LightsService, Scene, Channel, TCPClient) {
  // These are the scenes that are currently available
  $scope.Scenes = [];

  $scope.Settings = {Host: "", Port: 8888};

  $scope.Intensity = new Channel();

  $scope.SelectedSceneID = null;

  $scope.setLevelTimeout = null;

  // Create the settings modal that we will use later
  $ionicModal.fromTemplateUrl('templates/settings.html', {
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

  $rootScope.$on("intensity-changed", function(event, data) {
    // Reload the intensity
    $scope.Intensity.Value = data.Value;
  });

  $rootScope.$on("scenes-changed", function(event, data) {
    $scope.reloadScenes();
  });

  $scope.onSceneClick = function(item) {
    $scope.SelectedSceneID = item.ID;
    $scope.setLevels();
  };

  // Raised when the intensity slider value is changed
  $scope.onIntensityChanged = function(item) {
    $scope.setLevels();

    localStorage.setItem("intensity", item.Value);
  }

  // Raised when the darker button is pressed
  $scope.onDownClicked = function(item) {
    item.incrementDown();
    $scope.onIntensityChanged(item)
  };

  // Raised when the brighter button is pressed
  $scope.onUpClicked = function(item) {
    item.incrementUp();
    $scope.onIntensityChanged(item)
  };

  $scope.doDelete = function(item) {
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

        $scope.reloadScenes();
      }
    });
  };

  $scope.reloadScenes = function() {
    $scope.Scenes = LightsService.getScenes();
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

      $cordovaToast.showLongBottom(error.message);
    });
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = window.setTimeout(function () {
      $scope.setLevelTimout = null;

      var scene;
      if ($scope.SelectedSceneID) {
        scene = LightsService.getScene($scope.SelectedSceneID);
      } else {
        // If none is selected, then use an empty scene to switch the lights off
        scene = new Scene();
      }

      scene.writeLevels($scope.Intensity.Value)
      .then(function(response) {
        console.log("Set levels successfuly:");
        console.log(JSON.stringify(response));
        $cordovaToast.showLongBottom("Lights have been set");

      }).catch(function(error) {
        console.log("Couldn't write levels:");
        console.log(JSON.stringify(error));

        $scope.SelectedSceneID = null;
        $cordovaToast.showLongBottom(error.message);
      });

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

      $cordovaToast.showLongBottom(error.message);
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

        $cordovaToast.showLongBottom(error.message);
      });
    }
  };

  // Show the settings dialog
  $scope.showSettings = function() {
    $scope.menuPopover.hide();
    $scope.settingsModal.show();
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

        $cordovaToast.showLongBottom(error.message);
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
      message += "°"
      $cordovaToast.showLongBottom(message);

    }).catch(function(error) {
      console.log("Couldn't get temperature:");
      console.log(JSON.stringify(error));

      $cordovaToast.showLongBottom(error.message);
    })
  }

  $scope.initialize = function() {
    // Fetch any saved scenes
    $scope.reloadScenes();

    // Fetch the previous settings from localstorage
    $scope.Intensity.Value = parseInt(localStorage.getItem("intensity") || "0");

    // The controller's TCP settings
    angular.extend($scope.Settings, JSON.parse(localStorage.getItem("settings") || "{}"));

    // If no host or port is set then prompt the user for the controller location
    if (!$scope.Settings.Host || !$scope.Settings.Port)
      window.setTimeout($scope.showSettings, 250);
  };

  $scope.initialize();
})

// Settings Control
.controller("SettingsCtrl", function($scope) {
  $scope.closeSettings = function() {
    $scope.settingsModal.hide();
  };

  $scope.doSave = function() {
    localStorage.setItem("settings", JSON.stringify($scope.Settings));
    $scope.closeSettings();
  };
})

// EditCtrl: The controller for adding/editing scenes
.controller("EditCtrl", function($scope, $rootScope, $ionicHistory, $ionicPopup, $stateParams, LightsService, Channel, Scene) {
  $scope.Scene = {};

  $scope.IsNew = false;

  $scope.Intensity = new Channel({IsIntensity: true});

  $scope.setLevelTimeout = null;

  // Raised when the intensity slider value is changed
  $scope.onChannelChanged = function(index, item) {
    if ($scope.Scene.Mirror) {
      $scope.Scene.Channels[$scope.Scene.Channels.length - 1 - index].Value = $scope.Scene.Channels[index].Value;
    }

    $scope.setLevels();
  }

  // Raised when the intensity slider value is changed
  $scope.onIntensityChanged = function(item) {
    localStorage.setItem("intensity", item.Value);

    $scope.setLevels();

    // Also need to broadcast that the intensity has changed
    $rootScope.$broadcast("intensity-changed", item);
  }

  // Raised when the darker button is pressed
  $scope.onDownClicked = function(index, item) {
    item.incrementDown();

    if (item.IsIntensity) {
      $scope.onIntensityChanged(item)
    } else {
      $scope.onChannelChanged(index, item);
    }
  };

  $scope.onMirrorChanged = function() {
    if ($scope.Scene.Mirror) {
      // Make sure the values are mirrored
      for (var i = 0; i < $scope.Scene.Channels.length / 2; i++) {
        $scope.Scene.Channels[$scope.Scene.Channels.length - 1 - i].Value = $scope.Scene.Channels[i].Value;
      }
    }
  };

  // Raised when the brighter button is pressed
  $scope.onUpClicked = function(index, item) {
    item.incrementUp();

    if (item.IsIntensity) {
      $scope.onIntensityChanged(item)
    } else {
      $scope.onChannelChanged(index, item);
    }
  };

  $scope.doSave = function() {
    if (!$scope.Scene.Name) {
      $ionicPopup.alert({
        title: "Validation error",
        template: "Please enter a name for the Lighting Scheme",
      });
      return;
    }

    LightsService.saveScene($scope.Scene);
    $rootScope.$broadcast("scenes-changed");
    $ionicHistory.goBack();
  };

  $scope.getChannels = function() {
    if (!$scope.Scene)
      return null;

    if ($scope.Scene.Mirror) {
      return $scope.Scene.Channels.slice(0, $scope.Scene.Channels.length / 2);
    } else {
      return $scope.Scene.Channels;
    }
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = window.setTimeout(function () {
      $scope.setLevelTimout = null;

      $scope.Scene.writeLevels($scope.Intensity.Value,
        function(hasError) {
          if (hasError) {
            $cordovaToast.showLongBottom("An error occured while setting the lights");
          } else {
            $cordovaToast.showLongBottom("Lights have been set");
          }
        },
        function(errorMessage, originalError) {
          console.log("Couldn't writeLevels: " + originalError || errorMessage);
          $cordovaToast.showLongBottom(errorMessage);
          $scope.SelectedSceneID = null;
        }
      );
    }, 100);
  };

  $scope.initialize = function() {
    if ($stateParams.id) {
      $scope.Scene = LightsService.getScene($stateParams.id);
    } else {
      $scope.Scene = new Scene();
      $scope.IsNew = true;
    }

    $scope.onMirrorChanged();

    // Fetch the previous settings from localstorage
    $scope.Intensity.Value = parseInt(localStorage.getItem("intensity") || "0");
  };

  $scope.initialize();
})

;
