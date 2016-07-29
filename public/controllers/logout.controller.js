(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('LogoutCtrl', LogoutCtrl);

  LogoutCtrl.$inject = ['$auth','$location','toastr'];
  function LogoutCtrl($auth, $location, toastr) {
    var vm = this;
    
    vm.initialise = initialise;
      
    /////////////////////////////
    
    function initialise() {
      console.log("logout controller");
      if (!$auth.isAuthenticated()) {
        return;
      }
      $auth
        .logout()
        .then(function () {
          toastr.clear();
          toastr.info('You have been logged out');
          $location.path('/');
        });
    }

    vm.initialise();
    
    
  }
})();
