var EXPORTED_SYMBOLS = ['utils'];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

var utils = {};

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Preferences',
  'resource://gre/modules/Preferences.jsm');

utils.prefs = Object.create(new Preferences('extensions.easyscreenshot.'));

utils.prefs.getFile = function(k, v) {
  try {
    return this._prefSvc.getComplexValue(k, Ci.nsILocalFile) || v;
  } catch (e) {
    return this.get(k, v);
  }
};

utils.prefs.setFile = function(k, v) {
  this._prefSvc.setComplexValue(k, Ci.nsILocalFile, v);
};

utils.prefs.getLocale = function(k, v) {
  try{
    return this._prefSvc.getComplexValue(k, Ci.nsIPrefLocalizedString).data || v;
  } catch (e) {
    return this.get(k, v);
  }
};

utils.prefs.setLocale = function(k, v) {
  let pls = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
  pls.data = v;
  this._prefSvc.setComplexValue(k, Ci.nsIPrefLocalizedString, pls);
};

Cu.import('resource://easyscreenshot/3rd/log4moz.js');
var loggers = {};

function CommonLogger(nameSpace) {
  this.nameSpace = nameSpace;
  this.initialize();
};

CommonLogger.prototype = {
  initialize: function() {
    this.logger = Log4Moz.repository.getLogger(this.nameSpace);
  },

  trace: function(msg) {
    this.logger.level = Log4Moz.Level['Trace'];
    this.logger.trace(msg);
  },

  error: function(msg) {
    this.logger.level = Log4Moz.Level['Error'];
    this.logger.error(msg);
  },

  info: function(msg) {
    this.logger.level = Log4Moz.Level['Info'];
    this.logger.info(msg);
  }
};

utils.logger = function(ns) {
  if (!loggers[ns]) {
    loggers[ns] = new CommonLogger(ns);
  } else {
    // dump('Logger already exists: ' + ns + '\n');
  }
  return loggers[ns];
};
