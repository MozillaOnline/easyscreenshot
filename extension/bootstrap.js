const { utils: Cu } = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences",
  "resource://gre/modules/Preferences.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "require",
  "resource://devtools/shared/Loader.jsm");
XPCOMUtils.defineLazyGetter(this, "clipboard", () => require("sdk/clipboard"));

function handleMessage(message, sender, sendResponse) {
  if (message.dir != "bg2legacy") {
    return false;
  }

  switch (message.type) {
    case "migrate_prefs":
      let prefs = new Preferences("extensions.easyscreenshot.");
      sendResponse({
        "editor.color": prefs.get("color"),
        "editor.fontSize": prefs.get("fontSize"),
        "editor.lineWidth": prefs.get("lineWidth"),
        "downloads.openDirectory": prefs.get("openDirectory"),
        "notifications.showNotification": prefs.get("showNotification")
      });
      prefs.resetBranch();
      return false;
    case "copy_image":
      try {
        clipboard.set(message.image, "image");
        sendResponse({});
      } catch(ex) {
        sendResponse({
          error: ex.toString()
        });
      } finally {
        return false;
      }
    default:
      return false;
  }
}

function install() {}
function startup({webExtension}) {
  webExtension.startup().then(api => {
    const { browser } = api;
    browser.runtime.onMessage.addListener(handleMessage);
  });
}
function shutdown() {}
function uninstall() {}
