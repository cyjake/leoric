import { default as DataTypes } from '../../data_types';

class Mysql_BOOLEAN extends DataTypes.BOOLEAN {
  constructor(...args: ConstructorParameters<typeof DataTypes.BOOLEAN>) {
    super(...args);
    this.dataType = 'tinyint';
  }

  toSqlString(): string {
    return 'TINYINT(1)';
  }
}

class Mysql_DataTypes extends DataTypes {
  static BOOLEAN = Mysql_BOOLEAN as typeof DataTypes.BOOLEAN;
}

export default Mysql_DataTypes;
