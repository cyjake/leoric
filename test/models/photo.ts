import { BelongsTo, Bone, Column } from '../../src';
// @ts-ignore — user.js has no declaration file
import User from './user';

export default class Photo extends Bone {
  static shardingKey = 'userId';

  @Column()
  id!: bigint;

  @Column()
  userId!: bigint;

  @Column()
  url!: string;

  @Column()
  filename!: string;

  @Column({ allowNull: true })
  caption?: string;

  @BelongsTo({ foreignKey: 'userId' })
  user?: User;
}
