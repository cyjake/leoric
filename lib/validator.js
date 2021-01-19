'use strict';

const Validator = require('validator');

const { isPlainObject } = require('./utils');

class LeoricValidateError extends Error {
  constructor(validator, field, message, validateValue) {
    const errorMessage = message || `Validation ${validator}${validateValue !== undefined? ':' + String(validateValue) : ''} on ${field} failed`;
    super(errorMessage);
    this.name = 'LeoricValidateError';
  }
}

const validators = {
  ...Validator,
  notIn(str, values) {
    return !Validator.isIn(str, values);
  },
  notNull(value) {
    return value != null;
  },
  isNull: Validator.isEmpty,
  min(value, target) {
    const number = parseFloat(value);
    return isNaN(number) || number >= target;
  },
  max(value, target) {
    const number = parseFloat(value);
    return isNaN(number) || number <= target;
  },
  contains(str, elem) {
    return !!elem && str.includes(elem);
  },
  notContains(str, elem) {
    return !this.contains(str, elem);
  },
  regex(str, pattern, modifiers) {
    str += '';
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }
    const result = str.match(pattern);
    return result ? result.length > 0 : false;
  },
  notRegex(str, pattern, modifiers) {
    return !this.regex(str, pattern, modifiers);
  },
  is(str, pattern, modifiers) {
    return this.regex(str, pattern, modifiers);
  },
  notEmpty(str) {
    return !str.match(/^[\s\t\r\n]*$/);
  },
};

/**
 *
 * @param {Bone} ctx context
 * @param {string} name validate name
 * @param {object} attribute
 * @param {*} value
 */
function executeValidator(ctx, name, attribute, setValue) {
  const { name: field, validate, defaultValue } = attribute;
  const validateArgs = validate[name];

  const value = setValue != null? setValue : defaultValue;
  if (typeof validateArgs === 'function') {
    let needToRevert = false;
    // custom validator
    try {
      // Make sure this[name] callable and not return undefined or previous value (instance only) during validator executing while updating or saving
      if (ctx.raw) {
        needToRevert = true;
        ctx.raw[field] = value;
      }
      const execRes = validateArgs.call(ctx, value);
      if (execRes === false) throw new LeoricValidateError(name, field);
    } catch (err) {
      // revert value (instance only)
      if (ctx.raw && needToRevert) ctx.raw[field] = ctx.rawSaved[field];
      throw err;
    }
    // revert value (instance only)
    if (ctx.raw && needToRevert) ctx.raw[field] = ctx.rawSaved[field];
  } else {
    const validator = validators[name];
    if (typeof validator !== 'function') throw new LeoricValidateError(`Invalid validator function: ${name}`);
    let args = validateArgs;
    let msg;
    if (isPlainObject(validateArgs)) {
      if ('args' in validateArgs) args = validateArgs.args;
      msg = validateArgs.msg || msg;
    }

    if (['true', 'false'].indexOf(String(validateArgs)) >= 0) {
      if (validator.call(ctx, value == null? value : String(value)) !== args) {
        throw new LeoricValidateError(name, field, msg, !validateArgs? validateArgs : undefined);
      }
      return;
    }
    let callableArgs = [ String(value) ];
    callableArgs = callableArgs.concat(args);
    if (!validator.apply(ctx, callableArgs)) throw new LeoricValidateError(name, field, msg);
  }
}

module.exports = {
  LeoricValidateError,
  executeValidator,
};
