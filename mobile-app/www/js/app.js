angular.module('MooringLights', ["ionic", "MooringLights.controllers"])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('app', {
    url: "/app",
    controller: "MainCtrl",
    templateUrl: "templates/scenes.html",
  })

  .state('add-scene', {
    url: "/scene/add/",
    controller: 'EditSceneCtrl',
    templateUrl: "templates/edit.html",
  })

  .state('edit-scene', {
    url: "/scene/edit/:id",
    controller: 'EditSceneCtrl',
    templateUrl: "templates/edit.html",
  })

  ;

  $urlRouterProvider.otherwise('/app');

})
;
