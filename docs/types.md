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

### HasMany with Through

For many-to-many associations, use the `through` option:

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

## Validate Decorator

You can add a `validate` option to `@Column()` to enable field validation:

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

## Complete TypeScript Model Example

Here is a comprehensive example showing a full model definition in TypeScript:

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

## TypeScript 4.9 Compatibility

Leoric provides backward-compatible type declarations for TypeScript 4.9 and earlier through `typesVersions` in `package.json`. This is handled automatically - no additional configuration is needed.

If you're using TypeScript <= 4.9, the type declarations from the `types/ts4.9/` directory will be used instead of the default ones.

## Type Inference in Queries

TypeScript integration enables type-safe queries:

```ts
// Return type is inferred as Post | null
const post = await Post.findOne({ title: 'Hello' });

// Return type is inferred as Post[]
const posts = await Post.find({ userId: 1 });

// Attributes are type-checked
await Post.create({
  title: 'New Post',   // OK
  content: 'Hello',    // OK
  // unknown: 'value', // TypeScript error: unknown property
});
```

## Configuration

To use decorators in TypeScript, ensure the following compiler options are enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

The `emitDecoratorMetadata` option is required for the automatic type inference in `@Column()` to work. You also need to install `reflect-metadata` (which is a dependency of Leoric).
