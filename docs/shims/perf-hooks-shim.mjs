// Browser shim for Node.js 'perf_hooks' module
export const performance = globalThis.performance || {
  now() { return Date.now(); }
};
