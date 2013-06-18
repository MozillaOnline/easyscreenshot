(function() {
    var jsm = { };
    if (typeof XPCOMUtils == "undefined") {
        Cu.import("resource://gre/modules/XPCOMUtils.jsm");
    }
    XPCOMUtils.defineLazyGetter(jsm, "utils", function() {
        let obj = { };
        Cu["import"]("resource://easyscreenshot/utils.jsm", obj);
        return obj.utils;
    });
    XPCOMUtils.defineLazyGetter(jsm, "SnapshotStorage", function() {
        let obj = { };
        Cu["import"]("resource://easyscreenshot/snapshot.js", obj);
        return obj.SnapshotStorage;
    });

    var ns = MOA.ns('ESS.Snapshot');
    var _logger = jsm.utils.logger('ESS.snapshot');
    var _strings = null;

    ns.init = function (evt) {
        _strings = document.getElementById("easyscreenshot-strings");
    };

    ns.getSnapshot = function(part,data) {
        if(part == 'data'){
            return sendSnapshot(data.canvas, data.ctx);
        }

        var contentWindow = window.content;
        var document = contentWindow.document;
        var width, height, x, y;
        switch (part) {
            case 'visible':
                x = document.documentElement.scrollLeft;
                y = document.documentElement.scrollTop;
                width = document.documentElement.clientWidth;
                height = document.documentElement.clientHeight;
                break;
            case 'entire':
                x = y = 0;
                width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
                height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                break;
            default:
                _logger.trace('unknown part argument')
        }

        var canvas = null;
        try {
            canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "html:canvas");
            canvas.height = height;
            canvas.width = width;

            // maybe https://bugzil.la/729026#c10 ?
            var ctx = canvas.getContext("2d");

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.drawWindow(contentWindow, x, y, width, height, "rgb(255,255,255)");
        } catch(err) {
            canvas = null;
            canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "html:canvas");
            var scale = Math.min(1, Math.min(8192 / height, 8192 / width));
            canvas.height = height * scale;
            canvas.width = width * scale;

            var ctx = canvas.getContext("2d");

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.save();
            ctx.drawWindow(contentWindow, x, y, width, height, "rgb(255,255,255)");
        }

        sendSnapshot(canvas, ctx);
    };

    var sendSnapshot = function(canvas, ctx) {
        var defaultAction = "editor";

        switch(defaultAction) {
            case "local":
                saveDataToDisk(canvas.toDataURL("image/png", ""));
                break;
            case "editor":
                jsm.SnapshotStorage.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                openUILinkIn("chrome://easyscreenshot/content/editor.xhtml", "tab");
                break;
        }
    }

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

    ns.openSnapshotFeedback = function() {
        gBrowser.selectedTab = gBrowser.addTab('http://mozilla.com.cn/addon/107/?src=snapshotmenu');
    }

    window.addEventListener("load", function() {
        window.setTimeout(function() {
            ns.init();
        }, 1000);
        window.removeEventListener("load", arguments.callee, false);
    }, false);
})();
