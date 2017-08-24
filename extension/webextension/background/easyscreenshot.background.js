/* global PrintScreenLauncher */

Chaz.init("background");

const Content = new Chaz("page.content");
const Popup   = new Chaz("popup.privileged");
const Editor  = new Chaz("editor.content");

Popup.on("entire", PrintScreenLauncher.entire);
Popup.on("visible", PrintScreenLauncher.visible);

Popup.on("open", browser.tabs.create);

Content.on("open_editor", PrintScreenLauncher.openEditor);

// The browserAction button will be enabled when receive loaded event from content script
// so, if page not run my content script, then browserAction button will disable
// e.g. about:blank addons.mozilla.org
browser.tabs.onCreated.addListener(function(tab) {
    browser.browserAction.disable(tab.id);
});
browser.tabs.onUpdated.addListener(async function(tabId, info) {
    if (info.status === "loading") {
        browser.browserAction.disable(tabId);
        await Content.wait("loaded", (data, sender) => sender.tab.id === tabId);
        browser.browserAction.enable(tabId);
    }
});
