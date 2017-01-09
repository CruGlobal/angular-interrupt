;(function () {
  'use strict';

  angular.module('interrupt', ['ui.bootstrap.dialog', 'ngCookies', 'ngResource', 'easyXdm'])
    .controller('interrupt', ['$scope', '$log', '$dialog', '$cookies', 'interruptService',
      function (scope, log, dialog, cookies, interruptService) {

        var cookieName = 'doNotInterruptForNow';

        var interruptConfigurations = [
          {
            interruptType: 'sra',
            modal: createModalDialog(window.relativeFragmentsRoot + '/sra-modal.html'),
            //in UCM: window.relativeFragmentsRoot + 'frag_sw_assets/piu-intercept/affirmation.html'
            modalClass: 'sra',
            handleResult: buildAgreementResultHandler('sra')
          },
          {
            interruptType: 'credit-card-security-policy',
            modal: createModalDialog(window.relativeFragmentsRoot + '/cc-modal.html'),
            //in UCM: window.relativeFragmentsRoot + 'frag_sw_assets/piu-intercept/affirmation-cc.html'
            modalClass: 'sra', // same styling as the sra window
            handleResult: buildAgreementResultHandler('credit-card-security-policy')
          },
          {
            interruptType: 'piu',
            modal: createModalDialog(window.relativeFragmentsRoot + '/piu-modal.html'),
            //in UCM: window.relativeFragmentsRoot + 'frag_sw_assets/piu-intercept/modal.html'
            modalClass: 'piu',
            handleResult: function (result) {
              setDoNotInterruptCookie();
            }
          }
        ];

        function createModalDialog(templateUrl) {
          return dialog.dialog({
            backdrop: true,
            backdropFade: true,
            dialogFade: true,
            keyboard: false,
            backdropClick: false,
            controller: 'modal',
            templateUrl: templateUrl
          });
        }

        function buildAgreementResultHandler(interruptType) {
          return function(result) {
            interruptService.updateAgreementStatus(interruptType, result)
              .then(function (successResponse) {
                setDoNotInterruptCookie();
              }, handleFailedInterrupt);
          }
        }

        function setDoNotInterruptCookie() {
          //note: we cannot simply do this:
          //  cookies[cookieName] = 'y';
          //because this sets a session cookie, and Chrome and FF no longer flush session cookies on browser restarts;
          //the end result is the doNotInterruptForNow cookie remains effective way longer than we intend it to be.
          //So, we set a cookie the manual way whose expiration is a short time in the future.
          var expiration = tomorrow();
          document.cookie = cookieName + '=y; ' +
            'expires='+expiration.toUTCString() + '; ' +
            'path=/'
        }

        function tomorrow() {
          var today = new Date();
          var tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          return tomorrow;
        }

        function handleFailedInterrupt(error){
          log.error(error);
          setDoNotInterruptCookie();
          alert(
            "We apologize, but an error occurred we weren't able to save your selection. " +
              "We won't interrupt you further today from this browser, but please \n" +
              "(1) try this again in a different browser, and \n" +
              "(2) contact techhelp@cru.org to notify us of the problem. \n" +
              "Thank you, and sorry for the headache!");
        }

        if (_.isUndefined(cookies[cookieName])) {
          performInterruptIfNecessary();
        }

        function performInterruptIfNecessary() {
          var nextInterruptStep = setDoNotInterruptCookie;
          for (var i = interruptConfigurations.length - 1; i >= 0; i--) {
            var configuration = interruptConfigurations[i];
            nextInterruptStep = buildInterruptStep(configuration, nextInterruptStep);
          }

          nextInterruptStep();
        }

        function buildInterruptStep(configuration, nextInterruptStep) {
          return function () {
            interruptService.isInterruptRequired(configuration.interruptType)
              .then(function (interruptIsRequired) {
                if (interruptIsRequired) {
                  configuration.modal.open().then(configuration.handleResult, handleFailedInterrupt);
                  addClassToModalDivWhenAvailable('div.modal', configuration.modalClass);
                }
                else {
                  nextInterruptStep();
                }
              });
          }
        }

        function addClassToModalDivWhenAvailable(divSelector, className)
        {
          var childDiv = jQuery(divSelector);
          if (childDiv.length)
          {
            childDiv.closest('div.modal').addClass(className);
          }
          else
          {
            setTimeout(function(){
                addClassToModalDivWhenAvailable(divSelector, className);
            }, 10);
          }

        }

      }
    ])
    .controller('modal', ['$scope', 'dialog',
      function (scope, dialog) {

        scope.close = function (result) {
          dialog.close(result);
        }

      }
    ])
    .service('mockInterruptService', ['$q', '$log',
      function (q, log) {

        function promise(value) {
          var deferred = q.defer();
          deferred.resolve(value);
          return deferred.promise;
        }

        return {

          isInterruptRequired: function (interruptType) {
            if (location.search.indexOf(interruptType) >= 0) {
              return promise(true);
            } else {
              return promise(false);
            }
          },

          updateAgreementStatus: function(interruptType, status) {
            log.info("updating agreement status: ", interruptType, status);
            return promise("ok");
          }
        }
      }
    ])
    .service('interruptService', ['EasyXdm', '$rootScope',
      function (easyXdm, $rootScope) {
        return {

          /* interruptType: piu or sra or credit-card-security-policy */
          isInterruptRequired: function (interruptType) {
            var path = '/wsapi/rest/staffwebinterruptrequired?popuptype=' + interruptType;
            return easyXdm.fetch($rootScope, path);
          },

          /* only for sra and credit-card-security-policy */
          updateAgreementStatus: function(interruptType, status) {
            var subpath;
            if (interruptType === 'sra') {
              subpath = 'sraupdate';
            } else if (interruptType == 'credit-card-security-policy') {
              subpath = 'credit-card-security-policy-update';
            } else {
              throw "bad interruptType: " + interruptType;
            }

            var path = '/wsapi/rest/staffwebinterruptrequired/' + subpath;
            return easyXdm.fetch($rootScope, path, 'POST', {status: status});
          }
        }
      }
    ])

})();


/**
 * to be used by embedded frames in a modals that need to close the
 * modal. (at the moment, the PIU interrupt is the only one in this category)
 */
function dismissInterruptModal()
{
    angular.element('.modal').scope().close();
}
