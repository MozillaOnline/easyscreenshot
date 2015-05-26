/* vim: set ts=2 et sw=2 tw=80: */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * The original code is Abduction!
 * <https://addons.mozilla.org/firefox/addon/abduction/> by M. Evans
 *
 * The MIT License
 *
 * Copyright (c) 2006-09 Rowan Lewis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**From Abduction!**/

(function() {
  var jsm = { };
  if (typeof XPCOMUtils == 'undefined') {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }
  XPCOMUtils.defineLazyGetter(jsm, 'utils', function() {
    let obj = { };
    Cu['import']('resource://easyscreenshot/utils.jsm', obj);
    return obj.utils;
  });
  XPCOMUtils.defineLazyGetter(jsm, 'SnapshotStorage', function() {
    let obj = { };
    Cu['import']('resource://easyscreenshot/snapshot.js', obj);
    return obj.SnapshotStorage;
  });

  var ns = MOA.ns('ESS.Snapshot');
  var _logger = jsm.utils.logger('ESS.snapshot');
  var _strings = null;

  ns.init = function (evt) {
  };

  ns.ssSelector = function() {
    var doc = window.top.getBrowser().selectedBrowser.contentWindow.document;
    if(doc.defaultView.ssInstalled)
      return;

    function getString(key){
      var _stringBundle = document.getElementById('ssSelector-strings');
      return _stringBundle.getString(key);
    }
    var setting = {
      min_height:      4,
      min_width:      4,
      scroll_factor:    0.5
    };

    var widget = {
      window:        null,
      document:      null,
      root:        null,
      body:        null,
      overlay:      null,
      selection:      null,
      selection_inner:  null,
      selection_top:    null,
      selection_bottom:  null,
      selection_left:    null,
      selection_right:  null
    };

    var get_position = function(element) {
      var result = {
        top:  element.offsetTop,
        left:  element.offsetLeft,
        width:  element.offsetWidth,
        height:  element.offsetHeight
      };
      var parent = element.offsetParent;

      while (parent != null) {
        result.left += parent.offsetLeft;
        result.top += parent.offsetTop;

        parent = parent.offsetParent;
      }

      return result;
    };

    var scroll_to_y = function(min_y, max_y) {
      var scroll_up = Math.round(
        (24 - min_y + widget.root.scrollTop) * setting.scroll_factor
      );
      var scroll_down = Math.round(
        (24 + max_y - widget.overlay.offsetHeight - widget.root.scrollTop) * setting.scroll_factor
      );

      if (scroll_up > 0) {
        widget.root.scrollTop -= scroll_up;
      }

      else if (scroll_down > 0) {
        widget.root.scrollTop += scroll_down;
      }
    };

    var scroll_to_x = function(min_x, max_x) {
      var scroll_left = Math.round(
        (24 - min_x + widget.root.scrollLeft) * setting.scroll_factor
      );
      var scroll_down = Math.round(
        (24 + max_x - widget.overlay.offsetWidth - widget.root.scrollLeft) * setting.scroll_factor
      );

      if (scroll_left > 0) {
        widget.root.scrollLeft -= scroll_left;
      }

      else if (scroll_down > 0) {
        widget.root.scrollLeft += scroll_down;
      }
    };

    var event_connect = function(target, event, listener) {
      target.addEventListener(event, listener, false);
    };

    var event_release = function(target, event, listener) {
      target.removeEventListener(event, listener, false);
    };

    var event_stop = function(event) {
      if (event.preventDefault) {
        event.preventDefault();
      }

      event.stopPropagation();
    };

    var position_selection = function(position) {
      if (position.height < setting.min_height) {
        position.height = setting.min_height;
      }

      if (position.width < setting.min_width) {
        position.width = setting.min_width;
      }

      widget.selection.style.height = position.height + 'px';
      widget.selection.style.left = position.left + 'px';
      widget.selection.style.top = position.top + 'px';
      widget.selection.style.width = position.width + 'px';
    };

    var action_auto = function() {
      var stop = function() {
        widget.selection.className = null;
        widget.overlay.className = null;
        action_maximize_state = null;

        event_release(widget.selection, 'mousemove', move);
        event_release(widget.selection, 'mousedown', stop);
        event_release(widget.overlay, 'mousemove', move);
        event_release(widget.overlay, 'mousedown', stop);
      };
      var move = function(event) {
        widget.overlay.style.zIndex = -10000002;
        widget.selection.style.zIndex = -10000003;

        widget.selection.style.height = 0;
        widget.selection.style.left = 0;
        widget.selection.style.top = 0;
        widget.selection.style.width = 0;

        var element = widget.document.elementFromPoint(event.clientX, event.clientY);

        position_selection(get_position(element));

        widget.overlay.style.zIndex = 10000002;
        widget.selection.style.zIndex = 10000003;
      };

      action_maximize_state = null;
      action_maximize();

      widget.selection.className = 'x-ray';
      widget.overlay.className = 'x-ray';

      event_connect(widget.selection, 'mousemove', move);
      event_connect(widget.selection, 'mousedown', stop);
      event_connect(widget.overlay, 'mousemove', move);
      event_connect(widget.overlay, 'mousedown', stop);
    };

    var action_move = function(event) {
      var stop = function() {
        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        var position = get_position(widget.selection);
        var left = (event.pageX + offsetX);
        var top = (event.pageY + offsetY);
        var height = position.height;
        var width = position.width;

        if (left < 0) left = 0;
        if (top < 0) top = 0;

        if (left + width > widget.root.scrollWidth) {
          left = widget.root.scrollWidth - width;
        }

        if (top + height > widget.root.scrollHeight) {
          top = widget.root.scrollHeight - height;
        }

        scroll_to_y(top, top + height);
        scroll_to_x(left, left + width);

        widget.selection.style.left = left + 'px';
        widget.selection.style.top = top + 'px';
      };

      if (action_maximize_state != null) return;

      var position = get_position(widget.selection);
      var offsetX = position.left - event.pageX;
      var offsetY = position.top - event.pageY;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Maximze selection:
    var action_maximize_state = null;
    var action_maximize = function() {
      if (action_maximize_state != null) {
        var position = action_maximize_state;
        var height = position.height;
        var width = position.width;
        var top = position.top;
        var left = position.left;

        action_maximize_state = null;
      }

      else {
        var height = widget.root.scrollHeight;
        var width = widget.root.scrollWidth;
        var top = 0, left = 0;

        action_maximize_state = get_position(widget.selection);
      }

      widget.selection.style.height = height + 'px';
      widget.selection.style.left = left + 'px';
      widget.selection.style.top = top + 'px';
      widget.selection.style.width = width + 'px';
    };

    var init_selection_top = function(event) {
      var selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.top - event.pageY,
        height:    selection.height + selection.top
      };
    };

    var init_selection_bottom = function(event) {
      var selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.height - event.pageY
      };
    };

    var init_selection_left = function(event) {
      var selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.left - event.pageX,
        width:    selection.width + selection.left
      };
    };

    var init_selection_right = function(event) {
      var selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.width - event.pageX
      };
    };

    var set_selection_top = function(event, context) {
      var top = event.pageY + context.offset;
      var height = context.height;

      if (top < 0) top = 0;

      if (height - top < setting.min_height) {
        height = setting.min_height;
        top = context.height - height;
      }

      else {
        height -= top;
      }

      scroll_to_y(event.pageY, event.pageY);

      widget.selection.style.height = height + 'px';
      widget.selection.style.top = top + 'px';
    };

    var set_selection_bottom = function(event, context) {
      var height = (event.pageY + context.offset);

      if (height < setting.min_height) {
        height = setting.min_height;
      }

      if (context.selection.top + height > widget.root.scrollHeight) {
        height = widget.root.scrollHeight - context.selection.top;
      }

      scroll_to_y(event.pageY, event.pageY);

      widget.selection.style.height = height + 'px';
    };

    var set_selection_left = function(event, context) {
      var left = event.pageX + context.offset;
      var width = context.width;

      if (left < 0) left = 0;

      if (width - left < setting.min_width) {
        width = setting.min_width;
        left = context.width - width;
      }

      else {
        width -= left;
      }

      scroll_to_x(event.pageX, event.pageX);

      widget.selection.style.width = width + 'px';
      widget.selection.style.left = left + 'px';
    };

    var set_selection_right = function(event, context) {
      var width = (event.pageX + context.offset);

      if (width < setting.min_width) {
        width = setting.min_width;
      }

      if (context.selection.left + width > widget.root.scrollWidth) {
        width = widget.root.scrollWidth - context.selection.left;
      }

      scroll_to_x(event.pageX, event.pageX);

      widget.selection.style.width = width + 'px';
    };

    // Resize top:
    var action_top = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top');
        widget.selection.setAttribute('state', 'resize-top');

        set_selection_top(event, context_top);
      };

      var context_top = init_selection_top(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize top left:
    var action_top_left = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top-left');
        widget.selection.setAttribute('state', 'resize-top-left');

        set_selection_top(event, context_top);
        set_selection_left(event, context_left);
      };

      var context_top = init_selection_top(event);
      var context_left = init_selection_left(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize top right:
    var action_top_right = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top-right');
        widget.selection.setAttribute('state', 'resize-top-right');

        set_selection_top(event, context_top);
        set_selection_right(event, context_right);
      };

      var context_top = init_selection_top(event);
      var context_right = init_selection_right(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom:
    var action_bottom = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom');
        widget.selection.setAttribute('state', 'resize-bottom');

        set_selection_bottom(event, context_bottom);
      };

      var context_bottom = init_selection_bottom(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom left:
    var action_bottom_left = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom-left');
        widget.selection.setAttribute('state', 'resize-bottom-left');

        set_selection_bottom(event, context_bottom);
        set_selection_left(event, context_left);
      };

      var context_bottom = init_selection_bottom(event);
      var context_left = init_selection_left(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom right:
    var action_bottom_right = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom-right');
        widget.selection.setAttribute('state', 'resize-bottom-right');

        set_selection_bottom(event, context_bottom);
        set_selection_right(event, context_right);
      };

      var context_bottom = init_selection_bottom(event);
      var context_right = init_selection_right(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };
    // Resize left:
    var action_left = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-left');
        widget.selection.setAttribute('state', 'resize-left');

        set_selection_left(event, context_left);
      };

      var context_left = init_selection_left(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize right:
    var action_right = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'resize-right');
        widget.selection.setAttribute('state', 'resize-right');

        set_selection_right(event, context_right);
      };

      var context_right = init_selection_right(event);

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Select:
    var action_all = function(event) {
      var stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      var move = function(event) {
        widget.overlay.setAttribute('state', 'selecting');
        widget.selection.setAttribute('state', 'selecting');

        if (start.x < event.pageX) {
          var width = event.pageX - start.x;
          var left = start.x;
        }
        else {
          var width = start.x - event.pageX;
          var left = event.pageX;
        }

        if (start.y < event.pageY) {
          var height = event.pageY - start.y;
          var top = start.y;
        }
        else {
          var height = start.y - event.pageY;
          var top = event.pageY;
        }

        if (width < 4) width = 4;
        if (height < 4) height = 4;

        scroll_to_y(event.pageY, event.pageY);
        scroll_to_x(event.pageX, event.pageX);

        widget.selection.style.top = top + 'px';
        widget.selection.style.left = left + 'px';
        widget.selection.style.width = width + 'px';
        widget.selection.style.height = height + 'px';
      };

      var start = {
        x:  event.pageX,
        y:  event.pageY
      };

      action_maximize_state = null;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Define widgets:
    widget.document = window.top.getBrowser().selectedBrowser.contentWindow.document;
    widget.window = widget.document.defaultView;
    widget.window.ssInstalled = true;

    widget.root = widget.document.documentElement;
    widget.overlay = widget.document.createElement('ssSelector-overlay');
    widget.selection = widget.document.createElement('ssSelector-selection');
    widget.selection_inner = widget.document.createElement('ssSelector-selection-inner');
    widget.selection_top = widget.document.createElement('ssSelector-selection-top');
    widget.selection_top_left = widget.document.createElement('ssSelector-selection-top-left');
    widget.selection_top_right = widget.document.createElement('ssSelector-selection-top-right');
    widget.selection_bottom = widget.document.createElement('ssSelector-selection-bottom');
    widget.selection_bottom_left = widget.document.createElement('ssSelector-selection-bottom-left');
    widget.selection_bottom_right = widget.document.createElement('ssSelector-selection-bottom-right');
    widget.selection_left = widget.document.createElement('ssSelector-selection-left');
    widget.selection_right = widget.document.createElement('ssSelector-selection-right');


    var styles = widget.document.createElement('link');
    styles.setAttribute('rel', 'stylesheet');
    styles.setAttribute('href', 'chrome://easyscreenshot/skin/ssSelector.css');
    widget.root.appendChild(styles);
    widget.root.appendChild(widget.overlay);


//    widget.selection.style.height = (widget.window.innerHeight * 0.33) + 'px';
//    widget.selection.style.left = (widget.window.innerWidth * 0.33) + 'px';
//    widget.selection.style.top = (widget.root.scrollTop + (widget.window.innerHeight * 0.33)) + 'px';
//    widget.selection.style.width = (widget.window.innerWidth * 0.33) + 'px';

    widget.root.appendChild(widget.selection);
    widget.selection.appendChild(widget.selection_inner);
    widget.selection_inner.appendChild(widget.selection_top);
    widget.selection_inner.appendChild(widget.selection_top_left);
    widget.selection_inner.appendChild(widget.selection_top_right);
    widget.selection_inner.appendChild(widget.selection_bottom);
    widget.selection_inner.appendChild(widget.selection_bottom_left);
    widget.selection_inner.appendChild(widget.selection_bottom_right);
    widget.selection_inner.appendChild(widget.selection_left);
    widget.selection_inner.appendChild(widget.selection_right);


    widget.overlay.setAttribute('state', '');
    widget.selection.setAttribute('state', '');

    // Bind actions:
    event_connect(widget.overlay, 'mousedown', action_all);
    event_connect(widget.selection, 'mousedown', action_move);
    event_connect(widget.selection, 'dblclick', action_save);
    event_connect(widget.selection_top, 'mousedown', action_top);
    event_connect(widget.selection_top_left, 'mousedown', action_top_left);
    event_connect(widget.selection_top_right, 'mousedown', action_top_right);
    event_connect(widget.selection_bottom, 'mousedown', action_bottom);
    event_connect(widget.selection_bottom_left, 'mousedown', action_bottom_left);
    event_connect(widget.selection_bottom_right, 'mousedown', action_bottom_right);
    event_connect(widget.selection_left, 'mousedown', action_left);
    event_connect(widget.selection_right, 'mousedown', action_right);

    /*-------------------------------------------------------------------------------------------*/

    var capture = function() {
      var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'html:canvas');
      var context = canvas.getContext('2d');
      var selection = get_position(widget.selection);
      // too small,ignore it!
      var ignore = (selection.height <= 2 || selection.width <= 2);

      canvas.height = selection.height;
      canvas.width = selection.width;

      widget.overlay.style.display = 'none';
      widget.selection.style.display = 'none';

      context.drawWindow(
        widget.window,
        selection.left,
        selection.top,
        selection.width,
        selection.height,
        'rgb(255, 255, 255)'
      );

      widget.overlay.style.display = 'block';
      widget.selection.style.display = 'block';

      return {canvas: canvas, ctx: context, ignore:ignore};
    };
    var action_close = function(event) {
      widget.window.ssInstalled = false;
      if (notice) {
        event_release(notice, 'command', action_close);
      }
      event_release(widget.window, 'unload', action_close);
      event_release(widget.window, 'keydown', action_keydown);
      event_release(widget.selection, 'dblclick', action_save);
      event_release(widget.document, 'ssSelector:cancel', action_close);

      widget.root.removeChild(styles);
      widget.root.removeChild(widget.overlay);
      widget.root.removeChild(widget.selection);

      if (notificationBox) {
        notificationBox.removeAllNotifications(true);
      }
      if (gBrowser.selectedBrowser.currentURI.spec ==
          'chrome://easyscreenshot/content/screenshot.html') {
        gBrowser.removeCurrentTab();
      }
    };
    event_connect(widget.document, 'ssSelector:cancel', action_close);

    var action_save = function() {
      //todo: show editor
      var data = capture();
      if (data.ignore) {
        action_close();
        return;
      }
      MOA.ESS.Snapshot.getSnapshot('data',data);
      // All done.
      action_close();
    };
    var action_keydown = function(event) {
      if (event.keyCode == 27) action_close();
      else if (event.keyCode == 13) action_save();
      else return;

      event_release(widget.window, 'keydown', action_keydown);
    };
    var action_know = function() {
      if (notificationBox) {
        notificationBox.removeCurrentNotification();
      }
      prefs.setBoolPref('showNotification', false);
    };
    var append_notice = function() {
      if (!notificationBox) {
        return null;
      }
      return notificationBox.appendNotification(
        getString('notice'),
        'ssSelector-controls',
        null,
        notificationBox.PRIORITY_INFO_HIGH, [{
          label:    getString('acknowledge'),
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

    // Reposition ssSelector-selection to current viewport
    widget.selection.style.top = widget.root.scrollTop + 'px';
    widget.selection.style.left = widget.root.scrollLeft + 'px';

    var showNotification = true;
    var prefs = Components.classes['@mozilla.org/preferences-service;1']
                          .getService(Components.interfaces.nsIPrefService)
                          .getBranch('extensions.easyscreenshot.');
    try {
      showNotification = prefs.getBoolPref('showNotification');
    } catch (ex) {
      prefs.setBoolPref('showNotification', true);
    }
    var notificationBox = null;
    var notice = null;
    if (showNotification) {
      notificationBox = window.getNotificationBox(widget.window);
      notice = append_notice();
      event_connect(notice, 'command', action_close);
    }

    event_connect(widget.window, 'unload', action_close);
    event_connect(widget.window, 'keydown', action_keydown);
    event_connect(widget.selection, 'dblclick', action_save);
  };

  ns.cancel = function() {
    var doc = window.top.getBrowser().selectedBrowser.contentWindow.document;
    var evt = new doc.defaultView.CustomEvent('ssSelector:cancel');
    doc.dispatchEvent(evt);
  };
})();
