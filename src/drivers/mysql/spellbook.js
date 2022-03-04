'use strict';

// const SqlString = require('sqlstring');

const { Hint, IndexHint } = require('../../hint');

const spellbook = require('../abstract/spellbook');

module.exports = {
  ...spellbook,

  formatOptimizerHints(spell) {
    const optimizerHints = spell.hints.filter(hint => hint instanceof Hint);
    if (Array.isArray(optimizerHints) && optimizerHints.length > 0) {
      const hints = optimizerHints.map(hint => hint.toSqlString()).join(' ');
      return `/*+ ${hints} */`;
    }
    return '';
  },

  formatIndexHints(spell) {
    const indexHints = spell.hints.filter(hint => hint instanceof IndexHint);
    if (Array.isArray(indexHints) && indexHints.length > 0) {
      const hints = IndexHint.merge(indexHints);
      return hints.map(hint => hint.toSqlString()).join(' ');
    }
    return '';
  },

  /**
   * INSERT ... ON DUPLICATE KEY UPDATE
   * - http://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
   * @param {Spell} spell
   * @param {Array} columns
   */
  formatUpdateOnDuplicate(spell, columns) {
    const { updateOnDuplicate, Model } = spell;
    if (!updateOnDuplicate) return null;
    const { escapeId } = Model.driver;
    const { columnAttributes, primaryColumn } = Model;

    if (Array.isArray(updateOnDuplicate) && updateOnDuplicate.length) {
      columns = updateOnDuplicate.map(column => (columnAttributes[column] && columnAttributes[column].columnName ) || column)
        .filter(column => column !== primaryColumn);
    } else if (!columns.length) {
      columns = Object.values(columnAttributes).map(attribute => attribute.columnName).filter(column => column !== primaryColumn);
    }

    const sets = [];
    // Make sure the correct LAST_INSERT_ID is returned.
    // - https://stackoverflow.com/questions/778534/mysql-on-duplicate-key-last-insert-id
    // if insert columnAttributes include primary column, `primaryKey = LAST_INSERT_ID(primaryKey)` is not need any more
    if (!columns.includes(primaryColumn)) {
      sets.push(`${escapeId(primaryColumn)} = LAST_INSERT_ID(${escapeId(primaryColumn)})`);
    }
    sets.push(...columns.map(column => `${escapeId(column)}=VALUES(${escapeId(column)})`));

    return `ON DUPLICATE KEY UPDATE ${sets.join(', ')}`;
  },

  formatReturning() {
    return '';
  },

  /**
   * UPDATE ... ORDER BY ... LIMIT ${rowCount}
   * - https://dev.mysql.com/doc/refman/8.0/en/update.html
   * @param {Spell} spell
   */
  formatUpdate(spell) {
    const result = spellbook.formatUpdate.call(this, spell);
    const { rowCount, orders } = spell;
    const chunks = [];

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
    if (chunks.length > 0) result.sql += ` ${chunks.join(' ')}`;

    return result;
  },
  /**
   * DELETE ... ORDER BY ...LIMIT
   * @param {Spell} spell 
   */
  formatDelete(spell) {
    const result = spellbook.formatDelete.call(this, spell);
    const { rowCount, orders } = spell;
    const chunks = [];

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
    if (chunks.length > 0) result.sql += ` ${chunks.join(' ')}`;

    return result;
  }
};
