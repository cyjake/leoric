'use strict';

const spellbook = require('../abstract/spellbook');

module.exports = {
  ...spellbook,

  formatInsert(spell) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = spellbook.formatInsert(spell);
    return {
      sql,
      values,
    };
  },

  formatUpsert(spell) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = spellbook.formatUpsert(spell);
    return {
      sql,
      values,
    };
  },
};
