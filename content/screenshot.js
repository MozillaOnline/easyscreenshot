(function() {
  const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
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

  ns.ssSelector = function() {
    jsm.utils.getBitMap();
    window.open('chrome://easyscreenshot/content/screenshot.xul', '', 'fullscreen=yes');
  };
})();
