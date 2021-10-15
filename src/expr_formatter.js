'use strict';

const { precedes, walkExpr } = require('./expr');

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
  const Model = qualifier && qualifier != spell.Model.tableAlias
    ? (spell.joins.hasOwnProperty(qualifier) ? spell.joins[qualifier].Model : null)
    : spell.Model;
  if (!Model) throw new Error(`Unabled to find model ${qualifiers}`);
  return Model;
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
  }

  return escapeId(column);
}

const extractFieldNames = ['year', 'month', 'day'];

function formatFuncExpr(spell, ast) {
  const { name, args } = ast;
  const { type } = spell.Model.driver;

  // https://www.postgresql.org/docs/9.1/static/functions-datetime.html
  if (type === 'postgres' && extractFieldNames.includes(name)) {
    return `EXTRACT(${name.toUpperCase()} FROM ${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
  }

  return `${name.toUpperCase()}(${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
}

function formatLiteral(spell, ast) {
  const { value } = ast;

  if (value == null) return 'NULL';

  if (Array.isArray(value)) {
    if (value.length) return `(${value.map(() => '?').join(', ')})`;
    return '(NULL)';
  }

  return '?';
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
    case 'raw':
      // return value directly
      return value;
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
    return isLogicalOp(ast) && isLogicalOp(arg) && precedes(name, arg.name) < 0
      ? `(${formatExpr(spell, arg)})`
      : formatExpr(spell, arg);
  });

  if (name == 'between' || name == 'not between') {
    return `${params[0]} ${name.toUpperCase()} ${params[1]} AND ${params[2]}`;
  }

  if (name == 'not') return `NOT ${params[0]}`;

  if ('!~-'.includes(name) && params.length == 1) return `${name} ${params[0]}`;

  if (args[1].type == 'literal' && args[1].value == null && !isLogicalOp(ast)) {
    if (!['=', '!='].includes(name)) {
      throw new Error(`Invalid operator ${name} against null`);
    }
    return `${params[0]} ${name === '=' ? 'IS' : 'IS NOT'} NULL`;
  }

  // IN (1, 2, 3)
  // IN (SELECT user_id FROM group_users)
  if ((args[1].type == 'literal' && Array.isArray(args[1].value)) || args[1].type == 'subquery') {
    let op = name;
    if (name == '=') {
      op = 'in';
    } else if (name == '!=') {
      op = 'not in';
    }
    if (!['in', 'not in'].includes(op)) {
      throw new Error(`Invalid operator ${name} against ${args[1].value}`);
    }
    return `${params[0]} ${op.toUpperCase()} ${params[1]}`;
  }

  if (params[1] !== '') {
    return `${params[0]} ${name.toUpperCase()} ${params[1]}`;
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
    // filter empty condition
    .filter((condition) => !!condition)
    .join(' AND ');
}

/**
 * The `... IS NULL` predicate is not parameterizable.
 * - https://github.com/brianc/node-postgres/issues/1751
 * @param {Array} values the collected values
 * @param {Object} ast the abstract syntax tree
 * @returns {Array} values
 */
function collectLiteral(spell, ast, values) {
  walkExpr(ast, function(itr) {
    const { type, value } = itr;

    if (type === 'op' && !isLogicalOp(itr)) {
      coerceLiteral(spell, itr);
    } else if (type == 'literal' && value != null) {
      if (Array.isArray(value)) {
        values.push(...value);
      } else {
        values.push(value);
      }
    }
  });
  return values;
}

function coerceLiteral(spell, ast) {
  const { args } = ast;
  const firstArg = args[0];

  if (firstArg.type === 'id') {
    const model = findModel(spell, firstArg.qualifiers);
    const attribute = model && model.attributeMap[firstArg.value];

    if (attribute) {
      for (const arg of args.slice(1)) {
        if (arg.type === 'literal') {
          arg.value = attribute.uncast(arg.value);
        }
      }
    }
  }
}

module.exports = { formatExpr, formatConditions, collectLiteral };
