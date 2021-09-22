import { Bone, DataTypes } from './index';

const { STRING, DATE } = DataTypes;

class User extends Bone {
  static attributes = {
    name: STRING,
    created_at: DATE,
    updated_at: DATE,
  }
}

async function main() {
  await User.create({ name: 'Stranger' })
  const user = await User.first;
  await user.update({ name: 'Tyrael' });
}

main().catch(err => console.error(err))
