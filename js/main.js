;(function () {
  'use strict';

  angular.module('interrupt', ['ui.bootstrap.dialog', 'ngCookies', 'ngResource', 'easyXdm'])
    .controller('interrupt', ['$scope', '$log', '$dialog', '$cookies', 'sraInterrupt', 'piuInterrupt', 'sraUpdate',
      function (scope, log, dialog, cookies, sraInterrupt, piuInterrupt, sraUpdate) {

        var sraOptions = {
          backdrop: true,
          backdropFade: true,
          dialogFade: true,
          keyboard: false,
          backdropClick: false,
          controller: 'modal',
          templateUrl: window.relativeFragmentsRoot + '/sra-modal.html'  //in UCM: window.relativeFragmentsRoot + 'frag_sw_assets/piu-intercept/affirmation.html'
        }
        var piuOptions = {
          backdrop: true,
          backdropFade: true,
          dialogFade: true,
          keyboard: false,
          backdropClick: false,
          controller: 'modal',
          templateUrl: window.relativeFragmentsRoot + '/piu-modal.html'  //in UCM: window.relativeFragmentsRoot + 'frag_sw_assets/piu-intercept/modal.html'
        }

        var sra = dialog.dialog(sraOptions);
        var piu = dialog.dialog(piuOptions);

        var cookieName = 'doNotInterruptForNow';

        function setDoNotInterruptCookie() {
          //note: we cannot simply do this:
          //  cookies[cookieName] = 'y';
          //because this sets a session cookie, and Chrome and FF no longer flush session cookies on browser restarts;
          //the end result is the doNotInterruptForNow cookie remains effective way longer than we intend it to be.
          //So, we set a cookie the manual way whose expiration is a short time in the future.
          var expiration = tomorrow();
          document.cookie = cookieName + '=y;expires='+expiration.toUTCString() + ';';
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

          sraInterrupt.get(scope).then(function (openSraModal) {
            if (openSraModal) {
              sra.open().then(function (result) {
                sraUpdate.save(scope, result).then(function(successResponse){
                  setDoNotInterruptCookie();
                }, handleFailedInterrupt);
              });
              addClassToModalDivWhenAvailable('div.modal-header', 'sra');
            }
            else {
              piuInterrupt.get(scope).then(function (openPiuModal) {
                if(openPiuModal) {
                  piu.open().then(function (result){
                    setDoNotInterruptCookie();
                  }, handleFailedInterrupt);

                  addClassToModalDivWhenAvailable('div.modal-header', 'piu');
                }
                else {
                  setDoNotInterruptCookie();
                }
              });
            }
          });
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
    .controller('modal', ['$log', '$scope', 'dialog',
      function (log, scope, dialog) {

        scope.close = function (result) {
          dialog.close(result);
        }

      }
    ])
    .service('true', ['$q',
      function (q) {
        return {
          'get': function () {
            var deferred = q.defer();

            deferred.resolve(true);

            return deferred.promise;
          }
        }
      }
    ])
    .service('false', ['$q',
      function (q) {
        return {
          'get': function () {
            var deferred = q.defer();

            deferred.resolve(false);

            return deferred.promise;
          }
        }
      }
    ])
    .service('piuInterrupt', ['EasyXdm',
      function (easyXdm) {
        return {
          'get': function (scope) {
            return easyXdm.fetch(scope, '/wsapi/rest/staffwebinterruptrequired?popuptype=piu');
          }
        }
      }
    ])
    .service('sraInterrupt', ['EasyXdm',
      function (easyXdm) {
        return {
          'get': function (scope) {
            return easyXdm.fetch(scope, '/wsapi/rest/staffwebinterruptrequired?popuptype=sra');
          }
        }
      }
    ])
    .service('sraUpdate', ['EasyXdm',
      function (easyXdm) {
        return {
          'save': function (scope, result) {
            return easyXdm.fetch(scope, '/wsapi/rest/staffwebinterruptrequired/sraupdate', 'POST', {status: result});
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
