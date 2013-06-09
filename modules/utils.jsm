var EXPORTED_SYMBOLS = ['utils'];

const Cc = Components.classes;
const Ci = Components.interfaces;


var utils = {
};

Components.utils['import']('resource://easyscreenshot/3rd/log4moz.js');
var loggers = {};

function CommonLogger (nameSpace) {
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
    // dump("Logger already exists: " + ns + "\n");
  }
  return loggers[ns];
};
