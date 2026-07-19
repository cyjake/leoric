# ES2022 Class Fields and Model Compilation

## Status

**Status:** Implemented on the model-compilation branch

This document records the target design for supporting ES2022 class-field
semantics without putting every model instance behind a `Proxy`.

This design supersedes the earlier model-finalization experiment. It does not
repair class fields after every construction.

## Problem

Leoric exposes mapped attributes through accessors on a model prototype. Before
ES2022, TypeScript commonly emitted class fields as assignments:

```js
this.name = undefined;
```

An assignment invokes an inherited setter. With ES2022 `Define` semantics, the
same field is initialized as an own property:

```js
Object.defineProperty(this, 'name', {
  value: undefined,
  writable: true,
  enumerable: true,
  configurable: true,
});
```

The own property shadows Leoric's accessor. The JavaScript value and Leoric's
raw attribute storage can then disagree.

An instance `Proxy` can intercept this operation, but benchmarks show a material
cost on the hottest paths: approximately 3.45x for getters and 3.72x for
setters. The preferred design therefore keeps ordinary model instances and
makes compatibility an explicit, one-time model operation.

## Terminology

The one-time replacement process is called **model compilation**.

```ts
compileModel(Definition, Base, attributes)
```

Model compilation turns a declarative class into the actual runtime model. It
creates a fresh subclass of the appropriate `Bone`, copies the supported class
footprint, initializes mapped attributes, and returns the compiled class. It
does not execute the definition class's constructor.

The public model paths are:

- **Generated model:** `realm.define('User', attributes)`
- **Direct model:** `class User extends Bone` with `declare` fields
- **Compiled model:** `@Model()` or `realm.define(Class, attributes)`

## Design

### 1. Generated models

```ts
const User = realm.define('User', {
  name: STRING,
});
```

This path already has all information needed to create a subclass of
`realm.Bone` and initialize its attributes. It does not involve a user-defined
constructor or class fields, so no compatibility work is required.

### 2. Direct models

```ts
class User extends Bone {
  @Column()
  declare name: string;
}
```

This is the preferred TypeScript path. `declare` gives TypeScript the field type
but emits no runtime field, leaving Leoric's prototype accessor visible.

A direct model is used as-is:

- no `Proxy`;
- no replacement constructor;
- normal inheritance and `instanceof` behavior;
- no per-instance class-field repair;
- registration or `connect()` initializes and marks the concrete model ready.

Every concrete leaf model must have its own readiness marker. Readiness must not
be inherited accidentally:

```ts
class User extends Bone {
  declare name: string;
}

class Admin extends User {
  declare role: string;
}
```

Registering `User` does not implicitly register `Admin`. Constructing or using
`Admin` before it is registered must produce a model-definition error.

#### Guarding accidental runtime fields

This declaration is unsafe under ES2022 semantics:

```ts
class User extends Bone {
  name!: string;
}
```

There is no reliable reflection API that can distinguish it from `declare
name: string` before construction. Runtime fields are instance operations and
do not appear in `User.prototype` descriptors. Constructing a probe at model
registration time is also unsafe because it would execute user constructors and
field initializers.

The guard therefore has two complementary parts:

1. A lint rule reports mapped fields that emit runtime class fields. This is the
   earliest and most complete diagnostic for users and coding agents.
2. Leoric validates the first ORM-managed instance of each direct model. If a
   mapped attribute is an own property, it throws a prescriptive error and does
   not attempt repair. Successful validation is cached per model.

Suggested diagnostic:

```text
User.name is emitted as an ES class field and shadows Leoric's attribute
accessor. Add `declare`, decorate User with `@Model()`, or define it through
`realm.define(User, attributes)`.
```

`Bone` cannot perform this check synchronously in its constructor: derived class
fields run only after `super()` returns. A direct `new User()` cannot therefore
be rejected at the exact field definition without a wrapper or `Proxy`; the
lint rule and the next ORM-managed boundary provide the guard.

### 3. Compiled models

Model compilation is the compatibility layer for definitions that emit regular
ES2022 fields. It is available through both TypeScript decorators and
`realm.define(Class, attributes)`.

#### Decorator entry point

```ts
@Model()
class User extends Bone {
  @Column()
  name!: string;

  get displayName() {
    return this.name.toUpperCase();
  }
}
```

The decorator returns the compiled constructor. TypeScript continues to expose
the binding using the declared `User` type, including inherited `Bone` APIs and
declared attributes.

#### Realm entry point

```ts
const User = realm.define(
  class User extends Bone {
    name!: string;

    get displayName() {
      return this.name.toUpperCase();
    }
  },
  {
    name: STRING,
  },
);
```

The class overload continues to require a subclass of the realm's `Bone`.
Automatic base-class wiring for an arbitrary class is not part of this design.
Both the decorator and realm entry points call the same model compiler.

#### Compilation behavior

Conceptually, compilation performs the following work once:

```ts
function compileModel(Definition, Base, attributes) {
  class CompiledModel extends Base {}

  copyPrototypeDescriptors(Definition, CompiledModel);
  copySupportedStaticDescriptors(Definition, CompiledModel);
  transferModelMetadata(Definition, CompiledModel);
  initializeAttributes(CompiledModel, attributes);
  markModelReady(CompiledModel);

  return CompiledModel;
}
```

The resulting chain is ordinarily:

```text
instance -> CompiledModel.prototype -> Bone.prototype
```

The original constructor is never invoked. Consequently its emitted
`defineProperty(this, 'name', ...)` operation never runs, and the mapped
accessor installed on `CompiledModel.prototype` remains effective. There is no
per-instance rewriting from `define` to `set`.

The supported class footprint includes:

- public methods, getters, setters, and symbol-named prototype members;
- supported public static configuration;
- column, association, validation, and hook metadata;
- the model name and relevant initialization options.

The initial contract excludes or constrains:

- custom instance constructors;
- private instance fields and methods;
- ordinary non-mapped instance field initializers;
- defaults expressed as class-field initializers;
- static private state;
- method behavior whose lexical `super` target is incompatible with the
  compiled base.

Mapped defaults belong in attribute metadata. Unsupported class constructs
should produce diagnostics where they can be identified reliably.

#### Identity

Compilation returns a different constructor:

```ts
class UserDefinition extends Bone {}
const User = realm.define(UserDefinition, attributes);

User !== UserDefinition;
new User() instanceof UserDefinition; // false
```

The inline form avoids ambiguity because the public binding receives the
compiled class:

```ts
const User = realm.define(class User extends Bone {}, attributes);
new User() instanceof User; // true
```

The same principle applies to `@Model()`: the decorated class binding refers to
the replacement returned by the decorator.

## Inheritance

A compiled child model extends an already ready runtime parent when one exists.
If it inherits through unready definition classes, compilation flattens that
definition segment onto the nearest ready runtime base and copies supported
descriptors and metadata from base to leaf. This skips fields and constructors
throughout the definition segment. Consequently, instances are not
`instanceof` detached intermediate definition classes.

Each concrete child still requires explicit registration or compilation. This
prevents a raw subclass from inheriting a parent's readiness marker and silently
using uninitialized metadata.

Inheritance details involving copied methods and lexical `super` need focused
tests before the compiler contract is considered stable.

## Performance Requirements

The design is intended to preserve direct-model performance:

- direct models perform no per-instance field scan after their one-time guard;
- compiled models perform descriptor and metadata work once;
- neither path uses an instance `Proxy`;
- neither path repairs mapped fields after each construction;
- hot getter and setter performance should remain within benchmark noise of a
  direct `Bone` subclass;
- construction and row hydration should be compared separately.

The benchmark suite must cover generated, direct, and compiled models, including
construction with values, row hydration, hot getters, and hot setters.

On Node.js 22.21.1 on Apple Silicon, compiling a fresh definition measured about
2.67 microseconds through `@Model()` and 2.78 microseconds through
`realm.define(Class)`, compared with 0.61 microseconds to create and mark a
direct class. This roughly 4.4-4.6x ratio is a one-time cost of about two
microseconds per model, not an instance cost. A conservative steady-state run
measured compiled construction within 3% of direct construction, hydration
within 1%, and no getter or setter regression. These findings reinforce
`declare` as the default TypeScript recommendation while keeping compilation as
an inexpensive compatibility path.

## Implementation Order

The design should be implemented and reviewed in the following slices:

1. Define readiness and direct-model registration semantics.
2. Add the accidental-class-field diagnostic and one-time runtime guard.
3. Preserve `realm.define('Name', attributes)` as the generated-model path.
4. Implement the shared `compileModel()` contract and footprint copying.
5. Route `realm.define(Class, attributes)` through model compilation.
6. Route `@Model()` through model compilation while preserving TypeScript's
   public class type.
7. Define and test compiled-model inheritance, identity, metadata, and `super`
   behavior.
8. Add compatibility documentation, migration guidance, and lint guidance.
9. Run the full benchmark matrix and publish results with the implementation.

## Non-Goals

- Keeping an instance `Proxy` as the default compatibility mechanism.
- Silently repairing direct models that use unsafe runtime fields.
- Inferring arbitrary runtime fields from prototype descriptors.
- Executing a user constructor merely to discover its class fields.
- Automatically turning any unrelated class into a realm-specific `Bone`
  subclass.
