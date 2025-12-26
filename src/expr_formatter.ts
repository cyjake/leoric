
import {
  precedes,
  walkExpr,
  Identifier,
  ExprDataType,
  Func,
  JsonValueFunc,
  Operator,
  TernaryOperator,
  ExprLiteral,
  Expr,
  Alias,
  Subquery,
  RawExpr,
} from './expr';
import { AGGREGATORS } from './constants';
import Spell from './spell';
import { AbstractBone } from './abstract_bone';
import { Literal } from './types/common';

/**
 * Find model by qualifiers.
 * @example
 * findModel(spell, ['comments'])
 * findModel(spell)
 *
 * @param {Spell} spell
 * @param {string[]} qualifiers
 */
function findModel<T extends typeof AbstractBone>(spell: Spell<T>, qualifiers?: string[]) {
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
function formatIdentifier<T extends typeof AbstractBone>(spell: Spell<T>, ast: Identifier | Alias) {
  const { value } = ast;
  const qualifiers = 'qualifiers' in ast ? ast.qualifiers : undefined;
  const Model = findModel(spell, qualifiers);
  const column = Model.unalias(value);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { escapeId } = spell.Model.driver!;

  if (qualifiers && qualifiers.length > 0) {
    return `${qualifiers.map(escapeId).join('.')}.${escapeId(column)}`;
  }

  return escapeId(column);
}

function formatDataType<T extends typeof AbstractBone>(spell: Spell<T>, ast: ExprDataType) {
  const { value, length } = ast;
  if (length) return `${value.toUpperCase()}(${length})`;
  return value.toUpperCase();
}

const extractFieldNames = ['year', 'month', 'day'];

function formatFuncExpr<T extends typeof AbstractBone>(spell: Spell<T>, ast: Func | JsonValueFunc) {
  const { name, args } = ast;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { type } = spell.Model.driver!;

  // https://www.postgresql.org/docs/9.1/static/functions-datetime.html
  if (type === 'postgres' && extractFieldNames.includes(name)) {
    return `EXTRACT(${name.toUpperCase()} FROM ${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
  }

  // https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-value
  // https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-21.html#mysqld-8-0-21-json
  if (name === 'json_value' && 'dataType' in ast && ast.dataType) {
    return `${name.toUpperCase()}(${args.map(arg => formatExpr(spell, arg)).join(', ')} RETURNING ${formatDataType(spell, ast.dataType)})`;
  }

  return `${name.toUpperCase()}(${args.map(arg => formatExpr(spell, arg)).join(', ')})`;
}

function formatLiteral<T extends typeof AbstractBone>(spell: Spell<T>, ast: ExprLiteral) {
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
 */
function isAggregatorExpr<T extends typeof AbstractBone>(spell: Spell<T>, ast: Expr | Subquery<T> | RawExpr) {
  const { type } = ast;
  switch (type) {
    case 'literal':
    case 'subquery':
    case 'wildcard':
    case 'mod':
    case 'id':
    case 'raw':
    case 'op':
      return false;
    case 'alias':
      return isAggregatorExpr(spell, ast.args[0]);
    case 'func':
      return AGGREGATORS.includes(ast.name);
    default:
      throw new Error(`Unexpected type: ${type}`);
  }
}

/**
 * Format the abstract syntax tree of an expression into escaped string.
 * @param {Spell}  spell
 * @param {Object} ast
 */
function formatExpr<T extends typeof AbstractBone>(
  spell: Spell<T>,
  ast: Expr | Subquery<T> | RawExpr,
): string {
  const { type } = ast;
  switch (type) {
    case 'literal':
      return formatLiteral(spell, ast);
    case 'subquery':
      return `(${ast.value.toSqlString()})`;
    case 'wildcard':
      return '*';
    case 'alias':
      return `${formatExpr(spell, ast.args[0])} AS ${formatIdentifier(spell, ast)}`;
    case 'mod':
      return `${ast.name.toUpperCase()} ${formatExpr(spell, ast.args[0])}`;
    case 'id':
      return formatIdentifier(spell, ast);
    case 'op':
      return formatOpExpr(spell, ast);
    case 'func':
      return formatFuncExpr(spell, ast);
    case 'raw':
      // return value directly
      return ast.value;
    default:
      throw new Error(`Unexpected type: ${type}`);
  }
}

/**
 * Check if current token is logical operator or not, e.g. `AND`/`NOT`/`OR`.
 */
function isLogicalOp(expr: Expr): boolean {
  return expr.type == 'op' && ['and', 'not', 'or'].includes(expr.name);
}

/**
 * Format `{ type: 'op' }` expressions into escaped string.
 * @param {Spell}  spell
 * @param {Object} ast
 */
function formatOpExpr<T extends typeof AbstractBone>(spell: Spell<T>, ast: Operator | TernaryOperator) {
  const { name, args } = ast;
  const params = args.map(arg => {
    return isLogicalOp(ast) && isLogicalOp(arg) && precedes(name, (arg as Operator).name) < 0
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
  if ((args[1].type == 'literal' && Array.isArray(args[1].value)) ||
    (args[1] as unknown as Subquery<T>).type == 'subquery'
  ) {
    let op = name;
    if (name == '=') {
      op = 'in';
    } else if (name == '!=') {
      op = 'not in';
    }
    if (!['in', 'not in'].includes(op)) {
      throw new Error(`Invalid operator ${name} against ${args[1]}`);
    }
    return `${params[0]} ${op.toUpperCase()} ${params[1]}`;
  }

  return `${params[0]} ${name.toUpperCase()} ${params[1]}`;
}

/**
 * Format an array of conditions into an expression. Conditions will be joined with `AND`.
 * @param {Object[]} conditions - An array of parsed where/having/on conditions
 */
function formatConditions<T extends typeof AbstractBone>(spell: Spell<T>, conditions: Expr[]): string {
  return conditions
    .map(condition => {
      return isLogicalOp(condition) && (condition as Operator).name == 'or' && conditions.length > 1
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
 */
function collectLiteral<T extends typeof AbstractBone>(spell: Spell<T>, ast: Expr, values: Literal[] = []) {
  walkExpr(ast, function(itr) {
    const { type } = itr;
    if (type === 'op' && !isLogicalOp(itr)) {
      coerceLiteral(spell, itr);
    } else if (type == 'literal' && itr.value != null) {
      const { value } = itr;
      if (Array.isArray(value)) {
        values.push(...value);
      } else {
        values.push(value);
      }
    }
  });
  return values;
}

function coerceLiteral<T extends typeof AbstractBone>(spell: Spell<T>, ast: Operator) {
  const { args } = ast;
  const firstArg = args[0];

  if (firstArg.type !== 'id') return;

  const model = findModel(spell, firstArg.qualifiers);
  const attribute = model && model.attributes[firstArg.value];

  if (!attribute) return;
  if (attribute.virtual) {
    throw new Error(`unable to use virtual attribute ${attribute.name} in model ${model.name}`);
  }

  for (const arg of args.slice(1)) {
    if (arg.type === 'literal') {
      // { params: { $like: '%foo%' } }
      if (attribute.jsType === JSON && typeof arg.value === 'string') continue;
      arg.value = attribute.uncast(arg.value, false);
    }
  }
}

export { formatExpr, formatConditions, collectLiteral, isAggregatorExpr };
