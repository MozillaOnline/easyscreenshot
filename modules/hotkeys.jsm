let EXPORTED_SYMBOLS = ['hotkeys'];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

if (typeof XPCOMUtils == 'undefined') {
  Cu.import('resource://gre/modules/XPCOMUtils.jsm');
}

let jsm = {};
XPCOMUtils.defineLazyModuleGetter(jsm, 'utils',
  'resource://easyscreenshot/utils.jsm');
const prefs = jsm.utils.prefs;

let {devtools} = Cu.import('resource://gre/modules/devtools/Loader.jsm', {});
let {require} = devtools;
let {Hotkey} = require('sdk/hotkeys');

let hotkeys = {
  _hotkeys: {},
  _callbacks: {},
  combo: function(aName) {
    let modifiers = prefs.get('hotkeys.' + aName + '.modifiers');
    let key = prefs.get('hotkeys.' + aName + '.key');
    return modifiers.replace(/\s+/g, '-') + '-' + key;
  },
  get: function(aName) {
    return this._hotkeys[aName];
  },
  set: function(aName, aCallback) {
    this.get(aName) && this.get(aName).destroy();
    this._hotkeys[aName] = Hotkey({
      combo: this.combo(aName),
      onPress: aCallback
    });
    this._callbacks[aName] = aCallback;
  },
  watch: function(aName) {
    let observer = () => {
      this.set(aName, this._callbacks[aName]);
    };
    prefs.observe('hotkeys.' + aName + '.modifiers', observer);
    prefs.observe('hotkeys.' + aName + '.key', observer);
  }
};
