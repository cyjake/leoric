---
layout: en
title: TypeScript Support
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Decorations

### Model and Class Fields

Every concrete TypeScript model must use `@Model()`. Declare mapped fields with `declare`
so TypeScript emits no runtime class field that could shadow Leoric's attribute accessors.

```ts
import { Bone, Column, Model } from 'leoric';

@Model()
class User extends Bone {
  @Column()
  declare name: string;
}
```

`@Model()` also repairs emitted JavaScript class fields after construction for compatibility,
but `declare` avoids that work and remains the recommended form. Mapped attributes are not
available inside the original constructor body because finalization runs after it returns.
Because the decorator returns a finalized subclass, avoid static private fields that are
accessed through `this`; use module-scoped private state or ordinary static properties instead.

### Column

```ts
import { Bone, Column, DataTypes: { SMALLINT }, Model } from 'leoric';

@Model()
class User extends Bone {
  @Column({ primaryKey: true })
  declare id: bigint;

  @Column({ allowNull: false })
  declare name: string;

  @Column()
  declare createdAt: Date;

  @Column()
  declare updatedAt: Date;

  @Column({ type: SMALLINT })
  declare age: number;
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
@Model()
class User extends Bone {
  @Column({ name: 'ssn', primaryKey: true, type: VARCHAR(16) })
  declare ssn: string;

  @Column({ name: 'gmt_create', allowNull: false })
  declare createdAt: Date;
}
```

### BelongsTo

```ts
import User from './user';

@Model()
class Post extends Bone {
  @BelongsTo()
  declare user: User;
}

const post = await Post.include('user').first;
assert.ok(post.user.id);
```

If the foreign key didn't follow the naming convention, please provide it with:

```ts
@Model()
class Post extends Bone {
  @BelongsTo({ foreignKey: 'authorId' })
  declare user: User;
}
```

### HasMany

```ts
import Post from './post';

@Model()
class User extends Bone {
  @HasMany()
  declare posts: Post[];
}
```

If the foreign key didn't follow the naming convention, please provide it with:

```ts
@Model()
class User extends Bone {
  @HasMany({ foreignKey: 'authorId' })
  declare posts: Post[];
}
```

In a `hasMany` association, e.g. one-to-many, the foreign key should be at the associated table. Please refer to our documentation about [Associations]({% link associations.md %}) for more detail.

### HasOne

```ts
import Profile from './profile';

@Model()
class User extends Bone {
  @HasOne()
  declare profile: Profile;
}
```

If the foreign key didn't follow the naming convention, please provide it with:

```ts
import Profile from './profile';

@Model()
class User extends Bone {
  @HasOne({ foreignKey: 'ownerId' })
  declare profile: Profile;
}
```

`hasOne` works almost the same as `hasMany`, which needs the foreign key to be at the associated table as well.

Whilst both `hasOne` and `belongsTo` can be used to create a one-to-one association, the major difference between them is where the foreign key is expected at. If you weren't familiar with the difference yet, please refer to our documentation about [Associations]({% link associations.md %}) for more detail.

### HasMany with Through

For many-to-many associations, use the `through` option:

```ts
import Tag from './tag';
import TagMap from './tag_map';

@Model()
class Post extends Bone {
  @HasMany({ through: 'tagMaps' })
  declare tags: Tag[];

  @HasMany()
  declare tagMaps: TagMap[];
}
```

## Validate Decorator

You can add a `validate` option to `@Column()` to enable field validation:

```ts
@Model()
class User extends Bone {
  @Column({
    allowNull: false,
    validate: {
      isEmail: true,
    },
  })
  declare email: string;

  @Column({
    validate: {
      isUrl: true,
    },
  })
  declare website: string;
}
```

## Complete TypeScript Model Example

Here is a comprehensive example showing a full model definition in TypeScript:

```ts
import { Bone, Column, BelongsTo, HasMany, DataTypes, Model } from 'leoric';
const { TEXT, JSONB } = DataTypes;

import User from './user';
import Comment from './comment';

@Model()
export default class Post extends Bone {
  @Column({ primaryKey: true, autoIncrement: true })
  declare id: bigint;

  @Column({ allowNull: false })
  declare title: string;

  @Column(TEXT)
  declare content: string;

  @Column(JSONB)
  declare extra: Record<string, unknown>;

  @Column()
  declare userId: bigint;

  @Column()
  declare createdAt: Date;

  @Column()
  declare updatedAt: Date;

  @Column()
  declare deletedAt: Date;

  @BelongsTo()
  declare user: User;

  @HasMany()
  declare comments: Comment[];
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
