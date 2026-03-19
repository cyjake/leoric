import { HookFunc } from '../setup_hooks';
import Raw from '../raw';
import { AbstractBone } from '../abstract_bone';
import type Spell from '../spell';
import type { Collection, Literal, QueryOptions } from '../types/common';

type BoneCtor = typeof AbstractBone;

type SequelizeLikeBone = BoneCtor & {
  sequelize: boolean;
  Instance: BoneCtor;
  rawAttributes: Record<string, any>;
  _scopes: Record<string, any>;
  _scope: any;
  addHook(hookName: string, fnNameOrFunc: string | HookFunc, func?: HookFunc): void;
  addScope(name: string, scope: any, options?: { override?: boolean }): void;
  scope(name?: any, ...args: any[]): any;
  unscoped(): any;
  setScope(scope: any): any;
  init(attributes: any, opts?: any, descriptors?: any): void;
  aggregate(attribute: string, aggregateFunction: string, options?: any): Promise<any>;
  count(options?: any): Spell<any, number>;
  decrement(fields: string | string[] | Record<string, number>, options?: any): Spell<any, number>;
  destroy(options?: any): Promise<number>;
  bulkDestroy(options?: any): Spell<any, number>;
  findAll(options?: any): Spell<any, Collection<any>>;
  find(options?: any): Spell<any, any | null>;
  findAndCountAll(options?: any): Promise<{ count: number; rows: any[] }>;
  findByPk(value: Literal, options?: any): Spell<any, any | null>;
  findCreateFind(options?: any): Promise<any | null>;
  findOne(options?: any): Spell<any, any | null>;
  findOrBuild(options?: any): Promise<[any, boolean]>;
  findOrCreate(options?: any): Promise<[any, boolean]>;
  increment(fields: string | string[] | Record<string, number>, options?: any): Spell<any, number>;
  max(attribute: string, options?: any): Promise<any>;
  min(attribute: string, options?: any): Promise<any>;
  restore(options?: any): Spell<any, number>;
  sum(attribute: string, options?: any): Promise<number>;
  update(values: Record<string, Literal>, options?: any): Promise<[number, any[]]>;
  bulkUpdate(values: Record<string, Literal>, options?: any): Spell<any, number>;
  upsert(values: Record<string, Literal>, options?: QueryOptions): Promise<any>;
  with(...args: any[]): any;
};

declare const SequelizeBone: SequelizeLikeBone;

export default function sequelize(Bone: typeof AbstractBone): SequelizeLikeBone;
export { SequelizeBone };

export type { Raw };
