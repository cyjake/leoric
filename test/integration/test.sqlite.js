'use strict';

const path = require('path');
const { connect } = require('../..');

before(async function() {
  await connect({
    client: 'sqlite3',
    database: '/tmp/leoric.sqlite3',
    models: path.resolve(__dirname, '../models'),
  });
});

require('./suite');
