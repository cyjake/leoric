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
| type = typeof field   | 自定义字段类型 |
| name = string         | 原始字段名 |

如果省略 `type` 配置项，`@Column()` 会尝试按照如下映射关系推导当前字段类型：

| ts type | data type |
|---------|-----------|
| number  | INTEGER |
| string  | STRING / VARCHAR(255) |
| Date    | DATE |
| bigint  | BIGINT |
| boolean | BOOLEAN / TINYINT(1) |

一个比较复杂的例子：

```ts
class User extends Bone {
  @Column({ name: 'ssn', primaryKey: true, type: VARCHAR(16) })
  ssn: string;

  @Column({ name: 'gmt_create', allowNull: false })
  createdAt: Date;
}
```

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

### HasMany with Through

对于多对多关联，可以使用 `through` 选项：

```ts
import Tag from './tag';
import TagMap from './tag_map';

class Post extends Bone {
  @HasMany({ through: 'tagMaps' })
  tags: Tag[];

  @HasMany()
  tagMaps: TagMap[];
}
```

## Validate 校验

可以在 `@Column()` 中添加 `validate` 选项来启用字段校验：

```ts
class User extends Bone {
  @Column({
    allowNull: false,
    validate: {
      isEmail: true,
    },
  })
  email: string;

  @Column({
    validate: {
      isUrl: true,
    },
  })
  website: string;
}
```

## 完整 TypeScript 模型示例

以下是一个完整的 TypeScript 模型定义示例：

```ts
import { Bone, Column, BelongsTo, HasMany, DataTypes } from 'leoric';
const { TEXT, JSONB } = DataTypes;

import User from './user';
import Comment from './comment';

export default class Post extends Bone {
  @Column({ primaryKey: true, autoIncrement: true })
  id: bigint;

  @Column({ allowNull: false })
  title: string;

  @Column(TEXT)
  content: string;

  @Column(JSONB)
  extra: Record<string, unknown>;

  @Column()
  userId: bigint;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @Column()
  deletedAt: Date;

  @BelongsTo()
  user: User;

  @HasMany()
  comments: Comment[];
}
```

## TypeScript 4.9 兼容性

Leoric 通过 `package.json` 中的 `typesVersions` 配置为 TypeScript 4.9 及更早版本提供向后兼容的类型声明。这是自动处理的，无需额外配置。

如果你使用的是 TypeScript <= 4.9，会自动使用 `types/ts4.9/` 目录下的类型声明。

## 查询中的类型推断

TypeScript 集成支持类型安全的查询：

```ts
// 返回类型推断为 Post | null
const post = await Post.findOne({ title: 'Hello' });

// 返回类型推断为 Post[]
const posts = await Post.find({ userId: 1 });

// 属性会进行类型检查
await Post.create({
  title: '新文章',   // OK
  content: '你好',   // OK
  // unknown: 'value', // TypeScript 错误：未知属性
});
```

## 配置

要在 TypeScript 中使用装饰器，需要在 `tsconfig.json` 中启用以下编译选项：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`emitDecoratorMetadata` 选项是 `@Column()` 自动类型推断所必需的。你还需要安装 `reflect-metadata`（它是 Leoric 的依赖项）。
