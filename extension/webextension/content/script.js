/* global CropOverlay, Utils */

(function() {
  let extId = chrome.i18n.getMessage("@@extension_id");
  let fixedPositionHack = "mococn-" + extId + "-fixed-position-hack";
  let fixedPositionOrig = "mococn-" + extId + "-fixed-position-orig";
  let rootScrollable = document.compatMode === "BackCompat" ?
    document.body : document.documentElement;
  let savedTopleft;
  let sizeLimit = Math.pow(2, 13);
  let windowScrolled = false;

  let fixedObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type !== "attributes") {
        return;
      }
      let attribute = mutation.attributeName,
          target = mutation.target;
      switch (attribute) {
        case "class":
          let newClass = target.getAttribute(attribute),
              oldClass = mutation.oldValue;
          if (newClass === oldClass) {
            return;
          }
          let elements = (target.parentElement || target).querySelectorAll("*");
          if (![].some.call(elements, function(element) {
            return window.getComputedStyle(element).position === "fixed";
          })) {
            return;
          }
          if (!target.hasAttribute(fixedPositionOrig)) {
            target.setAttribute(fixedPositionOrig, oldClass);
          }
          target.className = target.getAttribute(fixedPositionOrig);
          console.log((oldClass || "(emtpy class)") + " => " + newClass);
          return;
        case "style":
          if (target.style.position !== "fixed") {
            return;
          }
          let newStyle = target.getAttribute(attribute),
              oldStyle = mutation.oldValue;
          if (newStyle === oldStyle) {
            return;
          }
          let oldPositionMatched = /position:\s*([^;]+);/.exec(oldStyle);
          if (oldPositionMatched && oldPositionMatched[1] === "fixed") {
            return;
          }
          if (!target.hasAttribute(fixedPositionOrig)) {
            if (oldPositionMatched) {
              target.setAttribute(fixedPositionOrig, oldPositionMatched[1]);
            } else {
              // ? again, is this the correct default value?
              target.setAttribute(fixedPositionOrig, "absolute");
            }
          }
          target.style.position = target.getAttribute(fixedPositionOrig);
          console.log((oldStyle || "(emtpy style)") + " => " + newStyle);
          return;
        default:
          console.error("Unexpected mutation.attributeName: " + attribute);
      }
    });
  });

  function collectPositionFixedSelectors(styleSheets) {
    let selectors = [];
    for (let styleSheet of styleSheets) {
      try {
        for (let cssRule of styleSheet.cssRules) {
          if (!cssRule.style || cssRule.style.position !== "fixed") {
            continue;
          }
          selectors.push(cssRule.selectorText);
        }
      } catch (ex) {
        switch (ex.name) {
          case "SecurityError":
            console.log(styleSheet);
            return false;
          default:
            throw ex;
        }
      }
    }
    return selectors;
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "select":
        CropOverlay.init();
        CropOverlay.start();
        sendResponse({});
        return false;
      case "detect":
        sendResponse({
          "clientHeight": rootScrollable.clientHeight,
          "clientWidth": rootScrollable.clientWidth,
          "scrollHeight": Math.min(rootScrollable.scrollHeight, sizeLimit),
          "scrollLeft": rootScrollable.scrollLeft,
          "scrollLeftMax": rootScrollable.scrollLeftMax,
          "scrollTop": rootScrollable.scrollTop,
          "scrollTopMax": rootScrollable.scrollTopMax,
          "scrollWidth": Math.min(rootScrollable.scrollWidth, sizeLimit),
        });
        return false;
      case "init":
        CropOverlay.init();
        CropOverlay.cancel();

        savedTopleft = {
          left: rootScrollable.scrollLeft,
          top: rootScrollable.scrollTop
        };

        let styleSheets = document.styleSheets;
        let style = document.createElement("style");
        style.id = fixedPositionHack;
        style.type = "text/css";
        document.body.appendChild(style);

        let selectors = collectPositionFixedSelectors(styleSheets);
        let attributeFilter = ["style"];
        let extraElementsSelector;
        if (selectors) {
          if (selectors.length) {
            let ruleText = [
              selectors.join(", "),
              " { position: absolute }"
            ].join("");
            try {
              style.sheet.insertRule(ruleText, 0);
            } catch (ex) {
              switch (ex.name) {
                case "SyntaxError":
                  console.log(ruleText);
                  break;
                default:
                  throw ex;
              }
            }
          }
          extraElementsSelector = '[style*="fixed"]';
        } else {
          attributeFilter.push("class");
          extraElementsSelector = "*";
        }
        let extraElements = document.querySelectorAll(extraElementsSelector);
        [].forEach.call(extraElements, function(extraElement) {
          if (window.getComputedStyle(extraElement).position !== "fixed") {
            return;
          }
          let storedVal = extraElement.style.position;
          extraElement.setAttribute(fixedPositionHack, storedVal);
          extraElement.style.position = "absolute";
        });

        fixedObserver.observe(document.documentElement, {
          attributeFilter,
          attributeOldValue: true,
          subtree: true
        });

        sendResponse({
          step: 0
        });
        return false;
      case "scroll":
        window.scrollTo(message.to.left, message.to.top);
        // maybe make this delay adjustable ?
        let replyDelay = windowScrolled ? 400 : 0;
        windowScrolled = false;
        window.setTimeout(sendResponse, replyDelay, {
          left: rootScrollable.scrollLeft,
          top: rootScrollable.scrollTop
        });
        return true;
      case "confirm":
        sendResponse({
          left: rootScrollable.scrollLeft,
          top: rootScrollable.scrollTop,
          windowScrolled
        });
        return false;
      case "uninit":
        fixedObserver.disconnect();
        // ?

        let touchedSelector = "[" + fixedPositionHack + "]";
        let touchedElements = document.querySelectorAll(touchedSelector);
        [].forEach.call(touchedElements, function(extraElement) {
          let storedVal = extraElement.getAttribute(fixedPositionHack);
          extraElement.style.position = storedVal;
          extraElement.removeAttribute(fixedPositionHack);
        });

        document.getElementById(fixedPositionHack).remove();

        window.scrollTo(savedTopleft.left, savedTopleft.top);
        sendResponse({});
        return false;
      case "ping":
        sendResponse({
          type: "pong"
        });
        return false;
      default:
        return false;
    }
  }

  function handleWindowScroll(evt) {
    windowScrolled = true;
  }

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener("scroll", handleWindowScroll);
})();
