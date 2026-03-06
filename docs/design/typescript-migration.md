# TypeScript Migration Guide

This document tracks the ongoing effort to make Leoric a fully TypeScript-native library, removing legacy JavaScript design decisions introduced before or during the 2.14.x migration.

## Background

The `master` branch completed the TypeScript migration in 2.14.x: all source files under `src/` are now `.ts`. However several design decisions carried over from the JavaScript era remain and should be addressed incrementally.

## Issues and Status

### 1. Remove `allowJs` from `tsconfig.json`

**Status:** Done (2026-03-06)

`allowJs: true` was needed during the migration to let TypeScript process any remaining `.js` source files. Since `src/` is now fully `.ts`, this flag is unnecessary.

```diff
-    "allowJs": true,
     "allowSyntheticDefaultImports": true,
```

---

### 2. Enable `strict: true`

**Status:** Done (2026-03-06)

`strict: true` replaces the previous standalone `strictNullChecks: true` and additionally enables `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and `alwaysStrict`. The codebase passed with zero new errors.

```diff
-    "strictNullChecks": true,
+    "strict": true,
```

---

### 3. Remove `[key: string]: any` index signature from `AbstractBone`

**Status:** Pending

```ts
// src/abstract_bone.ts
[key: string]: any;
```

This was added to allow `this[attributeName]` lookups inside ORM internals (e.g. `attribute(name)`, `loadAttribute()`). The side-effect is that any subclass also carries this signature, which defeats TypeScript's property checking on model instances entirely.

**Fix:** Replace internal dynamic property accesses with `(this as Record<string, unknown>)[name]` and remove the index signature from the public class surface.

---

### 4. Replace `module.exports = Realm` dual-export

**Status:** Pending

```ts
// src/index.ts
module.exports = Realm;  // CJS legacy
export default Realm;    // TS export
```

The `module.exports` assignment was needed for bare `require('leoric')` consumers before `"exports"` was added to `package.json`. Now that the `"exports"` field is present and the `main` field points to `lib/index.js`, the CJS assignment is redundant and causes the emitted `module.exports` to shadow the TypeScript-declared default export, creating `.default` confusion for mixed CJS/ESM consumers.

**Fix:** Remove `module.exports = Realm` and verify the `"exports"` field in `package.json` handles all entry-point cases.

---

### 5. Type the `Object.assign(Realm, ...)` static augmentation

**Status:** Pending

```ts
// src/index.ts
Object.assign(Realm.prototype, migrations);
Object.assign(Realm, { connect, disconnect, Bone, ... });
```

These runtime augmentations are invisible to TypeScript. Consumers who import `Realm` directly see an incomplete type surface.

**Fix:** Use interface/namespace merging or incorporate the members directly into the class, then export a properly typed `Realm`.

---

### 6. Fix `InitOptions.hooks` union type

**Status:** Pending

```ts
// src/abstract_bone.ts
hooks?: {
  [key in BeforeHooksType]: (options: QueryOptions) => Promise<void>
} | {
  [key in AfterHooksType]: (instance: AbstractBone, result: object) => Promise<void>
};
```

The union forces hooks to be either all-before or all-after. Mixed hook objects are valid at runtime but rejected by the type.

**Fix:**
```ts
hooks?: Partial<
  { [K in BeforeHooksType]: (options: QueryOptions) => Promise<void> } &
  { [K in AfterHooksType]: (instance: AbstractBone, result: object) => Promise<void> }
>;
```

---

### 7. Move `src/types/common.d.ts` to a `.ts` file

**Status:** Done (2026-03-06)

`src/types/common.d.ts` was a hand-authored declaration file sitting alongside TypeScript source. The `copy-dts` npm script manually rsynced it (and any other `src/**/*.d.ts` files) to `lib/`. Hand-maintained `.d.ts` files diverge from runtime behaviour silently — and in fact the file contained several bugs that were only caught when the file was actually compiled as `.ts`:

- `Pool` was declared as a `class` with an `async` method signature, which is invalid syntax in a type declaration. Converted to `interface`.
- `Connection.query` had two overloads where the second had an optional `values` followed by a required `opts` — TypeScript correctly rejected this as "a required parameter cannot follow an optional parameter". Collapsed into a single generic signature. Also tightened `opts` to `spell?: Spell<T>` to match the concrete driver connection implementations.
- `declare class Attribute` re-declared the real `Attribute` class from `src/drivers/abstract/attribute.ts`. Removed. Updated `src/setup_hooks.ts` to import `Attribute` directly from the real source.
- `OrderOptions` and `GeneratorReturnType` were declared but never exported or used. Removed.
- `TransactionMethodOptions` was declared but never exported or used. Removed.

With `common.d.ts` converted to `common.ts`, `tsc` now emits `lib/types/common.d.ts` automatically. The `copy-dts`, `copy-dts:browser` scripts and the `pretest` reference to `copy-dts` were all removed from `package.json`.

```diff
-    "copy-dts": "mkdir -p lib && cd src && rsync -R ./**/*.d.ts ../lib && cd -",
-    "copy-dts:browser": "mkdir -p dist && cd src && rsync -R ./**/*.d.ts ../dist && cd -",
-    "prepack": "tsc && npm run copy-dts",
-    "prepack:browser": "rm -rf dist && tsc -p tsconfig.browser.json && npm run copy-dts:browser",
-    "pretest": "tsc && npm run copy-dts && ./test/prepare.sh",
+    "prepack": "tsc",
+    "prepack:browser": "rm -rf dist && tsc -p tsconfig.browser.json",
+    "pretest": "tsc && ./test/prepare.sh",
```

---

### 8. Replace `any[]` for AST condition arrays in `Spell`

**Status:** Pending

```ts
// src/spell.ts
whereConditions: any[];
havingConditions: any[];
```

The expression AST types (`Expr`, `Token`, `Operator`, etc.) already exist in `src/expr.ts`. These fields should use them.

---

### 9. Update `moduleResolution` to `Node16`

**Status:** Done (2026-03-06)

The legacy `"Node"` resolution algorithm predates the `package.json` `"exports"` field and does not honour it. The correct setting for Node ≥ 16 is `"moduleResolution": "node16"` (or `"nodenext"`), which respects the `"exports"` field for subpath and conditional exports.

In practice, `"moduleResolution"` and `"module"` must be a compatible pair. Attempting `"moduleResolution": "NodeNext"` while keeping `"module": "CommonJS"` is a TypeScript error. The base config `@tsconfig/node18` already sets the correct pair:

```json
{ "module": "node16", "moduleResolution": "node16" }
```

Our local overrides of both settings were simply removed, letting the base take over. Since `package.json` has no `"type": "module"`, TypeScript's Node16 mode treats all `.ts` files as CommonJS — so existing relative imports without file extensions continue to work.

The browser config (`tsconfig.browser.json`) uses `"module": "ESNext"` to target bundlers. Inheriting `moduleResolution: node16` from the base is an invalid combination; it was fixed by adding `"moduleResolution": "Bundler"` — the appropriate pairing for an ESNext/bundler build that also respects `"exports"` fields.

```diff
 // tsconfig.json
-    "module": "CommonJS",
-    "moduleResolution": "Node",

 // tsconfig.browser.json
+    "moduleResolution": "Bundler",
```

---

### 10. Add `.ts` extension to model directory scanner

**Status:** Done (2026-03-06)

The model directory scanner in `src/realm/index.ts` only accepted `.js` and `.mjs` extensions, silently ignoring `.ts` model files when running under `ts-node`, Bun, or any other TypeScript-first runtime.

```diff
-    if (entry.isFile() && ['.js', '.mjs'].includes(extname)) {
+    if (entry.isFile() && ['.js', '.mjs', '.ts'].includes(extname)) {

---

### 11. Remove `Spell.nodeify()`

**Status:** Done (2026-03-06)

`nodeify` was a Node.js pre-Promise error-convention bridge (callback with `(err, result)` signature). The minimum Node.js version is 18 and all public APIs are `async`/`await`. The method and its two test cases in `test/unit/spell.test.js` were removed.

---

### 12. Remove redundant `structuredClone` global declaration

**Status:** Done (2026-03-06)

The manual `declare global { function structuredClone... }` in `src/spell.ts` was removed. The original doc note that it was available in `lib.esnext.d.ts` was incorrect: TypeScript only ships `structuredClone` in `lib.dom.d.ts` and `lib.webworker.d.ts`, not in the ESNext Node libs.

The actual fix was to update `@types/node` from `^16.10.1` to `^18.19.130`. Node 18 types include `structuredClone` natively, which is consistent with `"engines": { "node": ">= 18.0.0" }` in `package.json`. This also brings other Node 18 global types into scope.

```diff
-    "@types/node": "^16.10.1",
+    "@types/node": "^18.19.130",
```

---

### 13. Strip JSDoc `@param {Type}` annotations from `.ts` files

**Status:** Done (2026-03-06)

163 occurrences of `@param {Type}` (142) and `@returns {Type}` (19) across 18 source files, plus 2 `@typedef {Object}` blocks, were cleaned up:

- `@param {Type} name description` → `@param name description` (type info is already in the TypeScript signature)
- `@returns {Type}` with no description → line removed entirely
- `@returns {Type} description` → `@returns description`
- `@typedef {Object} RawSql` block in `src/browser.ts` — removed (the type is expressed as a TypeScript interface elsewhere)
- `@typedef {Object} QueryResult` block in `src/realm/index.ts` — removed (the type is `QueryResult` in `src/types/common.ts`)

The cleanup was applied across: `src/abstract_bone.ts`, `src/adapters/sequelize.ts`, `src/browser.ts`, `src/collection.ts`, `src/data_types.ts`, `src/drivers/abstract/attribute.ts`, `src/drivers/abstract/index.ts`, `src/drivers/sqlite/sqlstring.ts`, `src/expr.ts`, `src/expr_formatter.ts`, `src/hint.ts`, `src/index.ts`, `src/query_object.ts`, `src/raw.ts`, `src/realm/base.ts`, `src/realm/index.ts`, `src/setup_hooks.ts`, `src/spell.ts`, `src/utils/string.ts`.

---

### 14. Migrate to TC39 Stage 3 decorators (long-term)

**Status:** Pending

```json
"experimentalDecorators": true,
"emitDecoratorMetadata": true
```

TypeScript 5.0 shipped native Stage 3 decorator support. The current implementation uses stage-1 experimental decorators and depends on `reflect-metadata` at runtime. Migrating `@Column`, `@HasMany`, `@HasOne`, `@BelongsTo` to TC39 decorators removes the `reflect-metadata` peer dependency and the `emitDecoratorMetadata` compiler option.

This is a breaking change for consumer code using the decorators.

---

### 15. Replace `invokable` Proxy + `DATA_TYPE as any` with proper factory types (long-term)

**Status:** Pending

```ts
// src/data_types.ts
static INTEGER: DATA_TYPE<INTEGER> = INTEGER as any;
```

Every `DataTypes` static member requires `as any` to bridge the class constructor and the callable `AbstractDataType<T>` interface, because the `Proxy`-based `invokable` helper cannot be expressed in TypeScript's type system without losing information.

A typed factory approach (e.g. `createDataType<T>(ctor)`) would eliminate all the `as any` casts on data type statics while preserving the `INTEGER(255)` / `new INTEGER(255)` dual syntax.
