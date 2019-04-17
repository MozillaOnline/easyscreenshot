let blobUrisByDownloadId = new Map();
let dataUrisByTabId = new Map();
let tabIdByDownloadId = new Map();
let tabIdByEditorId = new Map();

function dataUriToBlob(dataUri) {
  const binary = atob(dataUri.split(",", 2)[1]);
  const data = Uint8Array.from(binary, char => char.charCodeAt(0));
  const blob = new Blob([data], {type: "image/png"});
  return blob;
}

function getSnapshot(message, tab, sendResponse) {
  switch (message.action) {
    case "select":
      chrome.tabs.sendMessage(tab.id, {
        type: "select"
      }, undefined, sendResponse);
      break;
    case "entire":
    case "visible":
      chrome.tabs.sendMessage(tab.id, {
        type: message.action,
        selected: (message.selected || {})
      }, function(dataUri) {
        onCaptureEnded(tab.id, dataUri);
      });
      break;
    default:
      break;
  }
}

function handleAction(message, sendResponse) {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function(tabs) {
    if (tabs.length < 1) {
      sendResponse({
        error: "No active tab in currentWindow?"
      });
      return;
    }
    if (tabs.length > 1) {
      console.error(tabs);
    }

    getSnapshot(message, tabs[0], sendResponse);
  });
}

function handleCommand(cmd) {
  if (!cmd.startsWith("ess-")) {
    return;
  }

  let action = cmd.slice("ess-".length);
  handleAction({action}, response => {
    if (response && response.error) {
      console.error(response.error);
    } else {
      console.log(response);
    }
  });
}

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

function handlePopupAction(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case "select":
      case "entire":
      case "visible":
        handleAction(message, sendResponse);
        return true;
      case "settings":
        chrome.tabs.create({
          url: "" // TODO: create an option page
        }, sendResponse);
        return true;
      case "feedback":
        chrome.tabs.create({
          url: chrome.i18n.getMessage("feedbackUrl")
        }, sendResponse);
        return true;
      default:
        return false;
    }
  } catch (ex) {
    sendResponse({
      error: ex.message
    });
    return false;
  }
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
      let msgKey = message.failed ? "copy_failure" : "copy_success";
      notify(chrome.i18n.getMessage(msgKey));
      chrome.tabs.remove(sender.tab.id);
      document.getElementById("sound-export").play();
      break;
    case "download":
      // why we still need the replacement?
      let timestamp = (new Date()).toISOString().replace(/:/g, "-");
      // save in an alternative folder ?
      let filename = chrome.i18n.getMessage("save_file_name", timestamp);
      let blob = dataUriToBlob(message.url);
      let url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        incognito: sender.tab.incognito,
        filename,
        conflictAction: "uniquify"
      }, function(downloadId) {
        blobUrisByDownloadId.set(downloadId, url);
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
    case "popup_action":
      handlePopupAction(message, sender, sendResponse);
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

function onCaptureEnded(tabId, dataUri) {
  try {
    dataUrisByTabId.set(tabId, dataUri);

    chrome.tabs.create({
      openerTabId: tabId,
      url: chrome.extension.getURL("editor/page.html")
    }, function(tab) {
      tabIdByEditorId.set(tab.id, tabId);
    });
  } catch (ex) {
    console.error(ex);
  }
}


chrome.commands.onCommand.addListener(handleCommand);
chrome.downloads.onChanged.addListener(handleDownloadChange);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);
console.log("background.js loaded");
