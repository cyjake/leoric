'use strict';

const path = require('path');
const { connect } = require('../..');

before(async function() {
  await connect({
    client: 'mysql2',
    host: 'localhost',
    port: process.env.MYSQL_PORT,
    user: 'root',
    database: 'leoric',
    models: path.resolve(__dirname, '../models')
  });
});

require('./suite');
require('./suite/dates');
