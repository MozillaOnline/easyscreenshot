/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  if (content.ssLoaded) return;

  // Avoid loading this script multi-times for the same web page.
  content.ssLoaded = true;

  addMessageListener('ESS-SELECT-WEBPAGE-REGION', function() {
    let doc = content.document;
    if(content.ssInstalled) return;

    let setting = {
      min_height: 4,
      min_width: 4,
      scroll_factor: 0.5
    };

    let widget = {
      window: null,
      document: null,
      root: null,
      body: null,
      overlay: null,
      selection: null,
      selection_inner: null,
      selection_top: null,
      selection_bottom: null,
      selection_left: null,
      selection_right: null
    };

    let get_position = function(element) {
      let result = {
        top:  element.offsetTop,
        left:  element.offsetLeft,
        width:  element.offsetWidth,
        height:  element.offsetHeight
      };
      let parent = element.offsetParent;

      while (parent != null) {
        result.left += parent.offsetLeft;
        result.top += parent.offsetTop;

        parent = parent.offsetParent;
      }

      return result;
    };

    let scroll_to_y = function(min_y, max_y) {
      let scroll_up = Math.round(
        (24 - min_y + widget.root.scrollTop) * setting.scroll_factor
      );
      let scroll_down = Math.round(
        (24 + max_y - widget.overlay.offsetHeight - widget.root.scrollTop) * setting.scroll_factor
      );

      if (scroll_up > 0) {
        widget.root.scrollTop -= scroll_up;
      }

      else if (scroll_down > 0) {
        widget.root.scrollTop += scroll_down;
      }
    };

    let scroll_to_x = function(min_x, max_x) {
      let scroll_left = Math.round(
        (24 - min_x + widget.root.scrollLeft) * setting.scroll_factor
      );
      let scroll_down = Math.round(
        (24 + max_x - widget.overlay.offsetWidth - widget.root.scrollLeft) * setting.scroll_factor
      );

      if (scroll_left > 0) {
        widget.root.scrollLeft -= scroll_left;
      }

      else if (scroll_down > 0) {
        widget.root.scrollLeft += scroll_down;
      }
    };

    let event_connect = function(target, event, listener) {
      target.addEventListener(event, listener, false);
    };

    let event_release = function(target, event, listener) {
      target.removeEventListener(event, listener, false);
    };

    let event_stop = function(event) {
      if (event.preventDefault) {
        event.preventDefault();
      }

      event.stopPropagation();
    };

    let position_selection = function(position) {
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

    let action_move = function(event) {
      let stop = function() {
        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        let position = get_position(widget.selection);
        let left = (event.pageX + offsetX);
        let top = (event.pageY + offsetY);
        let height = position.height;
        let width = position.width;

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

      let position = get_position(widget.selection);
      let offsetX = position.left - event.pageX;
      let offsetY = position.top - event.pageY;

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    let init_selection_top = function(event) {
      let selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.top - event.pageY,
        height:    selection.height + selection.top
      };
    };

    let init_selection_bottom = function(event) {
      let selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.height - event.pageY
      };
    };

    let init_selection_left = function(event) {
      let selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.left - event.pageX,
        width:    selection.width + selection.left
      };
    };

    let init_selection_right = function(event) {
      let selection = get_position(widget.selection);

      return {
        selection:  selection,
        offset:    selection.width - event.pageX
      };
    };

    let set_selection_top = function(event, context) {
      let top = event.pageY + context.offset;
      let height = context.height;

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

    let set_selection_bottom = function(event, context) {
      let height = (event.pageY + context.offset);

      if (height < setting.min_height) {
        height = setting.min_height;
      }

      if (context.selection.top + height > widget.root.scrollHeight) {
        height = widget.root.scrollHeight - context.selection.top;
      }

      scroll_to_y(event.pageY, event.pageY);

      widget.selection.style.height = height + 'px';
    };

    let set_selection_left = function(event, context) {
      let left = event.pageX + context.offset;
      let width = context.width;

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

    let set_selection_right = function(event, context) {
      let width = (event.pageX + context.offset);

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
    let action_top = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top');
        widget.selection.setAttribute('state', 'resize-top');

        set_selection_top(event, context_top);
      };

      let context_top = init_selection_top(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize top left:
    let action_top_left = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top-left');
        widget.selection.setAttribute('state', 'resize-top-left');

        set_selection_top(event, context_top);
        set_selection_left(event, context_left);
      };

      let context_top = init_selection_top(event);
      let context_left = init_selection_left(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize top right:
    let action_top_right = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-top-right');
        widget.selection.setAttribute('state', 'resize-top-right');

        set_selection_top(event, context_top);
        set_selection_right(event, context_right);
      };

      let context_top = init_selection_top(event);
      let context_right = init_selection_right(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom:
    let action_bottom = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom');
        widget.selection.setAttribute('state', 'resize-bottom');

        set_selection_bottom(event, context_bottom);
      };

      let context_bottom = init_selection_bottom(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom left:
    let action_bottom_left = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom-left');
        widget.selection.setAttribute('state', 'resize-bottom-left');

        set_selection_bottom(event, context_bottom);
        set_selection_left(event, context_left);
      };

      let context_bottom = init_selection_bottom(event);
      let context_left = init_selection_left(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize bottom right:
    let action_bottom_right = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-bottom-right');
        widget.selection.setAttribute('state', 'resize-bottom-right');

        set_selection_bottom(event, context_bottom);
        set_selection_right(event, context_right);
      };

      let context_bottom = init_selection_bottom(event);
      let context_right = init_selection_right(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };
    // Resize left:
    let action_left = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-left');
        widget.selection.setAttribute('state', 'resize-left');

        set_selection_left(event, context_left);
      };

      let context_left = init_selection_left(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Resize right:
    let action_right = function(event) {
      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };
      let move = function(event) {
        widget.overlay.setAttribute('state', 'resize-right');
        widget.selection.setAttribute('state', 'resize-right');

        set_selection_right(event, context_right);
      };

      let context_right = init_selection_right(event);

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    // Select:
    let action_all = function(event) {
      let start = {
        x:  event.pageX,
        y:  event.pageY
      };

      let stop = function() {
        widget.overlay.setAttribute('state', '');
        widget.selection.setAttribute('state', '');

        event_release(widget.selection, 'mousemove', move)
        event_release(widget.selection, 'mouseup', stop);
        event_release(widget.overlay, 'mousemove', move)
        event_release(widget.overlay, 'mouseup', stop);
        event_release(widget.document, 'mouseleave', stop);
      };

      let move = function(event) {
        widget.overlay.setAttribute('state', 'selecting');
        widget.selection.setAttribute('state', 'selecting');

        let width = Math.abs(event.pageX - start.x);
        let height = Math.abs(event.pageY - start.y);
        let left = start.x < event.pageX ? start.x : event.pageX;
        let top = start.y < event.pageY ? start.y : event.pageY;

        if (width < 4) width = 4;
        if (height < 4) height = 4;

        scroll_to_y(event.pageY, event.pageY);
        scroll_to_x(event.pageX, event.pageX);

        widget.selection.style.top = top + 'px';
        widget.selection.style.left = left + 'px';
        widget.selection.style.width = width + 'px';
        widget.selection.style.height = height + 'px';
      };

      event_connect(widget.selection, 'mousemove', move)
      event_connect(widget.selection, 'mouseup', stop);
      event_connect(widget.overlay, 'mousemove', move)
      event_connect(widget.overlay, 'mouseup', stop);
      event_connect(widget.document, 'mouseleave', stop);
      event_stop(event);
    };

    let action_save = function() {
      let data = capture();
      if (data.ignore) {
        action_close();
        return;
      }
      sendAsyncMessage('SAVE_DATA', {
        dataStr: data.canvas.toDataURL()
      });
      action_close();
    };


    // Define widgets:
    widget.document = content.document;
    widget.window = content;
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


    let styles = widget.document.createElement('link');
    styles.setAttribute('rel', 'stylesheet');
    styles.setAttribute('href', 'chrome://easyscreenshot/skin/ssSelector.css');
    widget.root.appendChild(styles);
    widget.root.appendChild(widget.overlay);

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

    let capture = function() {
      let canvas = content.document.createElement('canvas');
      let context = canvas.getContext('2d');
      let selection = get_position(widget.selection);
      // too small,ignore it!
      let ignore = (selection.height <= 2 || selection.width <= 2);

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

    let action_close = function(event) {
      widget.window.ssInstalled = false;
      event_release(widget.window, 'unload', action_close);
      event_release(widget.window, 'keydown', action_keydown);
      event_release(widget.selection, 'dblclick', action_save);
      event_release(widget.document, 'ssSelector:cancel', action_close);

      widget.root.removeChild(styles);
      widget.root.removeChild(widget.overlay);
      widget.root.removeChild(widget.selection);

      sendAsyncMessage('ESS-REMOVE-NOTIFICATION', {});
      sendAsyncMessage('ESS-REMOVE-SCREEN-CAPTURE-PAGE', {});
    };
    event_connect(widget.document, 'ssSelector:cancel', action_close);

    let action_keydown = function(event) {
      if (event.keyCode == 27) action_close();
      else if (event.keyCode == 13) action_save();
      else return;

      event_release(widget.window, 'keydown', action_keydown);
    };

    // Reposition ssSelector-selection to current viewport
    widget.selection.style.top = widget.root.scrollTop + 'px';
    widget.selection.style.left = widget.root.scrollLeft + 'px';

    event_connect(widget.window, 'unload', action_close);
    event_connect(widget.window, 'keydown', action_keydown);
    event_connect(widget.selection, 'dblclick', action_save);
  });

  addMessageListener('ESS-CANCEL-WIDGET', function() {
    let doc = content.document;
    let evt = new content.CustomEvent('ssSelector:cancel');
    doc.dispatchEvent(evt);
  });
})();
