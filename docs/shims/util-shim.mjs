// Browser shim for Node.js 'util' module
export function format(fmt, ...args) {
  if (typeof fmt !== 'string') return String(fmt);
  let i = 0;
  return fmt.replace(/%[sdj%]/g, (match) => {
    if (match === '%%') return '%';
    if (i >= args.length) return match;
    const arg = args[i++];
    if (match === '%s') return String(arg);
    if (match === '%d') return Number(arg);
    if (match === '%j') {
      try { return JSON.stringify(arg); } catch { return '[Circular]'; }
    }
    return match;
  });
}

export function isDeepStrictEqual(a, b) {
  return deepStrictEqual(a, b);
}

function deepStrictEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object' && typeof a !== 'function') return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepStrictEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.byteLength !== b.byteLength) return false;
    for (let i = 0; i < a.byteLength; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, valA] of a) {
      if (!b.has(key) || !deepStrictEqual(valA, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const valA of a) {
      let found = false;
      for (const valB of b) {
        if (deepStrictEqual(valA, valB)) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
  }
  for (const key of keysA) {
    if (!deepStrictEqual(a[key], b[key])) return false;
  }
  return true;
}

export function inspect(obj) {
  return JSON.stringify(obj, null, 2);
}

const util = { format, isDeepStrictEqual, inspect };
export default util;
