'use strict';

const assert = require('assert').strict;
const { heresql } = require('../../../../lib/utils/string');
const Logger = require('../../../../lib/drivers/abstract/logger');

describe('=> Logger', function() {
  const logger = new Logger({
    hideKeys: [ 'password', 'confirm_password' ],
  });

  it('should mask values when INSERT', async () => {
    const sets = {
      name: 'Golum',
      password: 'My precious',
      confirm_password: 'My precious',
    };
    const sql = logger.format(
      'INSERT INTO users (name, password, confirm_password) VALUES (?, ?, ?)',
      Object.values(sets),
      { command: 'insert', sets }
    );
    assert.equal(
      sql,
      "INSERT INTO users (name, password, confirm_password) VALUES ('Golum', '***', '***')"
    );
  });

  it('should mask values when INSERT ... ON DUPLICATE KEY UPDATE ...', async () => {
    const sets = {
      id: 1,
      password: 'hakuna matata',
      confirm_password: 'hakuna matata',
    };
    const sql = logger.format(
      heresql(`
        INSERT INTO users (id, password, confirm_password) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE id = ?, password = ?, confirm_password = ?
      `),
      Object.values(sets),
      { command: 'upsert', sets }
    );
    assert.equal(
      sql,
      heresql(`
        INSERT INTO users (id, password, confirm_password) VALUES (1, '***', '***')
        ON DUPLICATE KEY UPDATE id = ?, password = ?, confirm_password = ?
      `)
    );
  });

  it('should mask values when UPDATE', async () => {
    const sets = {
      password: 'hakuna matata',
      confirm_password: 'hakuna matata',
    };
    const sql = logger.format(
      'UPDATE users SET password = ?, confirm_password = ? WHERE id = ?',
      Object.values(sets).concat(1),
      { command: 'update', sets }
    );
    assert.equal(
      sql,
      "UPDATE users SET password = '***', confirm_password = '***' WHERE id = 1"
    );
  });
});
