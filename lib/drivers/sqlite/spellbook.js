'use strict';

const spellbook = require('../abstract/spellbook');

function renameSelectExpr(spell) {
  const { Model, columns, joins, groups } = spell;
  const whitelist = new Set();

  for (const token of columns) {
    if (token.type == 'id') {
      if (!token.qualifiers && Model.schema[token.value]) {
        token.qualifiers = [Model.aliasName];
      }
      whitelist.add(token.qualifiers[0]);
    }
  }

  for (const qualifier of [Model.aliasName].concat(Object.keys(joins))) {
    if (!whitelist.has(qualifier) && !groups.length > 0) {
      const model = qualifier == Model.aliasName ? Model : joins[qualifier].Model;
      for (const name of model.columns) {
        columns.push({ type: 'id', qualifiers: [qualifier], value: name });
      }
    }
  }

  for (let i = 0; i < columns.length; i++) {
    const token = columns[i];
    const { type, qualifiers, value } = token;
    if (!qualifiers) continue;
    const qualifier = qualifiers[0];
    if (type == 'id') {
      columns[i] = {
        type: 'alias',
        value: `${qualifier}:${value}`,
        args: [ token ],
      };
    }
  }
}

module.exports = {
  ...spellbook,

  formatSelect(spell) {
    if (Object.keys(spell.joins).length > 0) renameSelectExpr(spell);
    return spellbook.formatSelect(spell);
  }
};
