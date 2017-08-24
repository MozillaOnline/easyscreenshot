/* global PrintScreen, CropOverlay */

Chaz.init("page.content");

const Background = new Chaz("background");
const Popup = new Chaz("popup.privileged");

// response image for background script's needs
Background.on("entire", PrintScreen.entire);
Background.on("visible", PrintScreen.visible);

// capture user select area
Popup.on("select", function() {
    CropOverlay.init();
    CropOverlay.start();
});

// let background script know, content script loaded
Background.send("loaded");
