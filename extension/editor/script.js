/* global CropOverlay, Utils */

  var EditorCropOverlay = {
    __proto__: CropOverlay,
    _i18nInstructionId: "editor_crop_instruction",
    _dblclick(evt) {
      Editor.current = {id: "crop"};
    },
    _keydown(evt) {
      // do nothing
    },
    _refreshImageData() {
      var { x, y, w, h } = Utils.parse(this._overlay.target);
      if (!h || !w) {
        return;
      }
      Editor.canvasData = Editor.ctx.getImageData(x, y, w, h);
    },
    _resize() {
      this._overlay.overlay.style.left = Editor.canvas.getBoundingClientRect().left + "px";
    },
    stop() {
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
    _isStartPoint(evt) {
      return evt.pageX - this._origRect[0] == this._startxy[0] &&
             evt.pageY - this._origRect[1] == this._startxy[1];
    },
    _mousedown(evt) {
      var rx = evt.pageX - this._origRect[0];
      var ry = evt.pageY - this._origRect[1];
      this._startxy = [rx, ry];
      document.addEventListener("mousemove", this._listeners.mousemove);
      document.addEventListener("mouseup", this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mousemove(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      x = Math.min(rx, this._startxy[0]);
      y = Math.min(ry, this._startxy[1]);
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
      if (rx > this._startxy[0] && ry < this._startxy[1])
        this._dir = 1;
      else if (rx < this._startxy[0] && ry < this._startxy[1])
        this._dir = 2;
      else if (rx < this._startxy[0] && ry > this._startxy[1])
        this._dir = 3;
      else if (rx > this._startxy[0] && ry > this._startxy[1])
        this._dir = 4;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._rect = [x, y, w, h];
      var dx = Math.min(this.lineWidth, x);
      var dy = this.lineWidth;
      var dw = Math.min(x + w + this.lineWidth, this._origRect[2]) - x + dx;
      var dh = Math.min(y + h + this.lineWidth, this._origRect[3]) - y + dy;
      x += this._origRect[0];
      y += this._origRect[1];
      this._canvas.style.left = x - dx + "px";
      this._canvas.style.top = y - dy + "px";
      this._canvas.left = x - dx;
      this._canvas.top = y - dy;
      this._canvas.width = dw;
      this._canvas.height = dh;
      this._ctx.lineWidth = this.lineWidth;
      this._ctx.strokeStyle = this.color;
      this._ctx.save();
      this._stroke(this._ctx, dx, dy, w, h);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mouseup(evt) {
      document.removeEventListener("mousemove", this._listeners.mousemove);
      document.removeEventListener("mouseup", this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
      if (!this._isStartPoint(evt)) {
        this._refreshImageData();
        Editor.updateHistory();
      }
    },
    _refreshImageData() {
      var [x, y, w, h] = this._rect;
      Editor.ctx.lineWidth = this.lineWidth;
      Editor.ctx.strokeStyle = this.color;
      Editor.ctx.save();
      this._stroke(Editor.ctx, x, y, w, h);
    },
    _stroke(ctx, x, y, w, h) {
    },
    get lineWidth() {
      return Editor.prefs["editor.lineWidth"];
    },
    set lineWidth(value) {
      if (!isNaN(value)) {
        chrome.storage.local.set({
          "editor.lineWidth": Number(value)
        });
      }
    },
    get fontSize() {
      return Editor.prefs["editor.fontSize"];
    },
    set fontSize(value) {
      if (!isNaN(value)) {
        chrome.storage.local.set({
          "editor.fontSize": Number(value)
        });
      }
    },
    get color() {
      return Editor.prefs["editor.color"];
    },
    set color(value) {
      chrome.storage.local.set({
        "editor.color": value
      });
    },
    init() {
      this._listeners.mousedown = this._mousedown.bind(this);
      this._listeners.mousemove = this._mousemove.bind(this);
      this._listeners.mouseup = this._mouseup.bind(this);
    },
    start(x, y, w, h, canvasId, evtName) {
      if (!evtName) {
        evtName = "mousedown";
      }
      this._canvas = document.createElement("canvas");
      this._ctx = this._canvas.getContext("2d");
      this._canvas.id = canvasId;
      Editor.canvas.className = canvasId;
      document.body.appendChild(this._canvas);
      this._origRect = [x, y, w, h];

      this._canvas.style.left = x + "px";
      this._canvas.style.top = y + "px";
      this._canvas.width = 0;
      this._canvas.height = 0;
      this._canvas.addEventListener(evtName, this._listeners[evtName]);
      Editor.canvas.addEventListener(evtName, this._listeners[evtName]);
    },
    cancel() {
      this._canvas.removeEventListener("mousedown", this._listeners.mousedown);
      Editor.canvas.removeEventListener("mousedown", this._listeners.mousedown);
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
    _stroke(ctx, x, y, w, h) {
      ctx.strokeRect(x, y, w, h);
    },
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "rectcanvas");
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
    _stroke(ctx, x, y, w, h) {
      ctx.beginPath();
      var dir = this._dir;
      if (dir == 1 || dir == 3) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + w, y);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
      }
      ctx.stroke();
      ctx.closePath();
    },
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "linecanvas");
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
    _stroke(ctx, x, y, w, h) {
      this._strokeCirc(ctx, x, y, w, h);
    },
    _strokeCirc(ctx, x, y, w, h) {
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
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "circcanvas");
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
    _refreshSize() {
      // Factor 1.2 per character looks good
      var factor = 1.2;
      // Initial size set to 2x1 characters
      this._size.width = Math.ceil(BaseControl.fontSize * factor * 2);
      this._size.height = Math.ceil(BaseControl.fontSize * factor);
    },
    _refreshImageData() {
      var textRect = this._input.getBoundingClientRect();

      var x = textRect.left;
      var y = textRect.top;
      var w = textRect.width;
      var h = textRect.height;

      // Hide floatbar temporarily to avoid overlapping
      Floatbar.hide();
      // see https://mzl.la/2cpTtyF , styles here almost work
      var img = new Image();
      var data = '<svg xmlns="http://www.w3.org/2000/svg" height="' +
                     h + 'px" width="' + w + 'px">' +
                   '<foreignObject height="100%" width="100%">' +
                     '<div xmlns="http://www.w3.org/1999/xhtml" style="border: 1px dashed transparent; color: ' +
                         this.color + "; font-family: Arial, Helvetica, sans-serif; font-size: " +
                         BaseControl.fontSize + 'px; padding: 1px; white-space: pre;">' +
                       this._input.value +
                     "</div>" +
                   "</foreignObject>" +
                 "</svg>";
      var blob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
      var url = URL.createObjectURL(blob);
      img.onload = function(evt) {
        var canvasRect = Editor.canvas.getBoundingClientRect();
        Editor.ctx.drawImage(evt.target, x - canvasRect.left, y - canvasRect.top);
        URL.revokeObjectURL(evt.target.src);

        // Show floatbar again after capturing text area
        Floatbar.show();
      };
      img.src = url;
    },
    _blur() {
      if (!/^\s*$/.test(this._input.value)) {
        this._refreshImageData();
        Editor.updateHistory();
      }
      this._hide();
    },
    _click(evt) {
      this._input.blur();
      this._input.style.fontSize = BaseControl.fontSize + "px";
      this._input.style.left = evt.pageX + "px";
      this._input.style.top = Math.min(Math.max(evt.pageY - 7, this._origRect[1]), this._origRect[1] + this._origRect[3] - 20) + "px";

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
      this._input.style.minWidth = initialWidth + "px";
      this._input.style.minHeight = initialHeight + "px";

      // Set maximal size
      this._input.style.maxWidth = maxWidth + "px";
      this._input.style.maxHeight = maxHeight + "px";

      // Set text color and transparent border
      this._input.style.color = this.color;
      this._input.style.borderColor = Utils.hex2rgba(this.color, 0.5);

      // Show and focus on the text input
      this._input.style.display = "block";
      this._input.focus();

      // This is to fix a bug that if you're using Chinese input method that
      // directly input letters into text input before pressing Space or Enter,
      // and clicks other place during inputting Chinese,
      // all unfinished letters would comes into new text input.
      // interrupt funcion here is to let Chinese input method put all characters first.
      Utils.interrupt((function() {
        this._input.value = "";
        this._input.style.width = initialWidth + "px";
        this._input.style.height = initialHeight + "px";
      }).bind(this));
    },
    _keypress(evt) {
      if (evt.ctrlKey && evt.keyCode == evt.DOM_VK_RETURN) { // Ctrl + Enter
        this._input.blur();
      }
    },
    _hide() {
      this._input.style.display = "none";
    },
    init() {
      var self = this;
      this._input = Utils.qs("#textinput");
      this._hide();
      this._listeners.click = this._click.bind(this);
      this._input.addEventListener("blur", this._blur.bind(this));
      this._input.addEventListener("keypress", this._keypress.bind(this));
      this._input.wrap = "off";
      // Auto resize according to content
      this._input.addEventListener("input", function(evt) {
        // Always shrink to minimal size first
        this.style.width = self._size.minWidth + "px";
        this.style.width = this.scrollWidth + "px";
        // And then extend to scroll size
        this.style.height = self._size.minHeight + "px";
        this.style.height = this.scrollHeight + "px";
      });
      // Disallow scroll. Make sure content on screen doesn't scroll away.
      this._input.addEventListener("scroll", function(evt) {
        this.scrollTop = 0;
        this.scrollLeft = 0;
      });
    },
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "textcanvas", "click");
    },
    cancel() {
      this._input.value = "";
      this._canvas.removeEventListener("click", this._listeners.click);
      Editor.canvas.removeEventListener("click", this._listeners.click);
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
    _blurAround(x, y) {
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
    _calcBluredData(x, y) {
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
      for (i = 0; i < 4; i++) {
        this._bluredData.data[this._xyToIndex(x, y, i)] = Math.floor(tmp[i] / tmp[4]);
      }
    },
    _refreshImageData() {
    },
    _xyToIndex(x, y, i) {
      return 4 * (y * this._origData.width + x) + i;
    },
    _mousemove(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      this._blurAround(rx, ry);
      evt.stopPropagation();
      evt.preventDefault();
    },
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "blurcanvas");
    },
    cancel() {
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
    _draw(x, y) {
      Editor.ctx.lineTo(x, y);
      Editor.ctx.stroke();
    },
    _mousedown(evt) {
      var rx = evt.pageX - this._origRect[0];
      var ry = evt.pageY - this._origRect[1];
      this._startxy = [rx, ry];
      Editor.ctx.lineWidth = BaseControl.lineWidth;
      Editor.ctx.strokeStyle = this.color;
      Editor.ctx.fillStyle = this.color;
      Editor.ctx.moveTo(rx, ry);
      Editor.ctx.beginPath();
      document.addEventListener("mousemove", this._listeners.mousemove);
      document.addEventListener("mouseup", this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _mouseup(evt) {
      if (this._isStartPoint(evt)) {
        var rx = evt.pageX - this._origRect[0];
        var ry = evt.pageY - this._origRect[1];
        var factor = 0.75;

        Editor.ctx.arc(rx, ry, BaseControl.lineWidth * factor, 0, Math.PI * 2, true);
        Editor.ctx.fill();
      }
      Editor.ctx.closePath();
      document.removeEventListener("mousemove", this._listeners.mousemove);
      document.removeEventListener("mouseup", this._listeners.mouseup);
      evt.stopPropagation();
      evt.preventDefault();
      this._refreshImageData();
      Editor.updateHistory();
    },
    _mousemove(evt) {
      var x = this._origRect[0];
      var y = this._origRect[1];
      var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
      var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
      this._draw(rx, ry);
      evt.stopPropagation();
      evt.preventDefault();
    },
    _refreshImageData() {
    },
    start(x, y, w, h) {
      this.__proto__.start.bind(this)(x, y, w, h, "pencilcanvas");
    },
    cancel() {
      this.__proto__.cancel.bind(this)();
    }
  };

  // Base class of ColorPicker & FontSelect
  var BarPopup = {
    get visible() {
      return this._ele.style.display != "none";
    },
    set visible(value) {
      this.toggle(value);
      this._anchor.toggle(value);
    },
    show() {
      this.toggle(true);
    },
    hide() {
      this.toggle(false);
    },
    toggle(toShow) {
      if (toShow === undefined) {
        toShow = !this.visible;
      }
      this._ele.style.display = toShow ? "block" : "none";
      document[toShow ? "addEventListener" : "removeEventListener"]("click", this._listeners.hide);
    }
  };

  // The color palette to pick a color, by default hidden.
  var ColorPicker = {
    __proto__: BarPopup,
    _ele: null,
    _anchor: null,
    _listeners: {},
    init() {
      this._listeners.hide = () => this.visible = false;

      this._ele = Utils.qs("#colorpicker");
      this._ele.addEventListener("click", this.click.bind(this));

      [].forEach.call(this._ele.querySelectorAll("li"), function(li) {
        li.style.backgroundColor = li.dataset.color;
      });
    },
    click(evt) {
      if (evt.target.nodeName.toLowerCase() == "li") {
        BaseControl.color = evt.target.dataset.color;
      }
    }
  };

  // The dropdown list to select font size, by default hidden.
  var FontSelect = {
    __proto__: BarPopup,
    _ele: null,
    _anchor: null,
    _listeners: {},
    init() {
      this._listeners.hide = () => this.visible = false;

      this._ele = Utils.qs("#fontselect");
      this._ele.addEventListener("click", this.click.bind(this));
    },
    click(evt) {
      if (evt.target.nodeName.toLowerCase() == "li") {
        BaseControl.fontSize = Number(evt.target.textContent);
      }
    }
  };

  /* BarItems are inside Floatbar, and only represent the UI part */
  var BarItem = function(options) {
    // options must contains id,
    // _refresh (update display of item according to prefs),
    // and click
    Utils.extend(this, options);
    Utils.assert(this.id, "id is mandatory");
    Utils.assert(this._refresh, "_refresh method is mandatory");
    Utils.assert(this.click, "click method is mandatory");
    this._ele = Utils.qs("#button-" + this.id);
    var title = chrome.i18n.getMessage("editor_" + this.id + "_tooltip");
    this._ele.setAttribute("title", title);
    this._init();
  };
  BarItem.prototype = {
    _init() {
      this.refresh = (function(changes, area) {
        if (area != "local") {
          return;
        }
        var prefId = "editor." + this.id;
        if (!changes[prefId]) {
          return;
        }
        Editor.prefs[prefId] = changes[prefId].newValue;
        this._refresh();
      }).bind(this);
      // _refresh() is to update display of item according to prefs
      this._refresh();
      chrome.storage.onChanged.addListener(this.refresh);
      this._ele.addEventListener("click", this.click.bind(this));
      this._initPopup();
    },
    uninit() {
      chrome.storage.onChanged.removeListener(this.refresh);
    },
    _initPopup() {
      if (this._popup) {
        this._popup.init();
        this._popup._anchor = this;
        this._ele.appendChild(this._popup._ele);
      }
    },
    get pressed() {
      return this._ele.classList.contains("current");
    },
    set pressed(value) {
      this.toggle(value);
      if (this._popup) {
        this._popup.toggle(value);
      }
    },
    press() {
      this.toggle(true);
    },
    release() {
      this.toggle(false);
    },
    toggle(toPress) {
      if (toPress === undefined) {
        toPress = !this.pressed;
      }
      this._ele.classList[toPress ? "add" : "remove"]("current");
    }
  };

  // Floatbar represents 2nd-level menubar floating above screenshot
  // and contains none or several items
  var Floatbar = {
    _ele: null,
    items: {},
    anchorEle: null, // Which button Floatbar is for/under
    init() {
      this._ele = Utils.qs("#floatbar");

      // Generate items
      this.items = {
        lineWidth: new BarItem({
          id: "lineWidth",
          _refresh() {
            Array.prototype.forEach.call(this._ele.getElementsByTagName("li"), function(li) {
              li.classList[li.value == BaseControl.lineWidth ? "add" : "remove"]("current");
            });
          },
          click(evt) {
            if (evt.target.nodeName.toLowerCase() == "li") {
              BaseControl.lineWidth = evt.target.value;
            }
          }
        }),
        fontSize: new BarItem({
          id: "fontSize",
          _popup: FontSelect,
          _refresh() {
            this._ele.firstChild.textContent = BaseControl.fontSize + " px";
          },
          click(evt) {
            Floatbar.pressItem(this);
            evt.stopPropagation();
          }
        }),
        color: new BarItem({
          id: "color",
          _popup: ColorPicker,
          _refresh() {
            this._ele.firstChild.style.backgroundColor = BaseControl.color;
          },
          click(evt) {
            Floatbar.pressItem(this);
            evt.stopPropagation();
          }
        })
      };

      window.addEventListener("resize", this);
    },
    handleEvent(evt) {
      switch (evt.type) {
        case "resize":
          this.reposition();
          break;
        default:
          break;
      }
    },
    reposition() {
      if (this.anchorEle) {
        this._ele.style.left = this.anchorEle.getBoundingClientRect().left + "px";
      }
    },
    show(buttonEle, itemsToShow) {
      if (buttonEle) {
        this.anchorEle = buttonEle;
        this.reposition();
      }

      this._ele.style.display = "block";

      if (itemsToShow) {
        Object.keys(this.items).forEach(function(id) {
          this.items[id]._ele.style.display = itemsToShow.indexOf(id) >= 0 ? "inline-block" : "none";
        }, this);
      }
    },
    hide() {
      this._ele.style.display = "none";
    },
    pressItem(item) {
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
    // options contains id, key
    // and may contain start, finish and clear
    Utils.extend(this, options);
    Utils.assert(this.id, "id is mandatory");
    Utils.assert(this.key, "key is mandatory");
    this._ele = Utils.qs("#button-" + this.id);
    var title = chrome.i18n.getMessage("editor_" + this.id + "_tooltip");
    this._ele.setAttribute("title", title + " (" + this.key + ")");
  };
  Button.prototype = {
    start() {
      this._ele.classList.add("current");
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
    clear() {
      Editor._current.classList.remove("current");
      Editor._current = null;
      if (this.floatbar) {
        Floatbar.hide();
      }
      Editor.canvas.className = "";
      Editor._controls[this.id].cancel();
    }
  };

  const HISTORY_LENGHT_MAX = 50;
  var Editor = {
    _controls: {
      "crop": EditorCropOverlay,
      "rectangle": Rect,
      "line": Line,
      "pencil": Pencil,
      "circle": Circ,
      "text": TextInput,
      "blur": Blur
    },
    _canvas: null,
    _ctx: null,
    _current: null,
    _history: [],
    _inited: false,
    buttons: {},
    get canvas() {
      return this._canvas;
    },
    set canvas(canvas) {
      this._canvas = canvas;
      this._ctx = this._canvas.getContext("2d");
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
      var oldID = this._current ? this._getID(this._current) : "";
      var newID = newCurrent ? this._getID(newCurrent) : "";

      var oldBtn = oldID ? this.buttons[oldID] : null;
      var newBtn = newID ? this.buttons[newID] : null;

      // Clear last button, normally clearing style and hiding floatbar
      if (oldBtn && !oldBtn.simple) {
        oldBtn.clear();
      }
      // finish() will only be called when a pressed button is clicked
      // start() is the main task this button is binding to
      if (newBtn) {
        newBtn[!newBtn.simple && newID == oldID ? "finish" : "start"]();
      }
    },
    prefs: {
      "editor.lineWidth": 6,
      "editor.fontSize": 18,
      "editor.color": "#FF0000"
    },
    init(img) {
      var self = this;

      this.canvas = Utils.qs("#display");
      try {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
      } catch (ex) {
        ["fontselect", "floatbar", "textinput"].forEach(function(id) {
          Utils.qs("#" + id).style.display = "none";
        });
        var src = chrome.i18n.getMessage("feedbackUrl");
        console.error(ex);
        window.location.href = src;
        return;
      }
      this.updateHistory();
      this._disableUndo();
      this._setupToolbar();
      Floatbar.init();

      document.body.addEventListener("keypress", function(evt) {
        if (evt.keyCode == evt.DOM_VK_ESCAPE) { // Esc
          self.current = null;
        }
        if (self._getID(evt.target) == "textinput") {
          return;
        }
        Object.keys(self.buttons).some(function(id) {
          var button = self.buttons[id];
          var key = button.key;
          return key ? [key.toLowerCase(), key.toUpperCase()].some(function(letter) {
            var found = evt.charCode == letter.charCodeAt(0);
            if (found) {
              self.current = {id};
              evt.preventDefault();
            }
            return found;
          }) : false;
        });
      });
      [EditorCropOverlay, Rect, Line, Pencil, Circ, TextInput, Blur].forEach(function(control) {
        control.init();
      });

      this._inited = true;
    },
    updateHistory() {
      this._history.push(this.canvasData);
      if (this._history.length > HISTORY_LENGHT_MAX) {
        this._history.shift();
        // this._history.splice(1, 1);
      }
      if (this._history.length > 1) {
        this._enableUndo();
      }
    },
    _getID(ele) {
      return ele.id.replace(/^button-/, "");
    },
    _setupToolbar() {
      var self = this;
      [].forEach.call(document.querySelectorAll("#toolbar > li"), function(li) {
        li.addEventListener("click", function(evt) {
          self.current = evt.target;
        });
      });
      this._setupButtons();
    },
    _setupButtons() {
      // Define floatbar types to avoid repetition
      var floatbars = {
        line: ["lineWidth", "color"],
        text: ["fontSize", "color"]
      };
      // Generate buttons
      this.buttons = {
        crop: new Button({
          id: "crop",
          key: "X",
          finish() {
            Editor._controls.crop.stop();
          }
        }),
        rectangle: new Button({
          id: "rectangle",
          key: "R",
          floatbar: floatbars.line
        }),
        line: new Button({
          id: "line",
          key: "D",
          floatbar: floatbars.line
        }),
        pencil: new Button({
          id: "pencil",
          key: "F",
          floatbar: floatbars.line
        }),
        circle: new Button({
          id: "circle",
          key: "E",
          floatbar: floatbars.line
        }),
        text: new Button({
          id: "text",
          key: "T",
          floatbar: floatbars.text
        }),
        blur: new Button({
          id: "blur",
          key: "B"
        }),
        undo: new Button({
          id: "undo",
          key: "Z",
          simple: true,
          start: Editor._undo.bind(Editor)
        }),
        local: new Button({
          id: "local",
          key: "S",
          simple: true,
          start: Editor._saveLocal.bind(Editor)
        }),
        copy: new Button({
          id: "copy",
          key: "C",
          simple: true,
          start: Editor._copyToClipboard.bind(Editor)
        }),
        cancel: new Button({
          id: "cancel",
          key: "Q",
          simple: true,
          start: Editor._cancelAndClose.bind(Editor)
        })
      };
    },
    _undo() {
      if (this._history.length > 1) {
        this._history.pop();
        this.canvasData = this._history[this._history.length - 1];
        if (this._history.length <= 1) {
          this._disableUndo();
        }
      }
    },
    _enableUndo() {
      Utils.qs("#button-undo").removeAttribute("disabled");
    },
    _disableUndo() {
      Utils.qs("#button-undo").setAttribute("disabled", "true");
    },
    _saveLocal() {
      chrome.runtime.sendMessage({
        "dir": "editor2bg",
        "type": "download",
        "url": this.canvas.toDataURL()
      });
    },
    async _copyToClipboard() {
      var failed = false;
      try {
        var response = await fetch(this.canvas.toDataURL());
        var arrayBuffer = await response.arrayBuffer();
        await browser.clipboard.setImageData(arrayBuffer, "png");
      } catch (ex) {
        failed = true;
      }
      await browser.runtime.sendMessage({
        "dir": "editor2bg",
        "type": "copy_image",
        "failed": failed
      });
    },
    _cancelAndClose() {
      chrome.runtime.sendMessage({
        "dir": "editor2bg",
        "type": "removetab"
      });
    }
  };

  window.addEventListener("load", function(evt) {
    chrome.storage.local.get(Object.keys(Editor.prefs), function(results) {
      Editor.prefs = Utils.extend(Editor.prefs, results);
      chrome.runtime.sendMessage(undefined, {
        "dir": "editor2bg",
        "type": "editor_ready"
      }, undefined, function(response) {
        var dataUri = response && response.dataUri;
        if (!dataUri) {
          Editor.init();
          return;
        }
        var img = new Image();
        img.onload = function(evt) {
          Editor.init(evt.target);
          img = undefined;
        }
        img.src = dataUri;
      });
    });
    document.title = chrome.i18n.getMessage("editor_title");
  });

  window.addEventListener("unload", function(evt) {
    for (var item in Floatbar.items) {
      Floatbar.items[item].uninit();
    }
  });
