import fs from 'fs/promises';
import path from 'path';

import { findDriver, AbstractDriver } from '../drivers';
import { isBone } from '../utils';

import BaseRealm from './base';
import { AbstractBone } from '../abstract_bone';

/**
 *
 * @typedef {Object} QueryResult
 * @property {Array} rows
 * @property {Array} fields
 */

/**
 * find models in directory
 * @param {string} dir
 * @returns {Array.<Bone>}
 */
async function findModels(dir: string): Promise<Array<typeof AbstractBone>> {
  if (!dir || typeof dir !== 'string') {
    throw new Error(`Unexpected models dir (${dir})`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const models = [];

  for (const entry of entries) {
    const extname = path.extname(entry.name);
    if (entry.isFile() && ['.js', '.mjs'].includes(extname)) {
      const model = require(path.join(dir, entry.name));
      if (isBone(model)) models.push(model);
    }
  }

  return models;
}

class Realm extends BaseRealm {
  /**
   * @override
   */
  getDriverClass(CustomDriver: typeof AbstractDriver | undefined, dialect: string) {
    if (CustomDriver) return super.getDriverClass(CustomDriver, dialect);
    return findDriver(dialect);
  }

  /**
   * @override
   */
  async getModels() {
    const { models: dir } = this.options;

    let models;
    if (dir) {
      models = Array.isArray(dir) ? dir : (await findModels(dir));
    } else {
      models = await super.getModels();
    }
    return models;
  }
}

export default Realm;
