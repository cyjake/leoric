'use strict';

module.exports = class Raw {
  constructor(value) {
    this.value = value;
    // consumed in expr_formatter.js
    this.type = 'raw';
  }
};
