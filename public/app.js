angular.module('MyApp', ['ngMessages', 'ngAnimate', 'toastr', 'ui.router', 'satellizer', 'ui.bootstrap', 'ngTagsInput' ])

.config(function ($stateProvider, $urlRouterProvider,$authProvider) {
  $stateProvider
    .state('home', {
      url: '/',
      templateUrl: 'partials/home.partial.html',
      controller: 'HomeCtrl',
      controllerAs:'vm',
      resolve: {
        skipIfLoggedIn: skipIfLoggedIn
      }
    })
    .state('dashboard', {
      url: '/dashboard',
      templateUrl: 'partials/dashboard.partial.html',
      controller: 'DashboardCtrl',
      controllerAs:'dash',
      abstract: true,
      resolve: {
          loginRequired: loginRequired
      }
    })
    .state('logout', {
      url: '/logout',
      template: null,
      controller: 'LogoutCtrl'
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
  $authProvider.linkedin({
    clientId: '75mrewllpu6ps1'
  });
   

  function skipIfLoggedIn($q, $auth, $location) {
    var deferred = $q.defer();
    if ($auth.isAuthenticated()) {
      $location.path('/dashboard/profile');
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
      $location.path('/');
    }
    return deferred.promise;
  }
})

