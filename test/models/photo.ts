import { BelongsTo, Bone, Column } from '../../src';
// @ts-ignore — user.js has no declaration file
import User from './user';

export default class Photo extends Bone {
  static shardingKey = 'userId';

  @Column()
  declare id: bigint;

  @Column()
  declare userId: bigint;

  @Column()
  declare url: string;

  @Column()
  declare filename: string;

  @Column({ allowNull: true })
  declare caption?: string;

  @BelongsTo({ className: 'User', foreignKey: 'userId' })
  declare user?: InstanceType<typeof User>;
}
