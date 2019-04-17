var Utils = {
  parse(element) {
    return {
      x: parseInt(element.style.left, 10),
      y: parseInt(element.style.top, 10),
      w: parseInt(element.style.width, 10),
      h: parseInt(element.style.height, 10),
    }
  },
  qs(selector) {
    return document.querySelector(selector)
  },
  contains(node, otherNode) {
    return node.contains(otherNode);
  },
  emptyFunction() {},
  /**
   * Copy all attributes of one object into another.
   * No error thrown if src is undefined.
   */
  extend(dst, src, preserveExisting) {
    for (var i in src) {
      if (!preserveExisting || dst[i] === undefined) {
        dst[i] = src[i];
      }
    }
    return dst;
  },
  /* Use callback to wait for main loop to finish its job */
  interrupt(callback) {
    setTimeout(callback, 0);
  },
  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  },
  /* e.g. (#FFFFFF, 0.5) => (255, 255, 255, 0.5) */
  hex2rgba(hex, alpha) {
    if (hex.length == 7 && hex[0] === "#" && alpha !== undefined) {
      return "rgba("
        + parseInt(hex.slice(1, 3), 16) + ","
        + parseInt(hex.slice(3, 5), 16) + ","
        + parseInt(hex.slice(5, 7), 16) + ","
        + alpha + ")";
    }
    return hex;
  }
};

var CropOverlay = {
  _extId: undefined,
  _i18nInstructionId: "generic_crop_instruction",
  _overlay: {},
  _status: {
    isMoving: false,
    isResizing: false,
    isNew: false,
  },
  handleEvent(evt) {
    switch (evt.type) {
      case "dblclick":
      case "keydown":
      case "mousedown":
      case "mousemove":
      case "mouseup":
      case "resize":
        this["_" + evt.type](evt);
        break;
      default:
        break;
    }
  },
  _dblclick(evt) {
    this.stop();
  },
  _display(x = 0, y = 0, w = 0, h = 0, ix = 0, iy = 0, iw = 0, ih = 0) {
    if (!w || !h) {
      var rootScrollable = document.compatMode === "BackCompat" ?
        document.body : document.documentElement;
      w = rootScrollable.scrollWidth;
      h = rootScrollable.scrollHeight;
    }
    this._displayItem(this._overlay.overlay, x, y, w, h);
    this._displayItem(this._overlay.top, 0, 0, w, iy);
    this._displayItem(this._overlay.right, ix + iw, iy, w - (ix + iw), ih);
    this._displayItem(this._overlay.bottom, 0, iy + ih, w, h - (iy + ih));
    this._displayItem(this._overlay.left, 0, iy, ix, ih);
    this._displayItem(this._overlay.target, (iw ? ix : -5), (ih ? iy : -5), iw, ih);
    this._overlay.overlay.style.display = "block";
  },
  _displayItem(element, x, y, w, h) {
    element.style.left = x + "px";
    element.style.top = y + "px";
    element.style.width = w + "px";
    element.style.height = h + "px";
  },
  _hide() {
    this._overlay.overlay.style.display = "none";
  },
  _keydown(evt) {
    switch (evt.keyCode) {
      case evt.DOM_VK_ESCAPE:
        this.cancel();
        break;
      case evt.DOM_VK_RETURN:
        this.stop();
        break;
      default:
        break;
    }
  },
  _mousedown(evt) {
    var { x, y } = Utils.parse(this._overlay.overlay);
    var { x: ix, y: iy } = Utils.parse(this._overlay.target);
    var rx = evt.pageX - x;
    var ry = evt.pageY - y;
    if (this._overlay.target == evt.target) {
      this._status.isMoving = [rx - ix, ry - iy];
    } else if (Utils.contains(this._overlay.target, evt.target)) {
      if (evt.target.id.indexOf(this._extId) < 0) {
        console.error("evt.target.id is " + evt.target.id);
        return;
      }
      var idParts = evt.target.id.split("-");
      this._status.isResizing = idParts[idParts.length - 1];
    } else {
      this._status.isNew = [rx, ry];
    }
    document.addEventListener("mousemove", this);
    document.addEventListener("mouseup", this);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mousemove(evt) {
    var { x, y, w, h } = Utils.parse(this._overlay.overlay);
    var { x: ix, y: iy, w: iw, h: ih } = Utils.parse(this._overlay.target);
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
        case "ctrlnw":
          nix = Math.min(Math.max(rx, 0), ix + iw - 50);
          niy = Math.min(Math.max(ry, 0), iy + ih - 50);
          nih = ih - (niy - iy);
          niw = iw - (nix - ix);
          break;
        case "ctrlne":
          nix = ix;
          niy = Math.min(Math.max(ry, 0), iy + ih - 50);
          nih = ih - (niy - iy);
          niw = Math.min(Math.max(rx - nix, 50), w - nix);
          break;
        case "ctrlse":
          nix = ix;
          niy = iy;
          nih = Math.min(Math.max(ry - niy, 50), h - niy);
          niw = Math.min(Math.max(rx - nix, 50), w - nix);
          break;
        case "ctrlsw":
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
  _mouseup(evt) {
    this._status = {
      isMoving: false,
      isResizing: false,
      isNew: false,
    }
    document.removeEventListener("mousemove", this);
    document.removeEventListener("mouseup", this);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _resize(evt) {
    this._display();
  },
  _initOverlayEl(part, parent) {
    var id = "mococn-" + this._extId + "-crop-" + part;
    var el = document.getElementById(id);
    if (el) {
      return el;
    }
    el = document.createElement("div");
    el.id = id;
    if (!parent || !this._overlay[parent]) {
      return el;
    }
    this._overlay[parent].appendChild(el);
    return el;
  },
  _initOverlays() {
    var self = this;
    this._overlay.overlay = this._initOverlayEl("overlay");
    ["top", "left", "right", "bottom", "target"].forEach(function(part) {
      self._overlay[part] = self._initOverlayEl(part, "overlay");
    });
    ["ctrlnw", "ctrlne", "ctrlse", "ctrlsw"].forEach(function(ctrl) {
      self._initOverlayEl(ctrl, "target");
    });
    document.body.appendChild(this._overlay.overlay);
  },
  init() {
    this._extId = /* 'easy-screenshot'; */ chrome.i18n.getMessage("@@extension_id");
    if (!this._overlay.overlay) {
      this._initOverlays();
      this._overlay.overlay.setAttribute("title", chrome.i18n.getMessage(this._i18nInstructionId));
    }
    this._hide();
  },
  start(x, y, w, h) {
    this._display(x, y, w, h);
    this._overlay.overlay.addEventListener("dblclick", this);
    this._overlay.overlay.addEventListener("mousedown", this);
    window.addEventListener("keydown", this);
    window.addEventListener("resize", this);
  },
  cancel() {
    this._hide();
    this._overlay.overlay.removeEventListener("dblclick", this);
    this._overlay.overlay.removeEventListener("mousedown", this);
    window.removeEventListener("keydown", this);
    window.removeEventListener("resize", this);
  },
  stop() {
    var parsed = Utils.parse(this._overlay.target);
    if (!parsed.w || !parsed.h) {
      return;
    }
    this.cancel();
    chrome.runtime.sendMessage(undefined, {
      dir: "content2bg",
      type: "popup_action", // not really
      action: "entire",
      selected: parsed
    }, undefined, function(response) {
      if (response && response.error) {
        console.error(response.error);
      }
    });
  }
};
