'use strict';

const path = require('path');
const { connect, Bone } = require('../..');
const { checkDefinitions } = require('./helpers');

before(async function() {
  await connect({
    client: 'sqlite3',
    database: '/tmp/leoric.sqlite3',
    models: path.resolve(__dirname, '../models'),
  });
});

require('./suite');

describe('=> Table definitions (sqlite)', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should be able to create table with INTEGER PRIMARY KEY', async () => {
    const { INTEGER } = Bone.DataTypes;
    class Note extends Bone {}
    Note.init({
      id: { type: INTEGER, primaryKey: true },
      public: { type: INTEGER },
    });

    await Note.sync();
    await checkDefinitions('notes', {
      id: { dataType: 'integer', primaryKey: true },
      public: { dataType: 'integer', primaryKey: undefined },
    });
  });
});
