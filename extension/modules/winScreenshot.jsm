var EXPORTED_SYMBOLS = ['winScreenshot'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

const MAX_PATH = 260;

var winScreenshot = {};

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');

var libPath = Services.io.newURI('resource://easyscreenshot/capturescreen.dll', null, null).
              QueryInterface(Ci.nsIFileURL).file.path;
var lib = ctypes.open(libPath);
var charArray = ctypes.jschar.array(MAX_PATH);
var filePath = new charArray();
var createBitMap = lib.declare("createBitMap", ctypes.default_abi, ctypes.void_t, ctypes.jschar.ptr);

winScreenshot.getBitMap = function() {
  var path = ctypes.cast(filePath.address(), ctypes.jschar.ptr);
  createBitMap(path);
  winScreenshot.bitMapFilePath = 'file:///' + path.readString();
};

winScreenshot.bitMapFilePath = '';