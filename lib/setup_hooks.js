'use strict';

/**
 *
 * @param {*} isInstance class or instance
 * @param {*} fnName
 * @param {arguments} args
 * @param {*} target class or instance
 * @return {
 *  useHooks: boolean
 *  args: arguments
 * }
 */
function formatArgs(isInstance, fnName, args, target) {
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
    case 'save': {
      // instance.save()
      opts = args[0];
      if (opts && opts.hooks === false) useHooks = false;
      argsRes = [ target, ...args ];
      break;
    }
    default:
      throw new Error('Unsupported hook');
  }
  return {
    useHooks,
    args: argsRes,
  };
}

function getFnType(hookName) {
  const res = hookName.split(/([A-Z]\w+$)/);
  return {
    type: res[0],
    method: res[1].toLowerCase(),
  };
}

const hookableMethods = [ 'update', 'create', 'destroy', 'upsert', 'remove', 'save' ]; // save equals to update|create|upsert
const hookType = {
  BEFORE: 'before',
  AFTER: 'after',
};
/**
 * Batch setup hooks
 * @param {*} target
 * @param {*} hooks
 * @return
 */
function setupHooks(target, hooks) {
  if (!hooks || !target) return;
  Object.keys(hooks).map(hookName => {
    const { type, method } = getFnType(hookName);
    if (hookableMethods.includes(method)) {
      // instance func
      const instanceOriginFunc = target.prototype[method];
      target.prototype[method] = async function() {
        const { useHooks, args } = formatArgs(true, method, arguments, this);
        if (useHooks && type === hookType.BEFORE) {
          await hooks[hookName].apply(this, args);
        }
        const res = await instanceOriginFunc.call(this, ...arguments);
        if (useHooks && type === hookType.AFTER) {
          await hooks[hookName].call(this, this, res);
        }
        return res;
      };

      // class static method
      const classOriginMethod = target[method];
      target[method] = async function() {
        const { useHooks, args } = formatArgs(false, method, arguments, this);
        if (useHooks && type === hookType.BEFORE) {
          await hooks[hookName].apply(this, args);
        }
        const res = await classOriginMethod.call(this, ...arguments);
        if (useHooks && type === hookType.AFTER) {
          await hooks[hookName].call(this, res, this);
        }
        return res;
      };
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
      if (useHooks && type === hookType.BEFORE) {
        await func.apply(this, args);
      }
      const res = await originMethod.call(this, ...arguments);
      if (useHooks && type === hookType.AFTER) {
        await func.call(this, res, this);
      }
      return res;
    };
  }
}

module.exports = {
  setupHooks,
  setupSingleHook,
};
