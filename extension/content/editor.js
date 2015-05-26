/* vim: set ts=2 et sw=2 tw=80: */
window.ssInstalled = true;

(function() {

  const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

  Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  XPCOMUtils.defineLazyModuleGetter(this, 'Services',
    'resource://gre/modules/Services.jsm');
  XPCOMUtils.defineLazyModuleGetter(this, 'Downloads',
    'resource://gre/modules/Downloads.jsm');
  XPCOMUtils.defineLazyModuleGetter(this, 'SnapshotStorage',
    'resource://easyscreenshot/snapshot.js');
  var jsm = {};
  XPCOMUtils.defineLazyModuleGetter(jsm, 'utils', 'resource://easyscreenshot/utils.jsm');
  const prefs = jsm.utils.prefs;

  var Utils = {
    parse: function(element) {
      return {
        x: parseInt(element.style.left, 10),
        y: parseInt(element.style.top, 10),
        w: parseInt(element.style.width, 10),
        h: parseInt(element.style.height, 10),
      }
    },
    qs: function(selector) document.querySelector(selector),
    contains: function(node, otherNode) {
      if (node.contains) {
        return node.contains(otherNode);
      } else {
        // not really equivalent, but enough here
        return [].some.call(node.children, function(n) n == otherNode);
      }
    },
    emptyFunction: function() {},
    /**
     * Copy all attributes of one object into another.
     * No error thrown if src is undefined.
     */
    extend: function(dst, src, preserveExisting) {
      for (var i in src) {
        if (!preserveExisting || dst[i] === undefined) {
          dst[i] = src[i];
        }
      }
      return dst;
    },
    /* Use callback to wait for main loop to finish its job */
    interrupt: function(callback) {
      setTimeout(callback, 0);
    },
    assert: function(condition, message) {
      if (!condition) {
        throw new Error(message);
      }
    },
    /* Simple downloading tool function */
    download: function(url, path, onsuccess, onerror, oncancel) {
      Downloads.createDownload({
        source: url,
        target: path
      }).then(function(aDownload) {
        aDownload.start().then(function() {
          if (aDownload.succeeded && onsuccess) {
            onsuccess();
          }
        }, function() {
          if (aDownload.error && onerror) {
            onerror();
          } else if (aDownload.canceled && oncancel) {
            oncancel();
          }
        }).then(null, onerror);
      }).then(null, onerror);
    },
    /* Simple string bundle tool object */
    strings: {
      _bundle: Services.strings.createBundle('chrome://easyscreenshot/locale/easyscreenshot.properties'),
      get: function(name, args) {
        if (args) {
          args = Array.prototype.slice.call(arguments, 1);
          return this._bundle.formatStringFromName(name, args, args.length);
        } else {
          return this._bundle.GetStringFromName(name);
        }
      }
    },
    notify: function(title, text) {
      Cc['@mozilla.org/alerts-service;1']
        .getService(Ci.nsIAlertsService)
        .showAlertNotification('chrome://easyscreenshot/skin/image/logo32.png', title, text || null);
    },
    /* e.g. (#FFFFFF, 0.5) => (255, 255, 255, 0.5) */
    hex2rgba: function(hex, alpha) {
      if (hex.length == 7 && hex[0] === '#' && alpha !== undefined) {
        return 'rgba('
          + parseInt(hex.slice(1, 3), 16) + ','
          + parseInt(hex.slice(3, 5), 16) + ','
          + parseInt(hex.slice(5, 7), 16) + ','
          + alpha + ')';
      }
      return hex;
    }
  };

  var CropOverlay = {
    _listeners: {},
    _overlay: {},
    _status: {
      isMoving: false,
      isResizing: false,
      isNew: false,
    },
    _dblclick: function(evt) {
      Editor.current = {id: 'crop'};
    },
    _display: function(x, y, w, h, ix, iy, iw, ih) {
      this._displayItem(this._overlay.overlay, x, y, w, h);
      this._displayItem(this._overlay.top, 0, 0, w, iy);
      this._displayItem(this._overlay.right, ix + iw, iy, w - (ix + iw), ih);
      this._displayItem(this._overlay.bottom, 0, iy + ih, w, h - (iy + ih));
      this._displayItem(this._overlay.left, 0, iy, ix, ih);
      this._displayItem(this._overlay.target, (iw ? ix : -5), (ih ? iy: -5), iw, ih);
      this._overlay.overlay.style.display = '';
    },
    _displayItem: function(element, x, y, w, h) {
      element.style.left = x + 'px';
      element.style.top = y + 'px';
      element.style.width = w + 'px';
      element.style.height = h + 'px';
    },
    _hide: function() {
      this._overlay.overlay.style.display = 'none';
    },
    _mousedown: function(evt) {
      var { x, y } = Utils.parse(this._overlay.overlay);
      var { x:ix, y:iy } = Utils.parse(this._overlay.target);
      var rx = evt.pageX - x;
      var ry = evt.pageY - y;
      if (this._overlay.target == evt.target) {
        this._status.isMoving = [rx - ix, ry - iy];
      } else if (Utils.contains(this._overlay.target, evt.target)) {
        this._status.isResizing = evt.target.id;
      } else {
        this._status.isNew = [rx, ry];
      }
      document.addEventListener('mousemove', this._listeners.mousemove);
      document.addEventListener('mouseup', this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mousemove: function(evt) {
      var { x, y, w, h } = Utils.parse(this._overlay.overlay);
      var { x:ix, y:iy, w:iw, h:ih } = Utils.parse(this._overlay.target);
      var rx = evt.pageX - x;
      var ry = evt.pageY - y;
      var nix, niy, nih, niw;
      if (this._status.isNew) {
        var startXY = this._status.isNew;
        rx = Math.min(Math.max(rx, 0), w);
        ry = Math.min(Math.max(ry, 0), h);
        nix = Math.min(startXY[0], rx);
        niy = Math.min(startXY[1], ry);
        nih = Math.abs(ry - startXY[1]);
        niw = Math.abs(rx - startXY[0]);
      } else if (this._status.isMoving) {
        var origXY = this._status.isMoving;
        nix = rx - origXY[0];
        niy = ry - origXY[1];
        nih = ih;
        niw = iw;
        nix = Math.min(Math.max(nix, 0), w - niw);
        niy = Math.min(Math.max(niy, 0), h - nih);
      } else if (this._status.isResizing) {
        switch (this._status.isResizing) {
          case 'ctrlnw':
            nix = Math.min(Math.max(rx, 0), ix + iw - 50);
            niy = Math.min(Math.max(ry, 0), iy + ih - 50);
            nih = ih - (niy - iy);
            niw = iw - (nix - ix);
            break;
          case 'ctrlne':
            nix = ix;
            niy = Math.min(Math.max(ry, 0), iy + ih - 50);
            nih = ih - (niy - iy);
            niw = Math.min(Math.max(rx - nix, 50), w - nix);
            break;
          case 'ctrlse':
            nix = ix;
            niy = iy;
            nih = Math.min(Math.max(ry - niy, 50), h - niy);
            niw = Math.min(Math.max(rx - nix, 50), w - nix);
            break;
          case 'ctrlsw':
            nix = Math.min(Math.max(rx, 0), ix + iw - 50);
            niy = iy;
            nih = Math.min(Math.max(ry - niy, 50), h - niy);
            niw = iw - (nix - ix);
            break;
          default:
            break;
        }
      }
      this._display(x, y, w, h, nix, niy, niw, nih);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mouseup: function(evt) {
      this._status = {
        isMoving: false,
        isResizing: false,
        isNew: false,
      }
      document.removeEventListener('mousemove', this._listeners.mousemove, false);
      document.removeEventListener('mouseup', this._listeners.mouseup, false);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _refreshImageData: function() {
      var { x, y, w, h } = Utils.parse(this._overlay.target);
      if (!h || !w) {
        return;
      }
      Editor.canvasData = Editor.ctx.getImageData(x, y, w, h);
    },
    init: function() {
      this._overlay = {
        overlay: Utils.qs('#crop'),
        top:   Utils.qs('#croptop'),
        right:   Utils.qs('#cropright'),
        bottom:  Utils.qs('#cropbottom'),
        left:  Utils.qs('#cropleft'),
        target:  Utils.qs('#croptarget'),
      };
      this._listeners.dblclick = this._dblclick.bind(this);
      this._listeners.mousedown = this._mousedown.bind(this);
      this._listeners.mousemove = this._mousemove.bind(this);
      this._listeners.mouseup = this._mouseup.bind(this);
      this._hide();
    },
    reposition: function() {
        this._overlay.overlay.style.left = Editor.canvas.getBoundingClientRect().left + 'px';
    },
    start: function(x, y, w, h) {
      this._display(x, y, w, h, 0, 0, 0, 0);
      this._overlay.overlay.addEventListener('dblclick', this._listeners.dblclick);
      this._overlay.overlay.addEventListener('mousedown', this._listeners.mousedown);
    },
    cancel: function() {
      this._hide();
      this._overlay.overlay.removeEventListener('dblclick', this._listeners.dblclick);
      this._overlay.overlay.removeEventListener('mousedown', this._listeners.mousedown);
    },
    stop: function() {
      this._refreshImageData();
      Editor.updateHistory();
    }
  };

  var BaseControl = {
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origRect: null,
    _rect: null,
    _startxy: null,
  //         _dir's value
  //
  //          |
  //         2  |  1
  //       -----------
  //         3  |  4
  //          |
  //

    _dir: 1,
    _isStartPoint: function(evt) {
      return evt.pageX - this._origRect[0] == this._startxy[0] &&
             evt.pageY - this._origRect[1] == this._startxy[1];
    },
    _mousedown: function(evt) {
      var rx = evt.pageX - this._origRect[0];
      var ry = evt.pageY - this._origRect[1];
      this._startxy = [rx, ry];
      document.addEventListener('mousemove', this._listeners.mousemove);
      document.addEventListener('mouseup', this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mousemove: function(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      var x = Math.min(rx, this._startxy[0]);
      var y = Math.min(ry, this._startxy[1]);
      var w = Math.abs(rx - this._startxy[0]);
      var h = Math.abs(ry - this._startxy[1]);
      if (evt.shiftKey) {
        w = Math.min(w, h);
        h = Math.min(w, h);
        if (x != this._startxy[0]) {
          x = this._startxy[0] - w;
        }
        if (y != this._startxy[1]) {
          y = this._startxy[1] - h;
        }
      }
      if(rx > this._startxy[0] && ry < this._startxy[1])
        this._dir = 1;
      else if(rx < this._startxy[0] && ry < this._startxy[1])
        this._dir = 2;
      else if(rx < this._startxy[0] && ry > this._startxy[1])
        this._dir = 3;
      else if(rx > this._startxy[0] && ry > this._startxy[1])
        this._dir = 4;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._rect = [x, y, w, h];
      var dx = Math.min(this.lineWidth, x);
      var dy = this.lineWidth;
      var dw = Math.min(x + w + this.lineWidth, this._origRect[2]) - x + dx;
      var dh = Math.min(y + h + this.lineWidth, this._origRect[3]) - y + dy;
      x += this._origRect[0];
      y += this._origRect[1];
      this._canvas.style.left = x - dx + 'px';
      this._canvas.style.top = y - dy + 'px';
      this._canvas.left = x - dx;
      this._canvas.top = y - dy;
      this._canvas.width = dw;
      this._canvas.height = dh;
      this._ctx.lineWidth = this.lineWidth;
      this._ctx.strokeStyle = ColorPicker.selected;
      this._ctx.save();
      this._stroke(this._ctx, dx, dy, w, h);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mouseup: function(evt) {
      document.removeEventListener('mousemove', this._listeners.mousemove);
      document.removeEventListener('mouseup', this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
      if (!this._isStartPoint(evt)) {
        this._refreshImageData();
        Editor.updateHistory();
      }
    },
    _refreshImageData: function() {
      var [x, y, w, h] = this._rect;
      Editor.ctx.lineWidth = this.lineWidth;
      Editor.ctx.strokeStyle = ColorPicker.selected;
      Editor.ctx.save();
      this._stroke(Editor.ctx, x, y, w, h);
    },
    _stroke: function(ctx, x, y, w, h) {
    },
    get lineWidth() {
      return prefs.get('lineWidth', 6);
    },
    set lineWidth(value) {
      if (!isNaN(value)) {
        prefs.set('lineWidth', Number(value));
      }
    },
    get fontSize() {
      return prefs.get('fontSize', 18);
    },
    set fontSize(value) {
      if (!isNaN(value)) {
        prefs.set('fontSize', Number(value));
      }
    },
    init: function() {
      this._listeners.mousedown = this._mousedown.bind(this);
      this._listeners.mousemove = this._mousemove.bind(this);
      this._listeners.mouseup = this._mouseup.bind(this);
    },
    start: function(x, y, w, h, canvasId, evtName) {
      if (!evtName) {
        evtName = 'mousedown';
      }
      this._canvas = document.createElement('canvas');
      this._ctx = this._canvas.getContext('2d');
      this._canvas.id = canvasId;
      Editor.canvas.className = canvasId;
      document.body.appendChild(this._canvas);
      this._origRect = [x, y, w, h];

      this._canvas.style.left = x + 'px';
      this._canvas.style.top = y + 'px';
      this._canvas.width = 0;
      this._canvas.height = 0;
      this._canvas.addEventListener(evtName, this._listeners[evtName]);
      Editor.canvas.addEventListener(evtName, this._listeners[evtName]);
    },
    cancel: function() {
      this._canvas.removeEventListener('mousedown', this._listeners.mousedown);
      Editor.canvas.removeEventListener('mousedown', this._listeners.mousedown);
      document.body.removeChild(this._canvas);
    }
  };

  var Rect = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origRect: null,
    _rect: null,
    _startxy: null,
    _stroke: function(ctx, x, y, w, h) {
      ctx.strokeRect(x, y, w, h);
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'rectcanvas');
    }
  };

  var Line = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origRect: null,
    _rect: null,
    _startxy: null,
    _stroke: function(ctx, x, y, w, h) {
      ctx.beginPath();
      var dir = this._dir;
      if(dir == 1 || dir == 3){
        ctx.moveTo(x, y+h);
        ctx.lineTo(x+w, y);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x+w, y+h);
      }
      ctx.stroke();
      ctx.closePath();
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'linecanvas');
    }
  };

  var Circ = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origRect: null,
    _rect: null,
    _startxy: null,
    _stroke: function(ctx, x, y, w, h) {
      this._strokeCirc(ctx, x, y, w, h);
    },
    _strokeCirc: function(ctx, x, y, w, h) {
      // see http://www.whizkidtech.redprince.net/bezier/circle/kappa/
      var br = (Math.sqrt(2) - 1) * 4 / 3;
      var bx = w * br / 2;
      var by = h * br / 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.bezierCurveTo(x + w / 2 + bx, y, x + w, y + h / 2 - by, x + w, y + h / 2);
      ctx.bezierCurveTo(x + w, y + h / 2 + by, x + w / 2 + bx, y + h, x + w / 2, y + h);
      ctx.bezierCurveTo(x + w / 2 - bx, y + h, x, y + h / 2 + by, x, y + h / 2);
      ctx.bezierCurveTo(x, y + h / 2 - by, x + w / 2 - bx, y, x + w / 2, y);
      ctx.closePath();
      ctx.stroke();
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'circcanvas');
    }
  };

  var TextInput = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _input: null,
    _listeners: {},
    _origRect: null,
    _size: {},
    _refreshSize: function() {
      // Factor 1.2 per character looks good
      var factor = 1.2;
      // Initial size set to 2x1 characters
      this._size.width = Math.ceil(BaseControl.fontSize * factor * 2);
      this._size.height = Math.ceil(BaseControl.fontSize * factor);
    },
    _refreshImageData: function() {
      var textRect = this._input.getBoundingClientRect();

      // Textarea borders are not needed when capturing screen
      var x = textRect.left + 1;
      var y = textRect.top + 1;
      var w = textRect.width - 2;
      var h = textRect.height - 2;

      this._canvas.width = w;
      this._canvas.height = h;

      // Hide floatbar temporarily to avoid overlapping
      Floatbar.hide();
      this._ctx.drawWindow(window.content, x + window.scrollX, y + window.scrollY, w, h, 'rgb(255,255,255)');
      // Show floatbar again after capturing text area
      Floatbar.show();

      var canvasRect = Editor.canvas.getBoundingClientRect();
      Editor.ctx.putImageData(this._ctx.getImageData(0, 0, w, h), x - canvasRect.left, y - canvasRect.top);
    },
    _blur: function() {
      if (!/^\s*$/.test(this._input.value)) {
        this._refreshImageData();
        Editor.updateHistory();
      }
      this._hide();
    },
    _click: function(evt) {
      this._input.blur();
      this._input.style.fontSize = BaseControl.fontSize + 'px';
      this._input.style.left = evt.pageX + 'px';
      this._input.style.top = Math.min(Math.max(evt.pageY - 7, this._origRect[1]), this._origRect[1] + this._origRect[3] - 20) + 'px';

      this._refreshSize();
      // marginX and marginY are to leave some minimal space between text input and page edge
      var marginX = 10;
      var marginY = 5;
      var maxWidth = this._origRect[0] + this._origRect[2] - evt.pageX - marginX;
      var maxHeight = this._origRect[1] + this._origRect[3] - evt.pageY - marginY;
      // Don't show text input if too close to page edge
      if (maxWidth <= 0 || maxHeight <= 0) {
        this._hide();
        return;
      }

      // Text input cannot bypass page edge
      var initialWidth = Math.min(this._size.width, maxWidth);
      var initialHeight = Math.min(this._size.height, maxHeight);

      // Initial size is minimal size. Cannot be smaller than this.
      this._size.minWidth = initialWidth;
      this._size.minHeight = initialHeight;

      // Set minimal size
      this._input.style.minWidth = initialWidth + 'px';
      this._input.style.minHeight = initialHeight + 'px';

      // Set maximal size
      this._input.style.maxWidth = maxWidth + 'px';
      this._input.style.maxHeight = maxHeight + 'px';

      // Set text color and transparent border
      this._input.style.color = ColorPicker.selected;
      this._input.style.borderColor = Utils.hex2rgba(ColorPicker.selected, 0.5);

      // Show and focus on the text input
      this._input.style.display = '';
      this._input.focus();

      // This is to fix a bug that if you're using Chinese input method that
      // directly input letters into text input before pressing Space or Enter,
      // and clicks other place during inputting Chinese,
      // all unfinished letters would comes into new text input.
      // interrupt funcion here is to let Chinese input method put all characters first.
      Utils.interrupt((function() {
        this._input.value = '';
        this._input.style.width = initialWidth + 'px';
        this._input.style.height = initialHeight + 'px';
      }).bind(this));
    },
    _keypress: function(evt) {
      if (evt.ctrlKey && evt.keyCode == 13) { // Ctrl + Enter
        this._input.blur();
      }
    },
    _hide: function() {
      this._input.style.display = 'none';
    },
    init: function() {
      var self = this;
      this._input = Utils.qs('#textinput');
      this._hide();
      this._listeners.click = this._click.bind(this);
      this._input.addEventListener('blur', this._blur.bind(this));
      this._input.addEventListener('keypress', this._keypress.bind(this));
      this._input.wrap = 'off';
      // Auto resize according to content
      this._input.addEventListener('input', function(evt) {
        // Always shrink to minimal size first
        this.style.width = self._size.minWidth + 'px';
        this.style.width = this.scrollWidth + 'px';
        // And then extend to scroll size
        this.style.height = self._size.minHeight + 'px';
        this.style.height = this.scrollHeight + 'px';
      });
      // Disallow scroll. Make sure content on screen doesn't scroll away.
      this._input.addEventListener('scroll', function(evt) {
        this.scrollTop = 0;
        this.scrollLeft = 0;
      });
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'textcanvas', 'click');
    },
    cancel: function() {
      this._input.value = '';
      this._canvas.removeEventListener('click', this._listeners.click);
      Editor.canvas.removeEventListener('click', this._listeners.click);
      document.body.removeChild(this._canvas);
      this._hide();
    }
  };

  var Blur = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origData: null,
    _bluredData: null,
    _origRect: null,
    _radius: 7,
    _blurAround: function(x, y) {
      var sx = Math.max(0, x - this._radius);
      var sy = Math.max(0, y - this._radius);
      var ex = Math.min(this._origRect[2], x + this._radius);
      var ey = Math.min(this._origRect[3], y + this._radius);
      var dx = Math.min(3, sx);
      var dy = Math.min(3, sy);
      var dw = Math.min(ex + 3, this._origRect[2]) - sx + dx;
      var dh = Math.min(ey + 3, this._origRect[3]) - sy + dy;
      this._origData = Editor.ctx.getImageData(sx - dx, sy - dy, dw, dh);
      this._bluredData = this._origData;
      for (var i = 0; i < this._origData.width; i++) {
        for (var j = 0; j < this._origData.height; j++) {
          if (Math.pow(i - (x - sx + dx), 2) + Math.pow(j - (y - sy + dy), 2) <= Math.pow(this._radius, 2)) {
            this._calcBluredData(i, j);
          }
        }
      }
      Editor.ctx.putImageData(this._bluredData, sx - dx, sy - dy);
    },
    _calcBluredData: function(x, y) {
      var maxradius = Math.min(x, y, this._origData.width - 1 - x, this._origData.height - 1 - y);
      var radius = Math.min(3, maxradius);
      var tmp = [0, 0, 0, 0, 0];
      for (var i = x - radius; i <= x + radius; i++) {
        for (var j = y - radius; j <= y + radius; j++) {
          for (var k = 0; k < 4; k++) {
            tmp[k] += this._origData.data[this._xyToIndex(i, j, k)];
          }
          tmp[4] += 1;
        }
      }
      for (var i = 0; i < 4; i++) {
        this._bluredData.data[this._xyToIndex(x, y, i)] = Math.floor(tmp[i] / tmp[4]);
      }
    },
    _refreshImageData: function() {
    },
    _xyToIndex: function(x, y, i) {
      return 4 * (y * this._origData.width + x) + i;
    },
    _mousemove: function(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      this._blurAround(rx, ry);
      evt.stopPropagation();
      evt.preventDefault();
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'blurcanvas');
    },
    cancel: function() {
      this.__proto__.cancel.bind(this)();
      this._origData = null;
      this._bluredData = null;
    }
  };

  var Pencil = {
    __proto__: BaseControl,
    _canvas: null,
    _ctx: null,
    _listeners: {},
    _origRect: null,
    _radius: 1,
    _draw: function(x, y) {
      Editor.ctx.lineTo(x, y);
      Editor.ctx.stroke();
    },
    _mousedown: function(evt) {
      var rx = evt.pageX - this._origRect[0];
      var ry = evt.pageY - this._origRect[1];
      this._startxy = [rx, ry];
      Editor.ctx.lineWidth = BaseControl.lineWidth;
      Editor.ctx.strokeStyle = ColorPicker.selected;
      Editor.ctx.fillStyle = ColorPicker.selected;
      Editor.ctx.moveTo(rx, ry);
      Editor.ctx.beginPath();
      document.addEventListener('mousemove', this._listeners.mousemove);
      document.addEventListener('mouseup', this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mouseup: function(evt) {
      if (this._isStartPoint(evt)) {
        var rx = evt.pageX - this._origRect[0];
        var ry = evt.pageY - this._origRect[1];
        var factor = 0.75;

        Editor.ctx.arc(rx, ry, BaseControl.lineWidth * factor, 0, Math.PI * 2, true);
        Editor.ctx.fill();
      }
      Editor.ctx.closePath();
      document.removeEventListener('mousemove', this._listeners.mousemove);
      document.removeEventListener('mouseup', this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
      this._refreshImageData();
      Editor.updateHistory();
    },
    _mousemove: function(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      this._draw(rx, ry);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _refreshImageData: function() {
    },
    start: function(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, 'pencilcanvas');
    },
    cancel: function() {
      this.__proto__.cancel.bind(this)();
    }
  };

  // Base class of ColorPicker & FontSelect
  var BarPopup = {
    get visible() {
      return this._ele.style.display != 'none';
    },
    set visible(value) {
      this.toggle(value);
      this._anchor.toggle(value);
    },
    show: function() {
      this.toggle(true);
    },
    hide: function() {
      this.toggle(false);
    },
    toggle: function(toShow) {
      if (toShow === undefined) {
        toShow = !this.visible;
      }
      this._ele.style.display = toShow ? '' : 'none';
      document[toShow ? 'addEventListener' : 'removeEventListener']('click', this._listeners.hide);
    }
  };

  // The color palette to pick a color, by default hidden.
  var ColorPicker = {
    __proto__: BarPopup,
    _ele: null,
    _anchor: null,
    _listeners: {},
    usePrefix: false,
    get selected() {
      return prefs.get('color', '#FF0000');
    },
    set selected(value) {
      prefs.set('color', value);
    },
    select: function(evt) {
      this.selected = evt.target.color;
    },
    init: function() {
      this._listeners.hide = () => this.visible = false;

      this._ele = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'colorpicker');
      this._ele.id = 'colorpicker';
      this._ele.addEventListener('select', this.select.bind(this));

      this.hide();
    }
  };

  // The dropdown list to select font size, by default hidden.
  var FontSelect = {
    __proto__: BarPopup,
    _ele: null,
    _anchor: null,
    _listeners: {},
    init: function() {
      this._listeners.hide = () => this.visible = false;

      this._ele = Utils.qs('#fontselect');
      this._ele.addEventListener('click', this.click.bind(this));

      this.hide();
    },
    click: function(evt) {
      if (evt.target.nodeName == 'li') {
        BaseControl.fontSize = Number(evt.target.textContent);
      }
    }
  };

  /* BarItems are inside Floatbar, and only represent the UI part */
  var BarItem = function(options) {
    // options must contains id,
    // refresh (update display of item according to prefs),
    // and click
    Utils.extend(this, options);
    Utils.assert(this.id, 'id is mandatory');
    Utils.assert(this.refresh, 'refresh method is mandatory');
    Utils.assert(this.click, 'click method is mandatory');
    this._ele = Utils.qs('#button-' + this.id);
    this._init();
  };
  BarItem.prototype = {
    _init: function() {
      // refresh() is to update display of item according to prefs
      this.refresh();
      prefs.observe(this.id, this.refresh, this);
      this._ele.addEventListener('click', this.click.bind(this));
      this._initPopup();
    },
    uninit: function() {
      prefs.ignore(this.id, this.refresh, this);
    },
    _initPopup: function() {
      if (this._popup) {
        this._popup.init();
        this._popup._anchor = this;
        this._ele.appendChild(this._popup._ele);
      }
    },
    get pressed() {
      return this._ele.classList.contains('current');
    },
    set pressed(value) {
      this.toggle(value);
      if (this._popup) {
        this._popup.toggle(value);
      }
    },
    press: function() {
      this.toggle(true);
    },
    release: function() {
      this.toggle(false);
    },
    toggle: function(toPress) {
      if (toPress === undefined) {
        toPress = !this.pressed;
      }
      this._ele.classList[toPress ? 'add' : 'remove']('current');
    }
  };

  // Floatbar represents 2nd-level menubar floating above screenshot
  // and contains none or several items
  var Floatbar = {
    _ele: null,
    items: {},
    anchorEle: null, // Which button Floatbar is for/under
    init: function() {
      var self = this;
      this._ele = Utils.qs('#floatbar');

      // Generate items
      this.items = {
        lineWidth: new BarItem({
          id: 'lineWidth',
          refresh: function() {
            Array.prototype.forEach.call(this._ele.getElementsByTagName('li'), function(li) {
              li.classList[li.value == BaseControl.lineWidth ? 'add' : 'remove']('current');
            });
          },
          click: function(evt) {
            if (evt.target.nodeName == 'li') {
              BaseControl.lineWidth = evt.target.value;
            }
          }
        }),
        fontSize: new BarItem({
          id: 'fontSize',
          _popup: FontSelect,
          refresh: function() {
            this._ele.firstChild.textContent = BaseControl.fontSize + ' px';
          },
          click: function(evt) {
            Floatbar.pressItem(this);
            evt.stopPropagation();
          }
        }),
        color: new BarItem ({
          id: 'color',
          _popup: ColorPicker,
          refresh: function() {
            this._ele.firstChild.style.backgroundColor = ColorPicker.selected;
          },
          click: function(evt) {
            Floatbar.pressItem(this);
            evt.stopPropagation();
          }
        })
      };

      this.hide();
    },
    reposition: function() {
      if (this.anchorEle) {
        this._ele.style.left = this.anchorEle.getBoundingClientRect().left + 'px';
      }
    },
    show: function(buttonEle, itemsToShow) {
      if (buttonEle) {
        this.anchorEle = buttonEle;
        this.reposition();
      }

      this._ele.style.display = '';

      if (itemsToShow) {
        Object.keys(this.items).forEach(function(id) {
          this.items[id]._ele.style.display = itemsToShow.indexOf(id) >= 0 ? 'inline-block' : 'none';
        }, this);
      }
    },
    hide: function() {
      this._ele.style.display = 'none';
    },
    pressItem: function(item) {
      for (var i in this.items) {
        if (this.items[i].id != item.id) {
          this.items[i].pressed = false;
        }
      }
      item.pressed = !item.pressed;
    }
  };

  /* Define button structure */
  var Button = function(options) {
    // options contains id,
    // and may contain start, finish and clear
    Utils.extend(this, options);
    Utils.assert(this.id, 'id is mandatory');
    this._ele = Utils.qs('#button-' + this.id);
  };
  Button.prototype = {
    start: function() {
      this._ele.classList.add('current');
      Editor._current = this._ele;
      if (this.floatbar) {
        Floatbar.show(this._ele, this.floatbar);
      }
      var canvas = Editor.canvas;
      Editor._controls[this.id].start(
        parseInt(canvas.offsetLeft, 10),
        parseInt(canvas.offsetTop, 10),
        parseInt(canvas.offsetWidth, 10),
        parseInt(canvas.offsetHeight, 10)
      );
    },
    finish: Utils.emptyFunction,
    clear: function() {
      Editor._current.classList.remove('current');
      Editor._current = null;
      if (this.floatbar) {
        Floatbar.hide();
      }
      Editor.canvas.className = '';
      Editor._controls[this.id].cancel();
    }
  };

  const HISTORY_LENGHT_MAX = 50;
  var Editor = {
    _controls: {
      'crop': CropOverlay,
      'rectangle': Rect,
      'line': Line,
      'pencil': Pencil,
      'circle': Circ,
      'text': TextInput,
      'blur': Blur
    },
    _canvas: null,
    _ctx: null,
    _current: null,
    _history: [],
    buttons: {},
    get canvas() {
      return this._canvas;
    },
    set canvas(canvas) {
      this._canvas = canvas;
      this._ctx = this._canvas.getContext('2d');
    },
    get ctx() {
      return this._ctx;
    },
    get canvasData() {
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    },
    set canvasData(data) {
      this.canvas.width = data.width;
      this.canvas.height = data.height;
      this.ctx.putImageData(data, 0, 0);
    },
    get current() {
      return this._current;
    },
    set current(newCurrent) {
      var oldID = this._current ? this._getID(this._current) : '';
      var newID = newCurrent ? this._getID(newCurrent) : '';

      var oldBtn = oldID ? this.buttons[oldID] : null;
      var newBtn = newID ? this.buttons[newID] : null;

      // Clear last button, normally clearing style and hiding floatbar
      if (oldBtn && !oldBtn.simple) {
        oldBtn.clear();
      }
      // finish() will only be called when a pressed button is clicked
      // start() is the main task this button is binding to
      if (newBtn) {
        newBtn[!newBtn.simple && newID == oldID ? 'finish' : 'start']();
      }
    },
    init: function() {
      var self = this;

      this.canvas = Utils.qs('#display');
      try {
        this.canvasData = SnapshotStorage.pop();
      } catch(ex) {
        ['fontselect', 'floatbar', 'textinput'].forEach(function(id) {
          Utils.qs('#' + id).style.display = 'none';
        });
        var src = prefs.getLocale('homepage', 'http://mozilla.com.cn/addon/325-easyscreenshot/');
        window.location.href = src;
        return;
      }
      this.updateHistory();
      this._disableUndo();
      this._setupToolbar();
      Floatbar.init();

      document.body.addEventListener('keypress', function(evt) {
        if (evt.keyCode == 27) { // Esc
          self.current = null;
        }
        if (self._getID(evt.target) == 'textinput') {
          return;
        }
        Object.keys(self.buttons).some(function(id) {
          var button = self.buttons[id];
          var key = button.key;
          return key ? [key.toLowerCase(), key.toUpperCase()].some(function(letter) {
            var found = evt.charCode == letter.charCodeAt(0);
            if (found) {
              self.current = {id: id};
              evt.preventDefault();
            }
            return found;
          }) : false;
        });
      });
      [CropOverlay, Rect, Line, Pencil, Circ, TextInput, Blur].forEach(function(control) {
        control.init();
      });
      this.playSound('capture');
    },
    updateHistory: function() {
      this._history.push(this.canvasData);
      if (this._history.length > HISTORY_LENGHT_MAX) {
        this._history.shift();
        //this._history.splice(1, 1);
      }
      if (this._history.length > 1) {
        this._enableUndo();
      }
    },
    _getID: function(ele) {
      return ele.id.replace(/^button-/, '');
    },
    _setupToolbar: function() {
      var self = this;
      [].forEach.call(document.querySelectorAll('#toolbar > li'), function(li) {
        li.addEventListener('click', function(evt) {
          self.current = evt.target;
        });
      });
      this._setupButtons();
    },
    _setupButtons: function() {
      // Define floatbar types to avoid repetition
      var floatbars = {
        line: ['lineWidth', 'color'],
        text: ['fontSize', 'color']
      };
      // Generate buttons
      this.buttons = {
        crop: new Button({
          id: 'crop',
          key: 'X',
          finish: function() {
            Editor._controls.crop.stop();
          }
        }),
        rectangle: new Button({
          id: 'rectangle',
          key: 'R',
          floatbar: floatbars.line
        }),
        line: new Button({
          id: 'line',
          key: 'D',
          floatbar: floatbars.line
        }),
        pencil: new Button({
          id: 'pencil',
          key: 'F',
          floatbar: floatbars.line
        }),
        circle: new Button({
          id: 'circle',
          key: 'E',
          floatbar: floatbars.line
        }),
        text: new Button({
          id: 'text',
          key: 'T',
          floatbar: floatbars.text
        }),
        blur: new Button({
          id: 'blur',
          key: 'B'
        }),
        undo: new Button({
          id: 'undo',
          key: 'Z',
          simple: true,
          start: Editor._undo.bind(Editor)
        }),
        local: new Button({
          id: 'local',
          key: 'S',
          simple: true,
          start: Editor._saveLocal.bind(Editor)
        }),
        copy: new Button({
          id: 'copy',
          key: 'C',
          simple: true,
          start: Editor._copyToClipboard.bind(Editor)
        }),
        cancel: new Button({
          id: 'cancel',
          key: 'Q',
          simple: true,
          start: Editor._cancelAndClose.bind(Editor)
        })
      };
    },
    _undo: function() {
      if(this._history.length > 1) {
        this._history.pop();
        this.canvasData = this._history[this._history.length - 1];
        if (this._history.length <= 1) {
          this._disableUndo();
        }
      }
    },
    _enableUndo: function() {
      Utils.qs('#button-undo').removeAttribute('disabled');
    },
    _disableUndo: function() {
      Utils.qs('#button-undo').setAttribute('disabled', 'true');
    },
    _saveLocal: function() {
      var self = this;
      var file = prefs.getFile('savePosition',
        Cc['@mozilla.org/file/directory_service;1']
          .getService(Ci.nsIProperties)
          .get('Desk', Ci.nsILocalFile)
      );
      var defaultFilename = Utils.strings.get('SnapFilePrefix') + '_' + (new Date()).toISOString().replace(/:/g, '-') + '.png';
      file.append(defaultFilename);

      Utils.download(this.canvas.toDataURL('image/png', ''), file.path, function() {
        if (prefs.get('openDirectory', true)) {
          try {
            file.reveal();
          } catch (e) {
            file.parent.launch();
          }
        }

        self.playSound('export');
        Utils.notify(Utils.strings.get('saveNotification'), file.parent.path);
        Utils.interrupt('window.close();');
      }, function() {
        Utils.notify(Utils.strings.get('failToSaveNotification'));
        Utils.interrupt('window.close();');
      });
    },
    _copyToClipboard: function() {
      var imagedata = this.canvas.toDataURL('image/png', '');
      var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
      var channel = ios.newChannel(imagedata, null, null);
      var input = channel.open();
      var imgTools = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools);

      var container = {};
      imgTools.decodeImageData(input, channel.contentType, container);

      var wrapped = Cc['@mozilla.org/supports-interface-pointer;1'].createInstance(Ci.nsISupportsInterfacePointer);
      wrapped.data = container.value;

      var trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
      trans.addDataFlavor(channel.contentType);
      trans.setTransferData(channel.contentType, wrapped, channel.contentLength);

      Services.clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);

      this.playSound('export');
      Utils.notify(Utils.strings.get('copyNotification'));
      Utils.interrupt('window.close();');
    },
    _cancelAndClose: function() {
      window.close();
    },
    _upToXiuxiu: function() {
      if (window.console) {
        console.log('not implemented');
      }
      window.close();
    },
    playSound: function(sound) {
      Utils.qs('#sound-' + sound).play();
    }
  };

  window.addEventListener('load', function(evt) {
    Editor.init();
    window.addEventListener('resize', function(evt) {
      Floatbar.reposition();
      CropOverlay.reposition();
    });
  });
  window.addEventListener('unload', function(evt) {
    for (var item in Floatbar.items) {
      Floatbar.items[item].uninit();
    }
  });
})();
