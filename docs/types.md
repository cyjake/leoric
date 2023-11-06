---
layout: en
title: TypeScript Support
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Decorations

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

Here is the list of options supported by `@Column()` that can be used to customize column definitions:

| option                | description |
|-----------------------|-------------|
| primaryKey = false    | declare class field as the primary key |
| autoIncrement = false | enable auto increment on corresponding class field, must be numeric type |
| allowNull = true      | class field can not be null when persisting to database |
| type = typeof field   | override the data type deduced from class field type |
| name = string         | actual name of the table field in database |

If `type` option is omitted, `@Column()` will try to deduce the corresponding one as below:

| ts type | data type |
|---------|-----------|
| number  | INTEGER |
| string  | STRING / VARCHAR(255) |
| Date    | DATE |
| bigint  | BIGINT |
| boolean | BOOLEAN / TINYINT(1) |

Here is an example that is a little bit more comprehensive:

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

If the foreign key didn't follow the naming convention, please provide it with:

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

If the foreign key didn't follow the naming convention, please provide it with:

```ts
class User extends Bone {
  @HasMany({ foreignKey: 'authorId' })
  posts: Post[];
}
```

In a `hasMany` association, e.g. one-to-many, the foreign key should be at the associated table. Please refer to our documentation about [Associations]({% link associations.md %}) for more detail.

### HasOne

```ts
import Profile from './profile';

class User extends Bone {
  @HasOne()
  profile: Profile;
}
```

If the foreign key didn't follow the naming convention, please provide it with:

```ts
import Profile from './profile';

class User extends Bone {
  @HasOne({ foreignKey: 'ownerId' })
  profile: Profile;
}
```

`hasOne` works almost the same as `hasMany`, which needs the foreign key to be at the associated table as well.

Whilst both `hasOne` and `belongsTo` can be used to create a one-to-one association, the major difference between them is where the foreign key is expected at. If you weren't familiar with the difference yet, please refer to our documentation about [Associations]({% link associations.md %}) for more detail.
