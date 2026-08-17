import { Bone, JsonSetMutation } from '../../src';

class User extends Bone {
  declare id: bigint;
  declare extra: Record<string, unknown>;
}

const mutations: JsonSetMutation[] = [
  { path: [ 'profile', 'name' ], value: 'Ada' },
  { path: [ 'items', 0 ], value: { active: true } },
];

function checkJsonSetTypes(user: User) {
  User.jsonSet({ id: 1n }, 'extra', [ 'profile', 'name' ], 'Grace');
  User.jsonSet({ id: 1n }, 'extra', mutations);

  user.jsonSet('extra', [ 'profile', 'name' ], 'Grace');
  user.jsonSet('extra', mutations, { silent: true });
  user.jsonSet('extra', [ 'obsolete' ], null, { nullTreatment: 'delete_key' });

  // @ts-expect-error paths cannot be empty
  user.jsonSet('extra', [], true);

  // @ts-expect-error nullTreatment is restricted to PostgreSQL values
  user.jsonSet('extra', [ 'obsolete' ], null, { nullTreatment: 'ignore' });
}

void checkJsonSetTypes;
