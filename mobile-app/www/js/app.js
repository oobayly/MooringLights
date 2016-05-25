/* globals angular: false */
/* globals console: false */
/* globals window: false */

angular.module('MooringLights', ["ionic", "MooringLights.controllers"])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      window.cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      window.StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('app', {
    url: "/app",
    controller: "MainCtrl",
    templateUrl: "templates/main.html",
  })

  .state('add-scene', {
    url: "/scene/add/",
    controller: 'EditSceneCtrl',
    templateUrl: "templates/edit-scene.html",
  })

  .state('add-chaser', {
    url: "/chaser/add/",
    controller: 'EditChaserCtrl',
    templateUrl: "templates/edit-chaser.html",
  })

  .state('edit-scene', {
    url: "/scene/edit/:id",
    controller: 'EditSceneCtrl',
    templateUrl: "templates/edit-scene.html",
  })

  .state('edit-chaser', {
    url: "/chaser/edit/:id",
    controller: 'EditChaserCtrl',
    templateUrl: "templates/edit-chaser.html",
  })

  ;

  $urlRouterProvider.otherwise('/app');

})
;
