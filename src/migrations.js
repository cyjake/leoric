'use strict';

const dayjs = require('dayjs');
const fs = require('fs').promises;
const path = require('path');

async function loadTasks(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.isFile() && ['.js', '.mjs'].includes(path.extname(entry.name))) {
      result.push(entry.name);
    }
  }

  return result;
}

function loadMigration(dir, name) {
  return { ...require(path.join(dir, name)), name };
}

async function migrate(steps = Infinity) {
  const { migrations: dir } = this.options;
  const { driver, DataTypes } = this;
  const { logger } = driver;

  await driver.query('CREATE TABLE IF NOT EXISTS leoric_meta (name VARCHAR(255) NOT NULL)');
  const { rows } = await driver.query('SELECT * FROM leoric_meta ORDER BY name');
  const finishedTasks = rows.map(row => row.name);
  const tasks = await loadTasks(dir);

  if (steps > 0) {
    const migrations = tasks
      .filter(entry => !finishedTasks.includes(entry))
      .slice(0, steps)
      .map(entry => loadMigration(dir, entry));

    for (const migration of migrations) {
      logger.logMigration(migration.name, 'up');
      await migration.up(driver, DataTypes);
      await driver.query('INSERT INTO leoric_meta (name) VALUES (?)', [ migration.name ]);
    }
  } else if (steps < 0) {
    const migrations = finishedTasks
      .slice(steps)
      .map(entry => loadMigration(dir, entry));

    for (const migration of migrations.reverse()) {
      logger.logMigration(migration.name, 'down');
      await migration.down(driver, DataTypes);
      await driver.query('DELETE FROM leoric_meta WHERE name = ?', [ migration.name ]);
    }
  }
}

async function rollback(step = 1) {
  if (step > 0) await this.migrate(-step);
}

async function createMigrationFile(name) {
  const { migrations: dir } = this.options;
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const fpath = path.join(dir, `${timestamp}-${name}.js`);
  await fs.writeFile(fpath, `'use strict';

module.exports = {
  async up(driver, DataTypes) {
    // TODO
  },

  async down(driver, DataTypes) {
    // TODO
  }
};
`
  );
}

module.exports = { migrate, rollback, createMigrationFile };
