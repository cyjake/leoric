'use strict';

const spellbook = require('../abstract/spellbook');

/**
 * INSERT ... ON DUPLICATE KEY UPDATE
 * - http://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
 * @param {Spell} spell
 */
function formatMysqlUpsert(spell) {
  const { Model, sets } = spell;
  const { shardingKey } = Model;

  if (shardingKey && sets[shardingKey] == null) {
    throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
  }

  const { driver, primaryKey, primaryColumn } = Model;
  const { sql, values } = spellbook.formatInsert(spell);
  const assigns = [];

  // Make sure the correct LAST_INSERT_ID is returned.
  // - https://stackoverflow.com/questions/778534/mysql-on-duplicate-key-last-insert-id
  assigns.push(`${driver.escapeId(primaryColumn)} = LAST_INSERT_ID(${driver.escapeId(primaryColumn)})`);

  for (const column in sets) {
    if (column !== primaryKey) {
      assigns.push(`${driver.escapeId(Model.unalias(column))} = ?`);
      values.push(sets[column]);
    }
  }

  return {
    sql: `${sql} ON DUPLICATE KEY UPDATE ${assigns.join(', ')}`,
    values
  };
}

module.exports = {
  ...spellbook,

  formatUpsert(spell) {
    return formatMysqlUpsert(spell);
  },
};
