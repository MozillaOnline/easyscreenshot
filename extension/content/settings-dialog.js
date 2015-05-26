/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import('resource://gre/modules/Services.jsm');

var settings = {
  _getDownloadsFolder: function(aFolder) {
    switch (aFolder) {
      case 'Desktop': {
        return Services.dirsvc.get('Desk', Ci.nsILocalFile);
        break;
      }
      case 'Downloads': {
        let dnldMgr = Cc['@mozilla.org/download-manager;1']
                      .getService(Ci.nsIDownloadManager);
        return dnldMgr.defaultDownloadsDirectory;
        break;
      }
      default: {
        throw "ASSERTION FAILED: folder type should be 'Desktop' or 'Downloads'";
      }
    }
  },

  _folderToIndex: function(aFolder) {
    if (!aFolder || aFolder.equals(this._getDownloadsFolder('Desktop'))) {
      return 0;
    } else if (aFolder.equals(this._getDownloadsFolder('Downloads'))) {
      return 1;
    } else {
      return 2;
    }
  },

  _setSaveDirElem: function(aFolder) {
    let path = aFolder.path;
    let saveDirPref = document.getElementById('pref-saveposition');
    saveDirPref.value = aFolder;

    let saveDirElem = document.getElementById('settings-saveposition');
    let bundlePreferences = document.getElementById('bundlePreferences');
    switch(this._folderToIndex(aFolder)) {
      case 0: {
        saveDirElem.label = bundlePreferences.getString('desktopFolderName');
        break;
      }
      case 1: {
        saveDirElem.label = bundlePreferences.getString('downloadsFolderName');
        break;
      }
      case 2: {
        saveDirElem.label = path;
        break;
      }
    }

    let ios = Cc['@mozilla.org/network/io-service;1']
              .getService(Ci.nsIIOService);
    let fph = ios.getProtocolHandler('file')
              .QueryInterface(Ci.nsIFileProtocolHandler);
    let iconUrlSpec = fph.getURLSpecFromFile(aFolder);
    saveDirElem.image = 'moz-icon://' + iconUrlSpec + '?size=16';
  },

  _init: function() {
    let saveDirPref = document.getElementById('pref-saveposition');
    if (!saveDirPref.value) {
      saveDirPref.value = this._getDownloadsFolder('Desktop');
    }
    this._setSaveDirElem(saveDirPref.value);

    this.refreshHotkeysBox();
    if (Services.appinfo.OS == 'WINNT') {
      document.getElementById('fullscreenshot').removeAttribute('hidden');
    }
  },

  refreshHotkeysBox: function(toDisable) {
    if (toDisable === undefined) {
      let enableHotkeysPref = document.getElementById('pref-enablehotkeys');
      toDisable = !enableHotkeysPref.value;
    }
    let hotkeysBox = document.getElementById('settings-hotkeys');
    ['label', 'menulist'].forEach((tag) => {
      [].forEach.call(hotkeysBox.getElementsByTagName(tag), function(ele) {
        toDisable ?
          ele.setAttribute('disabled', 'true') :
          ele.removeAttribute('disabled');
      });
    });
  },

  chooseSaveDir: function() {
    let bundlePreferences = document.getElementById('bundlePreferences');
    let title = bundlePreferences.getString('chooseDownloadFolderTitle');
    let fp = Cc['@mozilla.org/filepicker;1']
             .createInstance(Ci.nsIFilePicker);
    fp.init(window, title, Ci.nsIFilePicker.modeGetFolder);
    fp.appendFilters(Ci.nsIFilePicker.filterAll);

    if (fp.show() != Ci.nsIFilePicker.returnCancel) {
      this._setSaveDirElem(fp.file);
    }
  },
};

window.addEventListener('load', function() {
  settings._init();
}, false);
