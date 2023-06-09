---
layout: en
title: Hooks
---

Hooks support the insertion of specific contextual operations at specific times when a query is executed. This article describes the hook functions supported by Leoric and how to use them

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Declaring

You can declare Hook in the following way ：

```javascript
// class syntax
class User extends Bone {
  static beforeCreate() {}
  static afterUpdate() {}
});

// define
Realm.define('User', attrs, {
  hooks: {
    beforeCreate() {},
    afterUpdate() {},
  }
});
```

## Available Hooks：

> `Model.method` means hook call by Model class,  `instance.method` means hook call by Model's instance, the arguments of hooks are slightly different for different calling methods

### create

`create` supports:

```javascript
// create hooks, args are create function's arguments
Model.beforeCreate(args) // function's context is the instance to be created
Model.afterCreate(instance, createResult) // createResult is create function's returns
instance.beforeCreate(args)
instance.afterCreate(instance, createResult) // function's context is the instance to be created
```

**Please be noted that the function context of the hooks of `create` are the instance to be created.**

### bulkCreate

`bulkCreate` supports two types of hooks:

```javascript
// bulkCreate hooks
Model.beforeBulkCreate(records, queryOptions) // function's context is the Model
Model.afterBulkCreate(instances, Model) // the argument 'instances' are instances to be created
```

### update

`update` supports:

```javascript
// update hooks
Model.beforeUpdate(args) // function's context is the `Model`
Model.afterUpdate(updateResult, Model)
instance.beforeUpdate(args) // function's context is the instance to be created
instance.afterUpdate(instance, updateResult) // function's context is the instance to be created, 'updateResult' is update function's returns.
```

### save

`save` supports：
```javascript
instance.beforeSave(options)
instance.afterSave(instance, options)
```

Note that calling `save` may trigger the other functions' hooks (such as `create`, `update` or `upsert`).

- The `create` hook function fires when the instance is not persistent or with an unset primary key
- The `upsert` hook function fires when the instance is not persistent and the primary key has been set
- When the instance is persistent, the hook function of `upsert` will be triggered

### upsert

`upsert` supports:

```javascript
instance.beforeUpsert(opts) // function's context is the instance
instance.afterUpsert(instance, upsertResult)
```

### remove

`remove` supports:

```javascript
Model.beforeRemove(args)
Model.afterRemove(removeResult, Model)
instance.beforeRemove(args)
instance.afterRemove(instance, removeResult)
```

## Table of hooks

```javascript
// create hooks
Model.beforeCreate(args)
Model.afterCreate(instance, createResult)
instance.beforeCreate(args)
instance.afterCreate(instance, createResult)

// bulkCreate hooks
Model.beforeBulkCreate(records, queryOptions)
Model.afterBulkCreate(instances, Model)

// update hooks
Model.beforeUpdate(args)
Model.afterUpdate(updateResult, Model)
instance.beforeUpdate(args)
instance.afterUpdate(instance, updateResult)

// save hooks
instance.beforeSave(options)
instance.afterSave(instance, options)

// upsert hooks
instance.beforeUpsert(opts)
instance.afterUpsert(instance, upsertResult)

// remove hooks
Model.beforeRemove(args)
Model.afterRemove(removeResult, Model)
instance.beforeRemove(args)
instance.afterRemove(instance, removeResult)
```
