const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

(function() {
  Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  XPCOMUtils.defineLazyModuleGetter(this, 'Services',
    'resource://gre/modules/Services.jsm');

  addMessageListener('easyscreenshot@mozillaonline.com:canvasData', function(aMsg) {
    content.postMessage(aMsg.data, '*');
  });
})();
