import { performance } from 'perf_hooks';
import { IS_LEORIC_BONE } from '../constants';

export function isPlainObject(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function compose(...funcs: ((...args: unknown[]) => unknown)[]) {
  if (funcs.length === 0) return (arg: unknown) => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reverse().reduce((a, b) => (...args) => b(a(...args)));
}

export function getPropertyNames(obj: unknown): string[] {
  if (obj == null) return [];
  const propertyNames = [];
  // avoid to deep clone obj
  let muteObj = Object.getPrototypeOf(obj);
  do {
    propertyNames.push(...Object.keys(muteObj));
    muteObj = Object.getPrototypeOf(muteObj);
    // the loop while reach to Leoric#Bone, filter __proto__, Object.getPrototypeOf(Bone) = {}, ({}).constructor.name = 'Object'
  } while (muteObj && muteObj.constructor.name !== 'Object');
  // get own properties
  propertyNames.push(...Object.keys(obj));
  // get unique properties' names
  const propertyNamesSet = new Set(propertyNames);
  return Array.from(propertyNamesSet);
}

// microseconds to millisecond, 10.456
export function calculateDuration(starttime: number): number {
  return Math.floor((performance.now() - starttime) * 1000) / 1000;
}

export const logger = ['log', 'warn', 'debug', 'info', 'error'].reduce((
  result: Record<string, (...args: unknown[]) => void>,
  key
) => {
  result[key] = function(...args: unknown[]) {
    console[key as 'log' | 'warn' | 'debug' | 'info' | 'error']('[leoric]', ...args);
  };
  return result;
}, {});

/**
 * Check if cls is subclass of Bone
 * @param cls
 */
export function isBone(bone: unknown): boolean {
  if (!bone || (typeof bone !== 'object' && typeof bone !== 'function')) return false;
  const metaValue = Reflect.getMetadata(IS_LEORIC_BONE, bone);
  return metaValue === true;
}
