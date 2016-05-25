/* globals angular: false */
/* globals console: false */

angular.module("MooringLights.directives", [])

.directive("lights", function() {
  return {
    restrict: "E",
    replace: false,
    template: '<span><i class="icon ion-ios-sunny" style="opacity: {{channel / 255}}" ng-repeat="channel in value track by $index"></i></span>',

    link: function($scope) {

    },

    scope: {
      value: "="
    }
  };
})

.directive("lightSlider", function() {
  return {
    restrict: "E",
    replace: false,
    templateUrl: "templates/light-slider.html",

    link: function($scope) {
      // Need to wrap the value in an object for binding to the range
      $scope.data = {value: $scope.value};

      $scope.step = parseInt($scope.step || "32");

      $scope.$watch("value", function(newValue, oldValue) {
        if ($scope.debug)
          console.log("Value changed from " + oldValue + " to " + newValue);
        if (newValue !== $scope.data.value)
          $scope.data.value = parseInt($scope.value);
      });

      $scope.onSlide = function() {
        $scope.onValueChanged();
      };

      $scope.onDownClicked = function() {
        $scope.doStep(-$scope.step);
      };

      $scope.onUpClicked = function() {
        $scope.doStep($scope.step);
      };

      $scope.doStep = function(step) {
        var newValue = parseInt($scope.value) + parseInt(step);
        newValue = $scope.step * Math.round(newValue / $scope.step);

        if (newValue < 0) {
          newValue = 0;
        } else if (newValue > 255) {
          newValue = 255;
        }

        $scope.data.value = newValue;

        $scope.onValueChanged();
      };

      $scope.onValueChanged = function() {
        $scope.value = $scope.data.value;

        if ($scope.onChange)
          $scope.onChange({value: $scope.value});
      };
    },

    scope: {
      debug: "@",
      value: "=",
      step: "@",
      onChange: "&"
    },
  };
})

;
