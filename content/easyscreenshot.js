/* vim: set ts=2 et sw=2 tw=80: */
(function() {
  let jsm = {};
  if (XPCOMUtils === undefined) {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }
  XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
  XPCOMUtils.defineLazyModuleGetter(jsm, 'utils', 'resource://easyscreenshot/utils.jsm');

  let ns = MOA.ns('ESS.Snapshot');
  let _logger = jsm.utils.logger('ESS.snapshot');
  // var _strings = null;

  ns.startSelection = function() {
    // load frame script and send message
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/captorFrameScript.js', false);
    browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:startSelection');
    // browserMM.addMessageListener('easyscreenshot@mozillaonline.com:showNotification', showNotification);
  };

  ns.captureEntirePage = function() {
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/snapshot.js', false);
    browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:captureEntirePage');
  };

  ns.captureVisiblePart = function() {
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/snapshot.js',false);
    browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:captureVisiblePart');
  };

  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"]
    .getService(Ci.nsIMessageListenerManager);
  globalMM.addMessageListener('easyscreenshot@mozillaonline.com:openEditor', function(aMsg) {
    let tab = gBrowser.selectedTab = gBrowser.addTab('chrome://easyscreenshot/content/editor.xhtml');
    let browserMM = gBrowser.getBrowserForTab(tab).messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/editorFrameScript.js', false);
    browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:canvasData', aMsg.data);
  });

  let appendNotification = function(aMsg) {
    let prefs = Services.prefs.getBranch('extensions.easyscreenshot.');
    let showNotification = true;
    try {
      showNotification = prefs.getBoolPref('showNotification');
    } catch (ex) {
      prefs.setBoolPref('showNotification', true);
    }
    if (!showNotification) {
      return;
    }

    let notificationBox = gBrowser.getNotificationBox(aMsg.target);
    if (!notificationBox) {
      return;
    }

    let notice = notificationBox.appendNotification(
      // getString('notice'),
      'hahhaxixi',
      'ssSelector-controls',
      null,
      notificationBox.PRIORITY_INFO_HIGH, [{
        // label:    getString('acknowledge'),
        label:    'acknowledge',
        accessKey:  'K',
        callback:  function() {
          notificationBox.removeNotification(notice);
          prefs.setBoolPref('showNotification', false);
        }
      }]
    );
  };

  let removeNotification = function(aMsg) {
    let notificationBox = gBrowser.getNotificationBox(aMsg.target);
    if (!notificationBox) {
      return;
    }
    let notice = notificationBox.getNotificationWithValue('ssSelector-controls');
    if (!notice) {
      return;
    }
    notificationBox.removeNotification(notice);
  };

  globalMM.addMessageListener('easyscreenshot@mozillaonline.com:appendNotification', appendNotification);
  globalMM.addMessageListener('easyscreenshot@mozillaonline.com:removeNotification', removeNotification);
  // remove on unload

})();
