export class Hint {
  static build(hint: Hint | { index: string } | string): typeof Hint;

  constructor(text: string);

  set text(value: string);

  get text(): string;

  /**
   *
   * @param {Hint} hint
   * @returns {boolean}
   * @memberof Hint
   */
  isEqual(hint: Hint): boolean;

  toSqlString(): string;
}

/**
 * @enum
 */
export enum INDEX_HINT_TYPE {
  use = 'use',
  force = 'force',
  ignore = 'ignore'
}

/**
 * @enum
 */
export enum INDEX_HINT_SCOPE {
  join = 'join',
  orderBy = 'order by',
  groupBy = 'group by',
}

export class IndexHint {
  /**
   * build index hint
   *
   * @static
   * @param {object | string} obj
   * @param {string} indexHintType
   * @returns {IndexHint}
   * @example
   * build('idx_title')
   * build('idx_title', INDEX_HINT_TYPE.force, INDEX_HINT_SCOPE.groupBy)
   * build({
   *   index: 'idx_title',
   *   type: INDEX_HINT_TYPE.ignore,
   *   scope: INDEX_HINT_SCOPE.groupBy,
   * })
   */
  static build(hint: string | Array<string> | { index: string, type?: INDEX_HINT_TYPE, scope?: INDEX_HINT_SCOPE }, type?: INDEX_HINT_TYPE, scope?: INDEX_HINT_SCOPE): IndexHint;
  
  /**
   * Creates an instance of IndexHint.
   * @param {Array<string> | string} index
   * @param {INDEX_HINT_TYPE} type
   * @param {INDEX_HINT_SCOPE?} scope
   * @memberof IndexHint
   */
  constructor(index: string, type?: INDEX_HINT_TYPE, scope?: INDEX_HINT_SCOPE);
  
    set index(values: string | Array<string>);
  
    get index(): Array<string>;
  
    set type(value: string);
  
    get type(): string;
  
    set scope(value: string);
  
    get scope(): string;
  
    toSqlString(): string;
  
    /**
     *
     * @param {IndexHint} hint
     * @returns {boolean}
     * @memberof IndexHint
     */
    isEqual(hint: IndexHint): boolean;
  
    /**
     * @static
     * @param {IndexHint} hints
     * @returns {Array<IndexHint>}
     * @memberof IndexHint
     */
    static merge(hints: Array<IndexHint>): Array<IndexHint>;
}
