/* vim: set ts=2 et sw=2 tw=80: */
(function() {

  if (typeof XPCOMUtils == 'undefined') {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }

  let jsm = {};

  XPCOMUtils.defineLazyModuleGetter(jsm, 'utils',
    'resource://easyscreenshot/utils.jsm');
  const _logger = jsm.utils.logger('ESS.snapshot');
  const strings = jsm.utils.strings('ssSelector');

  let ns = MOA.ns('ESS.Snapshot');

  ns.startSelection = function() {
    let browser = gBrowser.selectedBrowser;
    loadFrameScript(browser);
    browser.messageManager.sendAsyncMessage('easyscreenshot@mozillaonline.com:startSelection');
  };

  ns.captureEntirePage = function() {
    let browser = gBrowser.selectedBrowser;
    loadFrameScript(browser);
    browser.messageManager.sendAsyncMessage('easyscreenshot@mozillaonline.com:captureEntirePage');
  };

  ns.captureVisiblePart = function() {
    let browser = gBrowser.selectedBrowser;
    loadFrameScript(browser);
    browser.messageManager.sendAsyncMessage('easyscreenshot@mozillaonline.com:captureVisiblePart');
  };

  function loadFrameScript(aBrowser) {
    if (!aBrowser.__captor_framescript_loaded) {
      aBrowser.messageManager.loadFrameScript('chrome://easyscreenshot/content/captorFrameScript.js', false);
      aBrowser.__captor_framescript_loaded = true;
    }
  }

  function openEditor(aCanvasData) {
    let tab = gBrowser.selectedTab = gBrowser.addTab('chrome://easyscreenshot/content/editor.xhtml');
    let browserMM = gBrowser.getBrowserForTab(tab).messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/editorFrameScript.js', false);
    browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:canvasData', aCanvasData);
  }

  function appendNotification(aBrowser) {
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

    let notificationBox = gBrowser.getNotificationBox(aBrowser);
    if (!notificationBox) {
      return;
    }

    let notice = notificationBox.appendNotification(
      strings.get('notice'),
      'ssSelector-controls',
      null,
      notificationBox.PRIORITY_INFO_HIGH, [{
        label: strings.get('acknowledge'),
        accessKey: 'K',
        callback: function() {
          notificationBox.removeNotification(notice);
          prefs.setBoolPref('showNotification', false);
        }
      }]
    );
  }

  function removeNotification(aBrowser) {
    let notificationBox = gBrowser.getNotificationBox(aBrowser);
    if (!notificationBox) {
      return;
    }
    let notice = notificationBox.getNotificationWithValue('ssSelector-controls');
    if (!notice) {
      return;
    }
    notificationBox.removeNotification(notice);
  }

  function handleMessage(aMsg) {
    switch (aMsg.name) {
      case 'easyscreenshot@mozillaonline.com:openEditor': {
        openEditor(aMsg.data);
        break;
      }
      case 'easyscreenshot@mozillaonline.com:appendNotification': {
        appendNotification(aMsg.target);
        break;
      }
      case 'easyscreenshot@mozillaonline.com:removeNotification': {
        removeNotification(aMsg.target);
        break;
      }
      default: {
        _logger.trace('Receive unknown message: ' + aMsg.name);
        break;
      }
    }
  }

  let windowMM = window.messageManager;
  let messages = [
    'easyscreenshot@mozillaonline.com:openEditor',
    'easyscreenshot@mozillaonline.com:appendNotification',
    'easyscreenshot@mozillaonline.com:removeNotification'
  ];

  messages.forEach((aName) => windowMM.addMessageListener(aName, handleMessage));

  window.addEventListener('unload', function() {
    messages.forEach((aName) => windowMM.removeMessageListener(aName, handleMessage));
  });

})();
