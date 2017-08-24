let blobUrisByDownloadId = new Map();
let dataUrisByTabId = new Map();
let tabIdByDownloadId = new Map();
let tabIdByEditorId = new Map();


function handleDownloadChange(downloadDelta) {
  if (!blobUrisByDownloadId.has(downloadDelta.id)) {
    return;
  }

  if (!downloadDelta.state ||
      downloadDelta.state.current === "in_progress") {
    return;
  }

  URL.revokeObjectURL(blobUrisByDownloadId.get(downloadDelta.id));
  blobUrisByDownloadId.delete(downloadDelta.id);
  chrome.tabs.remove(tabIdByDownloadId.get(downloadDelta.id), function() {
    tabIdByDownloadId.delete(downloadDelta.id);
  });

  if (downloadDelta.state.current === "interrupt") {
    notify(chrome.i18n.getMessage("save_failure"));
    return;
  }
  document.getElementById("sound-export").play();
  chrome.downloads.search({
    id: downloadDelta.id
  }, function(results) {
    notify(chrome.i18n.getMessage("save_success"),
           (results.length && results[0].filename));
  });

  chrome.storage.local.get(["downloads.openDirectory"], function(results) {
    if (results["downloads.openDirectory"] === false) {
      return;
    }

    chrome.downloads.show(downloadDelta.id);
  });
}

function handleRuntimeMessage(message, sender, sendResponse) {
  if (["content2bg",
       "editor2bg",
       "popup2bg"].indexOf(message.dir) < 0) {
    return;
  }
  console.log(message);
  switch (message.type) {
    case "copy_image":
      browser.runtime.sendMessage({
        dir: "bg2legacy",
        type: message.type,
        image: message.image
      }).then(function(response) {
        if (response && response.error) {
          console.error(response.error);
          notify(chrome.i18n.getMessage("copy_failure"));
        } else {
          notify(chrome.i18n.getMessage("copy_success"));
        }
        chrome.tabs.remove(sender.tab.id);
        document.getElementById("sound-export").play();
      }, function(ex) {
        console.error(ex);
      });
      break;
    case "download":
      // why we still need the replacement?
      let timestamp = (new Date()).toISOString().replace(/:/g, "-");
      // save in an alternative folder ?
      let filename = chrome.i18n.getMessage("save_file_name", timestamp);
      chrome.downloads.download({
        url: message.url,
        filename,
        conflictAction: "uniquify"
      }, function(downloadId) {
        blobUrisByDownloadId.set(downloadId, message.url);
        tabIdByDownloadId.set(downloadId, sender.tab.id);
      });
      break;
    case "editor_ready":
      let tabId = tabIdByEditorId.get(sender.tab.id);
      if (!tabId) {
        break;
      }
      let dataUri = dataUrisByTabId.get(tabId);
      if (!dataUri) {
        break;
      }
      sendResponse({ dataUri });
      dataUrisByTabId.delete(tabId);
      tabIdByEditorId.delete(sender.tab.id);
      document.getElementById("sound-capture").play();
      break;
    case "removetab":
      chrome.tabs.remove(sender.tab.id);
      break;
    default:
      break;
  }
}

function notify(title, text) {
  chrome.notifications.create({
    "type": "basic",
    "iconUrl": "icons/icon-48.png", // ?
    "title": (title || ""),
    "message": (text || "")
  });
}


chrome.downloads.onChanged.addListener(handleDownloadChange);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
browser.runtime.sendMessage({
  dir: "bg2legacy",
  type: "migrate_prefs"
}).then(function(response) {
  for (let key in response) {
    if (response[key] === undefined) {
      delete response[key];
    }
  }
  chrome.storage.local.set(response);
}, function(ex) {
  console.error(ex);
});


// construct necessary DOM Element for play audio
document.body.appendChild(function() {
  var elt = document.createElement("div");
  var tmpElt = null;
  tmpElt = document.createElement("audio");
  tmpElt.id = "sound-capture";
  tmpElt.src = browser.extension.getURL("/editor/audio/capture.ogg");
  elt.appendChild(tmpElt);
  tmpElt = document.createElement("audio");
  tmpElt.id = "sound-export";
  tmpElt.src = browser.extension.getURL("/editor/audio/export.ogg");
  elt.appendChild(tmpElt);
  return elt;
}());
