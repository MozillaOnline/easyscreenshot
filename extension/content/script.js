/* global CropOverlay */

(function() {
  let rootScrollable = document.compatMode === "BackCompat" ?
    document.body : document.documentElement;
  let sizeLimit = Math.pow(2, 13);

  function getSize(message) {
    if (message.type === "entire") {
      let zoomedSizeLimit = Math.floor(sizeLimit / window.devicePixelRatio);
      return {
        x: (message.selected.x || 0),
        y: (message.selected.y || 0),
        w: Math.min(message.selected.w || rootScrollable.scrollWidth, zoomedSizeLimit),
        h: Math.min(message.selected.h || rootScrollable.scrollHeight, zoomedSizeLimit),
        z: window.devicePixelRatio
      }
    }

    return {
      x: rootScrollable.scrollLeft,
      y: rootScrollable.scrollTop,
      w: rootScrollable.clientWidth,
      h: rootScrollable.clientHeight,
      z: window.devicePixelRatio
    }
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "select":
        CropOverlay.init();
        CropOverlay.start();
        sendResponse({});
        return false;
      case "entire":
      case "visible":
        CropOverlay.init();
        CropOverlay.cancel();

        let size = getSize(message);

        let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
        canvas.width = size.w * size.z;
        canvas.height = size.h * size.z;
        canvas.mozOpaque = true;

        let ctx = canvas.getContext("2d");
        ctx.scale(size.z, size.z);
        ctx.drawWindow(window, size.x, size.y, size.w, size.h, "#fff");

        sendResponse(canvas.toDataURL());
        return false;
      case "ping":
        sendResponse({
          type: "pong"
        });
        return false;
      default:
        return false;
    }
  }

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
})();
