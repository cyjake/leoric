'use strict';

const { connect } = require('..');

before(async function() {
  await connect({
    client: 'sqlite3',
    database: '/tmp/leoric.sqlite3',
    models: `${__dirname}/models`,
  });
});

require('./suite');
