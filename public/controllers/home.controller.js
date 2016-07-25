(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('HomeCtrl', HomeCtrl);

  //HomeCtrl.$inject = ['HomeService'];
  function HomeCtrl() {
    var vm = this;
    
    vm.initialise = initialise;
      
    /////////////////////////////
    
    function initialise() {
      console.log("Home controller");
    }

    vm.initialise();
    
    
  }
})();
