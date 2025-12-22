import dayjs from 'dayjs';
import { promises as fs } from 'fs';
import path from 'path';
import AbstractDriver from './drivers/abstract';
import DataTypesModule from './data_types';

interface Migration {
  name: string;
  up: (driver: AbstractDriver, DataTypes: typeof DataTypesModule) => Promise<void>;
  down: (driver: AbstractDriver, DataTypes: typeof DataTypesModule) => Promise<void>;
}

interface RealmContext {
  options: {
    migrations: string;
    [key: string]: any;
  };
  driver: AbstractDriver;
  DataTypes: typeof DataTypesModule;
}

async function loadTasks(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && ['.js', '.mjs', '.ts'].includes(path.extname(entry.name))) {
      result.push(entry.name);
    }
  }

  return result;
}

function loadMigration(dir: string, name: string): Migration {
  return { ...require(path.join(dir, name)), name };
}

async function migrate(this: RealmContext, steps = Infinity): Promise<void> {
  const { migrations: dir } = this.options;
  const { driver } = this;
  const DataTypes = this.DataTypes;
  const { logger } = driver;

  await driver.query('CREATE TABLE IF NOT EXISTS leoric_meta (name VARCHAR(255) NOT NULL)');
  const { rows } = await driver.query('SELECT * FROM leoric_meta ORDER BY name');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const finishedTasks = rows!.map(row => row.name);
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
      .map(entry => loadMigration(dir, entry as string));

    for (const migration of migrations.reverse()) {
      logger.logMigration(migration.name, 'down');
      await migration.down(driver, DataTypes);
      await driver.query('DELETE FROM leoric_meta WHERE name = ?', [ migration.name ]);
    }
  }
}

async function rollback(this: RealmContext, step = 1): Promise<void> {
  if (step > 0) await migrate.call(this, -step);
}

async function createMigrationFile(this: RealmContext, name: string): Promise<void> {
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

export { migrate, rollback, createMigrationFile };
