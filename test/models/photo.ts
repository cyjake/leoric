import { BelongsTo, Bone, Column } from '../..';
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
