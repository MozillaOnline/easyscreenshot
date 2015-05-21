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
    let {win} = this.infoFromEvent(aEvent);
    if(this.shouldEnable(aEvent)){
      win.MOA.ESS.Snapshot.ssSelector();
    } else {
      win.MOA.ESS.Snapshot.getSnapshot('visible');
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
    if (Services.appinfo.OS == 'WINNT') {
      document.getElementById('easyscreenshot-snapshot-screen-select').removeAttribute('hidden');
    }
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
        keyID: 'key-snapshot-screen-select',
        modifiersPref: 'extensions.easyscreenshot.hotkeys.screen.select.modifiers',
        keyPref: 'extensions.easyscreenshot.hotkeys.screen.select.key'
      }, {
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

  getScreenShot: function() {
    function runProc(relPath,args) {
      try {
        var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(relPath);
        var process=Components.classes['@mozilla.org/process/util;1'].createInstance(Components.interfaces.nsIProcess);
        process.init(file);
        process.runw(false, args, args.length);
      } catch(e) {
        Application.console.log('overlay-browser.js::98 ' + e);
      }
    }

    function iso8601FromDate(date, punctuation) {
      var string = date.getFullYear().toString();
      if (punctuation) {
        string += '-';
      }
      string += (date.getMonth() + 1).toString().replace(/\b(\d)\b/g, '0$1');
      if (punctuation) {
        string += '-';
      }
      string += date.getDate().toString().replace(/\b(\d)\b/g, '0$1');
      if (1 || date.time) {
        string += date.getHours().toString().replace(/\b(\d)\b/g, '0$1');
        if (punctuation) {
          string += ':';
        }
        string += date.getMinutes().toString().replace(/\b(\d)\b/g, '0$1');
        if (punctuation) {
          string += ':';
        }
        string += date.getSeconds().toString().replace(/\b(\d)\b/g, '0$1');
        if (date.getMilliseconds() > 0) {
          if (punctuation) {
            string += '.';
          }
          string += date.getMilliseconds().toString();
        }
      }
      return string;
    }
    var _stringBundle = document.getElementById('easyscreenshot-strings');

    var file = Components.classes['@mozilla.org/file/directory_service;1']
                         .getService(Components.interfaces.nsIProperties)
                         .get('Desk', Components.interfaces.nsIFile);
    var filename = _stringBundle.getFormattedString('screenshotFile', [iso8601FromDate(new Date()) + '.png']);
    file.append(filename);
    file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

    var io = Components.classes['@mozilla.org/network/io-service;1']
                  .getService(Components.interfaces.nsIIOService);
    var target = io.newFileURI(file)

    var mainwin = document.getElementById('main-window');
    if (!mainwin.getAttribute('xmlns:html'))
      mainwin.setAttribute('xmlns:html', 'http://www.w3.org/1999/xhtml');

    var content = window.content;
    if (content.document instanceof XULDocument) {
      var insideBrowser = content.document.querySelector('browser');
      content = insideBrowser ? insideBrowser.contentWindow : content;
    }
    var desth = content.innerHeight + content.scrollMaxY;
    var destw = content.innerWidth + content.scrollMaxX;

    // Unfortunately there is a limit:
    if (desth > 16384) desth = 16384;

    var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'html:canvas');
    var ctx = canvas.getContext('2d');

    canvas.height = desth;
    canvas.width = destw;
    ctx.clearRect(0, 0, destw, desth);
    ctx.save();
    ctx.drawWindow(content, 0, 0, destw, desth, 'rgb(255,255,255)');
    var data = canvas.toDataURL('image/png', '');
    var source = io.newURI(data, 'UTF8', null);
    // prepare to save the canvas data
    var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
                            .createInstance(Components.interfaces.nsIWebBrowserPersist);

    persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    persist.persistFlags |= Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
    // save the canvas data to the file

    Cu.import('resource://gre/modules/PrivateBrowsingUtils.jsm')
    var pc = PrivateBrowsingUtils.privacyContextFromWindow(content)
    persist.saveURI(source, null, null, null, null, file, pc);
    if (Services.appinfo.OS == 'WINNT') {
      var winDir = Components.classes['@mozilla.org/file/directory_service;1'].
        getService(Components.interfaces.nsIProperties).get('WinD', Components.interfaces.nsILocalFile);
      runProc(winDir.path + '\\system32\\mspaint.exe', [file.path]);
    } else if (Services.appinfo.OS == 'Darwin') {
      runProc('/usr/bin/open', ['-a', 'Preview', file.path]);
    } else {
      var message = _stringBundle.getFormattedString('screenshotSaved', [file.path]);
      Application.console.log('overlay-browser.js::188 ' + message)
    }
  },
};

window.addEventListener('load', ns.ceEasyScreenshot, false);
window.addEventListener('unload', ns.ceEasyScreenshot, false);

