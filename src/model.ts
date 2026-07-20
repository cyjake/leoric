import 'reflect-metadata';

import {
  AbstractBone,
  hasCheckedModelClassFields,
  isModelClassReady,
  markModelClassFieldsChecked,
  markModelClassReady,
} from './abstract_bone';

const STATIC_KEYS_TO_SKIP = new Set([ 'length', 'name', 'prototype' ]);
const COMPILED_MODEL = Symbol('leoric#compiledModel');

export class LeoricModelCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeoricModelCompilationError';
  }
}

export function isCompiledModel(Model: typeof AbstractBone): boolean {
  return Object.prototype.hasOwnProperty.call(Model, COMPILED_MODEL);
}

/** Compile a declarative model class into a constructor that never runs its fields. */
export function compileModel<T extends typeof AbstractBone>(Definition: T): T {
  if (isCompiledModel(Definition)) return Definition;

  const definitions: Array<typeof AbstractBone> = [ Definition ];
  let Base = Object.getPrototypeOf(Definition) as typeof AbstractBone;
  while (typeof Base === 'function' && !isModelClassReady(Base)) {
    definitions.push(Base);
    Base = Object.getPrototypeOf(Base) as typeof AbstractBone;
  }
  if (typeof Base !== 'function') {
    throw new LeoricModelCompilationError(`${Definition.name} must extend Bone or another Leoric model before it can be compiled.`);
  }

  const CompiledModel = class extends (Base as any) {} as typeof AbstractBone;
  for (const CurrentDefinition of definitions.reverse()) {
    copyPrototypeDescriptors(CurrentDefinition, CompiledModel);
    copyStaticDescriptors(CurrentDefinition, CompiledModel);
    copyMetadata(CurrentDefinition, CompiledModel);
  }

  Object.defineProperty(CompiledModel, 'name', {
    value: Definition.name,
    configurable: true,
  });
  Object.defineProperty(CompiledModel, COMPILED_MODEL, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  markModelClassReady(CompiledModel);
  if (hasCheckedModelClassFields(Base)) markModelClassFieldsChecked(CompiledModel);
  return CompiledModel as T;
}

function copyPrototypeDescriptors(Definition: typeof AbstractBone, Model: typeof AbstractBone): void {
  const descriptors = Object.getOwnPropertyDescriptors(Definition.prototype);
  Reflect.deleteProperty(descriptors, 'constructor');
  Object.defineProperties(Model.prototype, descriptors);
}

function copyStaticDescriptors(Definition: typeof AbstractBone, Model: typeof AbstractBone): void {
  const descriptors = Object.getOwnPropertyDescriptors(Definition) as Record<PropertyKey, PropertyDescriptor>;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === 'string' && STATIC_KEYS_TO_SKIP.has(key)) continue;
    const descriptor = descriptors[key];
    if (key === 'attributes' && descriptor.value) {
      descriptor.value = { ...descriptor.value };
    }
    Object.defineProperty(Model, key, descriptor);
  }
}

function copyMetadata(Definition: typeof AbstractBone, Model: typeof AbstractBone): void {
  for (const metadataKey of Reflect.getOwnMetadataKeys(Definition)) {
    Reflect.defineMetadata(metadataKey, Reflect.getOwnMetadata(metadataKey, Definition), Model);
  }
  for (const metadataKey of Reflect.getOwnMetadataKeys(Definition.prototype)) {
    Reflect.defineMetadata(metadataKey, Reflect.getOwnMetadata(metadataKey, Definition.prototype), Model.prototype);
  }
}
