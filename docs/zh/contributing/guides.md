---
layout: zh
title: 如何参与
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 快速上手

三个步骤

1. 安装我们目前需要支持的数据库，MySQL、PostgreSQL、以及 SQLite
2. 克隆仓库代码并安装依赖
3. 愉快地开始编码

### 准备开发环境

首先需要安装 HomeBrew 和 Git，然后安装并启动数据库：

```bash
$ brew install mysql postgres sqlite
$ brew service start mysql
$ brew service start postgres
```

### 执行测试

```bash
$ npm install
# 初始化表结构，运行所有测试
$ npm run test
# 仅运行单元测试
$ npm run test:unit
# 仅运行集成测试
$ npm run test:integration
```

还可以执行单个测试文件，或者使用 `--grep` 选项进一步限定执行范围：

```bash
$ npm run test -- test/unit/test.connect.js --grep "should work"
$ npm run test:unit -- --grep "=> Sequelize adapter"
$ npm run test:mysql -- --grep "bone.toJSON()"
```

如果 `--grep [pattern]` 不够直观，也可以随时改成用 `.only` 来指定用例：

```js
describe('=> Spell', function() {
  it.only('supports error convention with nodeify', async function() {
    // asserts
  });
});
```

提交代码之前记得将 `.only` 移除掉。

## 编写帮助文档

Leoric 的帮助文档使用 Github Pages 服务，后者依赖 Jekyll 构建。Jekyll 是一个使用 Ruby 编写的静态站点生成工具，具体安装方式参考[macOS 安装 Ruby](https://mac.install.guide/ruby/index.html)，或者参考 Moncef Belyamani 的 [Ruby 安装脚本](https://www.moncefbelyamani.com/ruby-script/)。如果你只想要安装 Jekyll，也可以[使用 HomeBrew 安装 Ruby](https://mac.install.guide/ruby/13.html)，然后再[安装 Jekyll](https://jekyllrb.com/docs/installation/macos/) 即可：

```bash
$ brew install ruby
$ echo 'export PATH="/usr/local/opt/ruby/bin:$PATH"' >> ~/.zshrc
$ cd docs
$ bundle install
```

如果遇到连接 https://rubygems.org 超时的问题，考虑切换 `docs/Gemfile` 中使用的 Ruby Gems 源：

```diff
diff --git a/docs/Gemfile b/docs/Gemfile
index 4382725..b4dba82 100644
--- a/docs/Gemfile
+++ b/docs/Gemfile
@@ -1,4 +1,4 @@
-source "https://rubygems.org"
+source "https://gems.ruby-china.com"
```

完成 `bundle install` 即可在本地使用 Jekyll 构建帮助文档：

```bash
$ cd docs  # 如果还在项目根路径的话，记得先切换到 docs 目录
$ jekyll serve
Configuration file: leoric/docs/_config.yml
            Source: leoric/docs
       Destination: leoric/docs/_site
 Incremental build: disabled. Enable with --incremental
      Generating...
   GitHub Metadata: No GitHub API authentication could be found. Some fields may be missing or have incorrect data.
                    done in 3.73 seconds.
 Auto-regeneration: enabled for 'leoric/docs'
    Server address: http://127.0.0.1:4000/
  Server running... press ctrl-c to stop.
```

访问 <http://localhost:4000/> 即可。

## 代码是如何组织的

可以将 Leoric 的代码划分为如下几层（从底层往顶层）：

- SQL 解析器 `lib/expr.js`
- SQL 中间表示层 `lib/spell.js`，提供查找、修改 SQL 相关方法
- SQL 驱动层 `lib/drivers/*.js`，将中间表示层转换为实际可执行的 SQL 语法，并提供执行 SQL 获取返回结果的相关方法
- 数据模型基类 Bone `lib/bone.js`
- [可选] Sequelize 适配器 `lib/sequelize.js`

### SQL 驱动层

SQL 驱动层主要包含如下模块：

- 定义数据模型所需的属性描述 `lib/drivers/*/attribute.js`
- 定义数据模型所需的字段类型描述 `lib/drivers/*/data_types.js`
- 用来处理表结构的相关 SQL 方法 `lib/drivers/*/schema.js`
- 用来将 SQL 中间表示层转换为实际可执行的 SQL 的转换工具 `lib/drivers/*/spellbook.js`
- 组装以上模块并提供对应驱动器 `lib/drivers/*/index.js`
