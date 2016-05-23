angular.module("MooringLights.controllers", ["ngCordova", "MooringLights.services"])

// SceneCtrl: The controller used for displaying all the scenes
.controller("SceneCtrl", function($scope, $rootScope, $ionicModal, $ionicPopup, $cordovaToast, LightsService, Scene, Channel) {
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

  // Remove the settings dialog when cleaning up
  $scope.$on('$destroy', function() {
    $scope.settingsModal.remove();
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
      .then(function(data) {
        console.log("Set levels successfuly:");
        console.log(JSON.stringify(data));

      }).catch(function(error) {
        console.log("Couldn't write levels:");
        console.log(JSON.stringify(error));

        $scope.SelectedSceneID = null;
        $cordovaToast.show(error.message, "long", "bottom");
      });

    }, 100);
  };

  // Show the settings dialog
  $scope.showSettings = function() {
    $scope.settingsModal.show();
  };

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
          if (hasError)
            $cordovaToast.show("An error occured while setting the levels.", "long", "bottom");
        },
        function(errorMessage, originalError) {
          console.log("Couldn't writeLevels: " + originalError || errorMessage);
          $cordovaToast.show(errorMessage, "long", "bottom");
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
