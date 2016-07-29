(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('NavCtrl', NavCtrl);

  NavCtrl.$inject = ['$auth','UserService','toastr'];
  function NavCtrl($auth, UserService) {
    var vm = this;
    vm.initialise = initialise;
    vm.isAuthenticated = isAuthenticated;
    /////////////////////////////
    
    function initialise() {
      console.log("navigation controller");
      UserService.getProfile()
      .then(function(response){
        vm.profile = response.data;
      })
      .catch(function(error){
        toastr.clear();
        toastr.error(error);
      })
    }

    vm.initialise();


    function isAuthenticated() {
      return $auth.isAuthenticated();
    };
    
    
  }
})();
