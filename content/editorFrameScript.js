const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

// Prevent tab from restoring.
docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing = true;

let canvasData = null;
let loaded = false;

function maybeStart() {
  if (canvasData && loaded) {
    content.dispatchEvent(new content.CustomEvent('ceEasyScreenshot:canvasData', {
      detail: canvasData
    }));
  }
}

let message = 'easyscreenshot@mozillaonline.com:canvasData';
addMessageListener(message, function onCanvasData(aMsg) {
  removeMessageListener(message, onCanvasData);
  canvasData = aMsg.data;
  maybeStart();
});

addEventListener('DOMContentLoaded', function() {
  loaded = true;
  maybeStart();
});
