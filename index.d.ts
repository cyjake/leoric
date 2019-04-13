
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

interface SpellOptions {
  command?: string;
  columns: Object[];
  table: ExprIdentifier;
  whereConditions: ExprOperator[];
  groups: (ExprIdentifier | ExprFunc)[];
  orders: (ExprIdentifier | ExprFunc)[];
  havingCondtions: ExprOperator[];
  joins: Object;
  skip: number;
  scopes: Function[];
  subqueryIndex: number;
  rowCount: 0;
}

type SpellFactory = (spell: Spell) => Promise<null | number | Collection<Bone> | ResultSet>;

type OrderOptions = { [name: string]: 'desc' | 'asc' };

type SetOptions = { [key: string]: Literal };

type WithOptions = {
  [qualifier: string]: { select: string[], throughRelation: string }
}

declare class Spell {
  constructor(Model: Bone, factory: SpellFactory, opts: SpellOptions);

  $select(...names: string[]): this & Promise<Bone>;
  $insert(opts: SetOptions): this & Promise<number>;
  $update(opts: SetOptions): this & Promise<number>;
  $upsert(opts: SetOptions): this & Promise<number>;
  $delete(): this & Promise<number>;

  $from(table: string | Spell): this & Promise<Bone>;

  $with(opts: WithOptions): this & Promise<Bone>;
  $with(...qualifiers: string[]): this & Promise<Bone>;

  $join(Model: Bone, onConditions: string, ...values: Literal[]): this & Promise<Bone>;
  $join(Model: Bone, onConditions: WhereConditions): this & Promise<Bone>;

  $where(conditions: string, ...values: Literal[]): this & Promise<Bone>;
  $where(conditions: WhereConditions): this & Promise<Bone>;

  $group(...names: string[]): this & Promise<ResultSet>;
  $having(conditions: WhereConditions): this & Promise<ResultSet>;

  $order(name: string, order?: 'desc' | 'asc'): this & Promise<Bone>;
  $order(opts: OrderOptions): this & Promise<Bone>;

  $offset(skip: number): this & Promise<Bone>;
  $limit(skip: number): this & Promise<Bone>;

  $count(name?: string): this & Promise<ResultSet>;
  $average(name?: string): this & Promise<ResultSet>;
  $minimum(name?: string): this & Promise<ResultSet>;
  $maximum(name?: string): this & Promise<ResultSet>;
  $sum(name?: string): this & Promise<ResultSet>;

  batch(size?: number): AsyncIterable<Bone>;

  toSqlString(): string;
  toString(): string;
}

type Pool = Object;

type Literal = null | boolean | number | string | Date

type OperatorCondition = {
  [key in '$eq' | '$ne']?: Literal;
} & {
  [key in '$in' | '$nin' | '$notIn']?: Literal[] | Set<Literal>;
} & {
  [key in '$like' | '$notLike']?: Literal[];
} & {
  [key in '$gt' | '$gte' | '$lt' | '$lte']?: number;
} & {
  [key in '$between' | '$notBetween']?: [number, number] | [Date, Date];
};

interface WhereConditions {
  [key: string]: Literal | Literal[] | OperatorCondition;
}

interface Attributes {
  [key: string]: Literal;
}

interface AttributeMeta {
  type: JSON;
}

interface RelateOptions {
  className?: string;
  foreignKey?: string;
}

type ResultSet = Attributes[] | { [qualifier: string]: Attributes }[]

declare class Collection<Bone> extends Array<Bone> {
  save(): Promise<void>;
  toJSON(): Object[];
  toObject(): Object[];
}

type Query = Spell & Promise<Collection<Bone>>;

declare class Bone {
  static pool: Pool;
  static models: Bone[];
  static table: string;
  static aliasName: string;
  static primaryKey: string;

  static shardingKey: string;
  static physicTables: string[];

  static attribute(name: string, meta: AttributeMeta): void;
  static renameAttribute(originalName: string, newName: string): void;
  static hasOne(name: string, opts?: RelateOptions): void;
  static hasMany(name: string, opts?: RelateOptions): void;
  static belongsTo(name: string, opts?: RelateOptions): void;

  static create(attributes: Attributes): Promise<Bone>;

  static find(whereConditions: string, ...values: Literal[]): Query;
  static find(whereConditions: WhereConditions): Query;
  static find(): Query;

  static all: Query;
  static unscoped: Query;

  static findOne(whereConditions: string, ...values: Literal[]): Spell & Promise<Bone | null>;
  static findOne(whereConditions: WhereConditions): Spell & Promise<Bone | null>;
  static findOne(): Spell & Promise<Bone | null>;

  static get(index: number): Spell & Promise<Bone | null>;
  static first: Spell & Promise<Bone | null>;
  static last: Spell & Promise<Bone | null>;

  static include(...names: string[]) : Query;

  static select(...names: string[]): Query;
  static select(filter: (name: string) => boolean): Query;

  static join(Model: Bone, onConditions: string, ...values: Literal[]): Query;
  static join(Model: Bone, onConditions: WhereConditions): Query;

  static where(whereConditions: string, ...values: Literal[]): Query;
  static where(whereConditions: WhereConditions): Query;

  static group(...names: string[]): Spell & Promise<ResultSet>;

  static order(name: string, order?: 'desc' | 'asc'): Query;
  static order(opts: OrderOptions): Query;

  static count(name?: string): Spell & Promise<ResultSet>;
  static average(name?: string): Spell & Promise<ResultSet>;
  static minimum(name?: string): Spell & Promise<ResultSet>;
  static maximum(name?: string): Spell & Promise<ResultSet>;
  static sum(name?: string): Spell & Promise<ResultSet>;

  static update(whereConditions: WhereConditions): Spell & Promise<number>;

  static remove(whereConditions: WhereConditions, forceDelete?: boolean): Spell & Promise<number>;

  static transaction(callback: GeneratorFunction): Promise<void>;

  constructor(attributes: Attributes);

  attribute(name: string, value: Literal): void;
  attribute(name: string): Literal;
  attributeWas(name: string): Literal;
  attributeChanged(name: string): boolean;

  save(): Promise<this>;
  remove(forceDelete?: boolean): number;
}

interface ConnectOptions {
  client?: 'mysql' | 'mysql2' | 'pg';
  host: string;
  user: string;
  database: string;
  models: string | Bone[];
}

/**
 * Connect models to database.
 * @example
 * connect({
 *   host: 'localhost',
 *   user: 'root',
 *   database: 'leoric',
 *   models: path.join(__dirname, 'models')
 * })
 */
export function connect(opts: ConnectOptions): Promise<Pool>;
