---
layout: zh
title: Sequelize 适配器
---

为了降低 Sequelize 用户的迁移成本，Leoric 也提供兼容 Sequelize API 的适配器，打开 `sequelize` 开关即可：

```js
const Realm = require('leoric');
const realm = new Realm({
  sequelize: true,  // 开启 sequelize 适配器
  host: 'localhost',
});
await realm.sync();
```

开启 Sequelize 适配器之后，数据模型的 API 将和 [Sequelize Model](https://sequelize.org/master/class/lib/model.js~Model.html) 基本保持一致，具体异同见下文。

## 目录
{:.no_toc}

1. 目录
{:toc}

## 读取与写入数据

### 脏检查

## 表结构与变更迁移

## 数据校验

## 关联关系

## 高级查询

### 覆盖查询条件
