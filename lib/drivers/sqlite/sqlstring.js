'use strict';

const SqlString = require('sqlstring');

exports.escape = function escape(value) {
  if (typeof value === 'boolean') return +value;
  return SqlString.escape(value);
};

exports.escapeId = function escapeId(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
};
