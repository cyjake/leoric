---
layout: zh
title: 钩子
---

钩子(hooks) 支持在执行查询的特定时机插入根据上下文所做的特殊操作，本文将介绍 leoric 支持的钩子函数以及如何使用它们

## 目录
{:.no_toc}

1. 目录
{:toc}

## 声明钩子
可通过以下方式声明：
```javascript
// init
Model.init(attrs, {
  hooks: {
    beforeCreate: () => {},
    afterUpdate: () => {}
  }
});

// define
Realm.define('User', attrs, {
  hooks: {
    beforeCreate: () => {},
    afterUpdate: () => {}
  }
}})
```


## 支持的钩子函数：
> 其中 `Model.method` 表示直接通过模型类调用方法，  `Instance.method` 表示通过模型实例调用方法，针对不同的调用方式其 hook 的入参和都略有不同

### create
`create`  支持以下几个钩子函数:
```javascript
// create hooks,其中 args 为函数本身调用时的参数
Model.beforeCreate(args) // 函数上下文为将要创建的实例
Model.afterCreate(instance, createResult)
Instance.beforeCreate(args)
Instance.afterCreate(instance, createResult) // 函数上下文为将要创建的实例
```
**需要注意的是，`create` 的钩子函数的函数上下文 `context` 皆为将要创建的实例**
### bulkCreate
`bulkCreate` 支持以下两个钩子函数，其函数上下文为模型类:
```javascript
// bulkCreate hooks
Model.beforeBulkCreate(records, queryOptions) // 函数上下文为 Model
Model.afterBulkCreate(instances, Model) // instances 为批量创建的实例
```
### update
`update` 支持以下几个钩子函数:
```javascript
// update hooks
Model.beforeUpdate(args) // 函数上下文为 Model
Model.afterUpdate(updateResult, Model) // 函数上下文为 Model
instance.beforeUpdate(args) // 函数上下文为 instance
instance.afterUpdate(instance, updateResult) // 函数上下文为 instance, updateResult 为 `update` 函数的更新结果。
```
### save
`save` 支持以下两个钩子函数：
```javascript
Instance.beforeSave(options)
Instance.afterSave(instance, options)
```
需要注意的是， `save` 属于保存操作，模型实例调用 `save` 时会根据实际情况再触发 `create` 、 `update` 或 `upsert` 的钩子函数。

- 当实例是未持久化且主键未设值的数据时会触发 `create` 的钩子函数
- 当实例是未持久化且主键已经设值的数据时 `upsert` 的钩子函数被触发
- 当实例是已持久化的数据时会触发 `upsert` 的钩子函数


### upsert
`upsert` 支持以下两个钩子函数:
```javascript
Instance.beforeUpsert(opts) // 函数上下文为 instance
Instance.bafterUpsert(instance, upsertResult) // upsertResult 为 `upsert` 执行结果。

```
### remove
`remove` 支持以下四个钩子函数:
```javascript
Model.beforeRemove(args)
Model.afterRemove(removeResult, Model) // removeResult 为函数执行结果
Instance.beforeRemove(args)
Instance.afterRemove(instance, removeResult)
```

## 汇总
```javascript

// create hooks,其中 args 为函数本身调用时的参数
Model.beforeCreate(args) // 函数上下文为将要创建的实例
Model.afterCreate(instance, createResult)
Instance.beforeCreate(args)
Instance.afterCreate(instance, createResult) // 函数上下文为将要创建的实例

// bulkCreate hooks
Model.beforeBulkCreate(records, queryOptions) // 函数上下文为 Model
Model.afterBulkCreate(instances, Model) // instances 为批量创建的实例

// update hooks
Model.beforeUpdate(args) // 函数上下文为 Model
Model.afterUpdate(updateResult, Model) // 函数上下文为 Model
instance.beforeUpdate(args) // 函数上下文为 instance
instance.afterUpdate(instance, updateResult) // 函数上下文为 instance

// save hooks
Instance.beforeSave(options)
Instance.afterSave(instance, options)

// upsert hooks
Instance.beforeUpsert(opts) // 函数上下文为 instance
Instance.bafterUpsert(instance, upsertResult)

// remove hooks
Model.beforeRemove(args)
Model.afterRemove(removeResult, Model)
Instance.beforeRemove(args)
Instance.afterRemove(instance, removeResult)

```

