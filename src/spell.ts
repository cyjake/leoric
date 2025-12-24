
/**
 * The {@link Spell} class.
 * @module
 */
import pluralize from 'pluralize';
import SqlString from 'sqlstring';
import { parseExprList, parseExpr, walkExpr, Expr, Token, Alias } from './expr';
import { isPlainObject } from './utils';
import { IndexHint, INDEX_HINT_TYPE, Hint, HintInterface, HintScopeObject } from './hint';
import { parseObject } from './query_object';
import Raw from './raw';
import { AGGREGATOR_MAP } from './constants';

import {
  Literal, command, Connection,
  BoneColumns,
  Collection,
  ResultSet,
  QueryResult,
  QueryOptions,
  OnConditions,
  WithOptions,
  WhereConditions,
} from './types/common';
import { AbstractBone } from './types/abstract_bone';
import { Identifier, Func, Operator, TernaryOperator, Subquery } from './expr';

// Polyfill for structuredClone
declare global {
  function structuredClone<T>(value: T, options?: any): T;
}

interface SpellBookFormatStandardResult {
  sql: string;
  values?: Array<Literal> | {
    [key: string]: Literal
  };
  [key: string]: Literal
}

interface Join {
  [key: string]: {
    Model: typeof AbstractBone;
    on: ExprOperator;
    hasMany?: boolean;
  }
}

type ExprOperator = Operator | TernaryOperator;
// Columns in a SELECT can be any parsed expression token (identifier, func, alias, etc.),
// or Raw (when passed directly), and parser may yield undefined entries.
type SpellColumn = Token | Raw;

type ScopeFunction = (spell: Spell<any>) => void;

interface SpellOptions {
  command?: command;
  columns: SpellColumn[];
  // allow subquery as table source in dup and with()
  table: Identifier | Subquery<any>;
  whereConditions: any[];
  groups: (Identifier | Func | Alias | Raw)[];
  orders: [Identifier | Func | Raw, 'asc' | 'desc'][];
  havingConditions: any[];
  joins: Join;
  skip: number;
  scopes: ScopeFunction[];
  subqueryIndex: number;
  rowCount?: number;
  connection?: Connection;
  sets?: { [key: string]: Literal } | { [key: string]: Literal }[];
  hints?: Array<Hint | IndexHint>;
  hint?: Hint | IndexHint;
  paranoid?: boolean;
  transaction?: any;
  laters?: Array<(result: any) => any>;
}

export interface SpellMeta extends SpellOptions {
  Model: typeof AbstractBone;
}

export type SpellBookFormatResult<T> = SpellBookFormatStandardResult | T;


/**
 * check condition to avoid use virtual fields as where conditions
 * @param {Bone} Model
 * @param {Array<Object>} conds
 */
function checkCond(Model: typeof AbstractBone, conds: any[]): void {
  for (const cond of conds) {
    if (cond && cond.type === 'id' && cond.value != null) {
      if (Model.attributes[cond.value] && Model.attributes[cond.value].virtual) {
        throw new Error(`unable to use virtual attribute ${cond.value} as condition in model ${Model.name}`);
      }
    } else if (cond && cond.type === 'op' && cond.args && cond.args.length) {
      checkCond(Model, cond.args);
    }
  }
}

/**
 * Parse condition expressions
 * @example
 * parseConditions(Model, { foo: { $op: value } });
 * parseConditions(Model, 'foo = ?', value);
 * @param {Bone} Model
 * @param {(string|Object)} conditions
 * @param {...*} values
 * @returns {Array}
 */
function parseConditions(Model: typeof AbstractBone, conditions: any, ...values: Literal[]): any[] {
  if (conditions instanceof Raw) return [ conditions ];
  let conds: any[];
  if (isPlainObject(conditions)) {
    conds = parseObject(conditions);
  } else if (typeof conditions == 'string') {
    conds = [parseExpr(conditions, ...values)];
  } else {
    throw new Error(`unexpected conditions ${conditions}`);
  }
  checkCond(Model, conds);
  return conds;
}

function parseSelect<T extends typeof AbstractBone>(spell: Spell<T>, ...names: Array<BoneColumns<T>> | Array<string | Raw>) {
  const { joins, Model } = spell;
  if (typeof names[0] === 'function') {
    names = Object.keys(Model.columnAttributes).filter(names[0]);
  } else {
    names = names.flat() as Array<string | Raw>;
  }

  const columns: SpellColumn[] = [];
  for (const name of names) {
    if (name instanceof Raw) {
      columns.push(name);
    } else {
      columns.push(...parseExprList(name) as SpellColumn[]);
    }
  }

  for (const ast of columns) {
    walkExpr(ast as Token, token => {
      if (token.type !== 'id') return;
      const { qualifiers, value } = token;
      const qualifier = qualifiers && qualifiers[0];
      const model = qualifier && joins && (qualifier in joins) ? joins[qualifier].Model : Model;

      if (!model.columnAttributes[value]) {
        if (model.attributes[value]) {
          throw new Error(`unable to use virtual attribute ${value} as field in model ${model.name}`);
        }
        throw new Error(`unable to find attribute ${value} in model ${model.name}`);
      }
    });
  }

  return columns;
}

/**
 * Translate key-value pairs of columnAttributes into key-value pairs of columns. Get ready for the SET part when generating SQL.
 * @param {Spell} spell
 * @param {Object} obj - key-value pairs of columnAttributes
 * @param {boolean} strict - check attribute exist or not
 * @returns {Object}
 */
function formatValueSet(spell: Spell<any>, obj: Record<string, any>): Record<string, any> {
  const { Model } = spell;
  const sets: Record<string, any> = {};
  for (const name in obj) {
    const attribute = Model.columnAttributes[name];
    const value = obj[name];

    if (!attribute) {
      continue;
    }

    // raw sql don't need to uncast
    if (value instanceof Raw) {
      try {
        const expr = parseExpr(value.value);
        if (expr && expr.type === 'func' && ['json_merge_patch', 'json_merge_preserve'].includes((expr as Func).name)) {
          sets[name] = { ...expr, __expr: true };
          continue;
        }
      } catch {
        // ignored
      }
      sets[name] = value;
    } else {
      sets[name] = attribute.uncast(value);
    }
  }
  return sets;
}

/**
 * Translate key-value pairs of columnAttributes into key-value pairs of columns. Get ready for the SET part when generating SQL.
 * @param {Spell}  spell
 * @param {Object|Array} obj   - key-value pairs of columnAttributes
 */
function parseSet(spell: Spell<any>, obj: any): Record<string, any> | Record<string, any>[] {
  let sets: Record<string, any> | Record<string, any>[];
  if (Array.isArray(obj)) {
    sets = [];
    for (const o of obj) {
      (sets as Record<string, any>[]).push(formatValueSet(spell, o));
    }
  } else {
    sets = formatValueSet(spell, obj);
  }
  return sets;
}

/**
 * Construct on conditions as ast from associations.
 * @example
 * joinOnConditions(spell, Post, 'posts', 'comments', {
 *   association: { Model: Comment, foreignKey: 'postId' }
 * });
 *
 * @param {Spell}  spell
 * @param {Model}  BaseModel
 * @param {string} baseName
 * @param {string} refName
 * @param {Object} opts
 * @param {Object} opts.association - the association between BaseModel and RefModel
 * @param {Object} opts.where    - used to override association.where when processing `{ through }` associations
 */
function joinOnConditions(
  spell: Spell<typeof AbstractBone>,
  BaseModel: typeof AbstractBone,
  baseName: string,
  refName: string,
  opts: any,
): ExprOperator {
  const { where, association } = opts;
  const { Model: RefModel, foreignKey, belongsTo } = association;
  const [baseKey, refKey] = belongsTo
    ? [foreignKey, RefModel.primaryKey]
    : [BaseModel.primaryKey, foreignKey];

  const onConditions: ExprOperator = {
    type: 'op', name: '=',
    args: [
      { type: 'id', value: baseKey, qualifiers: [baseName] },
      { type: 'id', value: refKey, qualifiers: [refName] }
    ],
  };
  const finalWhere = where || association.where;
  if (finalWhere) {
    const whereConditions = parseConditions(BaseModel, finalWhere).reduce((result: any, condition: any) => {
      if (!result) return condition;
      return { type: 'op', name: 'and', args: [ result, condition ] };
    });
    walkExpr(whereConditions, (node: any) => {
      if (node.type == 'id' && !node.qualifiers) node.qualifiers = [refName];
    });
    return { type: 'op', name: 'and', args: [ onConditions, whereConditions ] } as ExprOperator;
  } else {
    return onConditions;
  }
}

/**
 * Find association by certain criteria.
 * @example
 * findAssociation({ Model: Post });
 * @param {Object} associations - Model associations
 * @param {Object} opts      - Search criteria, e.g. { Model }
 */
function findAssociation(associations: Record<string, any>, opts: Record<string, any>): any {
  for (const qualifier in associations) {
    const association = associations[qualifier];
    let found = true;
    for (const name in opts) {
      if (opts[name] != association[name]) {
        found = false;
        break;
      }
    }
    if (found) return association;
  }
  return null;
}

/**
 * Parse associations into spell.joins
 * @param {Spell}  spell     - An instance of spell
 * @param {Model}  BaseModel - A subclass of Bone
 * @param {string} baseName  - Might be Model.tableAlias, Model.table, or other names given by users
 * @param {string} refName   - The name of the join target
 * @param {Object} opts      - Extra options such as { select, throughAssociation }
 */
function joinAssociation(spell: Spell<any>, BaseModel: typeof AbstractBone, baseName: string, refName: string, opts: Record<string, any> = {}): void {
  const { joins } = spell;
  const { associations } = BaseModel;
  let association = associations[refName] || associations[pluralize(refName, 1)];

  if (refName in joins) throw new Error(`duplicated ${refName} in join tables`);
  if (!association && opts.targetAssociation) {
    association = findAssociation(associations, { Model: opts.targetAssociation.Model });
  }
  if (!association) {
    throw new Error(`unable to find association ${refName} on ${BaseModel.name}`);
  }

  const { through, Model: RefModel, includes } = association;

  if (through) {
    const throughAssociation = associations[through];
    // multiple associations might be mounted through the same intermediate association.
    // such as tagMaps => colorTags, tagMaps => styleTags
    // in this case, the intermediate association shall be mounted only once.
    if (!joins[through]) joinAssociation(spell, BaseModel, baseName, through);
    joinAssociation(spell, throughAssociation.Model, through, refName, {
      ...opts, throughAssociation, targetAssociation: association
    });
    return;
  }

  const { throughAssociation, targetAssociation } = opts;
  const whereOpts = targetAssociation ? targetAssociation.where : null;
  const select = opts.select || association.select;

  if (select) {
    const columns = parseSelect({ Model: RefModel } as Spell<typeof RefModel>, select);
    for (const token of columns) {
      walkExpr(token as Expr, (node: any) => {
        if (node.type === 'id' && !node.qualifiers && RefModel.columnAttributes[node.value]) {
          node.qualifiers = [refName];
        }
      });
    }
    spell.columns.push(...columns);
  }

  spell.joins[refName] = {
    Model: RefModel,
    on: joinOnConditions(spell, BaseModel, baseName, refName, { where: whereOpts, association }),
    hasMany: association.hasMany || (throughAssociation ? throughAssociation.hasMany : false),
  };

  if (includes) joinAssociation(spell, RefModel, refName, includes);
}

/**
 * If Model supports soft delete, and deletedAt isn't specified in whereConditions yet, and the table isn't a subquery, append a default where({ deletedAt: null }).
 */
function scopeDeletedAt(spell: Spell<any>): void {
  const { table, sets, whereConditions, Model } = spell;

  const { deletedAt } = Model.timestamps;

  // from subquery
  if (table.type !== 'id') return;

  // UPDATE users SET deleted_at = NULL WHERE id = 42;
  if (sets && !Array.isArray(sets) && (sets as Record<string, any>)[deletedAt] === null) return;

  // deletedAt already specified
  for (const condition of whereConditions) {
    let found = false;
    walkExpr(condition, ({ type, value }: any) => {
      if (type === 'id' && value == deletedAt) {
        found = true;
      }
    });
    if (found) return;
  }

  spell.$where({ [deletedAt]: null });
}

scopeDeletedAt.__paranoid = true;

/**
 * Spell is the query builder of Leoric which has several important characters that made a powerful querying interface possible.
 *
 * - Deferred
 * - Method chaining
 * - Parsing SQL expressions
 *
 * Some of the methods of Spell follow such pattern:
 *
 * - Methods that begin with `$`, such as {@link Spell#$group}, are methods that support chaining. For example, we can do `new Spell().$select('foo').$group('bar')` to construct an SQL query.
 * - These methods have twin methods without the `$`, which have the same functionalities but differ in only one thing, every call of these methods makes changes on a duplicate of current spell and returns the duplicated one. For example, `new Spell().select('foo').group('bar')` works and each call, `new Spell()`, `.select('foo')`, and `.group('bar')`, returns a new spell.
 *
 * Spell adapts this pattern to make following usage possible:
 *
 *     const query = Post.find('createdAt > ?', new Date(2012, 4, 15));
 *     const [ { count } ] = query.count();
 *     const posts = query.offset(page * pageSize).limit(pageSize);
 *     this.body = { count, posts }
 *
 * `query.count()` and `query.offset()` won't interfere with each other because `new Spell` gets returned every time these methods were called. For brevity, only the methods start with `$` are documented.
 *
 * For performance reason, {@link Bone} use the prefixed with `$` ones mostly.
 * @alias Spell
 */
class Spell<T extends typeof AbstractBone, U = InstanceType<T> | Collection<InstanceType<T>> | ResultSet<T> | number | null> extends Promise<U> {
  Model: T;
  connection?: Connection;

  command: command = 'select';
  scopes: Array<ScopeFunction>;
  joins: Join = {};
  sets?: { [key: string]: Literal } | { [key: string]: Literal }[];
  declare table: Identifier | Subquery<T>;
  columns: SpellColumn[] = [];
  groups: (Identifier | Func | Alias | Raw)[] = [];
  whereConditions: ExprOperator[] = [];
  havingConditions: ExprOperator[] = [];
  updateOnDuplicate?: string[] | true;
  orders: [Identifier | Func | Raw, 'asc' | 'desc'][] = [];
  skip = 0;
  rowCount?: number;
  hints: Array<Hint | IndexHint>;
  subqueryIndex = 0;
  returning?: boolean | string[];
  uniqueKeys?: string[];
  laters: Array<(result: any) => any> = [];

  /**
   * Create a spell.
   * @param {Model}          Model    - A sub class of {@link Bone}.
   * @param {Object}         opts     - Extra columnAttributes to be set.
   */
  constructor(Model: T, opts: Partial<SpellOptions> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    super(() => {});
    if (Model.synchronized == null) {
      throw new Error(`model ${Model.name} is not connected yet`);
    }

    const scopes: Array<ScopeFunction> = [];

    if (Model._scope) {
      scopes.push(Model._scope);
    }

    const { deletedAt } = Model.timestamps;
    // FIXME: need to implement paranoid mode
    if (Model.columnAttributes[deletedAt] && opts.paranoid !== false) {
      scopes.push(scopeDeletedAt);
    }

    if (opts.scopes && opts.scopes.length) {
      scopes.push(...opts.scopes);
    }

    this.scopes = scopes;

    /**
     * A sub-class of Bone.
     */
    this.Model = Model;

    this.laters = [];

    // transaction options is passed around in opts.transaction in sequelize adapter
    Object.assign(this, {
      command: 'select',
      columns: [],
      table: parseExpr(Model.table),
      whereConditions: [],
      groups: [],
      orders: [],
      havingConditions: [],
      joins: {},
      skip: 0,
      subqueryIndex: 0
    }, opts.transaction, opts);

    const hints: (Hint | IndexHint)[] = [];

    if (opts.hints && opts.hints.length) {
      hints.push(...opts.hints.map(hint => Hint.build(hint)));
    }

    if (opts.hint) {
      hints.push(Hint.build(opts.hint));
    }

    this.hints = hints.reduce((result: (Hint | IndexHint)[], hint: Hint | IndexHint) => {
      if (!result.some((entry: any) => entry.isEqual(hint))) {
        result.push(hint);
      }
      return result;
    }, []);
  }

  #emptySpell() {
    const whereConditions = [];
    const { shardingKey } = this.Model;
    if (shardingKey) {
      for (const condition of this.whereConditions) {
        const [arg] = condition.args;
        if (arg.type === 'id' && arg.value === shardingKey) {
          whereConditions.push(structuredClone(condition));
        }
      }
    }
    Object.assign(this, {
      whereConditions,
      groups: [],
      orders: structuredClone(this.orders),
      havingConditions: [],
      joins: {},
      subqueryIndex: 0,
      rowCount: 0,
      skip: 0,
    });
  }

  get unscoped() {
    const spell = this.dup;
    spell.scopes = [];
    return spell;
  }

  // remove `deleted is NULL`
  get unparanoid() {
    const spell = this.dup;
    spell.scopes = spell.scopes.filter((scope: any) => !scope.__paranoid);
    return spell;
  }

  get all() {
    return this as Spell<T, Collection<InstanceType<T>>>;
  }

  get first() {
    return this.order(this.Model.primaryKey).$get(0) as Spell<T, InstanceType<T> | null>;
  }

  get last(): Spell<T, InstanceType<T> | null> {
    return this.order(this.Model.primaryKey, 'desc').$get(0) as Spell<T, InstanceType<T> | null>;
  }

  /**
   * Get a duplicate of current spell.
   */
  get dup(): Spell<T> {
    return new Spell<T>(this.Model, {
      command: this.command,
      columns: [...this.columns],
      sets: this.sets,
      table: this.table,
      whereConditions: [...this.whereConditions],
      groups: [...this.groups],
      orders: [...this.orders],
      havingConditions: [...this.havingConditions],
      joins: this.joins,
      skip: this.skip,
      rowCount: this.rowCount,
      scopes: [...this.scopes],
      laters: [...this.laters],
      hints: [...this.hints],
      // used by transaction
      connection: this.connection,
    });
  }

  /**
   * Get nth record.
   * @param {number} index
   * @returns {Bone}
   */
  $get(index: number): this {
    this.$limit(1);
    if (index > 0) this.$offset(index);

    return this.later((results: any[]) => {
      const { Model } = this;
      const result = results[0];
      return result instanceof Model ? result : null;
    });
  }
  get!: (index: number) => Spell<T, InstanceType<T> | null>;

  later(resolve: (result: any) => any): this {
    this.laters.push(resolve);
    return this;
  }

  async ignite() {
    const { Model, laters } = this;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let result: any = await Model.driver!.cast(this as any);
    result = { ...result, spell: this };
    for (const later of laters) {
      result = await later(result);
    }
    return result;
  }

  /**
   * Fake spell as a thenable object so it can be consumed like a regular Promise.
   * @example
   * const post = await Post.first
   * Post.last.then(post => handle(post));
   * @param {Function} resolve
   * @param {Function} reject
   */
  then<V, W>(resolve?: ((value: U) => V | Promise<V>) | null, reject?: ((reason: any) => W | Promise<W>) | null): Promise<V | W> {
    return Promise.resolve(this.ignite()).then(resolve, reject);
  }

  /**
   * @param {Function} reject
   */
  catch<V>(reject?: ((reason: any) => V | Promise<V>) | null): Promise<any | V> {
    return this.then(null, reject);
  }

  /**
   * @param {Function} onFinally
   */
  finally(onFinally?: (() => void) | null): Promise<any> {
    return this.then().finally(onFinally);
  }

  /**
   * - https://nodejs.org/en/knowledge/errors/what-are-the-error-conventions/
   * @param {Function} callback
   */
  nodeify(callback: (err: any, result?: any) => void): void {
    this.then(function resolve(result: any) {
      callback(null, result);
    }, function reject(err: any) {
      callback(err);
    });
  }

  /**
   * Generate an INSERT query.
   * @private
   * @param {Object} obj - key-values pairs
   */
  $insert(obj: Record<string, any>): this {
    this.command = 'insert';
    this.sets = parseSet(this, obj);
    return this;
  }
  insert!: (obj: Record<string, any>) => Spell<T, QueryResult>;

  /**
   * Generate a upsert-like query which takes advantage of ON DUPLICATE KEY UPDATE.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $upsert(obj: Record<string, any>): this {
    this.command = 'upsert';
    this.sets = parseSet(this, obj);
    return this;
  }
  upsert!: (obj: Record<string, any>) => Spell<T, QueryResult>;

  $bulkInsert(records: Record<string, any>[]): this {
    this.command = 'bulkInsert';
    this.sets = parseSet(this, records);
    return this;
  }
  bulkInsert!: (records: Record<string, any>[]) => Spell<T, U>;

  /**
   * Whitelist columnAttributes to select. Can be called repeatedly to select more columnAttributes.
   * @param {...string} names
   * @example
   * .select('title');
   * .select('title', 'createdAt');
   * .select('IFNULL(title, "Untitled")');
   */
  $select(...names: any[]): this {
    this.columns.push(...parseSelect(this as any, ...names));
    return this;
  }
  select!: (...names: (string | Raw | ((name: string) => boolean))[]) => Spell<T, U>;

  /**
   * Make a UPDATE query with values updated by generating SET key=value from obj.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $update(obj: Record<string, any>): this {
    this.command = 'update';
    this.sets = parseSet(this, obj);
    return this;
  }
  update!: (obj: Record<string, any>) => Spell<T, QueryResult>;

  $increment(name: string, by = 1, opts: Record<string, any> = {}): this {
    const { Model } = this;
    const silent = opts.silent;
    const { timestamps } = Model;
    this.command = 'update';
    if (!Number.isFinite(by)) throw new Error(`unexpected increment value ${by}`);
    if (!Model.columnAttributes.hasOwnProperty(name)) {
      throw new Error(`undefined attribute "${name}"`);
    }

    const sets = this.sets as Record<string, any> || {};
    sets[name] = {
      type: 'op',
      name: by > 0 ? '+' : '-',
      args: [
        { type: 'id', value: name, },
        { type: 'literal', value: Math.abs(by) },
      ],
      __expr: true,
    };
    this.sets = sets;

    if (timestamps.updatedAt && !sets[timestamps.updatedAt] && !silent) {
      sets[timestamps.updatedAt] = new Date();
    }

    return this;
  }
  increment!: (name: string | BoneColumns<T>, by?: number, opts?: QueryOptions) => Spell<T, QueryResult>;

  $decrement(name: string, by = 1, opts: QueryOptions = {}): this {
    return this.$increment(name, -by, opts);
  }
  decrement!: (name: string | BoneColumns<T>, by?: number, opts?: QueryOptions) => Spell<T, QueryResult>;

  /**
   * Set query command to DELETE.
   */
  $delete() {
    this.command = 'delete';
    return this;
  }
  delete!: () => Spell<T, QueryResult>;

  /**
   * Set the table of the spell. If an instance of {@link Spell} is passed, it will be used as a derived table.
   * @param {string|Spell} table
   */
  $from(table: string | Spell<any>): this {
    this.table = table instanceof Spell
      ? { type: 'subquery', value: table }
      : (parseExpr(table) as Identifier);
    return this;
  }
  from!: (table: string | Spell<any>) => Spell<T, U>;

  /**
   * Set WHERE conditions. Both string conditions and object conditions are supported.
   * @example
   * .where({ foo: null });
   * .where('foo = ? and bar >= ?', null, 42);
   * @param {string|Object} conditions
   * @param {...*}          values     - only necessary when using templated string conditions
   */
  $where(conditions: any, ...values: Literal[]): this {
    const Model = this.Model;
    this.whereConditions.push(...parseConditions(Model, conditions, ...values));
    return this;
  }
  where!: (conditions: any, ...values: Literal[]) => Spell<T, U>;

  $orWhere(conditions: any, ...values: Literal[]): this {
    const { whereConditions } = this;
    if (whereConditions.length == 0) return this.$where(conditions, ...values);
    const combined = whereConditions.slice(1).reduce((result: any, condition: any) => {
      return { type: 'op', name: 'and', args: [result, condition] };
    }, whereConditions[0]);
    const Model = this.Model;
    this.whereConditions = [
      { type: 'op', name: 'or', args:
        [combined, ...parseConditions(Model, conditions, ...values)] }
    ];
    return this;
  }
  orWhere!: (conditions: any, ...values: Literal[]) => Spell<T, U>;

  /**
   * Set GROUP BY columnAttributes. `select_expr` with `AS` is supported, hence following expressions have the same effect:
   *
   *     .select('YEAR(createdAt)) AS year').group('year');
   *
   * @example
   * .group('city');
   * .group('YEAR(createdAt)');
   * @param {...string} names
   */
  $group(...names: string[]): this {
    const { columns, groups, Model } = this;

    for (const name of names) {
      if (Model.attributes[name] && Model.attributes[name].virtual) {
        throw new Error(`unable to use virtual attribute ${name} as group column in model ${Model.name}`);
      }
      const token = parseExpr(name) as Alias | Identifier;
      if (token.type === 'alias') {
        groups.push({ type: 'id', value: token.value });
      } else {
        groups.push(token as Identifier);
      }
      if (!columns.some(entry => (entry as Identifier).value === token.value)) {
        columns.push(token as SpellColumn);
      }
    }
    return this;
  }
  group!: (...names: string[]) => Spell<T, U>;

  /**
   * Set the ORDER of the query
   * @example
   * .order('title');
   * .order('title', 'desc');
   * .order({ title: 'desc' });
   * .order('id asc, gmt_created desc')
   * @param {string|Object} name
   * @param {string} direction
   */
  $order(name: string | Raw | Record<string, 'asc' | 'desc'>, direction?: string): this {
    if (isPlainObject(name)) {
      if (name instanceof Raw) {
        this.orders.push([
          name,
          'asc'
        ]);
      } else {
        for (const [prop, dir] of Object.entries(name)) {
          this.$order(prop, dir);
        }
      }
    } else if (name instanceof Raw) {
      this.orders.push([
        name,
        (direction && direction.toLowerCase() === 'desc') ? 'desc' : 'asc'
      ]);
    } else {
      let orders: any[] = [];
      try {
        const results = parseExprList(name as string);
        orders = results.map(expr => {
          return [
            expr,
            (direction && direction.toLowerCase() === 'desc') ? 'desc' : 'asc'
          ];
        });
      } catch {
        orders = (name as string).split(',').map((cond: string) => {
          cond = cond.trim();
          const match = cond.match(/^(.+?)\s+(asc|desc)$/i);
          const [, field, dir] = match || [ '', cond, direction ];
          return [
            parseExpr(field),
            dir && dir.toLowerCase() == 'desc' ? 'desc' : 'asc'
          ];
        });
      }
      for (const order of orders) {
        checkCond(this.Model, [order[0]]);
        this.orders.push(order);
      }
    }
    return this;
  }
  order!: (name: any, direction?: string) => Spell<T, U>;

  /**
   * Set the OFFSET of the query.
   * @param {number} skip
   */
  $offset(skip: number) {
    skip = +skip;
    if (Number.isNaN(skip)) throw new Error(`invalid offset ${skip}`);
    this.skip = skip;
    return this;
  }
  offset!: (skip: number) => Spell<T, U>;

  /**
   * Set the LIMIT of the query.
   * @param {number} rowCount
   */
  $limit(rowCount: number) {
    rowCount = +rowCount;
    if (Number.isNaN(rowCount)) throw new Error(`invalid limit ${rowCount}`);
    this.rowCount = rowCount;
    return this;
  }
  limit!: (rowCount: number) => Spell<T, U>;

  /**
   * Set the HAVING conditions, which usually appears in GROUP queries only.
   * @example
   * .having('average between ? and ?', 10, 20);
   * .having('maximum > 42');
   * .having({ count: 5 });
   *
   * @param {string|Object} conditions
   * @param {...*}          values
   */
  $having(conditions: string | WhereConditions<T>, ...values: Literal[]): this {
    const Model = this.Model;
    for (const condition of parseConditions(Model, conditions, ...values)) {
      // Postgres can't have alias in HAVING clause
      // https://stackoverflow.com/questions/32730296/referring-to-a-select-aggregate-column-alias-in-the-having-clause-in-postgres
      if (Model.driver && Model.driver.type === 'postgres' && !(condition instanceof Raw)) {
        const { value } = condition.args[0];
        for (const column of this.columns as (Identifier | Alias)[]) {
          if (column.value === value && column.type === 'alias') {
            condition.args[0] = structuredClone(column.args[0]);
            break;
          }
        }
      }
      this.havingConditions.push(condition);
    }
    return this;
  }
  having!: (conditions: string | WhereConditions<T>, ...values: Literal[]) => Spell<T, ResultSet<T>>;

  $orHaving(conditions: string | WhereConditions<T>, ...values: Literal[]): this {
    this.$having(conditions, ...values);
    const { havingConditions } = this;
    const len = havingConditions.length;
    const combined = havingConditions.slice(1, len - 1).reduce((result: any, condition: any) => {
      return { type: 'op', name: 'and', args: [result, condition] };
    }, havingConditions[0]);
    this.havingConditions = [
      { type: 'op', name: 'or', args: [combined, havingConditions[len - 1]] }
    ];
    return this;
  }
  orHaving!: (conditions: string | WhereConditions<T>, ...values: Literal[]) => Spell<T, ResultSet<T>>;

  /**
   * LEFT JOIN predefined associations in model.
   * @example
   * .with('attachment');
   * .with('attachment', 'comments');
   * .with({ comments: { select: 'content' } });
   *
   * @param {...string} qualifiers
   */
  $with(...qualifiers: (string | WithOptions)[]): this {
    if (Number(this.rowCount) > 0 || this.skip > 0) {
      const spell = this.dup;
      spell.columns = [];
      this.#emptySpell();
      this.table = { type: 'subquery', value: spell };
    }

    for (const qualifier of qualifiers) {
      if (isPlainObject(qualifier)) {
        for (const [key, value] of Object.entries(qualifier)) {
          joinAssociation(this, this.Model, this.Model.tableAlias, key, value);
        }
      } else if (qualifier) {
        joinAssociation(this, this.Model, this.Model.tableAlias, qualifier as string);
      }
    }
    return this;
  }
  with!: (...qualifiers: (string | WithOptions)[]) => Spell<T, U>;

  /**
   * LEFT JOIN arbitrary models with specified ON conditions.
   * @example
   * .join(User, 'users.id = posts.authorId');
   * .join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = 0');
   *
   * @param {Model}         Model
   * @param {string|Object} onConditions
   * @param {...*}          values
   */
  $join<V extends typeof AbstractBone>(Model: V, onConditions: string | OnConditions<T>, ...values: Literal[]): this {
    if (typeof Model === 'string') {
      return this.$with(Model, onConditions as WithOptions, ...values as any);
    }
    const qualifier = Model.tableAlias;
    const { joins } = this;

    if (qualifier in joins) {
      throw new Error(`invalid join target. ${qualifier} already defined.`);
    }
    joins[qualifier] = {
      Model,
      on: parseConditions(Model, onConditions, ...values)[0],
    };
    return this;
  }
  join!: <V extends typeof AbstractBone>(Model: V, onConditions: string | OnConditions<T>, ...values: Literal[]) => Spell<T, U>;

  /**
   * add optimizer hints to query
   * @example
   * .optimizerHints('SET_VAR(foreign_key_checks=OFF)')
   * .optimizerHints('SET_VAR(foreign_key_checks=OFF)', 'MAX_EXECUTION_TIME(1000)')
   * @param {...string} hints
   * @memberof Spell
   */
  $optimizerHints(...hints: (string | Hint | IndexHint | HintInterface)[]) {
    this.hints.push(...hints.map(hint => Hint.build(hint)));
    return this;
  }
  optimizerHints!: (...hints: (string | Hint | IndexHint | HintInterface)[]) => Spell<T, U>;

  /**
   * @example
   * .useIndex('idx_id')
   * .useIndex('idx_id', 'idx_title_id')
   * .useIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @memberof Spell
   */
  $useIndex(...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.use) {
        console.warn('Do not recommend set non-use index hint in useIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.use);
    }));
    return this;
  }
  useIndex!: (...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) => Spell<T, U>;

  /**
   * @example
   * .forceIndex('idx_id')
   * .forceIndex('idx_id', 'idx_title_id')
   * .forceIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @memberof Spell
   */
  $forceIndex(...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof Hint || (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.force)) {
        console.warn('Do not recommend set non-force index hint in forceIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.force);
    }));
    return this;
  }
  forceIndex!: (...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) => Spell<T, U>;

  /**
   * @example
   * .ignoreIndex('idx_id')
   * .ignoreIndex('idx_id', 'idx_title_id')
   * .ignoreIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @memberof Spell
   */
  $ignoreIndex(...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.ignore) {
        console.warn('Do not recommend set non-ignore index hint in ignoreIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.ignore);
    }));
    return this;
  }
  ignoreIndex!: (...hints: (string | IndexHint | HintInterface | HintScopeObject)[]) => Spell<T, U>;

  count!: (name?: BoneColumns<T> | Raw | string) => Spell<T, Extract<U, ResultSet<T> | number>>;

  average!: (name?: BoneColumns<T> | Raw | string) => Spell<T, Extract<U, ResultSet<T> | number>>;

  minimum!: (name?: BoneColumns<T> | Raw | string) => Spell<T, Extract<U, ResultSet<T> | number>>;

  maximum!: (name?: BoneColumns<T> | Raw | string) => Spell<T, Extract<U, ResultSet<T> | number>>;

  sum!: (name?: BoneColumns<T> | Raw | string) => Spell<T, Extract<U, ResultSet<T> | number>>;

  /**
   * Get the query results by batch. Returns an async iterator which can then be consumed with an async loop or the cutting edge `for await`. The iterator is an Object that contains a `next()` method:
   *
   *     const iterator = {
   *       i: 0,
   *       next: () => Promise.resolve(this.i++);
   *     }
   *
   * See examples to consume async iterators properly. Currently async iterator is [proposed](https://github.com/tc39/proposal-async-iteration) and [implemented by V8](https://jakearchibald.com/2017/async-iterators-and-generators/) but hasn't made into Node.js LTS yet.
   * @example
   * async function consume() {
   *   const batch = Post.all.batch();
   *   while (true) {
   *     const { done, value: post } = await batch.next();
   *     if (value) handle(post);
   *     if (done) break
   *   }
   * }
   * // or
   * for await (const post of Post.all.batch()) {
   *    handle(post);
   * }
   */
  async * batch(size = 1000) {
    const limit = Number(size);
    if (!(limit > 0)) throw new Error(`invalid batch limit ${size}`);
    // Duplicate the spell because spell.skip gets updated while iterating over the batch.
    const spell = this.$limit(limit) as Spell<T, Collection<InstanceType<T>>>;
    let results = await spell;

    while (results.length > 0) {
      for (const result of results) {
        yield result;
      }
      results = await spell.$offset(spell.skip + limit);
    }
  }

  /**
   * Format current spell to SQL string.
   */
  toSqlString(): string {
    const { Model } = this;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { sql, values } = Model.driver!.format(this as any);
    return SqlString.format(sql, values);
  }

  /**
   * Alias of {@link Spell#toSqlString}
   */
  toString() {
    return this.toSqlString();
  }
}

for (const [aggregator, func] of Object.entries(AGGREGATOR_MAP)) {
  Object.defineProperty(Spell.prototype, `$${aggregator}`, {
    configurable: true,
    writable: true,
    value: function Spell_aggregator(name: any = '*') {
      if (name instanceof Raw) {
        this.$select(Raw.build(`${func.toUpperCase()}(${name}) AS ${aggregator}`));
        return this;
      }
      if (name !== '*' && parseExpr(name as string)?.type !== 'id') {
        throw new Error(`unexpected operand ${name} for ${func.toUpperCase()}()`);
      }
      this.$select(`${func}(${name}) as ${aggregator}`);
      return this;
    }
  });
}

for (const method of Object.getOwnPropertyNames(Spell.prototype)) {
  if (method.startsWith('$')) {
    const descriptor = Object.getOwnPropertyDescriptor(Spell.prototype, method);
    Object.defineProperty(Spell.prototype, method.slice(1), Object.assign({}, descriptor, {
      value: function Spell_dup<T extends typeof AbstractBone>(this: Spell<T>, ...args: any[]) {
        const spell = this.dup;
        (spell as any)[method](...args);
        return spell;
      }
    }));
  }
}

export default Spell;
