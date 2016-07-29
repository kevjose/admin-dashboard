(function() {
'use strict';

  angular
      .module('MyApp')
      .factory('UserService', UserService);

  UserService.$inject = ['$http'];
  function UserService($http) {
    return {
      getProfile: function() {
        return $http.get('/api/me');
      },
      getUsers: function() {
        return $http.get('/api/user/all');
      },
      updateRole: function(data){
        return $http.put('/api/user', data);
      },
      updateLoginCount: function(data){
        return $http.put('/api/user/count', data);
      }
    };
  }
})();