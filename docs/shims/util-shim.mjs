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
  return JSON.stringify(a) === JSON.stringify(b);
}

export function inspect(obj) {
  return JSON.stringify(obj, null, 2);
}

const util = { format, isDeepStrictEqual, inspect };
export default util;
