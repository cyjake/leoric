'use strict';

function snakeCase(str) {
  return str.toLowerCase().replace(/(\s|^)[a-z]/g, function (match) {
      return match.toUpperCase();
  })
}

/**
 * 
 *
 * @param {*} isInstance class or instance
 * @param {*} fnName
 * @param {arguments} args
 * @param {*} target class or instance
 * @returns {
 *  useHooks: boolean
 *  args: arguments
 * }
 */
function formatArgs (isInstance, fnName, args, target) {
  let useHooks = true;
  let opts;
  let argsRes;
  switch (fnName) {
    case 'create': {
      if (isInstance) {
        // instance.create()
        opts = args[0];
        if (opts && opts.hooks === false) useHooks = false;
        argsRes = [ target, ...args ];
        break;
      }
      // class.create(values, options)
      opts = args[1];
      if (opts && opts.hooks === false) useHooks = false;
      argsRes = args;
      break;
    }
    case 'update': case 'remove': {
      if (isInstance) {
        // instance.update(opts) instance.remove(forceUpdate)
        opts = args[1];
        if (opts && opts.hooks === false) useHooks = false;
        argsRes = [ target, ...args ];
        break;
      }
      // class.update(conditions, values = {}, options) class.remove(conditions, forceDelete)
      opts = args[2];
      if (opts && opts.hooks === false) useHooks = false;
      argsRes = args;
      break;
    }
    case 'upsert': {
      if (target.sequelize) {
        // sequelize class.upsert(values, options);
        opts = args[2];
        argsRes = args;
      } else {
        // instance.upsert()
        opts = args[0];
        argsRes = [ target, ...args ];
      }
      if (opts && opts.hooks === false) useHooks = false;
      break;
    }
    case 'destroy': {
      // instance.destroy(options)
      if (isInstance) argsRes = [ target, ...args ];
      else argsRes = args; // class.destroy
      opts = args[1];
      if (opts && opts.hooks === false) useHooks = false;
      break;
    }
    default:
      throw new Error('Unsupported hook')
  }
  return {
    useHooks,
    args: argsRes,
  }
}

function getFnType (hookName) {
  const res = hookName.split(/([A-Z]\w+$)/);
  return {
    type: res[0],
    method: res[1].toLowerCase(),
  }
}

const hookableMethods = [ 'update', 'create', 'destroy', 'upsert', 'remove' ];

/**
 * Batch setup hooks
 * @param {*} target
 * @param {*} hooks
 * @returns
 */
function setupHooks(target, hooks){
  if (!hooks || !target) return;
  hookableMethods.map(methodName => {
    // instance func
    const instanceOriginFunc = target.prototype[methodName];
    if (typeof instanceOriginFunc === 'function') {
      target.prototype[methodName] = async function() {
        const { useHooks, args } = formatArgs(true, methodName, arguments, this);
        if (useHooks && hooks[`before${snakeCase(methodName)}`]) {
          await hooks[`before${snakeCase(methodName)}`].apply(this, args);
        }
        const res = await instanceOriginFunc.call(this, ...arguments);
        if (useHooks && hooks[`after${snakeCase(methodName)}`]) {
          await hooks[`after${snakeCase(methodName)}`].call(this, this, res);
        }
        return res;
      }
    }
    // class static method
    const classOriginMethod = target[methodName];
    if (typeof classOriginMethod === 'function') {
      target[methodName] = async function() {
        const { useHooks, args } = formatArgs(false, methodName, arguments, this);
        if (useHooks && hooks[`before${snakeCase(methodName)}`]) {
          await hooks[`before${snakeCase(methodName)}`].apply(this, args);
        }
        const res = await classOriginMethod.call(this, ...arguments);
        if (useHooks && hooks[`after${snakeCase(methodName)}`]) {
          await hooks[`after${snakeCase(methodName)}`].call(this, res, this);
        }
        return res;
      }
    }
  });
}

/**
 * setup hook to class
 * @param {*} target target class
 * @param {*} hookName
 * @param {*} func
 */
function setupSingleHook(target, hookName, func) {
  const { type, method } = getFnType(hookName);
  const originMethod = target[method];
  if (typeof originMethod === 'function' && hookableMethods.includes(method)) {
    target[method] = async function() {
      const { useHooks, args } = formatArgs(false, method, arguments, this);
      if (useHooks && type === 'before') {
        await func.apply(this, args);
      }
      const res = await originMethod.call(this, ...arguments);
      if (useHooks && type === 'after') {
        await func.call(this, res, this);
      }
      return res;
    }
  }
}

module.exports = {
  setupHooks,
  setupSingleHook
}
