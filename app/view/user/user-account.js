'use strict';

angular.module('myApp.view.user', [
    'ngRoute',
    'myApp.user',
])

    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/user', {
                templateUrl: 'view/user/user-account.html',
                controller: 'UserAccountController'
            });
    }])

    .controller('UserAccountController', ['$scope', 'userManager', function ($scope, userManager) {
        $scope.user = userManager.getCurrentUser();
        $scope.save = function () {
            $scope.user.update();
        }

        $scope.changePassword = function () {
            if (!$scope.formPasswordChange.$valid) {
                return;
            }
            if ($scope.newPassword == "" || $scope.newPassword != $scope.newPassword2) {
                alert("The password in the new password and the verification field must be identical.");
                return;
            }

            userManager.changePassword($scope.user, $scope.newPassword).then(
                function (response) {
                    alert("Password sucessfully changed");
                },
                function (err) {
                    alert("Could not change the password. Please check the error log or try again.");
                }
            );
        };
    }]);

