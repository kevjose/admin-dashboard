angular.module('MyApp', ['ngMessages', 'ngAnimate', 'toastr', 'ui.router', 'satellizer', 'ui.bootstrap', 'ngTagsInput' ])

.config(function ($stateProvider, $urlRouterProvider,$locationProvider,$authProvider) {
  $stateProvider
    .state('home', {
      url: '/',
      templateUrl: 'partials/home.partial.html',
      controller: 'HomeCtrl',
      controllerAs:'vm'
    })
    .state('dashboard', {
      url: '/dashboard',
      templateUrl: 'partials/dashboard.partial.html',
      controller: 'DashboardCtrl',
      abstract: true,
    })
    .state('dashboard.profile', {
      url: '/profile',

      views: {
        'dashboardContent': {
          templateUrl: 'partials/profile.partial.html',
          controller: 'ProfileCtrl',
          controllerAs: 'vm'
        }
      }
    });

  $urlRouterProvider.otherwise('/');
  //$locationProvider.html5Mode(true);

   

  function skipIfLoggedIn($q, $auth) {
    var deferred = $q.defer();
    if ($auth.isAuthenticated()) {
      deferred.reject();
    } else {
      deferred.resolve();
    }
    return deferred.promise;
  }

  function loginRequired($q, $location, $auth) {
    var deferred = $q.defer();
    if ($auth.isAuthenticated()) {
      deferred.resolve();
    } else {
      $location.path('/login');
    }
    return deferred.promise;
  }
})

