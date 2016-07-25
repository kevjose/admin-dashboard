(function() {
  'use strict';

  angular
    .module('MyApp')
    .controller('DashboardCtrl', DashboardCtrl);

  //DashboardCtrl.$inject = ['DashboardService'];
  function DashboardCtrl() {
    var vm = this;
    
    vm.initialise = initialise;
      
    /////////////////////////////
    
    function initialise() {
      console.log("dashboard controller");
    }

    vm.initialise();
    
    
  }
})();
