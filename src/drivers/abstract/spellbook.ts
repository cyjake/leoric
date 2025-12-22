import SqlString from 'sqlstring';
import { Expr, findExpr, walkExpr } from '../../expr';
import { formatExpr, formatConditions, collectLiteral, isAggregatorExpr } from '../../expr_formatter';
import Raw from '../../raw';
import type Spell from '../../spell';
import { AbstractBone } from '../../types/abstract_bone';
import { Literal } from '../..';

/**
 * Make sure columns are qualified
 */
function qualify<T extends typeof AbstractBone>(spell: Spell<T>) {
  const { Model, columns, groups, whereConditions, havingConditions, orders } = spell;
  const baseName = Model.tableAlias;
  const clarify = (node: any) => {
    if (node.type === 'id' && !node.qualifiers) {
      if (Model.columnAttributes[node.value]) node.qualifiers = [ baseName ];
    }
  };

  for (const ast of columns.concat(groups, whereConditions, havingConditions)) {
    walkExpr(ast, clarify);
  }

  for (const [ ast ] of orders) {
    walkExpr(ast, clarify);
  }
}

/**
 * Format select list that indicates which columns to retrieve
 */
function formatSelectExpr<T extends typeof AbstractBone>(spell: Spell<T>, values: any[]) {
  const { Model, columns, joins, groups } = spell;
  const { escapeId } = Model.driver;
  const baseName = Model.tableAlias;
  const selects = new Set<string>();
  const map: Record<string, string[]> = {};
  let isAggregate = false;

  for (const token of columns) {
    collectLiteral(spell, token, values);
    const selectExpr = formatExpr(spell, token);
    isAggregate = isAggregate || isAggregatorExpr(spell, token);
    const qualifier = token.qualifiers ? token.qualifiers[0] : '';
    const list = map[qualifier] || (map[qualifier] = []);
    list.push(selectExpr);
  }

  for (const qualifier of [ baseName ].concat(Object.keys(joins))) {
    const list = map[qualifier];
    if (list) {
      for (const selectExpr of list) selects.add(selectExpr);
    } else if (groups.length === 0 && ![ 'sqlite', 'sqljs' ].includes(Model.driver.type) && !isAggregate) {
      selects.add(`${escapeId(qualifier)}.*`);
    }
  }

  if (map['']) {
    for (const selectExpr of map['']) selects.add(selectExpr);
  }

  return Array.from(selects);
}

export default class SpellBook {
  format<T extends typeof AbstractBone>(spell: Spell<T>) {
    for (const scope of spell.scopes) scope(spell);
    switch (spell.command) {
      case 'insert':
      case 'bulkInsert':
        return this.formatInsert(spell);
      case 'select':
        return this.formatSelect(spell);
      case 'update':
        return this.formatUpdate(spell);
      case 'delete':
        return this.formatDelete(spell);
      case 'upsert':
        return this.formatUpsert(spell);
      default:
        throw new Error(`Unsupported SQL command ${spell.command}`);
    }
  }

  /**
   * @returns optimizer hints
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatOptimizerHints<T extends typeof AbstractBone>(spell?: Spell<T>): string {
    return '';
  }

  /**
   * @returns index hints
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatIndexHints<T extends typeof AbstractBone>(spell?: Spell<T>): string {
    return '';
  }

  /**
  * Format a spell into INSERT query.
  */
  formatInsert<T extends typeof AbstractBone>(spell: Spell<T>) {
    const { Model, sets, updateOnDuplicate } = spell;
    const { shardingKey } = Model;
    const { createdAt } = Model.timestamps;
    const { escapeId } = Model.driver;
    const columns: string[] = [];
    const updateOnDuplicateColumns: string[] = [];

    const values: any[] = [];
    const placeholders: string[] = [];
    if (Array.isArray(sets)) {
      // merge records to get the big picture of involved columnAttributes
      const involved = sets.reduce((result: any, entry: any) => {
        return Object.assign(result, entry);
      }, {} as Record<string, any>);
      const columnAttributes: any[] = [];

      for (const name in involved) {
        columnAttributes.push(Model.columnAttributes[name]);
      }

      for (const entry of columnAttributes) {
        columns.push(entry.columnName);
        if (updateOnDuplicate && createdAt && entry.name === createdAt
          && !(Array.isArray(updateOnDuplicate) && updateOnDuplicate.includes(createdAt))) continue;
        updateOnDuplicateColumns.push(entry.columnName);
      }

      for (const entry of sets) {
        if (shardingKey && entry[shardingKey] == null) {
          throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
        }
        for (const attribute of columnAttributes) {
          const { name } = attribute;
          values.push(entry[name]);
        }
        placeholders.push(`(${new Array(columnAttributes.length).fill('?').join(',')})`);
      }

    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (shardingKey && sets![shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
      }
      for (const name in sets) {
        const value = sets[name];
        columns.push(Model.unalias(name));
        if (value instanceof Raw) {
          values.push(SqlString.raw(value.value));
        } else {
          values.push(value);
        }
        if (updateOnDuplicate && createdAt && name === createdAt) continue;
        updateOnDuplicateColumns.push(Model.unalias(name));
      }
    }


    const chunks: string[] = [ 'INSERT' ];

    // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
    const hintStr = this.formatOptimizerHints(spell);
    if (hintStr) {
      chunks.push(hintStr);
    }
    chunks.push(`INTO ${escapeId(Model.table)} (${columns.map((column: string) => escapeId(column)).join(', ')})`);
    if (placeholders.length) {
      chunks.push(`VALUES ${placeholders.join(', ')}`);
    } else {
      chunks.push(`VALUES (${columns.map(() => '?').join(', ')})`);
    }
    chunks.push(this.formatUpdateOnDuplicate(spell, updateOnDuplicateColumns));
    chunks.push(this.formatReturning(spell));
    return {
      sql: chunks.join(' ').trim(),
      values,
    };
  }

  /**
   * Format a spell without joins into a full SELECT query.
   */
  formatSelectWithoutJoin<T extends typeof AbstractBone>(spell: Spell<T>) {
    const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip, Model } = spell;
    const { escapeId } = Model.driver;
    const chunks: string[] = [ 'SELECT' ];
    const values: any[] = [];

    // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
    const hintStr = this.formatOptimizerHints(spell);

    if (hintStr) {
      chunks.push(hintStr);
    }

    if (columns.length > 0) {
      for (const column of columns) collectLiteral(spell, column, values);
      const selects: string[] = [];
      for (const token of columns) {
        const column = formatExpr(spell, token);
        if (!selects.includes(column)) selects.push(column);
      }
      chunks.push(`${selects.join(', ')}`);
    } else {
      chunks.push('*');
    }

    const table = formatExpr(spell, spell.table);
    chunks.push(`FROM ${table}`);
    if (spell.table.value instanceof spell.constructor) {
      const subTableAlias = spell.table.value.Model && spell.table.value.Model.tableAlias;
      chunks.push(`AS ${subTableAlias ? escapeId(subTableAlias) : `t${spell.subqueryIndex++}`}`);
    }

    // see https://dev.mysql.com/doc/refman/8.0/en/index-hints.html
    const indexHintStr = this.formatIndexHints(spell);
    if (indexHintStr) {
      chunks.push(indexHintStr);
    }

    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, values);
      chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
    }

    if (groups.length > 0) {
      const groupColumns = groups.map((group: any) => formatExpr(spell, group));
      chunks.push(`GROUP BY ${groupColumns.join(', ')}`);
    }

    if (havingConditions.length > 0) {
      for (const condition of havingConditions) collectLiteral(spell, condition, values);
      chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
    }

    if (orders.length > 0) {
      for (const [ expr ] of orders) collectLiteral(spell, expr, values);
      chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    }
    if (Number(rowCount) > 0) chunks.push(`LIMIT ${rowCount}`);
    if (skip > 0) chunks.push(`OFFSET ${skip}`);

    return { sql: chunks.join(' '), values };
  }

  /**
   * INSERT ... ON CONFLICT ... UPDATE SET
   */
  formatUpsert<T extends typeof AbstractBone>(spell: Spell<T>) {
    if (!spell.updateOnDuplicate) {
      spell.updateOnDuplicate = true;
    }

    const { sql, values } = this.formatInsert(spell);
    return {
      sql,
      values,
    };
  }

  /**
   * @returns returning sql string
   */
  formatReturning<T extends typeof AbstractBone>(spell: Spell<T>) {
    const { Model, returning } = spell;
    const { primaryColumn } = Model;
    const { escapeId } = Model.driver;

    let returnings: string[] | undefined;
    if (returning === true) returnings = [ escapeId(primaryColumn) ];
    if (Array.isArray(returning)) {
      returnings = (returning as string[]).map(escapeId);
    }
    return returnings && returnings.length ? `RETURNING ${returnings.join(', ')}` : '';
  }

  /**
   * @param columns columns for value set
   */
  formatUpdateOnDuplicate<T extends typeof AbstractBone>(spell: Spell<T>, columns: string[]) {
    const { updateOnDuplicate, uniqueKeys, Model, sets } = spell;
    if (!updateOnDuplicate) return '';
    const { columnAttributes, primaryColumn } = Model;
    const { escapeId } = Model.driver;
    const actualUniqueKeys: string[] = [];

    if (uniqueKeys) {
      for (const field of ([] as string[]).concat(uniqueKeys)) {
        actualUniqueKeys.push(escapeId(field));
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const setFields = Object.keys(sets!);
      if (columnAttributes) {
        for (const key in columnAttributes) {
          const att = columnAttributes[key];
          if (att.unique || (att.primaryKey && setFields.includes(att.name))) {
            actualUniqueKeys.push(escapeId(att.columnName));
            break;
          }
        }
      }

      if (!actualUniqueKeys.length) actualUniqueKeys.push(escapeId(primaryColumn));
      if (!actualUniqueKeys.length) actualUniqueKeys.push(escapeId('id'));
    }

    if (Array.isArray(updateOnDuplicate) && updateOnDuplicate.length) {
      columns = updateOnDuplicate.map((column: string) => (columnAttributes[column] && columnAttributes[column].columnName) || column);
    } else if (!columns.length) {
      columns = Object.values(columnAttributes).map(({ columnName }) => columnName);
    }
    const updateKeys = columns.map((column: string) => `${escapeId(column)}=EXCLUDED.${escapeId(column)}`);

    return `ON CONFLICT (${actualUniqueKeys.join(', ')}) DO UPDATE SET ${updateKeys.join(', ')}`;
  }

  /**
   * Format a spell into UPDATE query
   */
  formatUpdate<T extends typeof AbstractBone>(spell: Spell<T>): { sql: string; values?: Literal[] | Record<string, Literal> } {
    const { Model, sets, whereConditions } = spell as Spell<T> & {
      sets: Record<string, Literal | (Expr & { __expr: true })>;
    };
    const { shardingKey } = Model;

    if (shardingKey) {
      if (Object.prototype.hasOwnProperty.call(sets, shardingKey) && sets[shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
      }
      if (!whereConditions.some((condition: any) => findExpr(condition, { type: 'id', value: shardingKey }))) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
      }
    }

    if (Object.keys(sets).length === 0) {
      throw new Error('Unable to update with empty set');
    }

    const chunks: string[] = [ 'UPDATE' ];

    const values: any[] = [];
    const assigns: string[] = [];
    const { escapeId } = Model.driver;
    for (const name in sets) {
      const value = sets[name];
      const columnName = escapeId(Model.unalias(name));
      if (value && (value as { __expr: true }).__expr) {
        assigns.push(`${columnName} = ${formatExpr(spell, value as Expr)}`);
        collectLiteral(spell, value as Expr, values);
      } else if (value instanceof Raw) {
        assigns.push(`${columnName} = ${value.value}`);
      } else {
        assigns.push(`${columnName} = ?`);
        values.push(sets[name]);
      }
    }

    const hintStr = this.formatOptimizerHints(spell);
    const indexHintStr = this.formatIndexHints(spell);

    if (hintStr) {
      chunks.push(hintStr);
    }
    chunks.push(escapeId(Model.table));
    if (indexHintStr) {
      chunks.push(indexHintStr);
    }

    chunks.push(`SET ${assigns.join(', ')}`);
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, values);
      chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
    }

    return {
      sql: chunks.join(' '),
      values,
    };
  }

  /**
   * Format the spell into a DELETE query.
   */
  formatDelete<T extends typeof AbstractBone>(spell: Spell<T>): { sql: string; values?: Literal[] | Record<string, Literal> } {
    const { Model, whereConditions } = spell;
    const { shardingKey } = Model;
    const { escapeId } = Model.driver;
    const table = escapeId(Model.table);

    if (shardingKey && !whereConditions.some((condition: any) => findExpr(condition, { type: 'id', value: shardingKey }))) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
    }

    const chunks: string[] = [ 'DELETE' ];

    const hintStr = this.formatOptimizerHints(spell);
    if (hintStr) {
      chunks.push(hintStr);
    }

    chunks.push(`FROM ${table}`);

    if (whereConditions.length > 0) {
      const values: Literal[] = [];
      for (const condition of whereConditions) collectLiteral(spell, condition, values);
      chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
      return {
        sql: chunks.join(' '),
        values,
      };
    } else {
      return { sql: chunks.join(' ') };
    }
  }

  /**
   * To help choosing the right function when formatting a spell into SELECT query.
   */
  formatSelect<T extends typeof AbstractBone>(spell: Spell<T>) {
    const { whereConditions } = spell;
    const { shardingKey, table } = (spell).Model;

    if (shardingKey && !whereConditions.some((condition: any) => findExpr(condition, { type: 'id', value: shardingKey }))) {
      throw new Error(`Sharding key ${table}.${shardingKey} is required.`);
    }

    if ((spell).skip > 0 && (spell).rowCount == null) {
      throw new Error('Unable to query with OFFSET yet without LIMIT');
    }

    return Object.keys((spell).joins).length > 0
      ? this.formatSelectWithJoin(spell)
      : this.formatSelectWithoutJoin(spell);
  }

  /**
   * Format a spell with joins into a full SELECT query.
   */
  formatSelectWithJoin<T extends typeof AbstractBone>(spell: Spell<T>) {
    // Since it is a JOIN query, make sure columns are always qualified.
    qualify(spell);

    const { Model, whereConditions, groups, havingConditions, orders, rowCount, skip, joins } = spell;
    const { escapeId } = Model.driver;
    const baseName = Model.tableAlias;

    const chunks: string[] = [ 'SELECT' ];
    const values: any[] = [];
    const selects = formatSelectExpr(spell, values);

    const hintStr = this.formatOptimizerHints(spell);

    if (hintStr) {
      chunks.push(hintStr);
    }
    chunks.push(selects.join(', '));

    const table = formatExpr(spell, (spell).table);
    chunks.push(`FROM ${table}`);
    if ((spell).table.value instanceof (spell).constructor) {
      const subTableAlias = (spell).table.value.Model && (spell).table.value.Model.tableAlias;
      chunks.push(`AS ${subTableAlias ? escapeId(subTableAlias) : `t${(spell).subqueryIndex++}`}`);
    } else {
      chunks.push(`AS ${escapeId(baseName)}`);
    }

    for (const qualifier in joins) {
      const { Model: RefModel, on } = joins[qualifier];
      collectLiteral(spell, on, values);
      chunks.push(`LEFT JOIN ${escapeId(RefModel.table)} AS ${escapeId(qualifier)} ON ${formatExpr(spell, on)}`);
    }

    const indexHintStr = this.formatIndexHints(spell);
    if (indexHintStr) {
      chunks.push(indexHintStr);
    }

    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, values);
      chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
    }

    if (groups.length > 0) {
      chunks.push(`GROUP BY ${groups.map((group: any) => formatExpr(spell, group)).join(', ')}`);
    }

    if (havingConditions.length > 0) {
      for (const condition of havingConditions) collectLiteral(spell, condition, values);
      chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
    }

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (Number(rowCount) > 0) chunks.push(`LIMIT ${Number(rowCount)}`);
    if (Number(skip) > 0) chunks.push(`OFFSET ${Number(skip)}`);
    return { sql: chunks.join(' '), values };
  }

  /**
   * Format orders into ORDER BY clause in SQL
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatOrders<T extends typeof AbstractBone>(spell: Spell<T>, orders: any[]) {
    return orders.map(([ token, order ]) => {
      const column = formatExpr(spell, token);
      return order == 'desc' ? `${column} DESC` : column;
    });
  }
}
