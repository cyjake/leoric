'use strict';

const { precedes, copyExpr, findExpr, walkExpr } = require('../../expr');

/**
 * Find model by qualifiers.
 * @example
 * findModel(spell, ['comments'])
 * findModel(spell)
 *
 * @param {Spell} spell
 * @param {string[]} qualifiers
 */
function findModel(spell, qualifiers) {
  const qualifier = qualifiers && qualifiers[0];
  const Model = qualifier && qualifier != spell.Model.aliasName
    ? (spell.joins.hasOwnProperty(qualifier) ? spell.joins[qualifier].Model : null)
    : spell.Model;
  if (!Model) throw new Error(`Unabled to find model ${qualifiers}`);
  return Model;
}

/**
 * Format orders into ORDER BY clause in SQL
 * @param {Spell}    spell
 * @param {Object[]} orders
 */
function formatOrders(spell, orders) {
  return orders.map(([token, order]) => {
    const column = formatColumn(spell, token);
    return order == 'desc' ? `${column} DESC` : column;
  });
}

/**
 * Format token into identifiers/functions/etc. in SQL
 * @example
 * formatColumn(spell, { type: 'id', value: 'title' })
 * // => `title`
 *
 * formatColumn(spell, { type: 'func', name: 'year', args: [ { type: 'id', value: 'createdAt' } ] })
 * // => YEAR(`createdAt`)
 *
 * @param {Spell}  spell
 * @param {Object} token
 */
function formatColumn(spell, token) {
  if (token.type == 'id') {
    return formatIdentifier(spell, token);
  } else {
    return formatExpr(spell, token);
  }
}

/**
 * Format identifiers into escaped string with qualifiers.
 * @param {Spell}  spell
 * @param {Object} ast
 */
function formatIdentifier(spell, ast) {
  const { value, qualifiers } = ast;
  const Model = findModel(spell, qualifiers);
  const column = Model.unalias(value);
  const { escapeId } = spell.Model.driver;

  if (qualifiers && qualifiers.length > 0) {
    return `${qualifiers.map(escapeId).join('.')}.${escapeId(column)}`;
  } else {
    return escapeId(column);
  }
}

const extractFieldNames = ['year', 'month', 'day'];

function formatFuncExpr(spell, ast) {
  const { name, args } = ast;
  const { type } = spell.Model.driver;

  // https://www.postgresql.org/docs/9.1/static/functions-datetime.html
  if (type === 'pg' && extractFieldNames.includes(name)) {
    return `EXTRACT(${name.toUpperCase()} FROM ${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
  }

  return `${name.toUpperCase()}(${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
}

/**
 * The `... IS NULL` predicate is not parameterizable.
 * - https://github.com/brianc/node-postgres/issues/1751
 * @param {Array} values
 * @param {Object} ast
 */
function collectLiteral(values, ast) {
  walkExpr(ast, ({ type, value }) => {
    if (type == 'literal' && value != null) {
      if (Array.isArray(value)) {
        values.push(...value);
      } else {
        values.push(value);
      }
    }
  });
  return values;
}

function formatLiteral(spell, ast) {
  const { value } = ast;

  if (value == null) {
    return 'NULL';
  } else {
    return Array.isArray(value) ? `(${value.map(() => '?').join(', ')})` : '?';
  }
}

/**
 * Format the abstract syntax tree of an expression into escaped string.
 * @param {Spell}  spell
 * @param {Object} ast
 */
function formatExpr(spell, ast) {
  const { type, name, value, args } = ast;

  switch (type) {
    case 'literal':
      return formatLiteral(spell, ast);
    case 'subquery':
      return `(${value.toSqlString()})`;
    case 'wildcard':
      return '*';
    case 'alias':
      return `${formatExpr(spell, args[0])} AS ${formatIdentifier(spell, ast)}`;
    case 'mod':
      return `${name.to.toUpperCase()} ${formatExpr(spell, args[0])}`;
    case 'id':
      return formatIdentifier(spell, ast);
    case 'op':
      return formatOpExpr(spell, ast);
    case 'func':
      return formatFuncExpr(spell, ast);
    default:
      throw new Error(`Unexpected type ${type}`);
  }
}

/**
 * Check if current token is logical operator or not, e.g. `AND`/`NOT`/`OR`.
 * @param {Object} ast
 */
function isLogicalOp({ type, name }) {
  return type == 'op' && ['and', 'not', 'or'].includes(name);
}

/**
 * Format `{ type: 'op' }` expressions into escaped string.
 * @param {Spell}  spell
 * @param {Object} ast
 */
function formatOpExpr(spell, ast) {
  const { name, args } = ast;
  const params = args.map(arg => {
    return isLogicalOp(ast) && isLogicalOp(arg) && precedes(name, arg.name) <= 0
      ? `(${formatExpr(spell, arg)})`
      : formatExpr(spell, arg);
  });

  if (name == 'between' || name == 'not between') {
    return `${params[0]} ${name.toUpperCase()} ${params[1]} AND ${params[2]}`;
  }
  else if (name == 'not') {
    return `NOT ${params[0]}`;
  }
  else if ('!~-'.includes(name) && params.length == 1) {
    return `${name} ${params[0]}`;
  }
  else if (args[1].type == 'literal' && args[1].value == null) {
    if (['=', '!='].includes(name)) {
      const op = name == '=' ? 'IS' : 'IS NOT';
      return `${params[0]} ${op} NULL`;
    } else {
      throw new Error(`Invalid operator ${name} against null`);
    }
  }
  // IN (1, 2, 3)
  // IN (SELECT user_id FROM group_users)
  else if ((args[1].type == 'literal' && Array.isArray(args[1].value)) || args[1].type == 'subquery') {
    let op = name;
    if (name == '=') {
      op = 'in';
    } else if (name == '!=') {
      op = 'not in';
    }
    if (['in', 'not in'].includes(op)) {
      return `${params[0]} ${op.toUpperCase()} ${params[1]}`;
    } else {
      throw new Error(`Invalid operator ${name} against ${args[1].value}`);
    }
  }
  else {
    return `${params[0]} ${name.toUpperCase()} ${params[1]}`;
  }
}

/**
 * Format a spell without joins into a full SELECT query. This function is also used to format the subquery which is then used as a drived table in a SELECT with joins.
 * @param {Spell} spell
 */
function formatSelectWithoutJoin(spell) {
  const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip } = spell;
  const chunks = [];
  const values = [];

  if (columns.length > 0) {
    columns.reduce(collectLiteral, values);
    const selects = [];
    for (const token of columns) {
      const column = formatColumn(spell, token);
      if (!selects.includes(column)) selects.push(column);
    }
    chunks.push(`SELECT ${selects.join(', ')}`);
  } else {
    chunks.push('SELECT *');
  }

  const table = formatExpr(spell, spell.table);
  chunks.push(`FROM ${table}`);
  if (spell.table.value instanceof spell.constructor) {
    chunks.push(`AS t${spell.subqueryIndex++}`);
  }

  if (whereConditions.length > 0) {
    whereConditions.reduce(collectLiteral, values);
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
  }

  if (groups.length > 0) {
    const groupColumns = groups.map(group => formatColumn(spell, group));
    chunks.push(`GROUP BY ${groupColumns.join(', ')}`);
  }

  if (havingConditions.length > 0) {
    havingConditions.reduce(collectLiteral, values);
    chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(spell, orders).join(', ')}`);
  if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
  if (skip > 0) chunks.push(`OFFSET ${skip}`);

  return { sql: chunks.join(' '), values };
}

/**
 * Create a subquery to make sure OFFSET and LIMIT on left table takes effect.
 * @param {Spell} spell
 */
function createSubspell(spell) {
  const { Model, columns, joins, whereConditions, orders } = spell;
  const baseName = Model.aliasName;
  const subspell = spell.dup;

  subspell.columns = [];
  for (const token of columns) {
    walkExpr(token, ({ type, qualifiers, value }) => {
      if (type == 'id' && qualifiers[0] == baseName) {
        subspell.columns.push({ type, value });
      }
    });
  }

  // If columns were whitelisted, make sure JOIN columns are included.
  if (subspell.columns.length > 0) {
    for (const qualifier in joins) {
      const relation = joins[qualifier];
      walkExpr(relation.on, ({ type, qualifiers, value }) => {
        if (type == 'id' && qualifiers[0] == baseName) {
          subspell.columns.push({ type, value });
        }
      });
    }
  }

  // TODO: how to handle subqueries with GROUP?
  subspell.groups = [];

  subspell.whereConditions = [];
  for (let i = whereConditions.length - 1; i >= 0; i--) {
    const condition = whereConditions[i];
    let internal = true;
    walkExpr(condition, ({ type, qualifiers }) => {
      if (type == 'id' && qualifiers[0] != baseName) {
        internal = false;
      }
    });
    if (internal) {
      const token = copyExpr(JSON.parse(JSON.stringify(condition)), ({ type, value }) => {
        if (type === 'id') return { type, value };
      });
      subspell.whereConditions.unshift(token);
      whereConditions.splice(i, 1);
    }
  }

  subspell.orders = [];
  for (const order of orders) {
    const [token, direction] = order;
    const { type, qualifiers, value } = token;
    if (type == 'id' && qualifiers[0] == baseName) {
      subspell.orders.push([{ type, value }, direction]);
    }
  }

  return subspell;
}

/**
 * Make sure columns are qualified
 */
function qualify(spell) {
  const { Model, columns, groups, whereConditions, havingConditions, orders } = spell;
  const baseName = Model.aliasName;
  const clarify = node => {
    if (node.type === 'id' && !node.qualifiers) {
      if (Model.schema[node.value]) node.qualifiers = [baseName];
    }
  };

  for (const ast of columns.concat(groups, whereConditions, havingConditions)) {
    walkExpr(ast, clarify);
  }

  for (const [ast] of orders) {
    walkExpr(ast, clarify);
  }
}

/**
 * Format select list that indicates which columns to retrieve
 * @param {Spell} spell
 */
function formatSelectExpr(spell, values) {
  const { Model, columns, joins, groups } = spell;
  const { escapeId } = Model.driver;
  const baseName = Model.aliasName;
  const selects = new Set();
  const map = {};

  for (const token of columns) {
    collectLiteral(values, token);
    const selectExpr = formatColumn(spell, token);
    const qualifier = token.qualifiers ? token.qualifiers[0] : '';
    const list = map[qualifier] || (map[qualifier] = []);
    list.push(selectExpr);
  }

  for (const qualifier of [baseName].concat(Object.keys(joins))) {
    const list = map[qualifier];
    if (list) {
      for (const selectExpr of list) selects.add(selectExpr);
    } else if (groups.length === 0 && Model.driver.type !== 'sqlite') {
      selects.add(`${escapeId(qualifier)}.*`);
    }
  }

  if (map['']) {
    for (const selectExpr of map['']) selects.add(selectExpr);
  }

  return Array.from(selects);
}

/**
 * Format a spell with joins into a full SELECT query.
 * @param {Spell} spell
 */
function formatSelectWithJoin(spell) {
  // Since it is a JOIN query, make sure columns are always qualified.
  qualify(spell);

  const { Model, whereConditions, groups, havingConditions, orders, rowCount, skip, joins } = spell;
  const { escapeId } = Model.driver;
  const baseName = Model.aliasName;

  const values = [];
  const selects = formatSelectExpr(spell, values);
  const chunks = [`SELECT ${selects.join(', ')}`];

  if (skip > 0 || rowCount > 0) {
    const subspell = createSubspell(spell);
    const subquery = formatSelectWithoutJoin(subspell);
    values.push(...subquery.values);
    chunks.push(`FROM (${subquery.sql}) AS ${escapeId(baseName)}`);
  } else {
    chunks.push(`FROM ${escapeId(Model.table)} AS ${escapeId(baseName)}`);
  }

  for (const qualifier in joins) {
    const { Model: RefModel, on } = joins[qualifier];
    collectLiteral(values, on);
    chunks.push(`LEFT JOIN ${escapeId(RefModel.table)} AS ${escapeId(qualifier)} ON ${formatExpr(spell, on)}`);
  }

  if (whereConditions.length > 0) {
    whereConditions.reduce(collectLiteral, values);
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
  }

  if (groups.length > 0) {
    chunks.push(`GROUP BY ${groups.map(group => formatColumn(spell, group)).join(', ')}`);
  }

  if (havingConditions.length > 0) {
    havingConditions.reduce(collectLiteral, values);
    chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(spell, orders).join(', ')}`);
  return { sql: chunks.join(' '), values };
}

/**
 * To help choosing the right function when formatting a spell into SELECT query.
 * @param {Spell} spell
 */
function formatSelect(spell) {
  const { whereConditions } = spell;
  const { shardingKey, table } = spell.Model;

  if (shardingKey && !whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
    throw new Error(`Sharding key ${table}.${shardingKey} is required.`);
  }

  return Object.keys(spell.joins).length > 0
    ? formatSelectWithJoin(spell)
    : formatSelectWithoutJoin(spell);
}

/**
 * Format the spell into a DELETE query.
 * @param {Spell} spell
 */
function formatDelete(spell) {
  const { Model, whereConditions } = spell;
  const { shardingKey } = Model;
  const { escapeId } = Model.driver;
  const table = escapeId(Model.table);

  if (shardingKey && !whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
    throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
  }

  if (whereConditions.length > 0) {
    const values = whereConditions.reduce(collectLiteral, []);
    return {
      sql: `DELETE FROM ${table} WHERE ${formatConditions(spell, whereConditions)}`,
      values
    };
  } else {
    return { sql: `DELETE FROM ${table}` };
  }
}

/**
 * Format an array of conditions into an expression. Conditions will be joined with `AND`.
 * @param {Object[]} conditions - An array of parsed where/having/on conditions
 */
function formatConditions(spell, conditions) {
  return conditions
    .map(condition => {
      return isLogicalOp(condition) && condition.name == 'or' && conditions.length > 1
        ? `(${formatExpr(spell, condition)})`
        : formatExpr(spell, condition);
    })
    .join(' AND ');
}

/**
 * Format a spell into INSERT query.
 * @param {Spell} spell
 */
function formatInsert(spell) {
  const { Model, sets } = spell;
  const { shardingKey } = Model;
  const { escapeId } = Model.driver;
  const columns = Object.keys(sets).map(column => escapeId(Model.unalias(column)));

  if (shardingKey && sets[shardingKey] == null) {
    throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
  }

  return {
    sql: `INSERT INTO ${escapeId(Model.table)} (${columns.join(', ')}) VALUES (${columns.map(_ => '?').join(', ')})`,
    values: Object.values(sets)
  };
}

/**
 * Format a spell into UPDATE query
 * @param {Spell} spell
 */
function formatUpdate(spell) {
  const { Model, sets, whereConditions } = spell;
  const { shardingKey } = Model;

  if (shardingKey) {
    if (sets.hasOwnProperty(shardingKey) && sets[shardingKey] == null) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
    }
    if (!whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
    }
  }

  const values = [];
  const assigns = [];
  const { escapeId } = Model.driver;
  for (const column in sets) {
    assigns.push(`${escapeId(Model.unalias(column))} = ?`);
    values.push(sets[column]);
  }

  whereConditions.reduce(collectLiteral, values);
  return {
    sql: `UPDATE ${escapeId(Model.table)} SET ${assigns.join(', ')} WHERE ${formatConditions(spell, whereConditions)}`,
    values
  };
}

/**
 * INSERT ... ON CONFLICT ... UPDATE SET
 * - https://www.postgresql.org/docs/9.5/static/sql-insert.html
 * - https://www.sqlite.org/lang_UPSERT.html
 * @param {Spell} spell
 */
function formatUpsert(spell) {
  const { Model, sets } = spell;
  const { shardingKey } = Model;

  if (shardingKey && sets[shardingKey] == null) {
    throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
  }

  const { primaryColumn } = Model;
  const { sql, values } = formatInsert(spell);
  const assigns = [];
  const { escapeId } = Model.driver;

  for (const column in sets) {
    assigns.push(`${escapeId(Model.unalias(column))} = ?`);
    values.push(sets[column]);
  }

  return {
    sql: `${sql} ON CONFLICT (${escapeId(primaryColumn)}) DO UPDATE SET ${assigns.join(', ')}`,
    values
  };
}

module.exports = {
  format(spell) {
    for (const scope of spell.scopes) scope(spell);

    switch (spell.command) {
      case 'insert':
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
  },

  formatInsert,
  formatSelect,
  formatUpdate,
  formatDelete,
  formatUpsert,
};
