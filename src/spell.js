'use strict';

/**
 * The {@link Spell} class.
 * @module
 */
const pluralize = require('pluralize');
const SqlString = require('sqlstring');
const { parseExprList, parseExpr, walkExpr } = require('./expr');
const { isPlainObject } = require('./utils');
const { IndexHint, INDEX_HINT_TYPE, Hint } = require('./hint');
const { parseObject } = require('./query_object');
const Raw = require('./raw').default;
const { AGGREGATOR_MAP } = require('./constants');

/**
 * check condition to avoid use virtual fields as where conditions
 * @param {Bone} Model
 * @param {Array<Object>} conds
 */
function checkCond(Model, conds) {
  if (Array.isArray(conds)) {
    for (const cond of conds) {
      if (cond.type === 'id' && cond.value != null) {
        if (Model.attributes[cond.value] && Model.attributes[cond.value].virtual) {
          throw new Error(`unable to use virtual attribute ${cond.value} as condition in model ${Model.name}`);
        }
      } else if (cond.type === 'op' && cond.args && cond.args.length) {
        checkCond(Model, cond.args);
      }
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
function parseConditions(Model, conditions, ...values) {
  if (conditions instanceof Raw) return [ conditions ];
  let conds;
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

function parseSelect(spell, ...names) {
  const { joins, Model } = spell;
  if (typeof names[0] === 'function') {
    names = Object.keys(Model.columnAttributes).filter(names[0]);
  } else {
    names = names.reduce((result, name) => result.concat(name), []);
  }

  const columns = [];
  for (const name of names) {
    if (name instanceof Raw) columns.push(name);
    else columns.push(...parseExprList(name));
  }

  for (const ast of columns) {
    walkExpr(ast, token => {
      const { type, qualifiers, value } = token;
      if (type != 'id') return;
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
function formatValueSet(spell, obj, strict = true) {
  const { Model } = spell;
  const sets = {};
  for (const name in obj) {
    const attribute = Model.columnAttributes[name];
    const value = obj[name];

    if (!attribute) {
      continue;
    }

    // raw sql don't need to uncast
    if (value instanceof Raw) {
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
function parseSet(spell, obj) {
  let sets;
  if (Array.isArray(obj)) {
    sets = [];
    for (const o of obj) {
      // bulk write should not check attribute existence strictly
      sets.push(formatValueSet(spell, o, false));
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
function joinOnConditions(spell, BaseModel, baseName, refName, { where, association } = {}) {
  const { Model: RefModel, foreignKey, belongsTo } = association;
  const [baseKey, refKey] = belongsTo
    ? [foreignKey, RefModel.primaryKey]
    : [BaseModel.primaryKey, foreignKey];

  const onConditions = {
    type: 'op', name: '=',
    args: [
      { type: 'id', value: baseKey, qualifiers: [baseName] },
      { type: 'id', value: refKey, qualifiers: [refName] }
    ]
  };
  if (!where) where = association.where;
  if (where) {
    const whereConditions = parseConditions(BaseModel, where).reduce((result, condition) => {
      if (!result) return condition;
      return { type: 'op', name: 'and', args: [ result, condition ] };
    });
    walkExpr(whereConditions, node => {
      if (node.type == 'id') node.qualifiers = [refName];
    });
    return { type: 'op', name: 'and', args: [ onConditions, whereConditions ] };
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
function findAssociation(associations, opts) {
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
function joinAssociation(spell, BaseModel, baseName, refName, opts = {}) {
  const { joins } = spell;
  let association = BaseModel.associations[refName] || BaseModel.associations[pluralize(refName, 1)];

  if (refName in joins) throw new Error(`duplicated ${refName} in join tables`);
  if (!association && opts.targetAssociation) {
    association = findAssociation(BaseModel.associations, { Model: opts.targetAssociation.Model });
  }
  if (!association) {
    throw new Error(`unable to find association ${refName} on ${BaseModel.name}`);
  }

  const { through, Model: RefModel, includes } = association;

  if (through) {
    const throughAssociation = BaseModel.associations[through];
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
  const where = targetAssociation ? targetAssociation.where : null;
  const select = opts.select || association.select;

  if (select) {
    const columns = parseSelect({ Model: RefModel }, select);
    for (const token of columns) {
      walkExpr(token, node => {
        if (node.type === 'id' && !node.qualifiers && RefModel.columnAttributes[node.value]) {
          node.qualifiers = [refName];
        }
      });
    }
    spell.columns.push(...columns);
  }

  spell.joins[refName] = {
    Model: RefModel,
    on: joinOnConditions(spell, BaseModel, baseName, refName, { where, association }),
    hasMany: association.hasMany || (throughAssociation ? throughAssociation.hasMany : false),
  };

  if (includes) joinAssociation(spell, RefModel, refName, includes);
}

/**
 * If Model supports soft delete, and deletedAt isn't specified in whereConditions yet, and the table isn't a subquery, append a default where({ deletedAt: null }).
 */
function scopeDeletedAt(spell) {
  const { table, sets, whereConditions, Model } = spell;

  const { deletedAt } = Model.timestamps;

  // from subquery
  if (table.type !== 'id') return;

  // UPDATE users SET deleted_at = NULL WHERE id = 42;
  if (sets && sets[deletedAt] === null) return;

  // deletedAt already specified
  for (const condition of whereConditions) {
    let found = false;
    walkExpr(condition, ({ type, value }) => {
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
class Spell {
  /**
   * Create a spell.
   * @param {Model}          Model    - A sub class of {@link Bone}.
   * @param {Object}         opts     - Extra columnAttributes to be set.
   */
  constructor(Model, opts = {}) {
    if (Model.synchronized == null) {
      throw new Error(`model ${Model.name} is not connected yet`);
    }

    const scopes = [];

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

    const hints = [];

    if (opts.hints && opts.hints.length) {
      hints.push(...opts.hints.map(hint => Hint.build(hint)));
    }

    if (opts.hint) {
      hints.push(Hint.build(opts.hint));
    }

    this.hints = hints.reduce((result, hint) => {
      if (!result.some(entry => entry.isEqual(hint))) {
        result.push(hint);
      }
      return result;
    }, []);
  }

  static expr(text) {
    return { ...parseExpr(text), __expr: true };
  }

  #emptySpell() {
    Object.assign(this, {
      whereConditions: [],
      groups: [],
      orders: JSON.parse(JSON.stringify(this.orders)),
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
    spell.scopes = spell.scopes.filter((scope) => !scope.__paranoid);
    return spell;
  }

  get all() {
    return this;
  }

  get first() {
    return this.order(this.Model.primaryKey).$get(0);
  }

  get last() {
    return this.order(this.Model.primaryKey, 'desc').$get(0);
  }

  /**
   * Get a duplicate of current spell.
   * @returns {Spell}
   */
  get dup() {
    return new Spell(this.Model, {
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
  $get(index) {
    this.$limit(1);
    if (index > 0) this.$offset(index);

    return this.later(results => {
      const { Model } = this;
      const result = results[0];
      return result instanceof Model ? result : null;
    });
  }

  later(resolve) {
    this.laters.push(resolve);
    return this;
  }

  async ignite() {
    const { Model, laters } = this;
    let result = await Model.driver.cast(this);
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
  then(resolve = null, reject) {
    return this.ignite().then(resolve, reject);
  }

  /**
   * @param {Function} reject
   */
  catch(reject) {
    return this.then(null, reject);
  }

  /**
   * @param {Function} onFinally
   */
  finally(onFinally) {
    return this.then().finally(onFinally);
  }

  /**
   * - https://nodejs.org/en/knowledge/errors/what-are-the-error-conventions/
   * @param {Function} callback
   */
  nodeify(callback) {
    return this.then(function resolve(result) {
      callback(null, result);
    }, function reject(err) {
      callback(err);
    });
  }

  /**
   * Generate an INSERT query.
   * @private
   * @param {Object} obj - key-values pairs
   */
  $insert(obj) {
    this.command = 'insert';
    this.sets = parseSet(this, obj);
    return this;
  }

  /**
   * Generate a upsert-like query which takes advantage of ON DUPLICATE KEY UPDATE.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $upsert(obj) {
    this.command = 'upsert';
    this.sets = parseSet(this, obj);
    return this;
  }

  $bulkInsert(records) {
    this.command = 'bulkInsert';
    this.sets = parseSet(this, records);
    return this;
  }

  /**
   * Whitelist columnAttributes to select. Can be called repeatedly to select more columnAttributes.
   * @param {...string} names
   * @example
   * .select('title');
   * .select('title', 'createdAt');
   * .select('IFNULL(title, "Untitled")');
   */
  $select(...names) {
    this.columns.push(...parseSelect(this, ...names));
    return this;
  }

  /**
   * Make a UPDATE query with values updated by generating SET key=value from obj.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $update(obj) {
    this.command = 'update';
    this.sets = parseSet(this, obj);
    return this;
  }

  $increment(name, by = 1, opts = {}) {
    const { Model } = this;
    const silent = opts.silent;
    const { timestamps } = Model;
    this.command = 'update';
    if (!Number.isFinite(by)) throw new Error(`unexpected increment value ${by}`);
    if (!Model.columnAttributes.hasOwnProperty(name)) {
      throw new Error(`undefined attribute "${name}"`);
    }

    this.sets = {
      ...this.sets,
      [name]: {
        type: 'op',
        name: by > 0 ? '+' : '-',
        args: [
          { type: 'id', value: name, },
          { type: 'literal', value: Math.abs(by) },
        ],
        __expr: true,
      },
    };

    if (timestamps.updatedAt && !this.sets[timestamps.updatedAt] && !silent) {
      this.sets[timestamps.updatedAt] = new Date();
    }

    return this;
  }

  $decrement(name, by = 1,  opts = {}) {
    return this.$increment(name, -by, opts);
  }

  /**
   * Set query command to DELETE.
   * @returns {Spell}
   */
  $delete() {
    this.command = 'delete';
    return this;
  }

  /**
   * Set the table of the spell. If an instance of {@link Spell} is passed, it will be used as a derived table.
   * @param {string|Spell} table
   * @returns {Spell}
   */
  $from(table) {
    this.table = table instanceof Spell
      ? { type: 'subquery', value: table }
      : parseExpr(table);
    return this;
  }

  /**
   * Set WHERE conditions. Both string conditions and object conditions are supported.
   * @example
   * .where({ foo: null });
   * .where('foo = ? and bar >= ?', null, 42);
   * @param {string|Object} conditions
   * @param {...*}          values     - only necessary when using templated string conditions
   * @returns {Spell}
   */
  $where(conditions, ...values) {
    const Model = this.Model;
    this.whereConditions.push(...parseConditions(Model, conditions, ...values));
    return this;
  }

  $orWhere(conditions, ...values) {
    const { whereConditions } = this;
    if (whereConditions.length == 0) return this.$where(conditions, ...values);
    const combined = whereConditions.slice(1).reduce((result, condition) => {
      return { type: 'op', name: 'and', args: [result, condition] };
    }, whereConditions[0]);
    const Model = this.Model;
    this.whereConditions = [
      { type: 'op', name: 'or', args:
        [combined, ...parseConditions(Model, conditions, ...values)] }
    ];
    return this;
  }

  /**
   * Set GROUP BY columnAttributes. `select_expr` with `AS` is supported, hence following expressions have the same effect:
   *
   *     .select('YEAR(createdAt)) AS year').group('year');
   *
   * @example
   * .group('city');
   * .group('YEAR(createdAt)');
   * @param {...string} names
   * @returns {Spell}
   */
  $group(...names) {
    const { columns, groups, Model } = this;

    for (const name of names) {
      if (Model.attributes[name] && Model.attributes[name].virtual) {
        throw new Error(`unable to use virtual attribute ${name} as group column in model ${Model.name}`);
      }
      const token = parseExpr(name);
      if (token.type === 'alias') {
        groups.push({ type: 'id', value: token.value });
      } else {
        groups.push(token);
      }
      if (!columns.some(entry => entry.value === token.value)) {
        columns.push(token);
      }
    }
    return this;
  }

  /**
   * Set the ORDER of the query
   * @example
   * .order('title');
   * .order('title', 'desc');
   * .order({ title: 'desc' });
   * .order('id asc, gmt_created desc')
   * @param {string|Object} name
   * @param {string} direction
   * @returns {Spell}
   */
  $order(name, direction) {
    if (isPlainObject(name)) {
      if (name instanceof Raw) {
        this.orders.push([
          name,
        ]);
      } else {
        for (const prop in name) {
          this.$order(prop, name[prop]);
        }
      }
    }
    else if (/^(.+?)\s+(asc|desc)$/i.test(name)) {
      const conditions = name.split(',');
      conditions.map(cond => {
        [, name, direction] = cond.match(/^(.+?)\s+(asc|desc)$/i);
        this.$order(name, direction);
      });
    }
    else {
      const order = [
        parseExpr(name),
        direction && direction.toLowerCase() == 'desc' ? 'desc' : 'asc'
      ];
      checkCond(this.Model, order);
      this.orders.push(order);
    }
    return this;
  }

  /**
   * Set the OFFSET of the query.
   * @param {number} skip
   * @returns {Spell}
   */
  $offset(skip) {
    skip = +skip;
    if (Number.isNaN(skip)) throw new Error(`invalid offset ${skip}`);
    this.skip = skip;
    return this;
  }

  /**
   * Set the LIMIT of the query.
   * @param {number} rowCount
   * @returns {Spell}
   */
  $limit(rowCount) {
    rowCount = +rowCount;
    if (Number.isNaN(rowCount)) throw new Error(`invalid limit ${rowCount}`);
    this.rowCount = rowCount;
    return this;
  }

  /**
   * Set the HAVING conditions, which usually appears in GROUP queries only.
   * @example
   * .having('average between ? and ?', 10, 20);
   * .having('maximum > 42');
   * .having({ count: 5 });
   *
   * @param {string|Object} conditions
   * @param {...*}          values
   * @returns {Spell}
   */
  $having(conditions, ...values) {
    const Model = this.Model;
    for (const condition of parseConditions(Model, conditions, ...values)) {
      // Postgres can't have alias in HAVING clause
      // https://stackoverflow.com/questions/32730296/referring-to-a-select-aggregate-column-alias-in-the-having-clause-in-postgres
      if (Model.driver.type === 'postgres' && !(condition instanceof Raw)) {
        const { value } = condition.args[0];
        for (const column of this.columns) {
          if (column.value === value && column.type === 'alias') {
            condition.args[0] = JSON.parse(JSON.stringify(column.args[0]));
            break;
          }
        }
      }
      this.havingConditions.push(condition);
    }
    return this;
  }

  $orHaving(conditions, ...values) {
    this.$having(conditions, ...values);
    const { havingConditions } = this;
    const len = havingConditions.length;
    const combined = havingConditions.slice(1, len - 1).reduce((result, condition) => {
      return { type: 'op', name: 'and', args: [result, condition] };
    }, havingConditions[0]);
    this.havingConditions = [
      { type: 'op', name: 'or', args: [combined, havingConditions[len - 1]] }
    ];
    return this;
  }

  /**
   * LEFT JOIN predefined associations in model.
   * @example
   * .with('attachment');
   * .with('attachment', 'comments');
   * .with({ comments: { select: 'content' } });
   *
   * @param {...string} qualifiers
   * @returns {Spell}
   */
  $with(...qualifiers) {
    if (this.rowCount > 0 || this.skip > 0) {
      const spell = this.dup;
      spell.columns = [];
      this.#emptySpell();
      this.table = { type: 'subquery', value: spell };
    }

    for (const qualifier of qualifiers) {
      if (isPlainObject(qualifier)) {
        for (const key in qualifier) {
          joinAssociation(this, this.Model, this.Model.tableAlias, key, qualifier[key]);
        }
      } else {
        joinAssociation(this, this.Model, this.Model.tableAlias, qualifier);
      }
    }
    return this;
  }

  /**
   * LEFT JOIN arbitrary models with specified ON conditions.
   * @example
   * .join(User, 'users.id = posts.authorId');
   * .join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = 0');
   *
   * @param {Model}         Model
   * @param {string|Object} onConditions
   * @param {...*}          values
   * @returns {Spell}
   */
  $join(Model, onConditions, ...values) {
    if (typeof Model === 'string') {
      return this.$with(...arguments);
    }
    const qualifier = Model.tableAlias;
    const { joins } = this;

    if (qualifier in joins) {
      throw new Error(`invalid join target. ${qualifier} already defined.`);
    }
    joins[qualifier] = { Model, on: parseConditions(Model, onConditions, ...values)[0] };
    return this;
  }

  /**
   * add optimizer hints to query
   * @example
   * .optimizerHints('SET_VAR(foreign_key_checks=OFF)')
   * .optimizerHints('SET_VAR(foreign_key_checks=OFF)', 'MAX_EXECUTION_TIME(1000)')
   * @param {...string} hints
   * @returns {Spell}
   * @memberof Spell
   */
  $optimizerHints(...hints) {
    this.hints.push(...hints.map(hint => Hint.build(hint)));
    return this;
  }

  /**
   * @example
   * .useIndex('idx_id')
   * .useIndex('idx_id', 'idx_title_id')
   * .useIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @param {string | object} hints
   * @returns {Spell}
   * @memberof Spell
   */
  $useIndex(...hints) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.use) {
        console.warn('Do not recommend set non-use index hint in useIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.use);
    }));
    return this;
  }

  /**
   * @example
   * .forceIndex('idx_id')
   * .forceIndex('idx_id', 'idx_title_id')
   * .forceIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @param {string | object} hints
   * @returns {Spell}
   * @memberof Spell
   */
  $forceIndex(...hints) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof Hint || (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.force)) {
        console.warn('Do not recommend set non-force index hint in forceIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.force);
    }));
    return this;
  }

  /**
   * @example
   * .ignoreIndex('idx_id')
   * .ignoreIndex('idx_id', 'idx_title_id')
   * .ignoreIndex('idx_id', { orderBy: ['idx_title', 'idx_org_id'] }, { groupBy: 'idx_type' })
   * @param {string | object} hints
   * @returns {Spell}
   * @memberof Spell
   */
  $ignoreIndex(...hints) {
    this.hints.push(...hints.map((hint) => {
      if (hint instanceof IndexHint && hint.type !== INDEX_HINT_TYPE.ignore) {
        console.warn('Do not recommend set non-ignore index hint in ignoreIndex');
      }
      return IndexHint.build(hint, INDEX_HINT_TYPE.ignore);
    }));
    return this;
  }

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
   *
   * @param {number} size
   * @returns {Object}
   */
  async * batch(size = 1000) {
    const limit = parseInt(size, 10);
    if (!(limit > 0)) throw new Error(`invalid batch limit ${size}`);
    // Duplicate the spell because spell.skip gets updated while iterating over the batch.
    const spell = this.limit(limit);
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
   * @returns {string}
   */
  toSqlString() {
    const { Model } = this;
    const { sql, values } = Model.driver.format(this);
    return SqlString.format(sql, values);
  }

  /**
   * Alias of {@link Spell#toSqlString}
   * @returns {string}
   */
  toString() {
    return this.toSqlString();
  }
}

for (const aggregator in AGGREGATOR_MAP) {
  const func = AGGREGATOR_MAP[aggregator];
  Object.defineProperty(Spell.prototype, `$${aggregator}`, {
    configurable: true,
    writable: true,
    value: function Spell_aggregator(name = '*') {
      if (name instanceof Raw) {
        this.$select(Raw.build(`${func.toUpperCase()}(${name}) AS ${aggregator}`));
        return this;
      }
      if (name !== '*' && parseExpr(name).type !== 'id') {
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
      value: function Spell_dup() {
        const spell = this.dup;
        spell[method](...arguments);
        return spell;
      }
    }));
  }
}

module.exports = Spell;
