let message = 'easyscreenshot@mozillaonline.com:canvasData';
addMessageListener(message, function onCanvasData(aMsg) {
  content.postMessage(aMsg.data, '*');
  removeMessageListener(message, onCanvasData);
});
