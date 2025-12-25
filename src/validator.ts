// @ts-expect-error validator has no type definitions
import Validator from 'validator';
import { isPlainObject } from './utils';

const ERR_NAME = 'LeoricValidateError';

export class LeoricValidateError extends Error {
  constructor(validator: string, field: string, message?: string, validateValue?: any) {
    const errorMessage = message || `Validation ${validator}${validateValue !== undefined ? ':' + String(validateValue) : ''} on ${field} failed`;
    super(errorMessage);
    this.name = ERR_NAME;
  }
}

function regex(str: string, pattern: string | RegExp, modifiers?: string): boolean {
  str += '';
  if (typeof pattern === 'string') {
    pattern = new RegExp(pattern, modifiers);
  }
  const result = str.match(pattern as RegExp);
  return result ? result.length > 0 : false;
}

interface ValidatorMap {
  [key: string]: (...args: any[]) => boolean;
}

const validators: ValidatorMap = {
  ...Validator,
  notIn(str: string, values: string[]): boolean {
    return !Validator.isIn(str, values);
  },
  notNull(value: any): boolean {
    return value != null;
  },
  isNull: Validator.isEmpty,
  min(value: any, target: number): boolean {
    const number = parseFloat(value);
    return isNaN(number) || number >= target;
  },
  max(value: any, target: number): boolean {
    const number = parseFloat(value);
    return isNaN(number) || number <= target;
  },
  contains(str: string, elem: string): boolean {
    return !!elem && str.includes(elem);
  },
  notContains(str: string, elem: string): boolean {
    return !Validator.contains(str, elem);
  },
  regex,
  notRegex(str: string, pattern: string | RegExp, modifiers?: string): boolean {
    return !regex(str, pattern, modifiers);
  },
  is(str: string, pattern: string | RegExp, modifiers?: string): boolean {
    return regex(str, pattern, modifiers);
  },
  notEmpty(str: string): boolean {
    return /[^\s]/.test(str);
  },
  len(str: string, min: number, max?: number): boolean {
    return Validator.isLength(str, { min, max });
  },
};

interface Attribute {
  name: string;
  validate: Record<string, any>;
  defaultValue?: any;
}

interface BoneContext {
  getRaw?: (field: string) => any;
  _setRaw?: (field: string, value: any) => void;
}

/**
 * Execute a validator on a Bone instance
 * @param ctx context
 * @param name validate name
 * @param attribute
 * @param setValue
 */
export function executeValidator(
  ctx: BoneContext,
  name: string,
  attribute: Attribute,
  setValue?: any,
): void {
  const { name: field, validate, defaultValue } = attribute;
  const validateArgs = validate[name];
  const value = setValue != null ? setValue : defaultValue;
  if (typeof validateArgs === 'function') {
    let needToRevert = false;
    let originValue: any;
    // custom validator
    try {
      // Make sure this[name] callable and not return undefined or previous value (instance only) during validator executing while updating or saving
      if (ctx.getRaw) {
        originValue = ctx.getRaw(field);
        ctx._setRaw?.(field, value);
        needToRevert = true;
      }
      const execRes = validateArgs.call(ctx, value);
      if (execRes === false) throw new LeoricValidateError(name, field);
    } catch (err) {
      (err as any).name = ERR_NAME;
      throw err;
    } finally {
      // revert value (instance only)
      if (needToRevert) ctx._setRaw?.(field, originValue);
    }
  } else {
    const validator = validators[name];
    if (typeof validator !== 'function') throw new LeoricValidateError(`Invalid validator function: ${name}`, '');
    let args: any = validateArgs;
    let msg: string | undefined;
    if (isPlainObject(validateArgs)) {
      if ('args' in validateArgs) args = validateArgs.args;
      msg = validateArgs.msg;
    }

    if (['true', 'false'].indexOf(String(validateArgs)) >= 0) {
      if (validator.call(ctx, value == null ? value : String(value)) !== args) {
        throw new LeoricValidateError(name, field, msg, !validateArgs ? validateArgs : undefined);
      }
      return;
    }
    let callableArgs: any[] = [String(value)];
    callableArgs = callableArgs.concat(args);
    if (!validator.apply(ctx, callableArgs)) throw new LeoricValidateError(name, field, msg);
  }
}

export default { LeoricValidateError, executeValidator };
