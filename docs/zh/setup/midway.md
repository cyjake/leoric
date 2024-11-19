---
layout: zh
title: 在 Midway 应用中使用
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 使用指南

首先在 src/configuration.ts 启用 leoric 组件：

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

然后在配置文件（例如 src/config/config.default.ts）增加对应的数据源配置，下面这个例子配置了一个默认的数据源，使用 sqlite 数据库，在所有目录的 model 子目录中查找并加载数据模型定义：

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

然后就可以在 controller 或者 service 中按需使用数据模型，使用 `@InjectModel()` 装饰器注入对应的数据模型即可：

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

## 装饰器

### @InjectModel()

可以在需要使用 Model 的地方使用 `@InjectModel()` 注入模型到类属性，例如：

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

也可以使用 `@InjectDataSource()` 注入数据源实例：

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

如果配置有多个实例，可以给装饰器传数据源名称来获得对应的数据源。

## 多数据源配置

midway 给数据模型组件提供基础的多数据源配置规则，无论是使用 leoric 组件还是其他 ORM 库，使用方式大致是相同的，下面仍然以 leoric 组件为例：

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
      // 如果想要在 @InjectModel() 时省略数据源名称，那就需要在这里指定缺省值
      defaultDataSourceName: 'main',
    },
  };
}
```

然后在使用的时候需要传入对应的数据源名称，如果省略，则使用 `defaultDataSourceName` 配置项所指定的数据源：

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