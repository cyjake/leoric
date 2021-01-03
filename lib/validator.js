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
};

/**
 *
 * @param {Bone} ctx context
 * @param {string} name validate name
 * @param {string} field
 * @param {*} validateValues
 * @param {*} value
 */
function executeValidator(ctx, name, field, validateValues, value) {
  if (typeof validateValues === 'function') {
    // custom validator
    try {
      // make sure this[name] callable and not return undefined or previous value
      ctx.raw[field] = value;
      const execRes = validateValues.call(ctx, value);
      if (execRes === false) throw new LeoricValidateError(name, field);
    } catch (err) {
      // revert value
      ctx.raw[field] = ctx.rawInitial[field];
      throw err;
    }
    // revert value
    ctx.raw[field] = ctx.rawInitial[field];
  } else {
    const validator = validators[name];
    if (typeof validator !== 'function') throw new LeoricValidateError(`Invalid validator function: ${name}`);
    let args = validateValues;
    let msg;
    if (isPlainObject(validateValues)) {
      if ('args' in validateValues) args = validateValues.args;
      msg = validateValues.msg || msg;
    }

    if (Validator.isBoolean(String(validateValues))) {
      if (validator.call(ctx, value == null? value : String(value)) !== args) {
        throw new LeoricValidateError(name, field, msg, !validateValues? validateValues : undefined);
      }
      return;
    }
    if (!validator.call(ctx, String(value), ...args)) throw new LeoricValidateError(name, field, msg);
  }
}

module.exports = {
  LeoricValidateError,
  executeValidator,
};
