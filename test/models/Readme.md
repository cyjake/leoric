# test/models

Models defined in current directory are all in Active Record style, which means they don't have their column declarations in JavaScript.

The column definitions are fetched and parsed from `information_schema.columns` with most of the translation work done by `driver.querySchemaInfo()`.

```js
const { connect, Bone } = require('leoric');

// declare the model
class Note extends Bone {}

// connect to database and init with corresponding schema info
await connect({ models: [ Note ]});
```

In order to separate concerns, models in Sequelize style are mostly defined on the fly. They can be defined and initialized in the way described below:

```js
const { connect, Bone } = require('leoric');

// old school
const { STRING, TEXT } = Bone;
const Note = Bone.define('Note', { title: STRING, body: TEXT });

// or with class
class Memo extends Bone {}
Memoi.init({ title: STRING, body: TEXT });

// connect to database
await connect({ models: [ Note, Memo ]});
```
