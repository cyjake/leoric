import {
  Literal, command, Raw, Connection,
  ResultSet, QueryResult,
  QueryOptions, SetOptions, WithOptions,
  Collection, WhereConditions, OrderOptions, BoneColumns, OnConditions,
} from './types/common';
import { AbstractBone } from './types/abstract_bone';
import { Hint, IndexHint, CommonHintsArgs, HintInterface } from './hint';

interface SpellBookFormatStandardResult {
  sql?: string;
  values?: Array<Literal> | {
    [key: string]: Literal
  };
  [key: string]: Literal
}

interface Join {
  [key: string]: {
    Model: typeof AbstractBone;
    on: ExprBinaryOperator
  }
}

interface ExprIdentifier {
  type: 'id';
  value: string;
  qualifiers?: string[]
}

interface ExprFunc {
  type: 'func';
  name: string;
  args: (ExprLiteral | ExprIdentifier)[];
}

interface ExprLiteral {
  type: 'literal';
  value: Literal;
}

interface ExprBinaryOperator {
  type: 'op';
  name: string;
  args: [ExprIdentifier, ExprLiteral, ExprLiteral];
}

interface ExprTernaryOperator {
  type: 'op';
  name: 'between' | 'not between';
  args: [ExprIdentifier, ExprLiteral, ExprLiteral];
}

type ExprOperator = ExprBinaryOperator | ExprTernaryOperator;
type SpellColumn = ExprIdentifier | Raw;

type ScopeFunction = (spell: SpellMeta) => void;

interface SpellOptions {
  command?: command;
  columns: SpellColumn[];
  table: ExprIdentifier;
  whereConditions: ExprOperator[];
  groups: (ExprIdentifier | ExprFunc)[];
  orders: (ExprIdentifier | ExprFunc)[];
  havingCondtions: ExprOperator[];
  joins: Join;
  skip: number;
  scopes: ScopeFunction[];
  subqueryIndex: number;
  rowCount?: number;
  connection?: Connection;
  sets?: { [key: string]: Literal } | { [key: string]: Literal }[];
  hints?: Array<Hint | IndexHint>;
}

export interface SpellMeta extends SpellOptions {
  Model: typeof AbstractBone;
}

export type SpellBookFormatResult<T> = SpellBookFormatStandardResult | T;

export class Spellbook {

  format(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;

  formatInsert(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;
  formatSelect(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;
  formatUpdate(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;
  formatDelete(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;
  formatUpsert(spell: SpellMeta): SpellBookFormatResult<SpellBookFormatStandardResult>;
}

export class Spell<T extends typeof AbstractBone, U = InstanceType<T> | Collection<InstanceType<T>> | ResultSet<T> | number | null> extends Promise<U> {
  constructor(Model: T, opts: SpellOptions);

  Model: T;
  connection: Connection;

  command: string;
  scopes: Array<ScopeFunction>;

  select(...names: Array<string | Raw> | Array<(name: string) => boolean>): Spell<T, U>;
  insert(opts: SetOptions<T>): Spell<T, QueryResult>;
  update(opts: SetOptions<T>): Spell<T, QueryResult>;
  upsert(opts: SetOptions<T>): Spell<T, QueryResult>;
  delete(): Spell<T, QueryResult>;

  from(table: string | Spell<T>): Spell<T, U>;

  with(opts: WithOptions): Spell<T, U>;
  with(...qualifiers: string[]): Spell<T, U>;

  join<V extends typeof AbstractBone>(Model: V, onConditions: string, ...values: Literal[]): Spell<T, U>;
  join<V extends typeof AbstractBone>(Model: V, onConditions: OnConditions<T>): Spell<T, U>;

  $where(conditions: WhereConditions<T>): this;
  $where(conditions: string, ...values: Literal[]): this;
  $where(conditions: Raw, ...values: Literal[]): this;
  where(conditions: WhereConditions<T>): Spell<T, U>;
  where(conditions: string, ...values: Literal[]): Spell<T, U>;
  where(conditions: Raw, ...values: Literal[]): Spell<T, U>;

  orWhere(conditions: WhereConditions<T>): Spell<T, U>;
  orWhere(conditions: string, ...values: Literal[]): Spell<T, U>;
  orWhere(conditions: Raw, ...values: Literal[]): Spell<T, U>;

  group(...names: Array<string | Raw>): Spell<T, ResultSet<T>>;

  having(conditions: string, ...values: Literal[]): Spell<T, ResultSet<T>>;
  having(conditions: WhereConditions<T>): Spell<T, ResultSet<T>>;

  orHaving(conditions: string, ...values: Literal[]): Spell<T, ResultSet<T>>;
  orHaving(conditions: WhereConditions<T>): Spell<T, ResultSet<T>>;

  order(name: string, order?: 'desc' | 'asc'): Spell<T, U>;
  order(opts: OrderOptions<T>): Spell<T, U>;

  $offset(skip: number): Spell<T, U>;
  offset(skip: number): Spell<T, U>;

  $limit(rowCount: number): Spell<T, U>;
  limit(rowCount: number): Spell<T, U>;

  // aggregator(name: string) for Model.first/all/last.aggregator(name) because of ts(2526)
  count(name?: BoneColumns<T>): Spell<T, Extract<U, ResultSet<T> | number>>;
  count(name?: Raw | string): Spell<T, Extract<U, ResultSet<T> | number>>;

  average(name?: BoneColumns<T>): Spell<T, Extract<U, ResultSet<T> | number>>;
  average(name?: Raw | string): Spell<T, Extract<U, ResultSet<T> | number>>;

  minimum(name?: BoneColumns<T>): Spell<T, Extract<U, ResultSet<T> | number>>;
  minimum(name?: Raw | string): Spell<T, Extract<U, ResultSet<T> | number>>;

  maximum(name?: BoneColumns<T>): Spell<T, Extract<U, ResultSet<T> | number>>;
  maximum(name?: Raw | string): Spell<T, Extract<U, ResultSet<T> | number>>;

  sum(name?: BoneColumns<T>): Spell<T, Extract<U, ResultSet<T> | number>>;
  sum(name?: Raw | string): Spell<T, Extract<U, ResultSet<T> | number>>;

  batch(size?: number): AsyncIterable<T>;

  increment(name: BoneColumns<T>, by?: number, options?: QueryOptions): Spell<T, QueryResult>;
  increment(name: string, by?: number, options?: QueryOptions): Spell<T, QueryResult>;

  decrement(name: BoneColumns<T>, by?: number, options?: QueryOptions): Spell<T, QueryResult>;
  decrement(name: string, by?: number, options?: QueryOptions): Spell<T, QueryResult>;

  toSqlString(): string;
  toString(): string;

  all: Spell<T, U>;
  first: Spell<T, InstanceType<T> | null>;
  last: Spell<T, InstanceType<T> | null>;
  get(index: number): Spell<T, InstanceType<T> | null>;

  unscoped: Spell<T, U>;
  unparanoid: Spell<T, U>;

  optimizerHints(...hints: Array<string | HintInterface | Hint | IndexHint>): Spell<T, U>;
  useIndex(...hints: Array<CommonHintsArgs>): Spell<T, U>;
  forceIndex(...hints: Array<CommonHintsArgs>): Spell<T, U>;
  ignoreIndex(...hints: Array<CommonHintsArgs>): Spell<T, U>;
}
