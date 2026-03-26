---
layout: en
---

Developers can use migrations to manage operations that changes table schema etc.

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}
## What Is A Migration

Take following migration for example:

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

By executing this migration, the `up()` part, we create a table called `products` that consists of three columns, primary key `id`, a `name VARCHAR(255)` column to store product name, and a `description TEXT` to store descriptive information of the product. A migration consists of two methods, `up()` and `down()`, which make sure the task is able to migrate or rollback.

In this migration, the rollback operation is to drop the `products` table, which makes sure the change brought by `up()` is correctly reverted in `down()`.

Migrations can not only be used to change schema, but also can be used to migrate existing data. For example if we're trying to add a new column which has default value different than existing data, we can do it like below:

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

The migration above adds a new column called `users.wants_marketing_email` which defaults to `false`, but we want existing users remain subscribed to our marketing emails.

### Creating Migration File

We can use `Realm#createMigrationFile(name)` to create migration file:

```js
const Realm = require('leoric');
const realm = new Realm({
  client: 'mysql',
  migrations: 'database/migrations',
});

await realm.createMigrationFile('create-products');
// which creates migration file like 20210621170235-create-products.js in database/migrations
```

The generated migration file looks like below:

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

### Naming Conventions

As described above, `realm.createMigrationFile(name)` creates migration file like `20210621170235-create-products.js`. The prefix is the timestamp of the file when it's created, which is formatted as `YYYYMMDDHHMMSS`. The rest part of the file name is the `name` passed to the method. Therefore the full format of the migration file is `YYYYMMDDHHMMSS-${name}`.

Migrations that are executed will be stored in `leoric_meta` table to track the progress. If the table `leoric_meta` does not exist when migrating, it will be created automatically.

If the migration is reverted with `realm.rollback()`, the corresponding record will be removed from `leoric_meta`.

### Changing Migration

We'd recommend not to change migration back and forth, especially if the migration were committed into version control system, which might have its older version executed in other developer's database. In that case, it is highly unlikely to make it right for everyone involed.

Creating new migration to correct previous mistakes is recommended.
### Data Types Supported

Following data types are supported:

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

These data types will be mapped to corresponding type in database. For example, in MySQL `STRING` is mapped to `VARCHAR(255)`.

## Writing a Migration

### Creating a Table

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

The code above is equivalent to the SQL below:

```sql
CREATE TABLE `products` (
  `id` BIGINT PRIMARY KEY,
  `category_id` BIGINT,
  `name` VARCHAR(255),
  `price` INT,
);
```

### Adding Columns

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

The code above is equivalent to the SQL below:

```sql
ALTER TABLE `products` ADD COLUMN `volume` INTEGER;
```

### Changing Columns

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

The code above is equivalent to the SQL below:

```sql
ALTER TABLE `products` ADD COLUMN `volume` INTEGER UNSIGNED;
```

### Renaming Column

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.renameColumn('products', 'volume', 'stock');
  },
};
```

The code above is equivalent to the SQL below (which is not quite the same in older versions of MySQL):

```sql
ALTER TABLE `products` RENAME COLUMN `volume` TO `stock`;
```

### Removing Columns

|---|-------------------------|
| ⚠️ | PLEASE BACK UP AT FIRST |

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.removeColumn('products', 'stock');
  },
};
```

The code above is equivalent to the SQL below:

```sql
ALTER TABLE `products` DROP COLUMN `stock`;
```

### Creating Indices

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.addIndex('products', [ 'category_id', 'price' ]);
  },
};
```

The code above is equivalent to the SQL below:

```sql
CREATE INDEX `idx_products_category_id_price` ON `products` (`category_id`, `price`);
```

### Removing Indices

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.removeIndex('products', [ 'category_id', 'price' ]);
  },
};
```

The code above is equivalent to the SQL below:

```sql
DROP INDEX `idx_products_category_id_price`;
```

### Truncating Tables

|---|-------------------------|
| ⚠️ | PLEASE BACK UP AT FIRST |

```js
module.exports = {
  async up(driver, DataTypes) {
    await driver.truncateTable('products');
  }
};
```

The code above is equivalent to the SQL below:

```sql
TRUNCATE TABLE `products`;
```

### Dropping Tables

|---|-------------------------|
| ⚠️ | PLEASE BACK UP AT FIRST |

```js
module.exports = {
  async down(driver, DataTypes) {
    await driver.dropTable('products');
  },
};
```

The code above is equivalent to the SQL below:

```sql
DROP TABLE `table_name`;
```

### Using the `up`/`down` Methods

Migrations should provide both `up` and `down` methods. The former one is used to perform the intended change to schema, and the latter one is used to revert the change brought by `up`. The default content of the newly created migration is like below:

```js
'use strict';

module.exports = {
  async up(driver, DataTypes) {

  },

  async down(driver, DataTypes) {

  },
};
```

It is strongly recommended that make sure the changes will be properly reverted in `down`, nothing that might interfere other migrations, such as redundant columns or tables, should be left behind.

## Running Migrations

```js
const Realm = require('leoric');
const realm = new Realm();

await realm.migrate();
```

All of the migrations that are not executed yet will be loaded and executed accordingly. For example, if we have following migrations to execute:

```
// database/migrations
20210622130000-create-products.js
20210623150000-add-product-price.js
20210623160000-create-recipients.js
```

Then when we call `realm.migrate()`, the `up()` methods in `create-products`, `add-product-price`, and `create-recipients` get called one after another.

The name of the performed migrations are stored in `leoric_meta`:

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

### Rolling Back

```js
const Realm = require('leoric');
const realm = new Realm();

// one step backward
await realm.rollback()

// three steps backward
await realm.rollback(3);
```

`realm.rollback()` will query executed migrations from `leoric_meta`, and then execute the `down()` method accordingly.

### Resetting the Database

To reset the database, rollback all executed migrations and then re-run them from scratch. Currently Leoric does not provide a dedicated `reset()` method, but this can be achieved by combining `rollback()` and `migrate()`:

```js
const Realm = require('leoric');
const realm = new Realm({
  client: 'mysql',
  migrations: 'database/migrations',
});

// rollback all migrations (use a large number to cover all)
await realm.rollback(Infinity);

// re-run all migrations
await realm.migrate();
```

> **Warning**: This will destroy all existing data. Always back up your database before resetting.

### Running Specific Migration

You can control how many pending migrations to run by passing a `steps` parameter to `realm.migrate()`:

```js
// run only the next pending migration
await realm.migrate(1);

// run the next 3 pending migrations
await realm.migrate(3);
```

Similarly, `realm.rollback()` accepts a step count:

```js
// rollback the last migration
await realm.rollback();

// rollback the last 3 migrations
await realm.rollback(3);
```

> **Note**: There is currently no built-in way to run a specific migration by name. Migrations are always executed in chronological order based on their filename timestamps.

## Using Models in Migrations

In some cases, you may need to use models within migrations to manipulate data. To do this, require the model and use raw queries or model methods. Keep in mind that the model must already be connected:

```js
module.exports = {
  async up(driver, DataTypes) {
    // Add the new column first
    await driver.addColumn('users', 'display_name', {
      type: DataTypes.STRING,
    });

    // Use raw SQL to populate the new column from existing data
    await driver.query(`
      UPDATE users SET display_name = CONCAT(first_name, ' ', last_name)
    `);
  },

  async down(driver, DataTypes) {
    await driver.removeColumn('users', 'display_name');
  },
};
```

If you need to use the model API instead of raw SQL, you can set up a Realm instance within the migration. However, this is generally discouraged because model definitions may change over time and become out of sync with the migration:

```js
const Realm = require('leoric');
const User = require('../../app/models/user');

module.exports = {
  async up(driver, DataTypes) {
    await driver.addColumn('users', 'display_name', {
      type: DataTypes.STRING,
    });

    // Use model API (ensure connect is called)
    const realm = new Realm({
      client: 'mysql',
      database: 'myapp',
      models: [User],
    });
    await realm.connect();

    const users = await User.find();
    for (const user of users) {
      await user.update({ displayName: `${user.firstName} ${user.lastName}` });
    }

    await realm.disconnect();
  },

  async down(driver, DataTypes) {
    await driver.removeColumn('users', 'display_name');
  },
};
```

> **Best practice**: Prefer raw SQL queries (`driver.query()`) over model APIs in migrations. Raw SQL is deterministic and won't break if the model definition changes later.

## Schema Dumping

|---|---------------------------|
| ⚠️ | NOT FULLY IMPLEMENTED YET |

When migration finishes executing, not matter `realm.migrate()` or `realm.rollback()`, Leoric will create a schema dump in the parent directory of `opts.migrations`. For example, if the path specified with `opts.migrations` is `database/migrations`, the file will be created at `database/schema.js`, which contains statements like below:

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

  // other tables
}
```

The schema dump contains only statements about the table structures. The data stored in those tables is not included.
