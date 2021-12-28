1.14.4 / 2021-11-15
===================

## What's Changed

* test: PostgreSQL v14 test case compatibility by @cyjake https://github.com/cyjake/leoric/pull/230
* fix: turn off subquery optimization if query criteria contains other column by @cyjake https://github.com/cyjake/leoric/pull/229
* fix: bone.changed() return `false | string[]` type by @fengmk2 https://github.com/cyjake/leoric/pull/231

**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.14.3...v1.14.4

1.14.3 / 2021-11-12
===================

## What's Changed
* fix: logger.logQuery should be guarded in case of error by @SmartOrange in https://github.com/cyjake/leoric/pull/222
* fix: findOne without result should return null by @JimmyDaddy in https://github.com/cyjake/leoric/pull/225
* fix: Literal should support bigint type by @fengmk2 in https://github.com/cyjake/leoric/pull/226
* fix: select((name: string) => boolean) by @cyjake in https://github.com/cyjake/leoric/pull/227

**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.14.2...v1.14.3

1.14.2 / 2021-11-01
===================

## What's Changed
* fix: accept timestamps in snake case by @cyjake in https://github.com/cyjake/leoric/pull/221


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.14.1...v1.14.2

1.14.1 / 2021-11-01
===================

## What's Changed
* docs: export { Collection } by @cyjake in https://github.com/cyjake/leoric/pull/220


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.14.0...v1.14.1

1.14.0 / 2021-11-01
===================

Two options regarding `Model.init()` were added in this release:

```js
class User extends Bone {}
User.init({ name: STRING }, {
  timestamps: true,  // which is the default
  paranoid: true,    // which default to `false`
});
assert.deepEqual(Object.keys(User.attributes), [
  'id',
  'name',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);
```

## What's Changed
* docs: update 'primayKey' typos by @freshgum-bubbles in https://github.com/cyjake/leoric/pull/211
* docs: DataTypes definitions in d.ts by @cyjake in https://github.com/cyjake/leoric/pull/210
* fix: fix#209 sequelize mode should update all changed fields in instance update method by @JimmyDaddy in https://github.com/cyjake/leoric/pull/212
* fix: fix #213 findAndCountAll should ignore attributes by @JimmyDaddy in https://github.com/cyjake/leoric/pull/214
* fix: opts.connectTimeout by @cyjake in https://github.com/cyjake/leoric/pull/216
* fix: reload instance with sharding key should not throw by @cyjake in https://github.com/cyjake/leoric/pull/217
* feat: timestamps should be defined by default by @cyjake in https://github.com/cyjake/leoric/pull/218
* fix: instance.reload() should not rely on `static findOne()` by @cyjake in https://github.com/cyjake/leoric/pull/219

## New Contributors
* @freshgum-bubbles made their first contribution in https://github.com/cyjake/leoric/pull/211

**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.5...v1.14.0

1.13.5 / 2021-10-26
===================

## What's Changed
* docs: enhance aggregation query types & fix raw query result type by @cyjake in https://github.com/cyjake/leoric/pull/208


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.4...v1.13.5

1.13.4 / 2021-10-25
===================

## What's Changed
* docs: spell & model methods should be generic  by @cyjake in https://github.com/cyjake/leoric/pull/206
* docs: enhance query options, instance type, and toJSON() result type by @cyjake in https://github.com/cyjake/leoric/pull/207

This version brings correct (and hopefully better) typescript definitions, with the dts checked continuously at test/types tests. With this version, users that have model types correctly pinned at Bone will get code completion including class fields. Such as:

![image](https://user-images.githubusercontent.com/252317/138683240-98ee9e79-4b3e-449c-bc95-a449d457d64f.png)

**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.3...v1.13.4

1.13.3 / 2021-10-21
===================

## What's Changed
* refactor: persist edge cases of type casting in integration tests by @cyjake in https://github.com/cyjake/leoric/pull/202
* docs: renaming attributes by @cyjake in https://github.com/cyjake/leoric/pull/203
* fix: JSON.uncast(string) should not serialize twice by @cyjake in https://github.com/cyjake/leoric/pull/205


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.2...v1.13.3

1.13.2 / 2021-10-18
===================

## What's Changed
* fix: attribute.uncast([]) and realm.connect with synchronized models by @cyjake in https://github.com/cyjake/leoric/pull/201


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.1...v1.13.2

1.13.1 / 2021-10-18
===================

## What's Changed
* fix: skip connecting if models are synchronized already by @cyjake in https://github.com/cyjake/leoric/pull/200


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.13.0...v1.13.1

1.13.0 / 2021-10-18
===================

## What's Changed
* docs: monthly updates of 2021.09; support dark mode by @cyjake in https://github.com/cyjake/leoric/pull/196
* feat: coerce literal values into accurate attribute type by @cyjake in https://github.com/cyjake/leoric/pull/197
* fix: dispatched result should be in attribute names by @cyjake in https://github.com/cyjake/leoric/pull/198


**Full Changelog**: https://github.com/cyjake/leoric/compare/v1.12.0...v1.13.0

1.12.0 / 2021-10-12
===================

  * feat: support custom fields query and sequelize mode export rawAttributes (#192)
  * refactor: collection format query result (#194)
  * refactor: object condition parsing and expression formatting (#191)

1.11.1 / 2021-09-28
===================

This version fixes lots of issues regarding logical operator in object conditions.

  * fix: logical operator with multiple conditions such as (#190)
  * fix: sequelize mode support HAVING, and select fields raw sql support (#187)
  * fix: support len validator (#188)
  * fix: normalize logical operator conditions before formatting with spellbook (#186)

1.11.0 / 2021-09-24
===================

  * feat: support BINARY(length), VARBINARY(length), and BLOB (#169)
  * fix: logic operate should adapt one argument (#183)
  * fix: Bone.load() should be idempotent, make sure associations is intact (#184)
  * fix: selected instance isNewRecord is false (#182)
  * fix: set options.busyTimeout to mitigate SQLITE_BUSY (#176)
  * fix: turn on long stack trace of sqlite driver (#175)
  * docs: how to contribute (#180)

1.10.0 / 2021-09-14
===================

  * feat: SQLite driver should emit "connection" event when new connection is created (#168)
  * fix: bulkCreate(...records) should recognize custom setters (#168)
  * fix: attribute.equals() check should ignore defaultValue (#172)

1.9.0 / 2021-09-04
==================

> should've been a major release but since existing users have all migrated to the new api...

  * breaking: drop the deprecated `Model.describe()` (#167)

1.8.0 / 2021-08-30
==================

  * feat: silent option fix #164 (#165)
  * feat: binary type (#166)

1.7.1 / 2021-08-17
==================

  * revert: drop Driver#recycleConnections due to poor interoperability (#162)
  * fix: validator call array arguments (#160)

1.7.0 / 2021-08-17
=================

  * feat: close connections that exceeds opts.idleTimeout (#159)
  * feat: `opts.connectionLimit` support for SQLite (#159)
  * feat: raw query relpacements, closes #149 (#155)
  * fix: upsert created_at default (#154)
  * test: validator unit test (#157)
  * test: setup_hooks unit test (#158)

1.6.7 / 2021-08-05
==================

  * fix: prevent from calling Date.prototype.toJSON (#153)

1.6.6 / 2021-07-22
==================

  * fix: subclassing data type in dialects (#145)
  * fix: where('width / height >= 16 / 9') (#144)
  * docs: logging and sequelzie adapter (zh) (#142)
  * test: include test/unit/utils (#143)
  * test: more tests cases about sequelize adapter (#141)

1.6.5 / 2021-07-16
==================

  * fix: define assign Bone.models #140

1.6.4 / 2021-07-16
==================

  * refactor: connect({ Bone }) still necessary (#139)
  * fix: formatting select join with subqueries should not tamper the subquery itself (#138)
  * fix: describe table with more compatible syntax (#137)

1.6.3 / 2021-07-14
==================

  * fix: transaction option passing in sequelize adapter (#136)
  * fix: this.Model and proper Model.describe() (#135)

1.6.2 / 2021-07-09
==================

  * fix: convert datetime in seconds/milliseconds back to Date (#134)
  * fix: renamed attribute should remain enumerable (#133)

1.6.1 / 2021-07-07
==================

  * fix: collection convert should handle tddl results as well (#132)

1.6.0 / 2021-07-06
==================

  * feat: support class static attributes and hooks (#131)
  * fix: names defined in Bone.attributes should always be enumerable (#128)
  * chore: add quality badge to readme (#129)

1.5.2 / 2021-07-02
==================

  * fix: leave the getter properties defined in class syntax as is (#127)

1.5.1 / 2021-06-30
==================

  * fix: export Logger and Spell to let users intercept lower level api calls (#126)

1.5.0 / 2021-06-30
==================

  * feat: provide Bone.pool to be backward compatible with v0.x (#124)
  * feat: complete bone/spine.restore and Bone API type definitions (#125)
  * feat: support more data types (mediumtext, mediumint, char, date...) (#123)

1.4.1 / 2021-06-25
==================

  * refactor: simplify legacy timestamps support (#120)
  * refactor: do not subclass Bone unless asked specifically (#120)

1.4.0 / 2021-06-24
==================

  * feat: `realm.raw('SELECT ...')` and `Model.raw('SELECT ...')` (#94)
  * feat: support multiple order rules in one single string or one-dimensional array (#92)
  * feat: `Model.truncate()` now uses TRUNCATE if possible
  * feat: `Model.find().optimizerHints('SET_VAR(foreign_key_checks=OFF)')`
  * fix: Bone.bulkCreate() should not throw when called with non attribute (#117)
  * fix: batch upsert (#108)
  * fix: make sure connection is passed around in all queries carried out within transaction (#105)
  * fix: update, sequelize mode get API, destroy compitable (#104)
  * fix: `setDataValue` in sequelize adapter should not check prop name strictly
  * refactor: spell_insert (#118)
  * docs: about egg-orm & migrations (#119)
  * docs: revise instructions for installing Jekyll (#111)
  * docs: migrations, validations, hooks, and sequelize adapter (#103)
  * docs: contributing guides

1.3.0 / 2021-03-01
==================

  * feat: hook support
  * feat: dirty check (`changes()` & `previousChanges()`)
  * feat: compatible with mysql longtext conversion
  * feat: NOT condition

1.2.0 / 2020-12-10
==================

  * feat: `Realm.prototype.transaction()` with async function support
  * feat: `Realm.prototype.query()` for raw queries
  * feat: `logger.logQuery(sql, duration, { Model, command })`
  * feat: `logger.logQueryError(sql, err, duration, { Model, command })`

1.1.0 / 2020-11-23
==================

  * feat: JSON and JSONB data types
  * feat: support `stringifyObjects` option for mysql client
  * feat: aggregate functions for sequelize adapter
  * feat: `Spell.prototype.nodeify()`

1.0.3 / 2020-03-16
==================

  * fix: replace `deep-equal` (which is bloated) with `util.isDeepStrictEqual`

1.0.2 / 2020-03-04
==================

  * fix: driver.alterTable() with multiple columns to add in SQLite

1.0.1 / 2020-02-25
==================

  * fix: bulkCreate in sequelize shim

1.0.0 / 2020-02-24
==================

First major release. Let's get serious with semver.

  * feat: logger.logQuery(sql, duration) & logger.logQueryError(sql, err)

0.5.3 / 2020-02-22
==================

  * fix: `connect({ sequelize, dialect, client })` to allow mandatory sqlite client
  * fix: prevent queries being performed unless model is correctly connected

0.5.2 / 2020-02-21
==================

  * fix: drop the default and unused `require('sqlite3')`

0.5.1 / 2020-02-21
==================

  * fix: `connect({ client: '@journeyapps/sqlcipher' })`

0.5.0 / 2020-02-19
==================

  * feat: `Bone.sync()` to synchronize model with database
  * feat: `Bone.createMigrationFile()` to create migration file
  * feat: `Bone.migrate()` to run migrations
  * feat: `Bone.bulkCreate()` to bulk insert records
  * feat: `require('leoric')` now exports `Realm` to connect with multiple databases
  * feat: `realm.define()` to define models in an old fashioned way
  * feat: `realm.connect()` to connect with database
  * feat: SQLite support without hacking node-sqlite3
  * feat: `Bone.DataTypes` for type references
  * feat: `Bone.init()` to initialize models
  * feat: an adaptor to use Leoric in (partially) Sequelize complaint API
  * refactor: a complete re-write of JOIN queries
  * refactor: added `Bone.driver` to better encapsulate and planish database nuances

0.4.5 / 2019-12-14
==================

  * fix: prevent primary key from being overridden with incorrect `LAST_INSERT_ID()`

0.4.4 / 2019-07-15
==================

  * fix: append default scope when declaring relations, fixes #10

0.4.3 / 2019-05-09
==================

  * fix: prevent Bone.dispatch from creating duplicated records of main table

0.4.2 / 2019-04-26
==================

  * feat: `Spell#orWhere()` and `Spell#orHaving()`
  * feat: arithmetic operators
  * feat: unary operators such as unary minus `-` and bit invertion `~`
  * fix: unset attribute should be overwritable
  * fix: `attributeChanged()` should be false if attribute is unset and not overwritten
  * fix: subclass with incomplete getter/setter should be complemented
  * fix: sharding key validation on `Bone.update()` and `Bone.save()`
  * fix: sharding key should be along with primary key on `bone.remove()`
  * fix: `Bone.cast()` should leave `null` as is
  * fix: `INSERT ... UPDATE` with `id = LAST_INSERT_ID(id)` in MySQL
  * fix: `Model.find({ name: { $op1, $op2 } })` object conditions with multiple operators
  * fix: prefixing result set with qualifiers if query contains join relations and is not dispatchable
  * fix: `Spell#$get(index)` with LIMIT
  * doc: `Model.transaction()`
  * doc: definition types with `index.d.ts`

0.4.1 / 2019-03-21
==================

  * feat: premature sharding key validation
  * fix: output complete SQL instead of parameterized query with values.
  * fix: both `connect({ model })` and `connect({ models })` are allowed.
  * doc: no more `.findOrCreate()`, just `.upsert()`
  * doc: table of contents with kramdown's `{:toc}`
  * chore: droped experimental sqlite3 support

0.4.0 / 2018-11-05
==================

  * feat: PostgreSQL support
  * feat: Transaction support
  * upgrade: (forked) SQLite client updated to SQLite 3.24


0.3.0 / 2018-10-31
==================

 * feat: SQLite support with a [forked sqlite3](https://github.com/cyjake/node-sqlite3)
 * feat: mysql2 support (which is trivial since both mysql and mysql2 share the same API)
 * refactor: Spell now formats SQL with the literals separated, which gets escaped by the corresponding client itself later on.

0.2.0 / 2018-01-03
==================

 * breaking: renaming

0.1.8 / 2017-12-31
==================

 * fix: implement `query.batch()` as async iterator
 * fix: `NOT (expr)`
 * fix: `IFNULL(foo, default)`
 * fix: support `.select(name[])`, `.select(name => {})`, and `.select("...name")`
 * doc: `Model => className` in association options
 * doc: use [jsdoc](http://usejsdoc.org) to generate docs/api
 * doc: `.include()`

0.1.7 / 2017-12-22
==================

 * refactor: `{ type: 'op', name: 'as' }` renamed to `{ type: 'alias' }`
 * feat: `{ type: 'mod' }` for modifier, currently only `DISTINCT` is recognized
 * feat: unary operators like `!` and `NOT`
 * feat: `IS` and `IS NOT`
 * fix: logic operator precendences
 * fix: polymorphic hasMany({ through }) relations
 * fix: dispatching multiple results with joins correctly

0.1.6 / 2017-12-21
==================

 * feat: proper `.first`, `.last`, `.all`, and `.get(index)`
 * fix: accept `Date`, `boolean`, and `Set` values
 * fix: `Model.unscoped`
 * fix: `Model.remove({}, true)` should be unscoped

0.1.5 / 2017-12-20
==================

 * refactor: encapsulate column names. Keep them from the users even if the query results can not be dispatched.
 * fix: complicated groups with joins should discard the use of subquery.
 * fix: camelCase should replace globally
 * fix: avoid missing attribtue exception when toJSON/toObject

0.1.4 / 2017-12-18
==================

 * fix: should format condition arrays by hand instead of hand it over to formatExpr
 * fix: whereConditions of subquery should retain the order of the whereConditions in major query
 * fix: calculated columns should be kept in the final columns when sorting out the attributes
 * fix: doesn't depend on co anymore

0.1.3 / 2017-12-17
==================

 * fix: `select distict foo from table`;
 * fix: `where (a = 1 or a = 2) and b = 3`;
 * doc: a syntax table to provide a better glance over the querying ability.

0.1.2 / 2017-12-14
==================

 * fix: copy left table's orders into subquery to make order/limit work when combined.
 * fix: errors should be thrown when accessing attributes that weren't selected at the first place.

0.1.1 / 2017-12-13
==================

 * refactor: automatic versioning on spells. When client calls query methods with chaining, new versions of spell gets duplicated. Makes reuse of spells possible.
 * doc: english verion is almost complete <http://cyj.me/leoric>.

0.1.0 / 2017-12-09
==================

 * Initial version, covers basic usage such as model authoring, database connection, query interface, and association.
