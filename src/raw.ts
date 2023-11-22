export default class Raw {
  value: string;

  // consumed in expr_formatter.js
  type = 'raw';

  constructor(value: string) {
    if (typeof value !== 'string') {
      throw new Error('invalid type of raw value');
    }
    this.value = value;
  }

  toString() {
    return this.value;
  }

  static build(value: string) {
    return new Raw(value);
  }
}
