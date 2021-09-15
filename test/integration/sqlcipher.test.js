'use strict';

const fs = require('fs').promises;
const path = require('path');
const sqlcipher = require('@journeyapps/sqlcipher');
const Realm = require('../..');

before(async function() {
  const plaintext = '/tmp/leoric.sqlite3';
  const encrypted = '/tmp/leoric-encrypted.sqlite3';

  sqlcipher.verbose();
  const { Database, OPEN_READWRITE, OPEN_CREATE } = sqlcipher;
  const database = new Database(plaintext, OPEN_READWRITE | OPEN_CREATE);
  await fs.unlink(encrypted).catch(() => {/* ignored */});
  await new Promise((resolve, reject) => {
    database.serialize(function() {
      database.run(`ATTACH DATABASE '${encrypted}' AS encrypted KEY 'Accio!'`);
      database.run(`SELECT sqlcipher_export('encrypted')`);
      database.run(`DETACH DATABASE encrypted`, function(err) {
        if (err) reject(err);
        resolve();
      });
    });
  });

  const realm = new Realm({
    dialect: 'sqlite',
    database: encrypted,
    client: '@journeyapps/sqlcipher',
    models: path.resolve(__dirname, '../models'),
  });

  realm.driver.pool.on('connection', function(connection) {
    connection.query('PRAGMA key = "Accio!"');
  });

  await realm.connect();
});

require('./suite/index.test');
