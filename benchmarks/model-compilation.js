'use strict';

const { performance } = require('perf_hooks');
const Realm = require('../lib');
const { Bone, DataTypes, Model } = Realm;
const AbstractDriver = require('../lib/drivers/abstract').default;
const {
  markModelClassFieldsChecked,
  markModelClassReady,
} = require('../lib/abstract_bone');

const iterations = readPositiveInt('ITERATIONS', 100000);
const runs = readPositiveInt('RUNS', 7);
const warmupRuns = readPositiveInt('WARMUP_RUNS', 3);

Bone.driver = new AbstractDriver();
Bone.options = { define: {} };

const ATTRIBUTE_TYPES = {
  name: DataTypes.STRING,
  title: DataTypes.STRING,
  email: DataTypes.STRING,
  status: DataTypes.INTEGER,
  level: DataTypes.INTEGER,
  views: DataTypes.INTEGER,
  score: DataTypes.INTEGER,
  bio: DataTypes.TEXT,
};

const COLUMNS = Object.entries(ATTRIBUTE_TYPES).map(([ columnName, type ]) => ({
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

class DirectModel extends Bone {}
markModelClassReady(DirectModel);
markModelClassFieldsChecked(DirectModel);
initializeModel(DirectModel);

const realm = new Realm();
const GeneratedModel = realm.define('GeneratedModel', createAttributes(), { timestamps: false });
loadModel(GeneratedModel);

const DecoratorCompiledModel = Model()(class DecoratorCompiledModel extends Bone {
  name;
  status = 0;
});
initializeModel(DecoratorCompiledModel);

const RealmCompiledModel = realm.define(class RealmCompiledModel extends Bone {
  name;
  status = 0;
}, createAttributes(), { timestamps: false });
loadModel(RealmCompiledModel);

const models = [
  { name: 'direct', Model: DirectModel },
  { name: 'generated', Model: GeneratedModel },
  { name: '@Model compiled', Model: DecoratorCompiledModel },
  { name: 'realm compiled', Model: RealmCompiledModel },
];

validateModels();

const benchmarks = [
  {
    name: 'construct with values',
    runners: models.map(({ name, Model: ModelClass }) => ({
      name,
      run: () => new ModelClass(VALUES),
    })),
  },
  {
    name: 'instantiate row',
    runners: models.map(({ name, Model: ModelClass }) => ({
      name,
      run: () => ModelClass.instantiate(VALUES),
    })),
  },
  {
    name: 'getter hot path',
    runners: models.map(({ name, Model: ModelClass }) => ({
      name,
      run: buildGetRunner(new ModelClass(VALUES)),
    })),
  },
  {
    name: 'setter hot path',
    runners: models.map(({ name, Model: ModelClass }) => ({
      name,
      run: buildSetRunner(new ModelClass(VALUES)),
    })),
  },
];

console.log('Leoric model-compilation benchmark');
console.log(`Node ${process.version}, ${iterations.toLocaleString()} iterations, ${runs} measured runs, ${warmupRuns} warmup runs`);
console.log('');
console.log(`${padRight('case', 24)} ${padRight('model', 18)} ${padLeft('ops/s', 14)} ${padLeft('ns/op', 14)} ${padLeft('vs direct', 12)}`);
console.log('-'.repeat(88));

for (const benchmark of benchmarks) {
  const results = measureAll(benchmark.runners);
  const direct = results[0];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    console.log([
      padRight(index === 0 ? benchmark.name : '', 24),
      padRight(result.name, 18),
      padLeft(formatNumber(result.opsPerSecond), 14),
      padLeft(formatNumber(result.nsPerOp), 14),
      padLeft(`${(result.nsPerOp / direct.nsPerOp).toFixed(2)}x`, 12),
    ].join(' '));
  }
}

function createAttributes() {
  return { ...ATTRIBUTE_TYPES };
}

function initializeModel(ModelClass) {
  ModelClass.init(createAttributes(), { timestamps: false });
  loadModel(ModelClass);
}

function loadModel(ModelClass) {
  ModelClass.driver = Bone.driver;
  ModelClass.options = Bone.options;
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

function validateModels() {
  for (const { name, Model: ModelClass } of models) {
    const instance = new ModelClass(VALUES);
    if (instance.name !== VALUES.name || instance.status !== VALUES.status) {
      throw new Error(`${name} does not preserve mapped values`);
    }
    if (Object.hasOwn(instance, 'name') || Object.hasOwn(instance, 'status')) {
      throw new Error(`${name} has mapped own fields`);
    }
  }
}

function measureAll(runners) {
  let sink = 0;
  for (let i = 0; i < warmupRuns; i++) {
    for (const { run: runBenchmark } of runners) sink ^= run(runBenchmark, iterations);
  }

  const samples = runners.map(() => []);
  for (let runIndex = 0; runIndex < runs; runIndex++) {
    const order = runIndex % 2 === 0
      ? runners.map((_, index) => index)
      : runners.map((_, index) => runners.length - index - 1);
    for (const index of order) {
      if (typeof global.gc === 'function') global.gc();
      const start = performance.now();
      sink ^= run(runners[index].run, iterations);
      samples[index].push(((performance.now() - start) * 1e6) / iterations);
    }
  }

  if (sink === 0.123456789) console.log('');
  return runners.map(({ name }, index) => summarize(name, samples[index]));
}

function summarize(name, samples) {
  const nsPerOp = median(samples);
  return { name, nsPerOp, opsPerSecond: 1e9 / nsPerOp };
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
