---
layout: zh
title: TypeScript 支持
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 装饰器

### Column

```ts
import { Bone, DataTypes: { SMALLINT } } from 'leoric';

class User extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @Column({ allowNull: false })
  name: string;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @Column({ type: SMALLINT })
  age: number;
}
```

下面是 `@Column()` 支持的配置项列表：

| 配置项                | 功能描述 |
|-----------------------|-------------|
| primaryKey = false    | 声明主键 |
| autoIncrement = false | 启用自增字段，字段类型必须是数值类型 |
| allowNull = true      | 允许字段存储空值 NULL |
| type = typeof field | 自定义字段类型 |

如果省略 `type` 配置项，`@Column()` 会尝试按照如下映射关系推导当前字段类型：

| ts type | data type |
|---------|-----------|
| number  | INTEGER |
| string  | STRING / VARCHAR(255) |
| Date    | DATE |
| bigint  | BIGINT |
| boolean | BOOLEAN / TINYINT(1) |

### BelongsTo

```ts
import User from './user';

class Post extends Bone {
  @BelongsTo()
  user: User;
}

const post = await Post.include('user').first;
assert.ok(post.user.id);
```

如果关联字段的命名不符合命名约定，需要按如下方式手动配置：

```ts
class Post extends Bone {
  @BelongsTo({ foreignKey: 'authorId' })
  user: User;
}
```

### HasMany

```ts
import Post from './post';

class User extends Bone {
  @HasMany()
  posts: Post[];
}
```

如果关联字段的命名不符合命名约定，需要按如下方式手动配置：

```ts
class User extends Bone {
  @HasMany({ foreignKey: 'authorId' })
  posts: Post[];
}
```

在一个 `hasMany` 关联关系中（也叫一对多关联），用来创建关联关系的字段应该在外表上面，在上述示例中，也就是需要 `posts.user_id` 或者 `posts.author_id`。推荐阅读《[关联关系]({% link zh/associations.md %})》文档了解更多使用细节。

### HasOne

```ts
import Profile from './profile';

class User extends Bone {
  @HasOne()
  profile: Profile;
}
```

如果关联字段的命名不符合命名约定，需要按如下方式手动配置：

```ts
import Profile from './profile';

class User extends Bone {
  @HasOne({ foreignKey: 'ownerId' })
  profile: Profile;
}
```

`hasOne` 的配置方式和 `hasMany` 几乎相同，同样需要在外表中添加关联字段。

虽然 `hasOne` 和 `belongsTo` 都可以被用来配置一对一关联，但两者之间有个比较大的差别在于关联字段所属的表。如果是 `belongsTo`，需要关联字段添加到主表中，如果是 `hasOne`，则需要放到外表。推荐阅读《[关联关系]({% link zh/associations.md %})》文档了解更多使用细节。
