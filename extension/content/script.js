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
        width: Math.min(message.selected.w || rootScrollable.scrollWidth, zoomedSizeLimit),
        height: Math.min(message.selected.h || rootScrollable.scrollHeight, zoomedSizeLimit)
      }
    }

    return {
      x: rootScrollable.scrollLeft,
      y: rootScrollable.scrollTop,
      width: rootScrollable.clientWidth,
      height: rootScrollable.clientHeight
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

        let options = { rect: getSize(message) };
        sendResponse(options);
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
