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
    const { attributes, primaryColumn } = Model;

    if (Array.isArray(updateOnDuplicate) && updateOnDuplicate.length) {
      columns = updateOnDuplicate.map(column => (attributes[column] && attributes[column].columnName ) || column)
        .filter(column => column !== primaryColumn);
    } else if (!columns.length) {
      columns = Object.values(attributes).map(attribute => attribute.columnName).filter(column => column !== primaryColumn);
    }

    const sets = [];
    // Make sure the correct LAST_INSERT_ID is returned.
    // - https://stackoverflow.com/questions/778534/mysql-on-duplicate-key-last-insert-id
    sets.push(`${escapeId(primaryColumn)} = LAST_INSERT_ID(${escapeId(primaryColumn)})`);
    sets.push(...columns.map(column => `${escapeId(column)}=VALUES(${escapeId(column)})`));

    return `ON DUPLICATE KEY UPDATE ${sets.join(', ')}`;
  },

  formatReturning() {
    return '';
  },

  formatUpdateExtraOptions(spell) {
    const { rowCount, orders } = spell;

    const chunks = [];
    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);

    if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
    return chunks;
  }
};
