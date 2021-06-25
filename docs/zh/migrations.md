---
layout: zh
---

Leoric 提供迁移任务来帮助开发者完成日常工作中的表结构变更与数据迁移。

## 目录
{:.no_toc}

1. 目录
{:toc}

## 什么是迁移任务

以下面这个迁移任务为例：

```js
module.exports = {
  async up(driver, DataTypes) {
    const { BIGINT, STRING, TEXT } = DataTypes;
    await driver.createTable('products', {
      id: { type: BIGINT, primaryKey: true },
      name: STRING,
      description: TEXT,
    });
  },

  async down(driver, DataTypes) {
    await driver.dropTable('products');
  },
}
```

上面这个迁移任务创建了一张名为 `products` 的表，包含三个字段，分别是主键 `id`、字符串类型的 `name`、以及长文本 `description`。迁移任务需要同时提供 `up()` 和 `down()` 两个方法，确保任务是可以回退或者重做的。在这个迁移任务里，回退操作就是删除 `products` 表，重做则会重新创建 `products` 表。

迁移任务不仅仅可以用来做表结构变更，也可以用来做数据迁移来订正脏数据，比如新增的字段如果存量数据需要订正为与字段默认值不同的值，我们可以这么写：

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.addColumn('users', {
      wants_marketing_email: { type: BOOLEAN, default: false },
    });
    await driver.query('UPDATE users SET wants_marketing_email = 1');
  },

  async down(driver, DataTypes) {
    await driver.removeColumn('users', 'wants_marketing_email');
  },
}
```

上面这个迁移任务的作用是给 `users` 表增加 `wants_marketing_email` 字段，默认值为 `false`，但同时给存量数据设置默认值为 `true`（因为业务上之前是按 `true` 来处理的）。

### 创建迁移任务

可以使用 `Realm#createMigrationFile(name)` 来创建迁移任务：

```js
const Realm = require('leoric');
const realm = new Realm({
  client: 'mysql',
  migrations: 'database/migrations',
});

await realm.createMigrationFile('create-products');
// 将会在 database/migrations 目录下创建文件名类似 20210621170235-create-products.js 的文件
```

迁移任务骨架内容如下：

```js
'use strict';

module.exports = {
  async up(driver, DataTypes) {
    // TODO
  },

  async down(driver, DataTypes) {
    // TODO
  }
};
```

### 迁移任务文件命名约定

如前文所述，使用 `Realm#createMigrationFile(name)` 方法创建的迁移任务文件名类似 `20210621170235-create-products.js`，前缀是当前迁移任务的创建时间，格式为 `YYYYMMDDHHMMSS`，剩余的部分就是传入的 `name`，迁移任务名称即两者的组合，格式为 `YYYYMMDDHHMMSS-${name}`。

迁移任务的执行状态会被记录到 `leoric_meta` 表。如果在执行迁移任务的时候还没有 `leoric_meta` 表，就会自动创建一个。已经成功执行的迁移任务名会被存到 `leoric_meta.name`。

如果迁移任务被回退，相关执行记录则会被从 `leoric_meta` 表移除。

### 修改迁移任务内容

原则上不建议反复修改同一个迁移任务，尤其是在迁移任务已经被提交到仓库中，可能被合作的开发者在其他地方已经执行的情况下。如果发现搞错了需要执行的表结构变更或者数据迁移内容，请尽量通过增加新的迁移任务的方式。

### 支持的数据类型

Leoric 支持如下数据类型：

```js
STRING
INTEGER
BIGINT
DATE
BOOLEAN
TEXT
BLOB
JSON
JSONB
```

这些类型会被映射到对应的数据库字段类型。例如，在 MySQL 数据库中 `STRING` 默认会映射为 `VARCHAR(255)`。

## 编写迁移任务

### 创建表

```js
module.exports = {
  async up(driver, DataTypes) {
    const { STRING, BIGINT, INTEGER } = DataTypes;
    await driver.createTable('products', {
      id: { type: BIGINT, primary: true },
      category_id: { type: BIGINT },
      name: STRING,
      price: INTEGER,
    });
  },
};
```

上述代码等价于如下 SQL：

```sql
CREATE TABLE `products` (
  `id` BIGINT PRIMARY KEY,
  `category_id` BIGINT,
  `name` VARCHAR(255),
  `price` INT,
);
```

### 增加字段

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.addColumn('products', 'volume', {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    });
  },
}
```

上述代码等价于如下 SQL：

```sql
ALTER TABLE `products` ADD COLUMN `volume` INTEGER;
```

### 修改字段

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.changeColumn('products', 'volume', {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    });
  },
}
```

上述代码等价于如下 SQL：

```sql
ALTER TABLE `products` ADD COLUMN `volume` INTEGER UNSIGNED;
```

### 重命名字段

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.renameColumn('products', 'volume', 'stock');
  },
};
```

上述代码等价于如下 SQL（旧版本 MySQL 使用的 SQL 不完全相同）：

```sql
ALTER TABLE `products` RENAME COLUMN `volume` TO `stock`;
```

### 删除字段

|---|------------------|
| ⚠️ | 操作前请务必做好备份 |

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.removeColumn('products', 'stock');
  },
};
```

上述代码等价于如下 SQL：

```sql
ALTER TABLE `products` DROP COLUMN `stock`;
```

### 增加索引

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.addIndex('products', [ 'category_id', 'price' ]);
  },
};
```

上述代码等价于如下 SQL：

```sql
CREATE INDEX `idx_products_category_id_price` ON `products` (`category_id`, `price`);
```

### 删除索引

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.removeIndex('products', [ 'category_id', 'price' ]);
  },
};
```

上述代码等价于如下 SQL：

```sql
DROP INDEX `idx_products_category_id_price`;
```

### 清空表

|---|------------------|
| ⚠️ | 操作前请务必做好备份 |

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.truncateTable('products');
  }
};
```

上述代码等价于如下 SQL：

```sql
TRUNCATE TABLE `products`;
```

### 删除表

|---|------------------|
| ⚠️ | 操作前请务必做好备份 |

```js
module.exports = {
  async down(driver, DataTypes) {
    await driver.dropTable('products');
  },
};
```

上述代码等价于如下 SQL：

```sql
DROP TABLE `table_name`;
```

### 使用 `up`/`down` 方法

迁移任务默认需要提供 `up`/`down` 两个方法，前者用来执行正向的数据迁移或者表结构变更操作，后者用来回滚。默认创建的迁移任务文件内容如下：

```js
'use strict';

module.exports = {
  async up(driver, DataTypes) {

  },

  async down(driver, DataTypes) {

  },
};
```

建议在 `down` 方法中确保相关变更能够被正确回滚，不留下可能带来冲突的遗留表结构或者字段，避免影响其他执行任务回滚、或者当前执行任务的重新执行。

## 执行迁移任务

```js
const Realm = require('leoric');
const realm = new Realm();

await realm.migrate();
```

所有未被执行的迁移任务都会被找出来并按照时间顺序执行。如果有如下数据迁移任务：

```
// database/migrations
20210622130000-create-products.js
20210623150000-add-product-price.js
20210623160000-create-recipients.js
```

如果上面三个任务都没有被执行过，那么在调用 `realm.migrate()` 的时候将会依次执行 `create-products`、`add-product-price`、以及 `create-recipients`，依次调用三个任务中的 `up()` 方法。

被执行过的任务会被记录到 `leoric_meta` 表，大致内容如下：

```bash
mysql> select * from leoric_meta;
+------------------------------------------------------------------------+
| name                                                                   |
+------------------------------------------------------------------------+
| 20210622130000-create-products.js                                      |
| 20210623150000-add-product-price.js                                    |
| 20210623160000-create-recipients.js                                    |
+------------------------------------------------------------------------+
```

### 回退

```js
const Realm = require('leoric');
const realm = new Realm();

// 回退一步
await realm.rollback()

// 回退三步
await realm.rollback(3);
```

`realm.rollback()` 会从 `leoric_meta` 表查找执行记录，按照迁移任务倒序依次执行任务的 `down()` 方法。

### 重置数据库

// TODO

### 执行单个迁移任务

// TODO

## 在迁移任务中使用 Model

// TODO

## 转存表结构信息

|---|-----------------|
| ⚠️ | 相关功能仍在实现中 |

迁移任务执行成功后（不管是 `realm.migrate()` 还是 `realm.rollback()`），都会在 `opts.migrations` 所指定的目录的同级目录生成一份 `schema.js` 文件。例如，如果指定的 `opts.migrations` 路径是 `database/migrations`，Leoric 就会在迁移任务执行结束后转存一份完整的当前数据库结构信息到 `database/schema.js`，内容大致如下：

```js
module.exports = async function createSchema(driver, DataTypes) {
  const { STRING, INTEGER, BIGINT, DATE } = DataTypes;

  await driver.dropTable('products');
  await driver.createTable('products', {
    id: { type: BIGINT, primaryKey: true },
    name: STRING,
    price: INTEGER,
    createdAt: DATE,
    updatedAt: DATE,
  });

  // 其他表的创建语句类似
}
```

此文件仅包含表结构信息，不包含数据。
