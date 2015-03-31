(function() {
  var jsm = {};
  if (typeof XPCOMUtils == 'undefined') {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }
  XPCOMUtils.defineLazyGetter(jsm, 'utils', function() {
    let obj = {};
    Cu['import']('resource://easyscreenshot/utils.jsm', obj);
    return obj.utils;
  });

  var ns = MOA.ns('ESS.Screenshot');
  //let _logger = jsm.utils.logger('ESS.screenshot');
  var _logger = jsm.utils.logger('ESS.snapshot');

  ns.ssSelector = function() {
    window.open("chrome://easyscreenshot/content/screenshot.html", "", "fullscreen=yes");
  };
})();
