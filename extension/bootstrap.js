const { utils: Cu } = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences",
  "resource://gre/modules/Preferences.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "require",
  "resource://devtools/shared/Loader.jsm");
XPCOMUtils.defineLazyGetter(this, "clipboard", () => require("sdk/clipboard"));

var fxScreenshotHack = {
  topic: "prefservice:after-app-defaults",
  get prefs() {
    delete this.prefs;
    return this.prefs = new Preferences({
      branch: "extensions.screenshots.",
      defaultBranch: true
    });
  },

  defaultPrefTweak() {
    this.prefs.set("disabled", true);
  },

  init() {
    this.defaultPrefTweak();

    Services.obs.addObserver(this, this.topic);
  },

  observe(subject, topic, data) {
    switch (topic) {
      case this.topic:
        this.defaultPrefTweak();
        break;
      default:
        break;
    }
  },

  unint() {
    Services.obs.removeObserver(this, this.topic);
  }
};

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
      } catch (ex) {
        sendResponse({
          error: ex.toString()
        });
      }
      return false;
    default:
      return false;
  }
}

function install() {}
function startup({webExtension}) {
  fxScreenshotHack.init();

  webExtension.startup().then(({ browser }) => {
    browser.runtime.onMessage.addListener(handleMessage);
  });
}
function shutdown() {
  fxScreenshotHack.uninit();
}
function uninstall() {}
