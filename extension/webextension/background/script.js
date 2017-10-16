let blobUrisByDownloadId = new Map();
let dataUrisByTabId = new Map();
let tabIdByDownloadId = new Map();
let tabIdByEditorId = new Map();

function scrollAndCaptureOnce(tab, to, sendResponse, nextStep) {
  chrome.tabs.sendMessage(tab.id, {
    type: "scroll",
    to
  }, undefined, function(sResp) {
    if (sResp.left > to.left || sResp.top > to.top) {
      sendResponse({
        error: "Scrolled too much?"
      });
      return;
    }
    chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png"
    }, function(dataUri) {
      chrome.tabs.sendMessage(tab.id, {
        type: "confirm"
      }, undefined, function(cResp) {
        if (cResp.windowScrolled ||
            sResp.left !== cResp.left || sResp.top !== cResp.top ) {
          scrollAndCaptureOnce(tab, to, sendResponse, nextStep);
          return;
        }
        onCaptured(dataUri, tab.id, cResp, sendResponse, nextStep);
      });
    });
  });
}

function getSnapshot(message, tab, sendResponse) {
  switch (message.action) {
    case "select":
      chrome.tabs.sendMessage(tab.id, {
        type: "select"
      }, undefined, sendResponse);
      break;
    case "entire":
      chrome.tabs.sendMessage(tab.id, {
        type: "detect"
      }, undefined, function(dResp) {
        let selected = message.selected || {};
        let stepX = Math.ceil((selected.w || dResp.scrollWidth) / dResp.clientWidth);
        let steps = stepX * Math.ceil((selected.h || dResp.scrollHeight) / dResp.clientHeight);
        function nextStep(stepObj) {
          let step = stepObj.step;
          let y = Math.floor(step / stepX);
          let x = (y % 2) * (stepX - 1) + Math.pow(-1, y) * (step % stepX);
          scrollAndCaptureOnce(tab, {
            left: Math.min(dResp.scrollLeftMax, ((selected.x || 0) + x * dResp.clientWidth)),
            top: Math.min(dResp.scrollTopMax, ((selected.y || 0) + y * dResp.clientHeight))
          }, sendResponse, function() {
            step += 1;
            if (step < steps) {
              nextStep({ step });
            } else {
              onCaptureEnded(tab.id, tab.index);
              chrome.tabs.sendMessage(tab.id, {
                type: "uninit"
              }, undefined, sendResponse);
            }
          });
        }
        onCaptureStarted(tab.id, {
          x: selected.x,
          y: selected.y,
          w: (selected.w || dResp.scrollWidth),
          h: (selected.h || dResp.scrollHeight)
        });
        chrome.tabs.sendMessage(tab.id, {
          type: "init"
        }, undefined, nextStep);
      });
      break;
    case "visible":
      chrome.tabs.sendMessage(tab.id, {
        type: "detect"
      }, undefined, function(dResp) {
        onCaptureStarted(tab.id, {
          w: dResp.clientWidth,
          h: dResp.clientHeight
        });
        chrome.tabs.sendMessage(tab.id, {
          type: "init"
        }, undefined, function() {
          chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png"
          }, function(dataUri) {
            onCaptured(dataUri, tab.id, {}, sendResponse, function() {
              onCaptureEnded(tab.id, tab.index);
              chrome.tabs.sendMessage(tab.id, {
                type: "uninit"
              }, undefined, sendResponse);
            });
          });
        });
      });
      break;
    default:
      break;
  }
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
      notify(chrome.i18n.getMessage("copy_success"));
      chrome.tabs.remove(sender.tab.id);
      document.getElementById("sound-export").play();
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

function onCaptureStarted(tabId, size) {
  chrome.tabs.getZoom(tabId, function(zoomFactor) {
    let canvas = document.createElement("canvas");
    canvas.id = "canvas-" + tabId;
    try {
      canvas.width = size.w * zoomFactor;
      canvas.height = size.h * zoomFactor;
      canvas.setAttribute("leftoffset", (size.x || 0));
      canvas.setAttribute("topoffset", (size.y || 0));
      canvas.setAttribute("zoomfactor", zoomFactor);
    } catch (ex) {
      console.error(ex);
    }
    document.body.appendChild(canvas);
  });
}

function onCaptured(dataUri, tabId, topleft, sendResponse, callback) {
  chrome.tabs.getZoom(tabId, function(zoomFactor) {
    let canvas = document.getElementById("canvas-" + tabId);
    if (parseFloat(canvas.getAttribute("zoomfactor")) !== zoomFactor) {
      sendResponse({
        error: "zoomFactor changed!"
      });
      return;
    }
    let img = new Image();
    img.onload = function() {
      let ctx = canvas.getContext("2d");
      let leftOffset = parseInt(canvas.getAttribute("leftoffset"), 10);
      let topOffset = parseInt(canvas.getAttribute("topoffset"), 10);
      let left = (topleft.left || 0) - leftOffset;
      let top = (topleft.top || 0) - topOffset;

      ctx.drawImage(img, left * zoomFactor, top * zoomFactor);
      callback();
    }
    img.src = dataUri;
  });
}

function onCaptureEnded(tabId, tabIndex) {
  let canvas = document.getElementById("canvas-" + tabId);
  try {
    dataUrisByTabId.set(tabId, canvas.toDataURL());

    chrome.tabs.create({
      index: (tabIndex + 1),
      // openerTabId: tabId,
      url: chrome.extension.getURL("editor/page.html")
    }, function(tab) {
      tabIdByEditorId.set(tab.id, tabId);
    });
  } catch (ex) {
    console.error(ex);
  } finally {
    canvas.remove(); // ?
  }
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
console.log("background.js loaded");
