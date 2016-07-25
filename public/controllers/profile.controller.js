(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('ProfileCtrl', ProfileCtrl);

  //ProfileCtrl.$inject = ['ProfileService'];
  function ProfileCtrl() {
    var vm = this;
    
    vm.initialise = initialise;
      
    /////////////////////////////
    
    function initialise() {
      console.log("profile controller");
    }
    
    vm.initialise();
    
  }
})();
