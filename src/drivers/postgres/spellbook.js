'use strict';

const Spellbook = require('../abstract/spellbook');

class PostgresSpellBook extends Spellbook {
  formatInsert(spell) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = super.formatInsert(spell);
    return {
      sql,
      values,
    };
  };

  formatUpsert(spell) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = super.formatUpsert(spell);
    return {
      sql,
      values,
    };
  };
}

module.exports = PostgresSpellBook;
