'use strict';

const { performance } = require('perf_hooks');
const { Bone, DataTypes } = require('../lib');
const AbstractDriver = require('../lib/drivers/abstract').default;
const { hasLoadedAttributesKey } = require('../lib/abstract_bone');

const DEFAULT_ITERATIONS = 100000;
const DEFAULT_RUNS = 7;
const DEFAULT_WARMUP_RUNS = 3;

const iterations = readPositiveInt('ITERATIONS', DEFAULT_ITERATIONS);
const runs = readPositiveInt('RUNS', DEFAULT_RUNS);
const warmupRuns = readPositiveInt('WARMUP_RUNS', DEFAULT_WARMUP_RUNS);

Bone.driver = new AbstractDriver();
Bone.options = { define: {} };

const ATTRIBUTES = {
  name: DataTypes.STRING,
  title: DataTypes.STRING,
  email: DataTypes.STRING,
  status: DataTypes.INTEGER,
  level: DataTypes.INTEGER,
  views: DataTypes.INTEGER,
  score: DataTypes.INTEGER,
  bio: DataTypes.TEXT,
};

const COLUMNS = [
  { columnName: 'id', columnType: 'bigint', dataType: 'bigint', isNullable: 'NO' },
  { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
  { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
  { columnName: 'email', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
  { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
  { columnName: 'level', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
  { columnName: 'views', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
  { columnName: 'score', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
  { columnName: 'bio', columnType: 'text', dataType: 'text', isNullable: 'YES' },
];

const VALUES = {
  name: 'Ada',
  title: 'Principal Engineer',
  email: 'ada@example.com',
  status: 1,
  level: 42,
  views: 1024,
  score: 9001,
  bio: 'Analytical engine notes',
};

const ROW = {
  id: 1,
  name: VALUES.name,
  title: VALUES.title,
  email: VALUES.email,
  status: VALUES.status,
  level: VALUES.level,
  views: VALUES.views,
  score: VALUES.score,
  bio: VALUES.bio,
};

class DirectModel extends Bone {}
prepareModel(DirectModel, false);

class ProxyModel extends Bone {}
prepareModel(ProxyModel, true);

class DirectFieldModel extends DirectModel {
  name = undefined;
  status = undefined;
  title = undefined;
}

class ProxyFieldModel extends ProxyModel {
  name = undefined;
  status = undefined;
  title = undefined;
}

const benchmarks = [
  {
    name: 'construct with values',
    direct: () => new DirectModel(VALUES),
    proxy: () => new ProxyModel(VALUES),
  },
  {
    name: 'instantiate row',
    direct: () => DirectModel.instantiate(ROW),
    proxy: () => ProxyModel.instantiate(ROW),
  },
  {
    name: 'construct + native undefined fields',
    direct: () => new DirectFieldModel(VALUES),
    proxy: () => new ProxyFieldModel(VALUES),
    validate: validateNativeClassFields,
  },
  {
    name: 'getter hot path',
    direct: buildGetRunner(new DirectModel(VALUES)),
    proxy: buildGetRunner(new ProxyModel(VALUES)),
  },
  {
    name: 'setter hot path',
    direct: buildSetRunner(new DirectModel(VALUES)),
    proxy: buildSetRunner(new ProxyModel(VALUES)),
  },
  {
    name: 'defineProperty attribute initializer',
    direct: buildDefineAttributeRunner(new DirectModel(VALUES)),
    proxy: buildDefineAttributeRunner(new ProxyModel(VALUES)),
    validate: validateDefinePropertyInterception,
  },
  {
    name: 'defineProperty non-attribute',
    direct: buildDefineNonAttributeRunner(new DirectModel(VALUES)),
    proxy: buildDefineNonAttributeRunner(new ProxyModel(VALUES)),
  },
];

console.log(`Leoric Proxy class-fields benchmark`);
console.log(`Node ${process.version}, ${iterations.toLocaleString()} iterations, ${runs} measured runs, ${warmupRuns} warmup runs`);
console.log(`GC before samples: ${typeof global.gc === 'function' ? 'yes' : 'no'}`);
console.log('');
console.log(`${padRight('case', 38)} ${padLeft('direct ops/s', 14)} ${padLeft('proxy ops/s', 14)} ${padLeft('direct ns/op', 14)} ${padLeft('proxy ns/op', 14)} ${padLeft('proxy/direct', 14)}`);
console.log('-'.repeat(113));

for (const benchmark of benchmarks) {
  if (benchmark.validate) benchmark.validate();

  const direct = measure(benchmark.direct);
  const proxy = measure(benchmark.proxy);
  const ratio = proxy.nsPerOp / direct.nsPerOp;

  console.log([
    padRight(benchmark.name, 38),
    padLeft(formatNumber(direct.opsPerSecond), 14),
    padLeft(formatNumber(proxy.opsPerSecond), 14),
    padLeft(formatNumber(direct.nsPerOp), 14),
    padLeft(formatNumber(proxy.nsPerOp), 14),
    padLeft(`${ratio.toFixed(2)}x`, 14),
  ].join(' '));
}

function prepareModel(Model, withProxy) {
  Model.driver = Bone.driver;
  Model.options = Bone.options;
  Model.init({ ...ATTRIBUTES }, { timestamps: false });
  Model.load(COLUMNS);
  Model[hasLoadedAttributesKey] = withProxy;
}

function buildGetRunner(instance) {
  return function getRunner(i) {
    return instance.name.length + instance.title.length + instance.status + i;
  };
}

function buildSetRunner(instance) {
  return function setRunner(i) {
    instance.name = `Ada ${i}`;
    instance.status = i;
    return instance.status;
  };
}

function buildDefineAttributeRunner(instance) {
  return function defineAttributeRunner(i) {
    Object.defineProperty(instance, 'name', {
      value: `Ada ${i}`,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return instance.attribute('name');
  };
}

function buildDefineNonAttributeRunner(instance) {
  return function defineNonAttributeRunner(i) {
    Object.defineProperty(instance, '_cache', {
      value: i,
      writable: true,
      enumerable: false,
      configurable: true,
    });
    return instance._cache;
  };
}

function validateNativeClassFields() {
  const direct = new DirectFieldModel(VALUES);
  const proxy = new ProxyFieldModel(VALUES);

  if (direct.attribute('name') !== 'Ada' || direct.name !== undefined) {
    throw new Error('direct native class field baseline changed unexpectedly');
  }
  if (proxy.attribute('name') !== 'Ada' || proxy.name !== 'Ada') {
    throw new Error('proxy native class field handling failed');
  }
}

function validateDefinePropertyInterception() {
  const direct = new DirectModel(VALUES);
  const proxy = new ProxyModel(VALUES);

  Object.defineProperty(direct, 'name', {
    value: 'shadowed',
    writable: true,
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(proxy, 'name', {
    value: 'intercepted',
    writable: true,
    enumerable: true,
    configurable: true,
  });

  if (direct.attribute('name') !== 'Ada' || direct.name !== 'shadowed') {
    throw new Error('direct defineProperty baseline changed unexpectedly');
  }
  if (proxy.attribute('name') !== 'intercepted' || proxy.name !== 'intercepted') {
    throw new Error('proxy defineProperty interception failed');
  }
}

function measure(fn) {
  let sink = 0;
  for (let i = 0; i < warmupRuns; i++) {
    sink ^= run(fn, iterations);
  }

  const samples = [];
  for (let i = 0; i < runs; i++) {
    if (typeof global.gc === 'function') global.gc();
    const start = performance.now();
    sink ^= run(fn, iterations);
    const elapsedMs = performance.now() - start;
    samples.push((elapsedMs * 1e6) / iterations);
  }

  if (sink === 0.123456789) console.log('');

  const nsPerOp = median(samples);
  return {
    nsPerOp,
    opsPerSecond: 1e9 / nsPerOp,
  };
}

function run(fn, count) {
  let checksum = 0;
  for (let i = 0; i < count; i++) {
    const value = fn(i);
    if (typeof value === 'number') checksum = (checksum + value) | 0;
    else if (typeof value === 'string') checksum = (checksum + value.length) | 0;
    else if (value && typeof value === 'object') checksum = (checksum + (value.isNewRecord ? 1 : 0)) | 0;
  }
  return checksum;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint];
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function readPositiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function padLeft(value, length) {
  return String(value).padStart(length);
}

function padRight(value, length) {
  return String(value).padEnd(length);
}
