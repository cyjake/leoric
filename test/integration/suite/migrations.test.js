'use strict';

const assert = require('assert').strict;
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

const Realm = require('../../../src');
const Logger = require('../../../src/drivers/abstract/logger').default;
const { checkDefinitions } = require('../helpers');

const { Bone } = Realm;
const migrations = path.join(__dirname, '../migrations');

// class Topic extends Realm.Bone {}

async function createTopics() {
  const name = `${dayjs().format('YYYYMMDDHHmmss')}-create-topics.js`;
  const fpath = path.join(migrations, name);
  await fs.writeFile(fpath, `'use strict';

module.exports = {
async up(driver, { STRING, TEXT }) {
  await driver.createTable('topics', {
    title: { type: STRING, allowNull: false },
    body: { type: TEXT },
  });
},

async down(driver) {
  await driver.dropTable('topics');
},
};
`
  );

  return name;
}

describe('=> Migrations', async () => {
  let realm;

  before(() => {
    // use existing options, such as test/integration/test.mysql.js
    realm = new Realm({ ...Bone.options, migrations });
    if (/sqlcipher/.test(realm.options.client || '')) {
      realm.driver.pool.on('connection', function(connection) {
        connection.query('PRAGMA key = "Accio!"');
      });
    }
  });

  beforeEach(async () => {
    await realm.driver.dropTable('topics');
    await realm.driver.dropTable('leoric_meta');

    for (const entry of (await fs.readdir(migrations))) {
      if (!entry.startsWith('.')) {
        await fs.unlink(path.join(migrations, entry));
      }
    }
  });

  it('should be able to gernerate migration files', async () => {
    await realm.createMigrationFile('create-topics');
    const entries = await fs.readdir(migrations);
    const file = entries.find(entry => entry.endsWith('.js'));
    assert.ok(file);

    // TODO
    // realm.createMigrationFile('create-topics', { columnName: definition });
  });

  it('should be able to migrate up and down', async () => {
    const name = await createTopics();
    await realm.migrate();
    await checkDefinitions('topics', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
    const { rows } = await realm.driver.query('SELECT name FROM leoric_meta');
    assert.equal(rows[0].name, name);

    // undo 1 step to drop table `topics`
    await realm.migrate(-1);
    await checkDefinitions('topics', null);
    const { rows: result } = await realm.driver.query('SELECT name FROM leoric_meta');
    assert.equal(result.length, 0);
  });

  it('should be able to rollback', async () => {
    await createTopics();
    await realm.migrate();
    // undo 1 step to drop table `topics`
    await realm.rollback();
    await checkDefinitions('topics', null);
    const { rows: result } = await realm.driver.query('SELECT name FROM leoric_meta');
    assert.equal(result.length, 0);
  });

  it('should not rollback if invalid steps', async () => {
    await createTopics();
    await realm.migrate();
    await realm.rollback(0);
    await checkDefinitions('topics', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
    const { rows: result } = await realm.driver.query('SELECT name FROM leoric_meta');
    assert.equal(result.length, 1);
  });

  it('should log migration', async () => {
    const queryLogs = [];
    const migrationLogs = [];
    const originLogger = realm.driver.logger;
    realm.driver.logger = new Logger({
      ...originLogger,
      logMigration(name, direction) {
        migrationLogs.push([ name, direction ]);
      },
      logQuery(sql) {
        queryLogs.push(sql);
      },
    });

    const name = await createTopics();
    await realm.migrate();

    assert.deepEqual(migrationLogs.shift(), [ name, 'up' ]);
    assert.ok(queryLogs.some(entry => entry.startsWith('CREATE TABLE')));

    await realm.rollback();
    assert.deepEqual(migrationLogs.shift(), [ name, 'down' ]);
    assert.ok(queryLogs.some(entry => entry.startsWith('DROP TABLE')));

    realm.driver.logger = originLogger;
  });
});
