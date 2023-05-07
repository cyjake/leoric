'use strict';

const fs = require('fs').promises;
const path = require('path');
const assert = require('assert');

const { findDriver, AbstractDriver } = require('../drivers');
const { isBone } = require('../utils');

const BaseRealm = require('./base');

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
async function findModels(dir) {
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
  getDriverClass(CustomDriver, dialect) {
    return CustomDriver && CustomDriver.prototype instanceof AbstractDriver
      ? CustomDriver
      : findDriver(dialect);
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

module.exports = Realm;
