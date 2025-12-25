
import { format, isDeepStrictEqual } from 'util';
import { isPlainObject } from './utils';

export enum INDEX_HINT_TYPE {
  use = 'use',
  force = 'force',
  ignore = 'ignore'
}

export enum INDEX_HINT_SCOPE {
  join = 'join',
  orderBy = 'order by',
  groupBy = 'group by',
}

export enum INDEX_HINT_SCOPE_TYPE {
  join = 'join',
  orderBy = 'orderBy',
  groupBy = 'groupBy',
}

export interface BaseHintInterface {
  index: string;
}

export interface HintInterface extends BaseHintInterface {
  type?: INDEX_HINT_TYPE;
  scope?: INDEX_HINT_SCOPE;
}

export type HintScopeObject = {
  [key in INDEX_HINT_SCOPE_TYPE]?: string | string[];
}

export class Hint {

  #text = '';

  static build(hint: string | Hint | IndexHint | BaseHintInterface): Hint | IndexHint {
    if (hint instanceof Hint || hint instanceof IndexHint) return hint;
    if (typeof hint === 'string') return new Hint(hint);
    if (isPlainObject(hint) && hint.index) return IndexHint.build(hint);
    throw new SyntaxError(format('Unknown hint %s', hint));
  }

  constructor(text: string) {
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
  isEqual(hint: Hint): boolean {
    return hint instanceof Hint && this.text === hint.text;
  }

  toSqlString() {
    return this.#text;
  }
}

// MySQL only
export class IndexHint {

  #type = INDEX_HINT_TYPE.use;
  #scope: INDEX_HINT_SCOPE | '' = '';
  #index: string[] = [];

  /**
   * build index hint
   *
   * @static
   * @param {string | IndexHint} hint
   * @param {string} type index hint type
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
  static build(
    hint: string | IndexHint | HintInterface | HintScopeObject,
    type?: INDEX_HINT_TYPE,
    scope?: INDEX_HINT_SCOPE,
  ): IndexHint {
    if (typeof hint === 'string' || Array.isArray(hint)) {
      return new IndexHint(hint, type, scope);
    }

    if (hint instanceof IndexHint) return hint;

    if (isPlainObject(hint)) {
      if ('index' in hint) {
        return new IndexHint(hint.index, hint.type || type, hint.scope || scope);
      }

      for (const [key, value] of Object.entries(INDEX_HINT_SCOPE)) {
        if (hint.hasOwnProperty(key)) {
          const index = hint[key as INDEX_HINT_SCOPE_TYPE];
          if (index != null) return new IndexHint(index, type, value);
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
  constructor(index: string | string[], type: INDEX_HINT_TYPE = INDEX_HINT_TYPE.use, scope: INDEX_HINT_SCOPE | '' = '') {
    this.index = index;
    this.type = type;
    this.scope = scope;
  }

  set index(values: string | string[]) {
    const indices = ([] as string[]).concat(values);

    for (const index of indices) {
      if (typeof index !== 'string' || !index.trim()) {
        throw new SyntaxError(format('Unknown index hint %s', index));
      }
    }

    this.#index = indices;
  }

  get index(): string[] {
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

  set scope(value: INDEX_HINT_SCOPE | '') {
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
  isEqual(hint: IndexHint): boolean {
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
  static merge(hints: IndexHint[]): IndexHint[] {
    if (!hints || !hints.length) return hints;

    const grouped: Record<string, string[]> = {};
    for (const hint of hints) {
      const key = `${hint.type}_${hint.scope}`;
      grouped[key] = (grouped[key] || []).concat(hint.index);
    }

    const result = [];
    for (const key in grouped) {
      const indices = grouped[key].reduce((arr: string[], index) => {
        if (!arr.includes(index)) arr.push(index);
        return arr;
      }, []);
      const [type, scope] = key.split('_');
      result.push(new IndexHint(indices, type as INDEX_HINT_TYPE, scope as INDEX_HINT_SCOPE));
    }

    return result;
  }
}

export type CommonHintsArgs = string | HintInterface | Hint | IndexHint | {
  [key in INDEX_HINT_SCOPE_TYPE]?: string | Array<string>
};
