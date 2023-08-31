---
layout: zh
title: 在 Midway 应用中使用
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 使用指南

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
