'use strict';

const { performance } = require('perf_hooks');
const { Bone, DataTypes, Model } = require('../lib');
const AbstractDriver = require('../lib/drivers/abstract').default;
const { markModelClassFinalized } = require('../lib/abstract_bone');

const iterations = readPositiveInt('ITERATIONS', 100000);
const runs = readPositiveInt('RUNS', 7);
const warmupRuns = readPositiveInt('WARMUP_RUNS', 3);

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

const COLUMNS = Object.entries(ATTRIBUTES).map(([ columnName, type ]) => ({
  columnName,
  columnType: type.toSqlString(),
  dataType: type.toSqlString(),
  isNullable: 'YES',
}));

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

class DirectBase extends Bone {}
class DirectModel extends DirectBase {}
prepareModel(DirectBase);
markModelClassFinalized(DirectModel);

class RawFinalizedModel extends Bone {}
prepareModel(RawFinalizedModel);
const FinalizedModel = Model()(RawFinalizedModel);

class RawNativeFieldModel extends Bone {
  name = undefined;
  status = 0;
  title = 'Untitled';
}
prepareModel(RawNativeFieldModel);
const NativeFieldModel = Model()(RawNativeFieldModel);

const benchmarks = [
  {
    name: 'construct with values',
    direct: () => new DirectModel(VALUES),
    finalized: () => new FinalizedModel(VALUES),
  },
  {
    name: 'instantiate row',
    direct: () => DirectModel.instantiate(VALUES),
    finalized: () => FinalizedModel.instantiate(VALUES),
  },
  {
    name: 'construct + native fields',
    direct: () => new DirectModel(VALUES),
    finalized: () => new NativeFieldModel(VALUES),
    validate: validateNativeFields,
  },
  {
    name: 'getter hot path',
    direct: buildGetRunner(new DirectModel(VALUES)),
    finalized: buildGetRunner(new FinalizedModel(VALUES)),
  },
  {
    name: 'setter hot path',
    direct: buildSetRunner(new DirectModel(VALUES)),
    finalized: buildSetRunner(new FinalizedModel(VALUES)),
  },
];

console.log('Leoric model-finalization benchmark');
console.log(`Node ${process.version}, ${iterations.toLocaleString()} iterations, ${runs} measured runs, ${warmupRuns} warmup runs`);
console.log('');
console.log(`${padRight('case', 32)} ${padLeft('direct ops/s', 14)} ${padLeft('finalized ops/s', 16)} ${padLeft('direct ns/op', 14)} ${padLeft('finalized ns/op', 16)} ${padLeft('finalized/direct', 17)}`);
console.log('-'.repeat(119));

for (const benchmark of benchmarks) {
  if (benchmark.validate) benchmark.validate();
  const { direct, finalized } = measurePair(benchmark.direct, benchmark.finalized);
  const ratio = finalized.nsPerOp / direct.nsPerOp;

  console.log([
    padRight(benchmark.name, 32),
    padLeft(formatNumber(direct.opsPerSecond), 14),
    padLeft(formatNumber(finalized.opsPerSecond), 16),
    padLeft(formatNumber(direct.nsPerOp), 14),
    padLeft(formatNumber(finalized.nsPerOp), 16),
    padLeft(`${ratio.toFixed(2)}x`, 17),
  ].join(' '));
}

function prepareModel(ModelClass) {
  ModelClass.driver = Bone.driver;
  ModelClass.options = Bone.options;
  ModelClass.init({ ...ATTRIBUTES }, { timestamps: false });
  ModelClass.load(COLUMNS);
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

function validateNativeFields() {
  const instance = new NativeFieldModel(VALUES);
  if (instance.name !== VALUES.name || instance.status !== VALUES.status || instance.title !== VALUES.title) {
    throw new Error('native class fields were not finalized correctly');
  }
  if (Object.hasOwn(instance, 'name') || Object.hasOwn(instance, 'status') || Object.hasOwn(instance, 'title')) {
    throw new Error('native class fields still shadow attribute accessors');
  }
}

function measurePair(directFn, finalizedFn) {
  let sink = 0;
  for (let i = 0; i < warmupRuns; i++) {
    sink ^= run(directFn, iterations);
    sink ^= run(finalizedFn, iterations);
  }

  const directSamples = [];
  const finalizedSamples = [];
  for (let i = 0; i < runs; i++) {
    if (typeof global.gc === 'function') global.gc();
    const pairs = i % 2 === 0
      ? [[ directFn, directSamples ], [ finalizedFn, finalizedSamples ]]
      : [[ finalizedFn, finalizedSamples ], [ directFn, directSamples ]];
    for (const [ fn, samples ] of pairs) {
      const start = performance.now();
      sink ^= run(fn, iterations);
      samples.push(((performance.now() - start) * 1e6) / iterations);
    }
  }

  if (sink === 0.123456789) console.log('');
  return {
    direct: summarize(directSamples),
    finalized: summarize(finalizedSamples),
  };
}

function summarize(samples) {
  const nsPerOp = median(samples);
  return { nsPerOp, opsPerSecond: 1e9 / nsPerOp };
}

function run(fn, count) {
  let checksum = 0;
  for (let i = 0; i < count; i++) {
    const value = fn(i);
    if (typeof value === 'number') checksum = (checksum + value) | 0;
    else if (value && typeof value === 'object') checksum = (checksum + (value.isNewRecord ? 1 : 0)) | 0;
  }
  return checksum;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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
