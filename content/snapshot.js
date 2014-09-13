/* vim: set ts=2 et sw=2 tw=80: */
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
  XPCOMUtils.defineLazyGetter(jsm, 'SnapshotStorage', function() {
    let obj = {};
    Cu['import']('resource://easyscreenshot/snapshot.js', obj);
    return obj.SnapshotStorage;
  });

  var ns = MOA.ns('ESS.Snapshot');
  var _logger = jsm.utils.logger('ESS.snapshot');
  var _strings = null;

  ns.init = function (evt) {
    _strings = document.getElementById('easyscreenshot-strings');
  };

  ns.getSnapshot = function(part,data) {
    if (part == 'data') {
      return sendSnapshot(data.canvas, data.ctx);
    }

    var contentWindow = window.content;
    var contentDocument = contentWindow.document;
    var width, height, x, y;
    switch (part) {
      case 'visible':
        // Cancel selection mode first.
        ns.cancel();
        x = contentDocument.documentElement.scrollLeft;
        y = contentDocument.documentElement.scrollTop;
        width = contentDocument.documentElement.clientWidth;
        height = contentDocument.documentElement.clientHeight;
        break;
      case 'entire':
        // Cancel selection mode first.
        ns.cancel();
        x = y = 0;
        width = Math.max(contentDocument.documentElement.scrollWidth, contentDocument.body.scrollWidth);
        height = Math.max(contentDocument.documentElement.scrollHeight, contentDocument.body.scrollHeight);
        break;
      default:
        _logger.trace('unknown part argument')
    }

    try {
      var canvas = contentDocument.createElementNS('http://www.w3.org/1999/xhtml', 'html:canvas');
      canvas.height = height;
      canvas.width = width;

      // maybe https://bugzil.la/729026#c10 ?
      var ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.drawWindow(contentWindow, x, y, width, height, 'rgb(255,255,255)');

      if (width != canvas.width || height != canvas.height) {
        throw new Error("Size error");
      }

      sendSnapshot(canvas, ctx);
    } catch(ex) {
      Cu.reportError('Unable to capture screenshot with\n' +
                     'url: ' + contentWindow.location + '\n' +
                     'x: ' + x + '\n' +
                     'y: ' + y + '\n' +
                     'width: ' + width + '\n' +
                     'height: ' + height + '\n' +
                     'error: ' + ex);
      Cc['@mozilla.org/alerts-service;1']
        .getService(Ci.nsIAlertsService)
        .showAlertNotification('chrome://easyscreenshot/skin/image/logo32.png',
          document.getElementById("easyscreenshot-strings")
                  .getString('failToCaptureNotification'),
          null);
    }
  };

  var sendSnapshot = function(canvas, ctx) {
    jsm.SnapshotStorage.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    openUILinkIn('chrome://easyscreenshot/content/editor.xhtml', 'tab');
  };

  window.addEventListener('load', function() {
    window.setTimeout(function() {
      ns.init();
    }, 1000);
    window.removeEventListener('load', arguments.callee, false);
  }, false);

  addMessageListener('easyscreenshot@mozillaonline.com:captureEntirePage',function() {
    ns.getSnapshot('entire');
  });

  addMessageListener('easyscreenshot@mozillaonline.com:captureVisiblePart',function() {
    ns.getSnapshot('visible');
  });

})();
