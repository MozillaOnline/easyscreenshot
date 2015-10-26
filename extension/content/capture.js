/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  if (content.captureLoaded) return;

  // Avoid loading this script multi-times for the same tab.
  content.captureLoaded = true;

  let width, height, x, y;

  addMessageListener('ESS-CAPTURE-WEBPAGE', function(msg) {
    switch (msg.data.type) {
      case 'visible':
        x = content.document.documentElement.scrollLeft;
        y = content.document.documentElement.scrollTop;
        width = content.document.documentElement.clientWidth;
        height = content.document.documentElement.clientHeight;
        break;
      case 'entire':
        x = y = 0;
        width = Math.max(content.document.documentElement.scrollWidth, content.document.body.scrollWidth);
        height = Math.max(content.document.documentElement.scrollHeight, content.document.body.scrollHeight);
        break;
    }

    try {
      let canvas = content.document.createElement('canvas');
      canvas.height = height;
      canvas.width = width;

      let ctx = canvas.getContext('2d');

      ctx.drawWindow(content, x, y, width, height, 'rgb(255,255,255)');

      if (width != canvas.width || height != canvas.height) {
        sendAsyncMessage('CAPTURE_DATA_ERROR', {url: content.location});
      }

      sendAsyncMessage('SAVE_DATA', {
        dataStr: canvas.toDataURL()
      });
    } catch (ex) {
      sendAsyncMessage('CAPTURE_DATA_ERROR');
    }
  });
})();
