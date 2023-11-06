'use strict';

const fs = require('fs').promises;
const path = require('path');
const sqlcipher = require('@journeyapps/sqlcipher');
const Realm = require('../../src');

before(async function() {
  const plaintext = '/tmp/leoric.sqlite3';
  const encrypted = '/tmp/leoric-encrypted.sqlite3';

  sqlcipher.verbose();
  const { Database, OPEN_READWRITE, OPEN_CREATE } = sqlcipher;
  const database = new Database(plaintext, OPEN_READWRITE | OPEN_CREATE);
  await fs.unlink(encrypted).catch(() => {/* ignored */});
  // https://discuss.zetetic.net/t/how-to-encrypt-a-plaintext-sqlite-database-to-use-sqlcipher-and-avoid-file-is-encrypted-or-is-not-a-database-errors/868

  database.serialize(function() {
    database.run(`ATTACH DATABASE '${encrypted}' AS encrypted KEY 'Accio!'`);
    database.run(`SELECT sqlcipher_export('encrypted')`);
    database.run(`DETACH DATABASE encrypted`);
  });

  await new Promise(function(resolve, reject) {
    database.close(function(err) {
      if (err) reject(err);
      else resolve();
    });
  });

  // database.close(callback) seems not working properly, wait for one extra second
  await new Promise(resolve => setTimeout(resolve, 1000));

  const realm = new Realm({
    dialect: 'sqlite',
    database: encrypted,
    client: '@journeyapps/sqlcipher',
    models: path.resolve(__dirname, '../models'),
  });

  realm.driver.pool.on('connection', async function(connection) {
    await connection.query('PRAGMA key = "Accio!"');
  });

  await realm.connect();
});

require('./suite/index.test');
