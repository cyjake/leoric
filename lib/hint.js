'use strict';

const { isDeepStrictEqual, format } = require('util');
const { isPlainObject } = require('./utils');

/**
 * @enum
 */
const INDEX_HINT_TYPE = {
  use: 'use',
  force: 'force',
  ignore: 'ignore',
};

/**
 * @enum
 */
const INDEX_HINT_SCOPE = {
  join: 'join',
  orderBy: 'order by',
  groupBy: 'group by',
};

class Hint {

  #text = '';

  static build(hint) {
    // eslint-disable-next-line no-use-before-define
    if (hint instanceof Hint || hint instanceof IndexHint) return hint;
    // eslint-disable-next-line no-use-before-define
    if (isPlainObject(hint) && hint.index) return IndexHint.build(hint);
    return new Hint(hint);
  }

  constructor(text) {
    this.text = text;
  }

  set text(value) {
    if (typeof value !== 'string') {
      throw new SyntaxError(`Unknown optimizer hint ${value}`);
    }
    this.#text = value.replace(/^\s*\/\*\+|\*\/\s*$/g, '').trim();
  }

  get text() {
    return this.#text;
  }

  /**
   *
   * @param {Hint} hint
   * @returns {boolean}
   * @memberof Hint
   */
  isEqual(hint) {
    return hint instanceof Hint && this.text === hint.text;
  }

  toSqlString() {
    return this.#text;
  }
}

// MySQL only
class IndexHint {

  #type = INDEX_HINT_TYPE.use;
  #scope = '';
  #index = [];

  /**
   * build index hint
   *
   * @static
   * @param {object | string} obj
   * @param {string} indexHintType
   * @returns {IndexHint}
   * @example
   * build('idx_title')
   * build('idx_title', type: INDEX_HINT_TYPE.force, INDEX_HINT_SCOPE.groupBy)
   * build({
   *   index: 'idx_title',
   *   type: INDEX_HINT_TYPE.ignore,
   *   scope: INDEX_HINT_SCOPE.groupBy,
   * })
   */
  static build(hint, type, scope) {
    if (typeof hint === 'string' || Array.isArray(hint)) {
      return new IndexHint(hint, type, scope);
    }

    if (isPlainObject(hint)) {
      if (hint.index != null) {
        return new IndexHint(hint.index, hint.type, hint.scope);
      }

      for (const key in INDEX_HINT_SCOPE) {
        if (hint.hasOwnProperty(key)) {
          const index = hint[key];
          return new IndexHint(index, type, INDEX_HINT_SCOPE[key]);
        }
      }
    }

    throw new SyntaxError(format('Unknown index hint %s', hint));
  }

  /**
   * Creates an instance of IndexHint.
   * @param {Array<string> | string} index
   * @param {INDEX_HINT_TYPE} type
   * @param {INDEX_HINT_SCOPE?} scope
   * @memberof IndexHint
   */
  constructor(index, type = INDEX_HINT_TYPE.use, scope = ''){
    this.index = index;
    this.type = type;
    this.scope = scope;
  }

  set index(values) {
    values = [].concat(values);

    for (const value of values) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new SyntaxError(format('Unknown index hint %s', value));
      }
    }

    this.#index = values;
  }

  get index() {
    return this.#index;
  }

  set type(value) {
    if (!Object.values(INDEX_HINT_TYPE).includes(value)) {
      throw new SyntaxError(format('Unknown index hint type %s', value));
    }
    this.#type = value;
  }

  get type() {
    return this.#type;
  }

  set scope(value) {
    if (value && !Object.values(INDEX_HINT_SCOPE).includes(value)) {
      throw new SyntaxError(format('Unknown index hint scope %s', value));
    }
    this.#scope = value || '';
  }

  get scope() {
    return this.#scope;
  }

  toSqlString() {
    const { type, scope, index } = this;
    const chunks = [ type.toUpperCase(), 'INDEX' ];

    if (scope) {
      chunks.push(`FOR ${scope.toUpperCase()}`);
    }

    chunks.push(`(${index.join(',')})`);
    return chunks.join(' ');
  }

  /**
   *
   * @param {IndexHint} hint
   * @returns {boolean}
   * @memberof IndexHint
   */
  isEqual(hint) {
    return hint instanceof IndexHint
      && this.type === hint.type
      && this.scope === hint.scope
      && isDeepStrictEqual(this.index, hint.index);
  }

  /**
   * @static
   * @param {IndexHint} hints
   * @returns {Array<IndexHint>}
   * @memberof IndexHint
   */
  static merge(hints) {
    if (!hints || !hints.length) return hints;

    const grouped = {};
    for (const hint of hints) {
      const key = `${hint.type}_${hint.scope}`;
      grouped[key] = (grouped[key] || []).concat(hint.index);
    }

    const result = [];
    for (const key in grouped) {
      const indices = grouped[key].reduce((result, index) => {
        if (!result.includes(index)) result.push(index);
        return result;
      }, []);
      const [type, scope] = key.split('_');
      result.push(new IndexHint(indices, type, scope));
    }

    return result;
  }
}

module.exports = {
  Hint,
  IndexHint,
  INDEX_HINT_TYPE,
  INDEX_HINT_SCOPE,
};
