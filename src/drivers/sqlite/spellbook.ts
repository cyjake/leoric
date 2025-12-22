import Spellbook from '../abstract/spellbook';
import type Spell from '../../spell';
import { Literal } from '../../types/common';
import { AbstractBone } from '../../types/abstract_bone';

function renameSelectExpr<T extends typeof AbstractBone>(spell: Spell<T>): void {
  const { Model, columns, joins, groups } = spell;
  const whitelist = new Set<string>();

  for (const token of columns) {
    if (token.type === 'id') {
      if (!token.qualifiers && Model.columnAttributes[token.value]) {
        token.qualifiers = [Model.tableAlias];
      }
      if (token.qualifiers && token.qualifiers[0]) {
        whitelist.add(token.qualifiers[0]);
      }
    }
  }

  for (const qualifier of [Model.tableAlias].concat(Object.keys(joins))) {
    if (!whitelist.has(qualifier) && groups.length === 0) {
      const model = qualifier === Model.tableAlias ? Model : (joins as any)[qualifier].Model;
      for (const definition of model.columns) {
        const value = definition.columnName;
        columns.push({ type: 'id', qualifiers: [qualifier], value });
      }
    }
  }

  for (let i = 0; i < columns.length; i++) {
    const token = columns[i];
    const { type, qualifiers, value } = token;
    if (!qualifiers || type !== 'id') continue;
    const qualifier = qualifiers[0];
    columns[i] = {
      type: 'alias',
      value: `${qualifier}:${value}`,
      args: [token],
    };
  }
}

class SQLiteSpellBook extends Spellbook {
  formatSelect<T extends typeof AbstractBone>(spell: Spell<T>): { sql: string; values: Literal[]} {
    if (Object.keys((spell).joins).length > 0) {
      spell = (spell).dup;
      renameSelectExpr(spell);
    }
    return super.formatSelect(spell);
  }
}

export default SQLiteSpellBook;
