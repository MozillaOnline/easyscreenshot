/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {

  let jsm = {};
  XPCOMUtils.defineLazyModuleGetter(jsm, 'utils', 'resource://easyscreenshot/utils.jsm');
  const prefs = jsm.utils.prefs;

  var ns = MOA.ns('ESS');
  ns.ceEasyScreenshot = {
    buttonID: 'ce_easyscreenshot',
    viewID: 'PanelUI-easyscreenshot-view',

    strings: {
      _bundle: null,
      get: function(name) {
        this._bundle = this._bundle || document.getElementById('easyscreenshot-strings');
        return this._bundle.getString(name);
      }
    },

    handleEvent: function ce_easyscreenshot__handleEvent(aEvt) {
      switch (aEvt.type) {
        case 'unload': {
          this.uninit();
          break;
        }
        case 'load': {
          setTimeout(() => this.init(), 500);
          // On some page after restart, no event other than load is triggerd,
          // thus icon will stay disabled no matter what shouldEnable() returns.
          // The reason of this is still uncertain. Here's the dirty fix by
          // manually checking shouldEnable() after 1 sec.
          setTimeout(() => this.updateUI(aEvt), 1000);
          break;
        }
        case 'TabSelect': {
          this.updateUI(aEvt);
          break;
        }
        case 'popupshowing': {
          this.showSubViewFromArea(aEvt);
          aEvt.preventDefault();
          aEvt.stopPropagation();
          break;
        }
        case 'ViewShowing': {
          let {widget} = this.infoFromEvent(aEvt);
          widget.anchor.setAttribute('open', 'true');
          aEvt.target.removeEventListener('ViewShowing', this);
          break;
        }
        case 'ViewHiding': {
          let {widget} = this.infoFromEvent(aEvt);
          widget.anchor.removeAttribute('open');
          aEvt.target.removeEventListener('ViewHiding', this);
          break;
        }
      }
    },

    onLocationChange: function(aWebProgress, aRequest, aLocationURI, aFlags) {
      if (aWebProgress.isTopLevel && aLocationURI instanceof Ci.nsIURI) {
        this.updateUI();
      }
    },

    onCommand: function ce_easyscreenshot__onCommand(aEvt) {
      let {win} = this.infoFromEvent(aEvt);
      if(this.shouldEnable(aEvt)){
        win.MOA.ESS.Snapshot.startSelection();
      } else {
        win.MOA.ESS.Snapshot.captureVisiblePart();
      }
    },

    shouldEnable: function ce_easyscreenshot__shouldEnable(aEvt) {
      let win = aEvt === undefined ?
        Services.wm.getMostRecentWindow('navigator:browser') :
        this.infoFromEvent(aEvt).win;
      let uri = win.gBrowser.selectedBrowser.currentURI;

      // Button shouldn't be disabled on customization page.
      let whitelist = ['about:customizing'];
      return uri && (whitelist.indexOf(uri.spec) >= 0 || uri.schemeIs('http') || uri.schemeIs('https'));
    },

    updateUI: function ce_easyscreenshot__updateUI(aEvt){
      let {widget} = this.infoFromEvent(aEvt);
      let btn = widget.node;
      if (btn) {
        this.shouldEnable(aEvt) ?
          btn.removeAttribute('disabled') :
          btn.setAttribute('disabled', 'true');
      }
    },

    init: function ce_easyscreenshot__init() {
      this.createButton();
      this.logUsage();
      this.setupHotkeys();
      document.getElementById('PanelUI-popup')
              .addEventListener('popupshown',
                                (aEvt) => this.updateUI(aEvt));
      gBrowser.tabContainer.addEventListener('TabSelect', this, false);
      gBrowser.addProgressListener(this);
    },

    uninit: function ce_easyscreenshot__init() {
      gBrowser.removeProgressListener(this);
    },

    createButton: function ce_easyscreenshot__createButton() {
      let widget = CustomizableUI.getWidget(this.buttonID);
      if (widget && widget.provider == CustomizableUI.PROVIDER_API) {
        return;
      }

      CustomizableUI.createWidget({
        id: this.buttonID,
        type: 'button',
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: this.strings.get('title'),
        tooltiptext: this.strings.get('tooltip'),
        onCreated: (aNode) => {
          aNode.setAttribute('type', 'menu-button');
          let doc = aNode.ownerDocument || document;
          let menupopup = doc.createElement('menupopup');
          menupopup.addEventListener('popupshowing', this);
          aNode.appendChild(menupopup);
        },
        onCommand: (aEvt) => {
          let {areaType} = this.infoFromEvent(aEvt);
          if (areaType == CustomizableUI.TYPE_MENU_PANEL) {
            this.showSubViewFromArea(aEvt, areaType);
          } else {
            this.onCommand(aEvt);
          }
        }
      });
    },

    infoFromEvent: function(aEvt) {
      let doc = aEvt && aEvt.target && aEvt.target.ownerDocument || document;
      let win = doc && doc.defaultView || window;
      let widgetGroup = CustomizableUI.getWidget(this.buttonID);
      return {
        doc: doc,
        win: win,
        widget: widgetGroup.forWindow(win),
        areaType: widgetGroup.areaType
      };
    },

    showSubView: function(aWin, aAnchor, aArea) {
      let view = aWin.document.getElementById(this.viewID);
      view.addEventListener('ViewShowing', this);
      view.addEventListener('ViewHiding', this);
      aAnchor.setAttribute('closemenu', 'none');
      aWin.PanelUI.showSubView(this.viewID, aAnchor, aArea);
    },

    showSubViewFromArea: function(aEvt, aAreaType) {
      let {doc, win, widget, areaType} = this.infoFromEvent(aEvt);
      if ((aAreaType || areaType) == CustomizableUI.TYPE_MENU_PANEL) {
        this.showSubView(win, widget.node, CustomizableUI.AREA_PANEL);
      } else {
        CustomizableUI.hidePanelForNode(widget.node);
        let dm = doc.getAnonymousElementByAttribute(widget.anchor, 'anonid', 'dropmarker');
        let anchor = dm ?
                     doc.getAnonymousElementByAttribute(dm, 'class', 'dropmarker-icon') :
                     widget.anchor;
        this.showSubView(win, anchor, CustomizableUI.AREA_NAVBAR);
      }
    },

    logUsage: function() {
      try {
        Cu.import('resource://cmtracking/ExtensionUsage.jsm', this);
        this.ExtensionUsage.register(this.buttonID, 'window:button',
          'easyscreenshot@mozillaonline.com');
      } catch(e) {};
    },

    setupHotkeys: function() {
      try {
        let hotkeys = [{
          keyID: 'key-snapshot-select',
          modifiersPref: 'extensions.easyscreenshot.hotkeys.select.modifiers',
          keyPref: 'extensions.easyscreenshot.hotkeys.select.key'
        }, {
          keyID: 'key-snapshot-entire',
          modifiersPref: 'extensions.easyscreenshot.hotkeys.entire.modifiers',
          keyPref: 'extensions.easyscreenshot.hotkeys.entire.key'
        }, {
          keyID: 'key-snapshot-visible',
          modifiersPref: 'extensions.easyscreenshot.hotkeys.visible.modifiers',
          keyPref: 'extensions.easyscreenshot.hotkeys.visible.key'
        }];
        hotkeys.forEach((hotkey) => {
          if (Services.prefs.getBoolPref('extensions.easyscreenshot.hotkeys.enabled')) {
            let keyItem = document.getElementById(hotkey.keyID);
            if (keyItem) {
              keyItem.removeAttribute('disabled') ;
              keyItem.setAttribute('modifiers', Services.prefs.getCharPref(hotkey.modifiersPref));
              keyItem.setAttribute('key', Services.prefs.getCharPref(hotkey.keyPref));
            }
          }
        });
      } catch (e) {}
    },

    openSettings: function() {
      let features = 'chrome,titlebar,toolbar,centerscreen';
      try {
        let instantApply = Services.prefs.getBoolPref('browser.preferences.instantApply');
        features += instantApply ? ',dialog=no' : ',modal';
      } catch (e) {
        features += ',modal';
      }
      window.openDialog('chrome://easyscreenshot/content/settings-dialog.xul', 'Settings', features).focus();
    },

    openSnapshotFeedback: function() {
      let src = prefs.getLocale('homepage', 'http://mozilla.com.cn/addon/325-easyscreenshot/');
      gBrowser.selectedTab = gBrowser.addTab(src);
    }
  };

  window.addEventListener('load', ns.ceEasyScreenshot, false);
  window.addEventListener('unload', ns.ceEasyScreenshot, false);

})();
