'use strict';

const assert = require('assert').strict;
const path = require('path');
const ts = require('typescript');
const Realm = require('../../src').default;
const {
  Bone,
  DataTypes,
  LeoricClassFieldError,
  Model,
} = require('../../src');

const fixtureDirectory = path.resolve(__dirname, '../fixtures/class-fields');

describe('=> class field compiler and runtime configurations', function() {
  it('handles TypeScript define semantics from tsconfig', function() {
    const fixture = compileFixture('tsconfig.define.json');
    const {
      RegularUser,
      DeclaredUser,
      DecoratedUser,
      RealmDefinedUser,
    } = fixture.exports;

    assert.equal(fixture.options.target, ts.ScriptTarget.ES2022);
    assert.equal(fixture.options.useDefineForClassFields, true);

    const realm = createRealm([ RegularUser, DeclaredUser ]);
    load(RegularUser, { name: DataTypes.STRING });
    load(DeclaredUser, { name: DataTypes.STRING });

    assert.equal(Object.hasOwn(new RegularUser(), 'name'), true);
    assert.throws(
      () => RegularUser.instantiate({ name: 'Ada' }),
      error => error instanceof LeoricClassFieldError
        && error.modelName === 'RegularUser'
        && error.attributeName === 'name',
    );

    const declared = DeclaredUser.instantiate({ name: 'Ada' });
    assert.equal(Object.hasOwn(declared, 'name'), false);
    assert.equal(declared.name, 'Ada');

    load(DecoratedUser, {
      name: DataTypes.STRING,
      role: { type: DataTypes.STRING, defaultValue: 'member' },
    });
    const decorated = new DecoratedUser({ name: 'Ada' });
    assert.equal(decorated.name, 'Ada');
    assert.equal(decorated.role, 'member');
    assert.equal(Object.hasOwn(decorated, 'name'), false);
    assert.equal(Object.hasOwn(decorated, 'role'), false);

    const DefinedUser = realm.define(RealmDefinedUser, {
      name: DataTypes.STRING,
      role: { type: DataTypes.STRING, defaultValue: 'member' },
    }, { timestamps: false });
    load(DefinedUser);
    const defined = new DefinedUser({ name: 'Grace' });
    assert.equal(defined.name, 'Grace');
    assert.equal(defined.role, 'member');
    assert.equal(Object.hasOwn(defined, 'name'), false);
    assert.equal(Object.hasOwn(defined, 'role'), false);
  });

  it('handles TypeScript assignment semantics from tsconfig', function() {
    const fixture = compileFixture('tsconfig.set.json');
    const { RegularUser, DeclaredUser } = fixture.exports;

    assert.equal(fixture.options.target, ts.ScriptTarget.ES2020);
    assert.equal(fixture.options.useDefineForClassFields, false);

    createRealm([ RegularUser, DeclaredUser ]);
    load(RegularUser, { name: DataTypes.STRING });
    load(DeclaredUser, { name: DataTypes.STRING });

    const regular = RegularUser.instantiate({ name: 'Ada' });
    assert.equal(Object.hasOwn(regular, 'name'), false);
    assert.equal(regular.name, 'Ada');

    const declared = DeclaredUser.instantiate({ name: 'Grace' });
    assert.equal(Object.hasOwn(declared, 'name'), false);
    assert.equal(declared.name, 'Grace');
  });

  it('handles native class fields in the current Node.js runtime', function() {
    const NativeUser = evaluateNativeClass('NativeUser');

    createRealm([ NativeUser ]);
    load(NativeUser, { name: DataTypes.STRING });

    assert.equal(Object.hasOwn(new NativeUser(), 'name'), true);
    assert.throws(
      () => NativeUser.instantiate({ name: 'Ada' }),
      error => error instanceof LeoricClassFieldError
        && error.modelName === 'NativeUser'
        && error.attributeName === 'name',
    );

    const CompiledUser = Model()(evaluateNativeClass('CompiledUser'));
    load(CompiledUser, { name: DataTypes.STRING });
    const compiled = CompiledUser.instantiate({ name: 'Grace' });
    assert.equal(compiled.name, 'Grace');
    assert.equal(Object.hasOwn(compiled, 'name'), false);

    const realm = createRealm();
    const DefinedUser = realm.define(evaluateNativeClass('DefinedUser'), {
      name: DataTypes.STRING,
    }, { timestamps: false });
    load(DefinedUser);
    const defined = DefinedUser.instantiate({ name: 'Lin' });
    assert.equal(defined.name, 'Lin');
    assert.equal(Object.hasOwn(defined, 'name'), false);
  });
});

function evaluateNativeClass(name) {
  return new Function('Bone', `return class ${name} extends Bone { name; }`)(Bone);
}

function compileFixture(configName) {
  const configPath = path.join(fixtureDirectory, configName);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(configFile.error, undefined, formatDiagnostics([ configFile.error ].filter(Boolean)));

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, fixtureDirectory, undefined, configPath);
  assert.deepEqual(parsed.errors, [], formatDiagnostics(parsed.errors));

  let output;
  const options = {
    ...parsed.options,
    declaration: false,
    noEmit: false,
    sourceMap: false,
  };
  const host = ts.createCompilerHost(options);
  host.writeFile = (fileName, content) => {
    if (fileName.endsWith(`${path.sep}models.js`)) output = content;
  };
  const program = ts.createProgram(parsed.fileNames, options, host);
  const result = program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(result.diagnostics);
  assert.deepEqual(diagnostics, [], formatDiagnostics(diagnostics));
  assert.ok(output, `TypeScript did not emit models.js for ${configName}`);

  const fixtureModule = { exports: {} };
  const fixtureRequire = request => request === '../../../src' ? require('../../src') : require(request);
  new Function('require', 'module', 'exports', output)(fixtureRequire, fixtureModule, fixtureModule.exports);
  return { exports: fixtureModule.exports, options };
}

function createRealm(models = []) {
  return new Realm({
    dialect: 'sqlite',
    storage: ':memory:',
    models,
  });
}

function load(ModelClass, attributes) {
  if (attributes) ModelClass.init(attributes, { timestamps: false });
  ModelClass.load(Object.keys(ModelClass.attributes).map(name => ({
    columnName: name,
    columnType: 'varchar(255)',
    dataType: 'varchar',
    isNullable: 'YES',
  })));
}

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  });
}
