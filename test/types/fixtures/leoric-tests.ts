import * as assert from 'assert';

import Realm, { Bone, DataTypes } from '../../../types/index';

const { STRING, DATE } = DataTypes;

class User extends Bone {
  static attributes = {
    name: STRING,
    created_at: DATE,
    updated_at: DATE,
  }
}

async function main() {
  const userBone = await User.create({ name: 'Stranger' });
  assert.strictEqual(userBone.toJSON().name, userBone.toObject().name);

  const user = await User.first;
  await user.update({ name: 'Tyrael' });

  const realm = new Realm({
    dialect: 'sqlite',
    database: '/tmp/leoric.sqlite3',
  });
  await realm.query('SELECT * FROM sqlite_master');
}

main().catch(err => console.error(err))
