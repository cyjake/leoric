---
layout: zh
title: 日志
---
## 目录
{:.no_toc}

1. 目录
{:toc}

可以通过 `logger` 配置项覆盖相关方法来指定日志输出方式：

```js
const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  logger: {
    logQuery(sql, duration, opts) {},            // 数据库查询
    logQueryError(err, sql, duration, opts) {},  // 数据库查询失败
    logMigration(name) {},                       // 迁移任务
  },
});
```

## `logQuery`

完成一次数据库查询即调用 `logQuery(sql, duration, opts)` 方法，相关参数说明如下：

| 参数 | 类型 | 描述 |
|-----|------|------|
| `sql` | `string` | 执行的 SQL 语句 |
| `duration` | `number` | 执行耗时，从执行查询到返回结果，不包含连接池等候时间 |
| `opts.command` | `string` | 执行 SQL 查询指令 |
| `opts.connection` | `Connection` | 执行本次查询的数据库连接 |
| `opts.Model` | `Model` | 关联的数据模型 |

### 执行 SQL

默认按原文输出实际执行的 SQL 语句，如果配置了 `hideKeys` 参数来隐藏部分字段的输出，则相关字段的值会被隐藏。

### 执行耗时

从调用者的视角来看，数据模型的查询耗时可能比执行耗时要更长，例如执行 `await User.findOne()` 时包含如下步骤：

1. 从数据库连接池获取连接，如果请求并发量太高，此时可能需要等候
2. 在获取到的连接上调用查询方法，执行查询
3. 等待数据库返回执行结果，将结果处理成对应格式

`logQuery` 中的执行耗时即步骤二到步骤三所消耗的时间，主要用来评估数据库执行查询时性能表现。如果应用并发量比较高，建议通过调大连接池或者增加一层业务缓存来降低数据库负载。

### 关联的数据模型

可以通过 `opts.Model` 获取到本次查询相关的数据模型，如果存在多个数据模型的联表查询或者查询子句，`opts.Model` 仅代表发起查询的主数据模型。

### 其他参数

通过数据模型的查询方法执行数据库查询时，`opts` 还可能包含额外信息，包括但不限于:

| 参数 | 类型 | 描述 |
|-----|------|-----|
| `opts.hints` | `Hint[]` | 优化提示 |
| `opts.columns` | `string[]` | 查询的字段列表 |
| `opts.whereConditions` | `object[]` | 查询限定条件 |

## `logQueryError`

`logQueryError(err, sql, duration, opts)` 接收的参数与 `logQuery()` 大致相仿，唯一的区别是第一个参数为 `err`，仅在数据库查询出现异常时被调用，比如 SQL 语法错误、数据库校验不通过等情况。

| 参数 | 类型 | 描述 |
|-----|-----|------|
| `err` | `Error` | 数据库查询失败时的异常信息 |

## `logMigration`

执行迁移任务时，除了常规的 `logQuery()` 或者 `logQueryError()` 日志，还会额外执行 `logMigration(name)` 来记录当前执行的数据迁移任务。

## `hideKeys`

可以使用 `hideKeys` 参数隐藏敏感数据，避免敏感信息被记录到日志服务中：

```js
const realm = new Realm({
  logger: {
    hideKeys: [ 'users.password', 'docs.content' ],
  },
});
```

相关 SQL 语句将会被替换，效果大致如下：

```sql
INSERT INTO users (name, password) VALUES ('John', '***');
```
