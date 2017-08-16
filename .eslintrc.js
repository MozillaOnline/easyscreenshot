"use strict";

module.exports = {
  "env": {
    "webextensions": true
  },
  "extends": [
    "plugin:mozilla/recommended"
  ],
  "globals": {
    "Chaz": true,
  },
  "parserOptions" :{
    "ecmaFeatures" :{
      "experimentalObjectRestSpread" :true,
    },
  },
  "plugins": [
    "mozilla"
  ]
};
