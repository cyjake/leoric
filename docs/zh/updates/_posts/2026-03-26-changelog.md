---
layout: zh
title: 更新日志 (v2.3 - v2.15)
---

从 v2.3 起的详细发布说明，请参阅：

- [History.md](https://github.com/cyjake/leoric/blob/master/History.md) 完整版本历史
- [GitHub Releases](https://github.com/cyjake/leoric/releases) 各版本发布详情

## v2.2 以来的重要更新

### v2.14.0 (2025-12)

- 支持 `Model.query(sql, values)` 直接从模型类执行原始 SQL 查询
- 新增 `skipCloneValue` 选项以优化性能

### v2.13.x (2025)

- JSON 字段改进：`jsonMerge()` 支持复杂字面量和 null 处理
- 修复笛卡尔积结果中 BigInt 列的精度问题
- Sequelize 适配器 `count` 选项改进

### v2.12.x - v2.10.x (2024)

- 增强 TypeScript 支持和类型声明
- 查询构建器改进
- 多数据库驱动修复

### v2.9.x - v2.3.x (2022-2023)

- 软删除和恢复功能
- 索引提示支持（`useIndex`、`forceIndex`、`ignoreIndex`）
- 优化器提示支持
- JSON 字段查询和更新（`jsonMerge`、`JSON_MERGE_PATCH`）
- 日志改进：`logQuery`、`logQueryError`、`logMigration`
- Egg 框架和 Midway 组件集成增强
