(function() {
  window.addEventListener('load', function onLoad() {
    window.removeEventListener('load', onLoad);
    window.addEventListener('keydown', function(evt) {
	  console.log("==================" + evt.keyCode);
      /*
      if (evt.keyCode === 27) {
        window.top.close();
		return;
      }*//*
      var browser = document.getElementById('browserEle');
	  browser.contentWindow.dispatchEvent(evt);*/
    });
  });
})();