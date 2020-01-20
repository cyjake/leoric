# Contributing Guides

## How to get started

Three steps:

1. Install databases we intend to support, namely MySQL, PostgreSQL, and SQLite
2. Install `node_modules` (which might take long)
3. Happy hacking

### Preparing environment

```bash
$ brew install mysql postgres sqlite
$ brew service start mysql
$ brew service start postgres
```

### Running tests

```bash
$ npm install
# run all the tests in test/unit directory
$ npm test unit
# run all the tests in test/integration directory
$ npm test integration
# skip pretest task
$ npm run test-local
```

To be more specific, we can filter test files and cases:

```bash
$ npm run test-local -- test/unit/test.connect.js --grep "should work"
```

It is recommended that we start with unit tests first, such as:

```bash
$ npm run test-local -- test/unit/adapters/test.sequelize.js
```

## How the code is organized

TODO
