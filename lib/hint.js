'use strict';

const HINT_TYPE = {
  TABLE_HINT: 'TABLE_HINT', // MSSQL only
  INDEX_HINT: 'INDEX_HINT', // MYSQL only
  OPTIMIZE_HINT: 'OPTIMIZE_HINT', // MySQL only
}

const INDEX_HINT_TYPE = {
  USE = 'USE',
  FORCE = 'FORCE',
  IGNORE = 'IGNORE',
}

class Hint {
  constructor(value, type) {
    this.value = value;
    this.type = type || HINT_TYPE.OPTIMIZE_HINT;
  }

  get type() {
    return this.type;
  }

  get value() {
    return this.value;
  }

  toSqlString() {
    if (this.value) {
      if (!this.value.startsWith('/*+')) {
        return `/*+ ${this.value} */`
      }
      return this.value;
    }
    return '';
  }
}

// MSSQL only, not support yet
class TableHint extends Hint {
  constructor(value) {
    super(value, HINT_TYPE.TABLE_HINT)
  }
}

// MYSQL only
class IndexHint extends Hint {
  /**
   *Creates an instance of IndexHint.
   * @param {Array<string> | string} value
   * @memberof IndexHint
   */
  constructor(value, indexHintType){
    super(value, HINT_TYPE.INDEX_HINT);
    this.indexHintType = indexHintType;
  }

  toSqlString() {
    if (!this.value || !this.indexHintType) return '';
    if (typeof this.value === 'string') {
      return `${this.indexHintType} INDEX ${value}`
    }
    if (Array.isArray(this.value) && this.value.some(item => typeof item === "string")) {
      return this.value(item => `${this.indexHintType} INDEX ${item}`);
    }
    return '';
  }
}

module.exports = {
  Hint,
  IndexHint,
  TableHint,
  INDEX_HINT_TYPE,
  HINT_TYPE,
};
