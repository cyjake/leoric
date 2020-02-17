'use strict';

const { escapeId } = require('./sqlstring');
const spellbook = require('../abstract/spellbook');

module.exports = {
  ...spellbook,

  formatInsert(spell) {
    const { sql, values } = spellbook.formatInsert(spell);
    const { primaryColumn } = spell.Model;
    return {
      sql: `${sql} RETURNING ${escapeId(primaryColumn)}`,
      values,
    };
  },

  formatUpsert(spell) {
    const { sql, values } = spellbook.formatUpsert(spell);
    const { primaryColumn } = spell.Model;
    return {
      sql: `${sql} RETURNING ${escapeId(primaryColumn)}`,
      values,
    };
  },
};
