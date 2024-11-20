---
layout: en
title: Setup with Midway
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Usage

Firstly, activate the leoric component in src/configuration.ts

```ts
// src/configuration.ts
import { Configuration, ILifeCycle } from '@midwayjs/core';
import * as leoric from '@midwayjs/leoric';

@Configuration({
  imports: [
    leoric,
  ],

})
export class ContainerLifeCycle implements ILifeCycle {}
```

Secondly, supply database configurations in src/config/config.default.ts 

```ts
// src/config/config.default.ts
export default () => {
  return {
    leoric: {
      dataSource: {
        default: {
          dialect: 'sqlite',
          database: path.join(__dirname, '../../', 'database.sqlite'),
          sync: true,
          models: [
            '**/models/*{.ts,.js}'
          ]
        },
      },
    },
  }
}
```

Lastly, models from the configured directory should be available with `@InjectModel()`:

```ts
// src/controller/user.ts
import { Controller } from '@midwayjs/core';
import { InjectModel } from '@midwayjs/leoric';
import User from '../model/user';

@Controller('/api/users')
export class UserController {
  @InjectModel(User)
  User: typeof User;

  @Get('/')
  async index() {
    return await this.User.order('id', 'desc').limit(10);
  }
}
```

## Decorators

### @InjectModel()

Use `@InjectModel()` to inject model class in to class fields, such as:

```ts
// src/service/user.ts
import { Provide } from '@midwayjs/core';
import { InjectModel } from '@midwayjs/leoric';
import User from '../model/user';

@Provide()
export class UserService {
  @InjectModel(User)
  User: typeof User;
}
```

### @InjectDataSource()

Use `@InjectDataSource()` to inject data source instance in to class fields, like below:

```ts
// src/service/user.ts
import { Provide } from '@midwayjs/core';
import { InjectDataSource, Realm } from '@midwayjs/leoric';

@Provide()
export class UserService {
  @InjectDataSource()
  realm: Realm;

  async findAll() {
    const { rows, fields, ...etc } = this.realm.query('SELECT * FROM users');
    return rows;
  }
}
```

If multiple datasources were configured, pass the name of the data source to `@InjectDataSource(name)` for the corresponding one.

## Multiple Data Sources

The way to configure multiple data sources in midway with leoric should not be very different from in midway with other ORM components. Here is one example of utilizing two sqlite databases in midway.

```ts
// src/config/config.default.ts
export default () => {
  return {
    leoric: {
      dataSource: {
        main: {
          dialect: 'sqlite',
          database: path.join(__dirname, '../../', 'database.sqlite'),
          models: [
            'models/*{.ts,.js}'
          ]
        },
        backup: {
          dialect: 'sqlite',
          database: path.join(__dirname, '../../', 'backup.sqlite'),
          models: [
            'backup/models/*{.ts,.js}'
          ]
        },
      },
      defaultDataSourceName: 'main',
    },
  };
}
```

By specifing the `dataSource` parameter, the related models can be injected accordingly. If `dataSource` isn't specified, the one set with `defaultDataSourceName` will be used. 

For example, the backup models or the backup data source itself can be injected with `@InjectModel(BoneLike, 'backup')` or `@InjectDataSource('backup')`:


```ts
// src/controller/user.ts
import { Controller, Get } from '@midwayjs/core';
import Realm, { InjectDataSource, InjectModel } from '@midwayjs/leoric';
import User from '../model/user';

@Controller('/api/users')
export class UserController {
  @InjectModel(User, 'backup')
  User: typeof User;

  @InjectDataSource('backup')
  backupRealm: Realm

  @Get('')
  async index() {
    const users = await this.User.find();
    return users.toJSON();
  }
}
```