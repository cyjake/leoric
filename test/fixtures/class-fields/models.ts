import {
  Bone,
  Column,
  DataTypes,
  Model,
} from '../../../src';

const { STRING } = DataTypes;

export class RegularUser extends Bone {
  @Column({ type: STRING })
  name!: string;
}

export class DeclaredUser extends Bone {
  @Column({ type: STRING })
  declare name: string;
}

@Model()
export class DecoratedUser extends Bone {
  @Column({ type: STRING })
  name!: string;

  @Column({ type: STRING, defaultValue: 'member' })
  role = 'field initializer';
}

export class RealmDefinedUser extends Bone {
  id!: bigint;

  name!: string;

  role = 'field initializer';

  createdAt!: Date;

  updatedAt!: Date;
}
