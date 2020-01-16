'use strict';

const assert = require('assert').strict;
const { Bone } = require('../../..');

async function checkDefinitions(table, definitions) {
  const { database } = Bone.options;
  const schemaInfo = await Bone.driver.querySchemaInfo(database, table);
  const columns = schemaInfo[table];

  // checkDefinitions('notes', null)
  assert.ok(definitions ? columns : !columns);

  for (const columnName in definitions) {
    const found = columns.find(entry => entry.columnName === columnName);
    const definition = definitions[columnName];
    if (definition) {
      for (const key in definition) assert.equal(found[key], definition[key]);
    } else {
      assert.ok(found == null);
    }
  }
}

module.exports = { checkDefinitions };
