let popup = {
  handleEvent(evt) {
    switch (evt.type) {
      case "click":
        if (!evt.currentTarget ||
            !evt.currentTarget.dataset ||
            !evt.currentTarget.dataset.action ||
            evt.currentTarget.classList.contains("disabled")) {
          return;
        }
        this.toggleActions(false);
        this.redirectToBG(evt);
        break;
      case "load":
        this.init(evt);
        break;
      default:
        break;
    }
  },
  init(evt) {
    let self = this;

    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      let items = document.querySelectorAll("div[data-action]");
      [].forEach.call(items, function(item) {
        // Add .panel-list-item here as a work around for https://bugzil.la/1416505
        item.classList.add("panel-list-item");

        let text = item.querySelector("div.text");
        text.textContent = chrome.i18n.getMessage("action_" + item.dataset.action);
        item.addEventListener("click", self);
      });

      if (tabs.length < 1) {
        console.error("No active tab in currentWindow?");
        return;
      }
      if (tabs.length > 1) {
        console.error(tabs);
      }

      chrome.tabs.sendMessage(tabs[0].id, {
        type: "ping"
      }, undefined, function(resp) {
        self.toggleActions(!chrome.runtime.lastError);
      });
    });
  },
  redirectToBG(evt) {
    chrome.runtime.sendMessage(undefined, {
      dir: "popup2bg",
      type: "popup_action",
      action: evt.currentTarget.dataset.action
    }, undefined, function(response) {
      if (response && response.error) {
        console.error(response.error);
        return;
      }
      window.close();
    });
  },
  toggleActions(enabled, actions) {
    let items = document.querySelectorAll("div.panel-list-item");
    [].forEach.call(items, function(item) {
      if ((actions || ["select",
                       "entire",
                       "visible"]).indexOf(item.dataset.action) < 0) {
        return;
      }
      if (enabled) {
        item.classList.remove("disabled");
      } else {
        item.classList.add("disabled");
      }
    });
  }
}

window.addEventListener("load", popup);
