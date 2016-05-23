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
    controller: "SceneCtrl",
    templateUrl: "templates/scenes.html",
  })

  .state('add', {
    url: "/add/",
    controller: 'EditCtrl',
    templateUrl: "templates/edit.html",
  })

  .state('edit', {
    url: "/edit/:id",
    controller: 'EditCtrl',
    templateUrl: "templates/edit.html",
  })

  ;

  $urlRouterProvider.otherwise('/app');

})
;
