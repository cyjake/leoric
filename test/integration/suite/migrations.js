'use strict';

const assert = require('assert').strict;
const fs = require('fs').promises;
const path = require('path');
const strftime = require('strftime');

const Realm = require('../../..');
const { checkDefinitions } = require('../helpers');

const migrations = path.join(__dirname, '../migrations');

// class Topic extends Realm.Bone {}

describe('=> Migrations', async () => {
  const realm = new Realm({ migrations });

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
    const name = `${strftime('%Y%m%d%H%M%S')}-create-topics.js`;
    const fpath = path.join(migrations, name);
    await fs.writeFile(fpath, `'use strict';

module.exports = {
  async up(driver, { STRING, TEXT }) {
    await driver.createTable('topics', {
      title: { dataType: STRING, allowNull: false },
      body: { dataType: TEXT },
    });
  },

  async down(driver) {
    await driver.dropTable('topics');
  },
};
`
    );

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
});
