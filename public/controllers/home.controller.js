(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('HomeCtrl', HomeCtrl);

  HomeCtrl.$inject = ['$auth','toastr','UserService','$location'];
  function HomeCtrl($auth, toastr, UserService, $location) {
    var vm = this;
    
    vm.initialise = initialise;
    vm.isAuthenticated = isAuthenticated;
    vm.authenticate = authenticate;
      
    /////////////////////////////
    
    function initialise() {
      console.log("Home controller");
    }

    vm.initialise();

    function isAuthenticated() {
      return $auth.isAuthenticated();
    };

    function authenticate(provider) {
      $auth.authenticate(provider)
      .then(function (response) {
        toastr.clear();
        toastr.success('You have successfully signed in with ' + provider);
        if(!response.data.loginCount){
          response.data.loginCount =0 ;
        }
        var count = response.data.loginCount+ 1; 
        localStorage.setItem("count",count);
        UserService.updateLoginCount({'loginCount': count})
        .then(function(response){
          $location.path('/dashboard/profile');
        })
        .catch(function(error){
          toastr.clear();
          toastr.error(error);  
        })
      })
      .catch(function (response) {
        toastr.clear();
        toastr.error(response.data.message);
      });
    };
    
    
  }
})();
