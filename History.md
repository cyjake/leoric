0.5.0 / 2020-02-??
==================

  * New: `Bone.sync()` to synchronize model with database
  * New: `Bone.createMigrationFile()` to create migration file
  * New: `Bone.migrate()` to run migrations
  * New: `require('leoric')` now exports `Realm` to connect with multiple databases
  * New: `realm.define()` to define models in an old fashioned way
  * New: `realm.connect()` to connect to database
  * New: SQLite support without hacking node-sqlite3
  * New: `Bone.DataTypes` for type references
  * New: `Bone.init()` to initialize models
  * New: an adaptor to use Leoric in (partially) Sequelize complaint API
  * Refactor: a complete re-write of JOIN queries
  * Refactor: added `Bone.driver` to better encapsulate and planish database nuances


0.4.5 / 2019-12-14
==================

  * Fix: prevent primary key from being overridden with incorrect `LAST_INSERT_ID()`

0.4.4 / 2019-07-15
==================

  * Fix: append default scope when declaring relations, fixes #10

0.4.3 / 2019-05-09
==================

  * Fix: prevent Bone.dispatch from creating duplicated records of main table

0.4.2 / 2019-04-26
==================

  * New: `Spell#orWhere()` and `Spell#orHaving()`
  * New: arithmetic operators
  * New: unary operators such as unary minus `-` and bit invertion `~`
  * Fix: unset attribute should be overwritable
  * Fix: `attributeChanged()` should be false if attribute is unset and not overwritten
  * Fix: subclass with incomplete getter/setter should be complemented
  * Fix: sharding key validation on `Bone.update()` and `Bone.save()`
  * Fix: sharding key should be along with primary key on `bone.remove()`
  * Fix: `Bone.cast()` should leave `null` as is
  * Fix: `INSERT ... UPDATE` with `id = LAST_INSERT_ID(id)` in MySQL
  * Fix: `Model.find({ name: { $op1, $op2 } })` object conditions with multiple operators
  * Fix: prefixing result set with qualifiers if query contains join relations and is not dispatchable
  * Fix: `Spell#$get(index)` with LIMIT
  * Docs: `Model.transaction()`
  * Docs: definition types with `index.d.ts`

0.4.1 / 2019-03-21
==================

  * New: premature sharding key validation
  * Fix: output complete SQL instead of parameterized query with values.
  * Fix: both `connect({ model })` and `connect({ models })` are allowed.
  * Docs: no more `.findOrCreate()`, just `.upsert()`
  * Docs: table of contents with kramdown's `{:toc}`
  * Misc: droped experimental sqlite3 support

0.4.0 / 2018-11-05
==================

  * New: PostgreSQL support
  * New: Transaction support
  * Upgrade: (forked) SQLite client updated to SQLite 3.24


0.3.0 / 2018-10-31
==================

 * New: SQLite support with a [forked sqlite3](https://github.com/cyjake/node-sqlite3)
 * New: mysql2 support (which is trivial since both mysql and mysql2 share the same API)
 * Refactor: Spell now formats SQL with the literals separated, which gets escaped by the corresponding client itself later on.

0.2.0 / 2018-01-03
==================

 * Breaking: renaming

0.1.8 / 2017-12-31
==================

 * Fix: implement `query.batch()` as async iterator
 * Fix: `NOT (expr)`
 * Fix: `IFNULL(foo, default)`
 * Fix: support `.select(name[])`, `.select(name => {})`, and `.select("...name")`
 * Docs: `Model => className` in association options
 * Docs: use [jsdoc](http://usejsdoc.org) to generate docs/api
 * Docs: `.include()`

0.1.7 / 2017-12-22
==================

 * Refactor: `{ type: 'op', name: 'as' }` renamed to `{ type: 'alias' }`
 * New: `{ type: 'mod' }` for modifier, currently only `DISTINCT` is recognized
 * New: unary operators like `!` and `NOT`
 * New: `IS` and `IS NOT`
 * Fix: logic operator precendences
 * Fix: polymorphic hasMany({ through }) relations
 * Fix: dispatching multiple results with joins correctly

0.1.6 / 2017-12-21
==================

 * New: proper `.first`, `.last`, `.all`, and `.get(index)`
 * Fix: accept `Date`, `boolean`, and `Set` values
 * Fix: `Model.unscoped`
 * Fix: `Model.remove({}, true)` should be unscoped

0.1.5 / 2017-12-20
==================

 * Refactor: encapsulate column names. Keep them from the users even if the query results can not be dispatched.
 * Fix: complicated groups with joins should discard the use of subquery.
 * Fix: camelCase should replace globally
 * Fix: avoid missing attribtue exception when toJSON/toObject

0.1.4 / 2017-12-18
==================

 * Fix: should format condition arrays by hand instead of hand it over to formatExpr
 * Fix: whereConditions of subquery should retain the order of the whereConditions in major query
 * Fix: calculated columns should be kept in the final columns when sorting out the attributes
 * Fix: doesn't depend on co anymore

0.1.3 / 2017-12-17
==================

 * Fix: `select distict foo from table`;
 * Fix: `where (a = 1 or a = 2) and b = 3`;
 * Docs: a syntax table to provide a better glance over the querying ability.

0.1.2 / 2017-12-14
==================

 * Fix: copy left table's orders into subquery to make order/limit work when combined.
 * Fix: errors should be thrown when accessing attributes that weren't selected at the first place.

0.1.1 / 2017-12-13
==================

 * Refactor: automatic versioning on spells. When client calls query methods with chaining, new versions of spell gets duplicated. Makes reuse of spells possible.
 * Docs: english verion is almost complete <http://cyj.me/leoric>.

0.1.0 / 2017-12-09
==================

 * Initial version, covers basic usage such as model authoring, database connection, query interface, and association.
