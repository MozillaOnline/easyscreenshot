/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var ns = MOA.ns('ESS');
ns.ceEasyScreenshot = {
  handleEvent: function ce_easyscreenshot__handleEvent(aEvent) {
    switch (aEvent.type) {
      case 'unload':
        this.uninit();
        break;
      case 'load':
        setTimeout(this.init.bind(this), 500);
        // On some page after restart, no event other than load is triggerd,
        // thus icon will stay disabled no matter what isHttp() returns.
        // The reason of this is still uncertain. Here's the dirty fix by
        // manually checking isHttp() after 1 sec.
        setTimeout(function() {
          this.updateUI(this.isHttp());
        }.bind(this), 1000);
        break;
      case 'TabSelect':
      case 'DOMContentLoaded':
        this.updateUI(this.isHttp());
        break;
    }
  },

  onCommand: function ce_easyscreenshot__onCommand(){
    if(this.isHttp()){
      MOA.ESS.Snapshot.ssSelector();
    } else {
      MOA.ESS.Snapshot.getSnapshot('visible');
    }
  },

  isHttp: function ce_easyscreenshot__isHttp(){
    var tab = gBrowser.mCurrentTab;
    var uri = null;
    if (tab && tab.linkedBrowser) {
      uri = tab.linkedBrowser.currentURI;
    }

    return uri && (uri.schemeIs('http') || uri.schemeIs('https'));
  },

  updateUI: function ce_easyscreenshot__updateUI(isHttp){
    var btn =  document.getElementById('ce_easyscreenshot');
//    var select = document.getElementById('easyscreenshot-snapshot-select');
//    var entire = document.getElementById('easyscreenshot-snapshot-entire');
    if(this.isHttp()){
      btn.removeAttribute('disabled')
//      select.setAttribute('disabled', 'false')
//      entire.setAttribute('disabled', 'false')
    } else {
      btn.setAttribute('disabled', 'true')
//      select.setAttribute('disabled', 'true')
//      entire.setAttribute('disabled', 'true')
    }
  },

  init: function ce_easyscreenshot__init() {
    this.installButton('ce_easyscreenshot', 'nav-bar');
    gBrowser.tabContainer.addEventListener('TabSelect', this, false);
    window.addEventListener('DOMContentLoaded', this, false);
  },

  uninit: function ce_easyscreenshot__init() {
    window.removeEventListener('DOMContentLoaded', this, false);
  },

  installButton: function ce_easyscreenshot__installButton(buttonId,toolbarId) {
    toolbarId = toolbarId || 'addon-bar';
    var key = 'extensions.toolbarbutton.installed.' + buttonId;
    if (Application.prefs.getValue(key, false))
      return;

    var toolbar = window.document.getElementById(toolbarId);
    let curSet = toolbar.currentSet;
    if (-1 == curSet.indexOf(buttonId)) {
      let newSet = curSet + ',' + buttonId;
      toolbar.currentSet = newSet;
      toolbar.setAttribute('currentset', newSet);
      document.persist(toolbar.id, 'currentset');
      try {
        BrowserToolboxCustomizeDone(true);
      } catch(e) {}
    }
    if (toolbar.getAttribute('collapsed') == 'true') {
      toolbar.setAttribute('collapsed', 'false');
    }
    document.persist(toolbar.id, 'collapsed');
    Application.prefs.setValue(key, true);
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
    var filename = _stringBundle.getFormattedString('screentShotFile', [iso8601FromDate(new Date()) + '.png']);
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
      var message = _stringBundle.getFormattedString('screentShotSaved', [file.path]);
      Application.console.log('overlay-browser.js::188 ' + message)
    }
  },
};

window.addEventListener('load', ns.ceEasyScreenshot, false);
window.addEventListener('unload', ns.ceEasyScreenshot, false);

