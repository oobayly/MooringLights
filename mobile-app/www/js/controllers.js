angular.module("MooringLights.controllers", ["ngCordova", "MooringLights.services"])

// ChaserCtrl: The controller used for displaying all the chasers
.controller("ChaserCtrl", function($scope, $rootScope, $ionicModal, $ionicPopup, $cordovaToast, LightsService, Chaser, Channel) {
  // These are the chasers that are currently available
  $scope.Chasers = [];

  $scope.Settings = {Host: "", Port: 8888};

  $scope.Intensity = new Channel();

  $scope.SelectedChaserID = null;

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

  $rootScope.$on("chasers-changed", function(event, data) {
    $scope.reloadChasers();
  });

  $scope.onChaserClick = function(item) {
    $scope.SelectedChaserID = item.ID;
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
        // Unset the selcted chaser if it's the one we've deleted
        if ($scope.SelectedChaserID == item.ID)
          $scope.SelectedChaserID = null;

        LightsService.deleteChaser(item.ID);

        $scope.reloadChasers()
      }
    });
  }

  $scope.reloadChasers = function() {
    $scope.Chasers = LightsService.getChasers();
    $scope.setLevels();
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = window.setTimeout(function () {
      $scope.setLevelTimout = null;

      var chaser;
      if ($scope.SelectedChaserID) {
        chaser = LightsService.getChaser($scope.SelectedChaserID);
      } else {
        // If none is selected, then use an empty chaser to switch the lights off
        chaser = new Chaser();
      }

      chaser.writeLevels($scope.Intensity.Value,
        function(hasError) {
          if (hasError)
            $cordovaToast.show("An error occured while setting the levels.", "long", "bottom");
        },
        function(errorMessage, originalError) {
          console.log("Couldn't writeLevels: " + originalError || errorMessage);
          $cordovaToast.show(errorMessage, "long", "bottom");
          $scope.SelectedChaserID = null;
        }
      );
    }, 100);
  };

  // Show the settings dialog
  $scope.showSettings = function() {
    $scope.settingsModal.show();
  };

  $scope.initialize = function() {
    // Fetch any saved chasers
    $scope.reloadChasers();

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

// EditCtrl: The controller for adding/editing chasers
.controller("EditCtrl", function($scope, $rootScope, $ionicHistory, $ionicPopup, $stateParams, LightsService, Channel, Chaser) {
  $scope.Chaser = {};

  $scope.Channels = [];

  $scope.Intensity = new Channel({IsIntensity: true});

  $scope.setLevelTimeout = null;

  // Raised when the intensity slider value is changed
  $scope.onIntensityChanged = function(item) {
    localStorage.setItem("intensity", item.Value);

    $scope.setLevels();

    // Also need to broadcast that the intensity has changed
    $rootScope.$broadcast("intensity-changed", item);
  }

  // Raised when the intensity slider value is changed
  $scope.onChannelChanged = function(item) {
    $scope.Chaser.setChannels($scope.Channels);

    $scope.setLevels();
  }

  // Raised when the darker button is pressed
  $scope.onDownClicked = function(item) {
    item.incrementDown();

    if (item.IsIntensity) {
      $scope.onIntensityChanged(item)
    } else {
      $scope.onChannelChanged(item);
    }
  };

  // Raised when the brighter button is pressed
  $scope.onUpClicked = function(item) {
    item.incrementUp();

    if (item.IsIntensity) {
      $scope.onIntensityChanged(item)
    } else {
      $scope.onChannelChanged(item);
    }
  };

  $scope.doSave = function() {
    if (!$scope.Chaser.Name) {
      $ionicPopup.alert({
        title: "Validation error",
        template: "Please enter a name for the Lighting Scheme",
      });
      return;
    }

    LightsService.saveChaser($scope.Chaser);
    $rootScope.$broadcast("chasers-changed");
    $ionicHistory.goBack();
  };

  $scope.setLevels = function() {
    if ($scope.setLevelTimeout) {
      window.clearTimeout($scope.setLevelTimeout);
      $scope.setLevelTimeout = null;
    }

    $scope.setLevelTimeout = window.setTimeout(function () {
      $scope.setLevelTimout = null;

      $scope.Chaser.writeLevels($scope.Intensity.Value,
        function(hasError) {
          if (hasError)
            $cordovaToast.show("An error occured while setting the levels.", "long", "bottom");
        },
        function(errorMessage, originalError) {
          console.log("Couldn't writeLevels: " + originalError || errorMessage);
          $cordovaToast.show(errorMessage, "long", "bottom");
          $scope.SelectedChaserID = null;
        }
      );
    }, 100);
  };

  $scope.onMirrorChanged = function() {
    // Fetch the correct number of channels
    $scope.Channels = $scope.Chaser.getChannels();

    // And re-write them
    $scope.onChannelChanged();
  };

  $scope.initialize = function() {
    if ($stateParams.id) {
      $scope.Chaser = LightsService.getChaser($stateParams.id);
    } else {
      $scope.Chaser = new Chaser();
    }

    $scope.onMirrorChanged();

    // Fetch the previous settings from localstorage
    $scope.Intensity.Value = parseInt(localStorage.getItem("intensity") || "0");
  };

  $scope.initialize();
})

;
