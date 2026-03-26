---
layout: zh
title: 数据类型
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

Leoric 通过 `DataTypes` 对象提供一组数据类型，用于在静态属性或装饰器中定义模型字段。

```js
import { Bone, DataTypes } from 'leoric';
const { STRING, BIGINT, TEXT, BOOLEAN } = DataTypes;

class User extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true },
    name: { type: STRING(100), allowNull: false },
    bio: TEXT,
    active: BOOLEAN,
  }
}
```

## 字符串类型

### `STRING(length)`

变长字符串，映射到 SQL 的 `VARCHAR`。

| 参数     | 默认值 | 说明           |
|---------|--------|---------------|
| `length`| `255`  | 最大字符串长度  |

```js
STRING        // VARCHAR(255)
STRING(100)   // VARCHAR(100)
```

### `CHAR(length)`

定长字符串。

```js
CHAR        // CHAR(255)
CHAR(10)    // CHAR(10)
```

### `TEXT(length)`

长文本类型。`length` 参数控制大小变体。

| 变体               | SQL 类型       |
|--------------------|---------------|
| `TEXT`             | `TEXT`        |
| `TEXT('tiny')`     | `TINYTEXT`   |
| `TEXT('medium')`   | `MEDIUMTEXT` |
| `TEXT('long')`     | `LONGTEXT`   |

```js
import { DataTypes, LENGTH_VARIANTS } from 'leoric';

TEXT                          // TEXT
TEXT(LENGTH_VARIANTS.tiny)    // TINYTEXT
TEXT(LENGTH_VARIANTS.medium)  // MEDIUMTEXT
TEXT(LENGTH_VARIANTS.long)    // LONGTEXT
```

## 数值类型

### `INTEGER(length)`

32 位整数。支持 `UNSIGNED` 和 `ZEROFILL` 修饰符。

```js
INTEGER             // INTEGER
INTEGER(10)         // INTEGER(10)
INTEGER.UNSIGNED    // INTEGER UNSIGNED
```

### `TINYINT(length)`

8 位整数。

```js
TINYINT             // TINYINT
TINYINT(1)          // TINYINT(1) - MySQL 中常用作布尔值
TINYINT.UNSIGNED    // TINYINT UNSIGNED
```

### `SMALLINT(length)`

16 位整数。

```js
SMALLINT            // SMALLINT
SMALLINT.UNSIGNED   // SMALLINT UNSIGNED
```

### `MEDIUMINT(length)`

24 位整数。

```js
MEDIUMINT           // MEDIUMINT
MEDIUMINT.UNSIGNED  // MEDIUMINT UNSIGNED
```

### `BIGINT(length)`

64 位整数。常用于主键。

```js
BIGINT              // BIGINT
BIGINT.UNSIGNED     // BIGINT UNSIGNED
```

> **注意**：JavaScript 无法安全表示大于 `Number.MAX_SAFE_INTEGER`（2^53 - 1）的整数。对于超大数值，返回值可能是字符串。

### `DECIMAL(precision, scale)`

定点小数类型，适用于金融数据。

```js
DECIMAL             // DECIMAL
DECIMAL(10, 2)      // DECIMAL(10,2) - 共 10 位，小数点后 2 位
DECIMAL.UNSIGNED    // DECIMAL UNSIGNED
```

### `BOOLEAN`

布尔类型，映射到 SQL 的 `BOOLEAN`。

```js
BOOLEAN   // BOOLEAN
```

## 日期与时间类型

### `DATE(precision, timezone)`

日期时间类型，映射到 SQL 的 `DATETIME` 或 `TIMESTAMP`。

| 参数        | 默认值 | 说明                                    |
|------------|--------|----------------------------------------|
| `precision`| —      | 小数秒精度（0-6）                        |
| `timezone` | `true` | 启用时区支持（仅 PostgreSQL）              |

```js
DATE        // DATETIME
DATE(3)     // DATETIME(3) - 毫秒精度
DATE(6)     // DATETIME(6) - 微秒精度
```

### `DATEONLY`

仅日期类型，不含时间部分。映射到 SQL 的 `DATE`。

```js
DATEONLY    // DATE
```

## 二进制类型

### `BINARY(length)`

定长二进制数据。

```js
BINARY       // BINARY(255)
BINARY(16)   // BINARY(16)
```

### `VARBINARY(length)`

变长二进制数据。

```js
VARBINARY       // VARBINARY
VARBINARY(255)  // VARBINARY(255)
```

### `BLOB(length)`

二进制大对象。

| 变体                  | SQL 类型       |
|----------------------|---------------|
| `BLOB`               | `BLOB`       |
| `BLOB('tiny')`       | `TINYBLOB`   |
| `BLOB('medium')`     | `MEDIUMBLOB` |
| `BLOB('long')`       | `LONGBLOB`   |

## JSON 类型

### `JSON`

JSON 文本类型。在数据库中存储为 `TEXT`，但自动进行序列化/反序列化。

```js
import { DataTypes } from 'leoric';

class Post extends Bone {
  static attributes = {
    meta: DataTypes.JSON,
  }
}
```

### `JSONB`

原生 JSON 二进制类型。在 PostgreSQL 和 MySQL 5.7+ 中可用，以原生 `JSON` 类型存储。

```js
class Post extends Bone {
  static attributes = {
    extra: DataTypes.JSONB,
  }
}
```

更多关于查询和更新 JSON 数据的内容，请参阅 [JSON 字段]({{ '/zh/json' | relative_url }})。

## 虚拟类型

### `VIRTUAL`

虚拟列，不会持久化到数据库。适用于计算属性。

```js
class User extends Bone {
  static attributes = {
    firstName: STRING,
    lastName: STRING,
    fullName: {
      type: VIRTUAL,
      get() {
        return `${this.firstName} ${this.lastName}`;
      },
    },
  }
}
```

## LENGTH_VARIANTS

`LENGTH_VARIANTS` 枚举为 `TEXT` 和 `BLOB` 类型提供命名大小变体：

```js
import { LENGTH_VARIANTS } from 'leoric';

LENGTH_VARIANTS.tiny    // 'tiny'
LENGTH_VARIANTS.empty   // ''（默认）
LENGTH_VARIANTS.medium  // 'medium'
LENGTH_VARIANTS.long    // 'long'
```

## 配合 TypeScript 装饰器使用

使用 TypeScript 时，数据类型可以通过 `@Column` 装饰器指定：

```ts
import { Bone, Column, DataTypes } from 'leoric';
const { TEXT, SMALLINT, JSONB } = DataTypes;

class User extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @Column()
  name: string;           // 推断为 STRING

  @Column({ type: SMALLINT })
  age: number;            // 覆盖：使用 SMALLINT 而非 INTEGER

  @Column(TEXT)
  bio: string;            // 覆盖：使用 TEXT 而非 STRING

  @Column(JSONB)
  meta: Record<string, unknown>;

  @Column()
  createdAt: Date;        // 推断为 DATE
}
```

更多类型推断详情请参阅 [TypeScript 支持]({{ '/zh/types' | relative_url }})。

## 数据库方言差异

| Leoric 类型 | MySQL              | PostgreSQL          | SQLite    |
|-------------|--------------------|--------------------|-----------|
| `STRING`    | `VARCHAR`          | `VARCHAR`           | `TEXT`    |
| `TEXT`      | `TEXT`             | `TEXT`              | `TEXT`    |
| `INTEGER`   | `INT`              | `INTEGER`           | `INTEGER` |
| `BIGINT`    | `BIGINT`           | `BIGINT`            | `INTEGER` |
| `BOOLEAN`   | `TINYINT(1)`       | `BOOLEAN`           | `INTEGER` |
| `DATE`      | `DATETIME`         | `TIMESTAMP`         | `TEXT`    |
| `DATEONLY`  | `DATE`             | `DATE`              | `TEXT`    |
| `JSONB`     | `JSON`             | `JSONB`             | `TEXT`    |
| `BLOB`      | `BLOB`             | `BYTEA`             | `BLOB`    |
| `DECIMAL`   | `DECIMAL`          | `DECIMAL`/`NUMERIC` | `REAL`    |
