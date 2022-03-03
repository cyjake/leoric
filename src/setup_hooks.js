'use strict';

/**
 * @typedef {Object} FormatResult
 * @property {boolean} useHooks
 * @property {Array} args
 */

/**
 *
 * @param {boolean} isInstance class or instance
 * @param {string} fnName
 * @param {array} args
 * @param {Bone} target class or instance
 * @returns {FormatResult} result
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
      break;
    }
    case 'update': case 'remove': {
      if (isInstance || (target.sequelize && isInstance)) {
        // instance.update(opts) instance.remove(forceUpdate)
        // class.update(values = {}, options) (sequelize mode only)
        opts = args[1];
        if (opts && opts.hooks === false) useHooks = false;
        argsRes = [ target, ...args ];
        break;
      }
      // class.update(conditions, values = {}, options) class.remove(conditions, forceDelete, options)
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
    // sequelize mode instance only
    case 'destroy': {
      // instance.destroy(options)
      argsRes = [ target, ...args ];
      opts = args[0];
      if (opts && opts.hooks === false) useHooks = false;
      break;
    }
    // sequelize mode only
    case 'bulkDestroy': {
      argsRes = args; // class.destroy
      opts = args[0];
      if (opts && opts.hooks === false) useHooks = false;
      break;
    }
    // bulkUpdate: sequelize mode only; bulkCreate: Bone and sequelize mode
    case 'bulkUpdate': case 'bulkCreate': {
      argsRes = args; // class.update class.bulkCreate
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
    method: res[1].replace(res[1][0], res[1][0].toLowerCase()),
  };
}

// save equals to update|create|upsert
// bulkDestroy equals to class.destroy()
// bulkUpdate equals to class.update()
const hookableMethods = [ 'update', 'create', 'destroy', 'upsert', 'remove', 'save', 'bulkDestroy', 'bulkUpdate', 'bulkCreate' ];
const hookType = {
  BEFORE: 'before',
  AFTER: 'after',
};

const hookNames = hookableMethods.reduce(function(result, method) {
  for (const prefix of Object.values(hookType)) {
    result.push(prefix + method[0].toUpperCase() + method.slice(1));
  }
  return result;
}, []);

function addHook(target, hookName, func) {
  const { type, method } = getFnType(hookName);
  const sequelize = target.sequelize;
  if (hookableMethods.includes(method)) {
    // instance func
    const instanceOriginFunc = target.prototype[method];
    target.prototype[method] = async function() {
      const { useHooks, args } = formatArgs(true, method, arguments, this);
      if (useHooks && type === hookType.BEFORE) {
        // this.change(key) or this.attributeChanged(key) should work at before update
        if (method === 'update' && typeof arguments[0] === 'object' && !arguments[0] != null) {
          const values = arguments[0];
          const fields = arguments[1] && arguments[1].fields && arguments[1].fields.length? arguments[1].fields : [];
          const originalRaw = {};
          const changeRaw = {};
          for (const name in values) {
            if ((!fields.length || fields.includes(name)) && this.hasAttribute(name)) {
              originalRaw[name] = this.attribute(name);
              this[name] = values[name];
              changeRaw[name] = this.attribute(name);
            }
          }
          await func.apply(this, args);
          // revert instance after before hooks
          Object.keys(originalRaw).forEach((key) => {
            const current = this.attribute(key);
            // raw[key] may changed in beforeUpdate hooks
            if (current !== originalRaw[key] && current !== changeRaw[key]) return;
            this.attribute(key, originalRaw[key]);
          });
        } else {
          await func.apply(this, args);
        }
      }
      const res = await instanceOriginFunc.call(this, ...arguments);
      if (useHooks && type === hookType.AFTER) {
        await func.call(this, this, res);
      }
      return res;
    };

    // class static method
    /**
     * 1、static create proxy to instance.create
     * 2、destroy(sequelize mode only) use instance hooks and bulkDestroy
     * 3、update in sequelize mode, use instance hooks and bulkUpdate
     */
    if (method === 'create' || method === 'destroy' || (sequelize && method === 'update')) return;
    const classOriginMethod = target[method];
    target[method] = async function() {
      const { useHooks, args } = formatArgs(false, method, arguments, this);
      if (useHooks && type === hookType.BEFORE) {
        await func.apply(this, args);
      }
      const res = await classOriginMethod.call(this, ...arguments);
      if (useHooks && type === hookType.AFTER) {
        await func.call(this, res, this);
      }
      return res;
    };
  }
}

/**
 * setup hook to class
 * @param {Bone} target target class
 * @param {string} hookName
 * @param {function} func
 */
function setupSingleHook(target, hookName, func) {
  const { method } = getFnType(hookName);
  if (hookableMethods.includes(method)) {
    addHook(target, hookName, func);
  }
}

module.exports = {
  setupSingleHook,
  hookNames,
};
