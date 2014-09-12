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
    browserMM.loadFrameScript('chrome://easyscreenshot/content/ssSelector.js', false);
    // browserMM.sendAsyncMessage('easyscreenshot@mozillaonline.com:startSelection');
    browserMM.addMessageListener('easyscreenshot@mozillaonline.com:showNotification', showNotification);
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
})();
