'use strict';

const SqlString = require('sqlstring');

exports.escape = function escape(value) {
  return SqlString.escape(value);
};

exports.escapeId = function escapeId(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
};

