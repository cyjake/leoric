---
layout: en
title: Changelog (v2.3 - v2.15)
---

For detailed release notes from v2.3 onwards, please refer to:

- [History.md](https://github.com/cyjake/leoric/blob/master/History.md) for a complete version history
- [GitHub Releases](https://github.com/cyjake/leoric/releases) for release-specific details

## Highlights Since v2.2

### v2.14.0 (2025-12)

- Support `Model.query(sql, values)` for raw SQL queries directly from model classes
- New `skipCloneValue` option for performance optimization

### v2.13.x (2025)

- JSON field improvements: `jsonMerge()` with complex literals and null handling
- BigInt column precision fixes in cartesian product results
- Sequelize adapter `count` options improvements

### v2.12.x - v2.10.x (2024)

- Enhanced TypeScript support and type declarations
- Query builder improvements
- Multiple database driver fixes

### v2.9.x - v2.3.x (2022-2023)

- Soft delete and restore functionality
- Index hints support (`useIndex`, `forceIndex`, `ignoreIndex`)
- Optimizer hints support
- JSON field querying and updating (`jsonMerge`, `JSON_MERGE_PATCH`)
- Logging improvements with `logQuery`, `logQueryError`, `logMigration`
- Egg framework and Midway component integration enhancements
