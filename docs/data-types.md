---
layout: en
title: Data Types
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

Leoric provides a set of data types through the `DataTypes` object. These types are used when defining model attributes either statically or via decorators.

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

## String Types

### `STRING(length)`

Variable-length character string. Maps to `VARCHAR` in SQL.

| Parameter | Default | Description         |
|-----------|---------|---------------------|
| `length`  | `255`   | Maximum string length |

```js
STRING        // VARCHAR(255)
STRING(100)   // VARCHAR(100)
```

### `CHAR(length)`

Fixed-length character string.

```js
CHAR        // CHAR(255)
CHAR(10)    // CHAR(10)
```

### `TEXT(length)`

Long text type. The `length` parameter controls the size variant.

| Variant            | SQL Type      |
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

## Numeric Types

### `INTEGER(length)`

32-bit integer. Supports `UNSIGNED` and `ZEROFILL` modifiers.

```js
INTEGER             // INTEGER
INTEGER(10)         // INTEGER(10)
INTEGER.UNSIGNED    // INTEGER UNSIGNED
```

### `TINYINT(length)`

8-bit integer.

```js
TINYINT             // TINYINT
TINYINT(1)          // TINYINT(1) - commonly used for boolean in MySQL
TINYINT.UNSIGNED    // TINYINT UNSIGNED
```

### `SMALLINT(length)`

16-bit integer.

```js
SMALLINT            // SMALLINT
SMALLINT.UNSIGNED   // SMALLINT UNSIGNED
```

### `MEDIUMINT(length)`

24-bit integer.

```js
MEDIUMINT           // MEDIUMINT
MEDIUMINT.UNSIGNED  // MEDIUMINT UNSIGNED
```

### `BIGINT(length)`

64-bit integer. Commonly used for primary keys.

```js
BIGINT              // BIGINT
BIGINT.UNSIGNED     // BIGINT UNSIGNED
```

> **Note**: JavaScript cannot safely represent integers larger than `Number.MAX_SAFE_INTEGER` (2^53 - 1). For very large numbers, values may be returned as strings.

### `DECIMAL(precision, scale)`

Fixed-point decimal type. Suitable for financial data.

```js
DECIMAL             // DECIMAL
DECIMAL(10, 2)      // DECIMAL(10,2) - 10 digits total, 2 after decimal point
DECIMAL.UNSIGNED    // DECIMAL UNSIGNED
```

### `BOOLEAN`

Boolean type. Maps to `BOOLEAN` in SQL.

```js
BOOLEAN   // BOOLEAN
```

## Date & Time Types

### `DATE(precision, timezone)`

Datetime type. Maps to `DATETIME` or `TIMESTAMP` in SQL.

| Parameter  | Default | Description                              |
|------------|---------|------------------------------------------|
| `precision`| —       | Fractional seconds precision (0-6)       |
| `timezone` | `true`  | Enable timezone support (PostgreSQL only) |

```js
DATE        // DATETIME
DATE(3)     // DATETIME(3) - millisecond precision
DATE(6)     // DATETIME(6) - microsecond precision
```

### `DATEONLY`

Date-only type without time component. Maps to `DATE` in SQL.

```js
DATEONLY    // DATE
```

## Binary Types

### `BINARY(length)`

Fixed-length binary data.

```js
BINARY       // BINARY(255)
BINARY(16)   // BINARY(16)
```

### `VARBINARY(length)`

Variable-length binary data.

```js
VARBINARY       // VARBINARY
VARBINARY(255)  // VARBINARY(255)
```

### `BLOB(length)`

Binary large object.

| Variant              | SQL Type      |
|----------------------|---------------|
| `BLOB`               | `BLOB`       |
| `BLOB('tiny')`       | `TINYBLOB`   |
| `BLOB('medium')`     | `MEDIUMBLOB` |
| `BLOB('long')`       | `LONGBLOB`   |

```js
BLOB                          // BLOB
BLOB(LENGTH_VARIANTS.long)    // LONGBLOB
```

## JSON Types

### `JSON`

JSON text type. Stored as `TEXT` in the database, but automatically serialized/deserialized.

```js
import { DataTypes } from 'leoric';

class Post extends Bone {
  static attributes = {
    meta: DataTypes.JSON,
  }
}
```

### `JSONB`

Native JSON binary type. Available in PostgreSQL and MySQL 5.7+. Stored as native `JSON` type.

```js
class Post extends Bone {
  static attributes = {
    extra: DataTypes.JSONB,
  }
}
```

See [JSON Fields]({{ '/json' | relative_url }}) for querying and updating JSON data.

## Virtual Type

### `VIRTUAL`

Virtual columns that are not persisted to the database. Useful for computed properties.

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

The `LENGTH_VARIANTS` enum provides named size variants for `TEXT` and `BLOB` types:

```js
import { LENGTH_VARIANTS } from 'leoric';

LENGTH_VARIANTS.tiny    // 'tiny'
LENGTH_VARIANTS.empty   // '' (default)
LENGTH_VARIANTS.medium  // 'medium'
LENGTH_VARIANTS.long    // 'long'
```

## Using with TypeScript Decorators

When using TypeScript, data types can be specified through the `@Column` decorator:

```ts
import { Bone, Column, DataTypes } from 'leoric';
const { TEXT, SMALLINT, JSONB } = DataTypes;

class User extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @Column()
  name: string;           // Inferred as STRING

  @Column({ type: SMALLINT })
  age: number;            // Override: use SMALLINT instead of INTEGER

  @Column(TEXT)
  bio: string;            // Override: use TEXT instead of STRING

  @Column(JSONB)
  meta: Record<string, unknown>;

  @Column()
  createdAt: Date;        // Inferred as DATE
}
```

See [TypeScript Support]({{ '/types' | relative_url }}) for more details on type inference.

## Database Dialect Differences

| Leoric Type | MySQL              | PostgreSQL          | SQLite    |
|-------------|--------------------|---------------------|-----------|
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
