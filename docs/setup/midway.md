---
layout: en
title: Setup with Midway
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Usage

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
