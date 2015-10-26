/* vim: set ts=2 et sw=2 tw=80: */
(function() {
  var jsm = {};
  if (typeof XPCOMUtils == 'undefined') {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }

  XPCOMUtils.defineLazyModuleGetter(jsm, 'winScreenshot',
    'resource://easyscreenshot/winScreenshot.jsm');

  XPCOMUtils.defineLazyModuleGetter(jsm, 'utils',
    'resource://easyscreenshot/utils.jsm');

  XPCOMUtils.defineLazyModuleGetter(jsm, 'SnapshotStorage',
    'resource://easyscreenshot/snapshot.js');

  const prefs = jsm.utils.prefs;

  var ns = MOA.ns('ESS.Snapshot');
  var _logger = jsm.utils.logger('ESS.snapshot');
  var _strings = null;
  let notificationBox = null;

  ns.init = function (evt) {
    window.messageManager.addMessageListener('SAVE_DATA', function(msg) {
      jsm.SnapshotStorage.push(msg.data.dataStr);
      openUILinkIn('chrome://easyscreenshot/content/editor.xhtml', 'tab');
    });

    window.messageManager.addMessageListener('CAPTURE_DATA_ERROR', function(msg) {
      Cu.reportError('Unable to capture screenshot with\n' +
                     'url: ' + msg.data.url + '\n');
      Cc['@mozilla.org/alerts-service;1']
        .getService(Ci.nsIAlertsService)
        .showAlertNotification('chrome://easyscreenshot/skin/image/logo32.png',
          document.getElementById("easyscreenshot-strings")
                  .getString('failToCaptureNotification'),
                  null);
    });
    window.messageManager.addMessageListener('ESS-REMOVE-NOTIFICATION', function() {
      if (notificationBox) {
        notificationBox.removeAllNotifications(true);
      }
    });/*
    window.messageManager.addMessageListener('ESS-REMOVE-SCREEN-CAPTURE-PAGE', function() {
      if (gBrowser.selectedBrowser.currentURI.spec ==
          'chrome://easyscreenshot/content/screenshot.html') {
        gBrowser.removeCurrentTab();
      }
    });*/

    _strings = document.getElementById('easyscreenshot-strings');
  };

  let action_know = function() {
    if (notificationBox) {
      notificationBox.removeCurrentNotification();
    }
    prefs.set('showNotification', false);
  };

  let append_notice = function() {
    return notificationBox.appendNotification(
      _strings.getString('notice'),
      'ssSelector-controls',
      null,
      notificationBox.PRIORITY_INFO_HIGH, [{
        label:    _strings.getString('acknowledge'),
        accessKey:  'K',
        callback:  function() {
          try {
            action_know();
          }
          catch (error) {
            Services.console.logStringMessage('Error occurs when showing help information: ' + error);
          }
          return true;
        }
      }]
    );
  };

  ns.ssSelector = function() {
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/ssSelector.js', true);
    browserMM.sendAsyncMessage('ESS-SELECT-WEBPAGE-REGION');

    let showNotification = true;

    try {
      showNotification = prefs.get('showNotification');
    } catch (ex) {
      prefs.set('showNotification', true);
    }
    let notice = null;

    if (!showNotification) return;

    notificationBox = gBrowser.getNotificationBox();
    if (!notificationBox) return;

    notice = append_notice();
    // event_connect(notice, 'command', action_close);
    // notice.removeEventListener('command', listener, false);
  };

  ns.screenshot = function() {
    jsm.winScreenshot.getBitMap();
    window.top.openUILinkIn('chrome://easyscreenshot/content/screenshot.html', 'tab', 'fullscreen=yes');
  };

  ns.getSnapshot = function(part,data) {
    // Cancel selection mode first.
    ns.cancel();

    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.loadFrameScript('chrome://easyscreenshot/content/capture.js', true);
    browserMM.sendAsyncMessage('ESS-CAPTURE-WEBPAGE', {type: part});
    return;
  };

  ns.cancel = function() {
    window.messageManager.broadcastAsyncMessage('ESS-CANCEL-WIDGET');
  };

  var saveDataToDisk = function(data) {
    var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
    fp.init(window.parent, _strings.getString('saveImageTo'), Ci.nsIFilePicker.modeSave);
    fp.defaultString = _strings.getString('SnapFilePrefix') + '_' + (new Date()).toISOString().replace(/:/g, '-') + '.png';
    fp.appendFilter(_strings.getString('pngImage'), '*.png');

    if (fp.show() != Ci.nsIFilePicker.returnCancel) {
      var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      var path = fp.file.path;
      file.initWithPath(path + (/\.png$/.test(path) ? '' : '.png'));

      var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
      var source = ios.newURI(data, 'utf8', null);
      var target = ios.newFileURI(file);

      var persist = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Ci.nsIWebBrowserPersist);
      persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

      var transfer = Cc['@mozilla.org/transfer;1'].createInstance(Ci.nsITransfer);
      transfer.init(source, target, '', null, null, null, persist, false);
      persist.progressListener = transfer;

      persist.saveURI(source, null, null, null, null, file, null);
    }
  }

  ns.openSettings = function() {
    var features = 'chrome,titlebar,toolbar,centerscreen';
    try {
      var instantApply = Services.prefs.getBranch('browser.preferences.').getBoolPref('instantApply');
      features += instantApply ? ',dialog=no' : ',modal';
    } catch (e) {
      features += ',modal';
    }
    window.openDialog('chrome://easyscreenshot/content/settings-dialog.xul', 'Settings', features).focus();
  }

  ns.openSnapshotFeedback = function() {
    let src = prefs.getLocale('homepage', 'http://mozilla.com.cn/addon/325-easyscreenshot/');
    gBrowser.selectedTab = gBrowser.addTab(src);
  }

  window.addEventListener('load', function() {
    window.setTimeout(function() {
      ns.init();
    }, 1000);
    window.removeEventListener('load', arguments.callee, false);
  }, false);
})();
