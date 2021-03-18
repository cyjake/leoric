---
layout: en
title: How to Contribute
---

## Get Started

Three steps:

1. Install databases we intend to support, namely MySQL, PostgreSQL, and SQLite
2. Install `node_modules` (which might take long)
3. Happy hacking

### Preparing Environment

```bash
$ brew install mysql postgres sqlite
$ brew service start mysql
$ brew service start postgres
```

### Running Tests

```bash
$ npm install
# run unit tests
$ npm test unit
# run integration tests
$ npm test integration
```

To be more specific, we can filter test files and cases:

```bash
$ npm run test -- test/unit/test.connect.js --grep "should work"
```

## Working on Documentations

The documentations of Leoric is served with Github Pages, which requries Jekyll to build. [It is recommend](https://www.moncefbelyamani.com/the-definitive-guide-to-installing-ruby-gems-on-a-mac/) installing latest Ruby with HomeBrew:

```bash
$ brew install ruby
$ echo 'export PATH="/usr/local/opt/ruby/bin:$PATH"' >> ~/.zshrc
$ cd docs
$ bundle install
```

If your network struggles to connect to https://rubygems.org, consider changing the Ruby Gems source in `docs/Gemfile`:

```diff
diff --git a/docs/Gemfile b/docs/Gemfile
index 4382725..b4dba82 100644
--- a/docs/Gemfile
+++ b/docs/Gemfile
@@ -1,4 +1,4 @@
-source "https://rubygems.org"
+source "https://gems.ruby-china.com"
```

When bundle install completes, you can now build docs locally:

```bash
$ cd docs  # if you're not at this directory yet
$ jekyll serve
Configuration file: leoric/docs/_config.yml
            Source: leoric/docs
       Destination: leoric/docs/_site
 Incremental build: disabled. Enable with --incremental
      Generating...
   GitHub Metadata: No GitHub API authentication could be found. Some fields may be missing or have incorrect data.
                    done in 3.73 seconds.
 Auto-regeneration: enabled for 'leoric/docs'
    Server address: http://127.0.0.1:4000/leoric/
  Server running... press ctrl-c to stop.
```

The documentation will be available at <http://localhost:4000/leoric/>.

## How the code is organized

The code basically breaks into following layers (from bottom to top):

- the SQL parser `lib/expr.js`
- the SQL intermediate representation `lib/spell.js`, which breaks SQL into accessible properties
- the SQL driver `lib/drivers/*.js`, which generates vendor specific SQLs then queries said SQLs
- the Bone `lib/bone.js`, which serve as the base model
- and the optional adapter for sequelize `lib/sequelize.js`

### SQL Drivers

The model driver provides following abilities:

- Attributes in model definition `lib/drivers/*/attribute.js`
- Data types in model definition `lib/drivers/*/data_types.js`
- SQL formatters that deal with table structure `lib/drivers/*/schema.js`
- SQL formatters that translate Spell, the SQL intermediate representation, into vendor specific SQLs `lib/drivers/*/spellbook.js`
- The exported driver that have them assembled together, `lib/drivers/*/index.js`
