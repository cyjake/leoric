---
layout: en
title: Logging
---
## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

We can customzie logging methods with the `logger` option like below:

```js
const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  logger: {
    logQuery(sql, duration, opts) {},            // queries
    logQueryError(err, sql, duration, opts) {},  // failed queries
    logMigration(name) {},                       // migrations
  },
});
```

## `logQuery`

`logQuery(sql, duration, opts)` gets called when query completes, which receives arguments as explained in following table:

| name | type | description |
|-----|------|------|
| `sql` | `string` | SQL of the query |
| `duration` | `number` | response time of the query |
| `opts.command` | `string` | command of the query |
| `opts.connection` | `Connection` | related connection |
| `opts.Model` | `Model` | the model that initiates the query |

### SQL

By default, we log the SQL as is. If there are sensible data to ignore, please consider the  `hideKeys` option to hide certain columns from the logger.

### Response Time

When performing model queries, such as `await User.findOne()`, the most time consuming steps are as below:

1. obtaining a connection from the connection pool,
2. sending query through obtained connection,
3. getting and formatting the result.

The duration in `logQuery`is about the time elapsed between step 2 and 3, which should be close to the response time from the database perspective.

### Related Model

The model related to the query is accessible through `opts.Model`. If there are multiple models participated in the query, `opts.Model` is only bound to the initiator.

### Extra Info

When performing queries through model methods, `opts` might contain extra info including but not limited to below:

| name | type | description |
|-----|------|-----|
| `opts.hints` | `Hint[]` | optimizer hints |
| `opts.columns` | `string[]` | columns to select |
| `opts.whereConditions` | `object[]` | where conditions |

## `logQueryError`

`logQueryError(err, sql, duration, opts)` receives almost the same arguments like `logQuery()` with an extra first arugment `err`. This method only gets called when the query fails to be carried out in database, mostly due to syntax error, validation error, or other constraints.

| name | type | description |
|-----|-----|------|
| `err` | `Error` | related error |

## `logMigration`

When performing migration tasks, besides the default `logQuery()` or `logQueryError()`, there is also `logMigration(name)` to log the related migration task.

## `hideKeys`

We can use the `hideKeys` option to refrain the values of certain columns from being printed.

```js
const realm = new Realm({
  logging: {
    hideKeys: [ 'users.password', 'docs.content' ],
  },
});
```

The SQL with corresponding column values hidden is like below:

```sql
INSERT INTO users (name, password) VALUES ('John', '***');
```
