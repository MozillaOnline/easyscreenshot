/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  handleEvent: function ce_easyscreenshot__handleEvent(aEvent) {
    switch (aEvent.type) {
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
        setTimeout(() => this.updateUI(aEvent), 1000);
        break;
      }
      case 'TabSelect':
      case 'DOMContentLoaded': {
        this.updateUI(aEvent);
        break;
      }
      case 'popupshowing': {
        this.showSubViewFromArea(aEvent);
        aEvent.preventDefault();
        aEvent.stopPropagation();
        break;
      }
      case 'ViewShowing': {
        let {widget} = this.infoFromEvent(aEvent);
        widget.anchor.setAttribute('open', 'true');
        aEvent.target.removeEventListener('ViewShowing', this);
        break;
      }
      case 'ViewHiding': {
        let {widget} = this.infoFromEvent(aEvent);
        widget.anchor.removeAttribute('open');
        aEvent.target.removeEventListener('ViewHiding', this);
        break;
      }
    }
  },

  onCommand: function ce_easyscreenshot__onCommand(aEvent) {
    if(this.shouldEnable(aEvent)){
      MOA.ESS.Snapshot.startSelection();
    } else {
      MOA.ESS.Snapshot.captureVisiblePart();
    }
  },

  shouldEnable: function ce_easyscreenshot__shouldEnable(aEvent) {
    let {win} = this.infoFromEvent(aEvent);
    let uri = win.gBrowser.selectedBrowser.currentURI;

    // Button shouldn't be disabled on customization page.
    let whitelist = ['about:customizing'];
    return uri && (whitelist.indexOf(uri.spec) >= 0 || uri.schemeIs('http') || uri.schemeIs('https'));
  },

  updateUI: function ce_easyscreenshot__updateUI(aEvent){
    let {widget} = this.infoFromEvent(aEvent);
    let btn = widget.node;
    if (btn) {
      this.shouldEnable(aEvent) ?
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
                              (aEvent) => this.updateUI(aEvent));
    gBrowser.tabContainer.addEventListener('TabSelect', this, false);
    window.addEventListener('DOMContentLoaded', this, false);
  },

  uninit: function ce_easyscreenshot__init() {
    window.removeEventListener('DOMContentLoaded', this, false);
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
      onCommand: (aEvent) => {
        let {areaType} = this.infoFromEvent(aEvent);
        if (areaType == CustomizableUI.TYPE_MENU_PANEL) {
          this.showSubViewFromArea(aEvent, areaType);
        } else {
          this.onCommand(aEvent);
        }
      }
    });
  },

  infoFromEvent: function(aEvent) {
    let doc = aEvent.target && aEvent.target.ownerDocument || document;
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

  showSubViewFromArea: function(aEvent, aAreaType) {
    let {doc, win, widget, areaType} = this.infoFromEvent(aEvent);
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
      let instantApply = Services.prefs.getBranch('browser.preferences.').getBoolPref('instantApply');
      features += instantApply ? ',dialog=no' : ',modal';
    } catch (e) {
      features += ',modal';
    }
    window.openDialog('chrome://easyscreenshot/content/settings-dialog.xul', 'Settings', features).focus();
  },

  openSnapshotFeedback: function() {
    let src = 'http://mozilla.com.cn/addon/325-easyscreenshot/';
    gBrowser.selectedTab = gBrowser.addTab(src);
  }
};

window.addEventListener('load', ns.ceEasyScreenshot, false);
window.addEventListener('unload', ns.ceEasyScreenshot, false);

