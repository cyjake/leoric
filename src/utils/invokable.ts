/**
 * Make class/function able to be invoked without new
 * @param DataType
 */
function invokable<T extends { new(...args: any[]): any }>(DataType: T): any {
  return new Proxy(DataType, {
    // STRING(255)
    apply(target: T, thisArg: any, args: any[]): any {
      return new target(...args);
    },

    // new STRING(255)
    construct(target: T, args: any[]): any {
      return new target(...args);
    },

    // INTEGER.UNSIGNED
    get(target: T, p: string | symbol): any {
      // ref: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/length
      // The length property indicates the number of parameters expected by the function.
      // invokable INTEGER.toSqlString() will default to return "INTEGER(1)"
      return (target as any).hasOwnProperty(p) ? (target as any)[p] : new target()[p as any];
    },
  });
}

export default invokable;
