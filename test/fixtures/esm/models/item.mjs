import { Bone, DataTypes } from 'leoric';

export default class Item extends Bone {
  static attributes = {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  };
}
