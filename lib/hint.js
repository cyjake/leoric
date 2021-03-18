'use strict';

const HINT_TYPE = {
  TABLE_HINT: 'TABLE_HINT', // MSSQL only
  INDEX_HINT: 'INDEX_HINT', // MYSQL only
  OPTIMIZE_HINT: 'OPTIMIZE_HINT', // MySQL only
}

const INDEX_HINT_TYPE = {
  USE: 'USE',
  FORCE: 'FORCE',
  IGNORE: 'IGNORE',
}

const INDEX_HINT_USE_TYPE = {
  JOIN: 'JOIN',
  ORDER_BY: 'ORDER BY',
  GROUP_BY: 'GROUP BY',
}

class LeoricHintError extends Error {
  constructor(type, message) {
    const errorMessage = message || `${type} is not a valid Hint type`;
    super(errorMessage);
    this.name = 'LeoricHintError';
  }
}

class Hint {

  #value = '';
  #type = HINT_TYPE.OPTIMIZE_HINT;

  static build(obj) {
    if (obj instanceof Hint) {
      return obj;
    }
    if (typeof obj === 'string') {
      return new Hint(obj);
    }
    const { type, indexHintType, useType, value } = obj;
    if (indexHintType || type === HINT_TYPE.INDEX_HINT) {
      return new IndexHint(value, indexHintType, useType);
    }
    if (Object.keys(INDEX_HINT_TYPE).includes(type)) {
      return new IndexHint(value, type, useType);
    }
    return new Hint(value, type);
  }

  constructor(value, type) {
    if (type && !Object.keys(HINT_TYPE).includes(type)) {
      throw new LeoricHintError(type);
    }
    this.#value = value;
    this.#type = type || HINT_TYPE.OPTIMIZE_HINT;
  }

  set value(v) {
    if (v) {
      this.#value = v.replace(/[\/\*\+]|[\*\/]/g, '');
    }
  }

  get type() {
    return this.#type;
  }

  set type(t) {
    if (!t) return;
    if (Object.keys(HINT_TYPE).includes(t.toUpperCase())) {
      this.#type = t;
    }
    throw new LeoricHintError(t);
  }

  get value() {
    return this.#value;
  }

  /**
   *
   * @param {Hint} hint
   * @returns {boolean}
   * @memberof Hint
   */
  isEqual(hint) {
    if (!hint) return false;
    return hint.type === this.type && this.value === hint.value;
  }

  toSqlString() {
    if (this.#value) {
      return this.#value;
    }
    return '';
  }
}

// MSSQL(Microsoft SQL Server) only, not support yet
class TableHint extends Hint {
  constructor(value) {
    super(value, HINT_TYPE.TABLE_HINT)
  }
}

// MYSQL only
class IndexHint extends Hint {

  #indexHintType = INDEX_HINT_TYPE.USE;
  #useType = null;
  /**
   *Creates an instance of IndexHint.
   * @param {Array<string> | string} value
   * @param {enum<INDEX_HINT_TYPE>?} indexHintType
   * @param {enum<INDEX_HINT_USE_TYPE>?} useType
   * @memberof IndexHint
   */
  constructor(value, indexHintType, useType){
    super(value, HINT_TYPE.INDEX_HINT);
    if (indexHintType && !Object.keys(INDEX_HINT_TYPE).includes(indexHintType)) {
      throw new LeoricHintError(indexHintType);
    }
    if (useType && !Object.values(INDEX_HINT_USE_TYPE).includes(useType)) {
      throw new LeoricHintError(useType);
    }
    this.#indexHintType = indexHintType || INDEX_HINT_TYPE.USE;
    this.#useType = useType;
  }

  set indexHintType(type) {
    if (!type) return;
    if (Object.keys(INDEX_HINT_TYPE).includes(type.toUpperCase())) {
      this.#indexHintType = type;
    }
    throw new LeoricHintError(type);
  }

  get indexHintType() {
    return this.#indexHintType;
  }

  get useType() {
    return this.#useType;
  }

  set useType(type) {
    if (!type) return;
    if (Object.values(INDEX_HINT_USE_TYPE).includes(type.toUpperCase())) {
      this.#useType = type;
    }
    throw new LeoricHintError(type);
  }

  toSqlString() {
    if (!this.value || !this.indexHintType) return '';
    const chunks = [this.indexHintType, 'INDEX'];
    if (this.#useType) {
      chunks.push(`FOR ${this.useType}`);
    }
    if (typeof this.value === 'string') {
      chunks.push(`(${this.value})`);
      return chunks.join(' ');
    }
    if (Array.isArray(this.value) && this.value.some(item => typeof item === "string")) {
      chunks.push(`(${this.value.join(',')})`);
      return chunks.join(' ');
    }
    return '';
  }

  /**
   *
   * @param {IndexHint} hint
   * @returns {boolean}
   * @memberof IndexHint
   */
  isEqual(hint) {
    if (!hint) return false;
    return hint.type === this.type && this.value === hint.value && this.indexHintType === hint.indexHintType && this.useType === hint.useType;
  }

  static copy(hint) {
    return new IndexHint(hint.value, hint.indexHintType, hint.useType);
  }

  // static
  /**
   *
   *
   * @static
   * @param {IndexHint} hints
   * @returns {Array<IndexHint>}
   * @memberof IndexHint
   */
  static merge(hints) {
    if (!hints || !hints.length) return hints;
    const grouped = {};
    for (const hint of hints) {
      const key = `${hint.indexHintType}_${hint.useType || ''}`;
      if (Object.keys(grouped).includes(key)) {
        grouped[key].push(hint);
      } else {
        grouped[key] = [hint];
      }
    }

    const groupArr = [];
    for (const key in grouped) {
      let newIndexHint;
      if (grouped[key].length === 1) {
        const hint = grouped[key][0];
        newIndexHint = IndexHint.copy(hint);
      } else {
        const sampleHint = grouped[key][0];
        newIndexHint = new IndexHint(grouped[key].map(item => item.value), sampleHint.indexHintType, sampleHint.useType);
      }
      groupArr.push(newIndexHint);
    }

    return groupArr;
  }

  /**
   * build with indexHintType
   *
   * @static
   * @param {object | string} obj
   * @param {string} indexHintType
   * @returns {IndexHint}
   * @memberof IndexHint
   */
  static buildWithType(obj, indexHintType) {
    if (typeof obj === 'string') {
      return new IndexHint(obj, indexHintType);
    }
    const { useType, value, useFor } = obj;
    return new IndexHint(value, indexHintType, useType || useFor);
  }
}

module.exports = {
  Hint,
  IndexHint,
  TableHint,
  INDEX_HINT_TYPE,
  HINT_TYPE,
  INDEX_HINT_USE_TYPE,
  LeoricHintError,
};
