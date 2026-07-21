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

  it('checks compiled children when their ready parent has not been field-checked', function() {
    const UnsafeParent = evaluateNativeClass('UnsafeParent');
    createRealm([ UnsafeParent ]);
    load(UnsafeParent, { name: DataTypes.STRING });

    const CompiledChild = Model()(class CompiledChild extends UnsafeParent {});

    assert.throws(
      () => CompiledChild.instantiate({ name: 'Ada' }),
      error => error instanceof LeoricClassFieldError
        && error.modelName === 'CompiledChild'
        && error.attributeName === 'name',
    );
  });

  it('checks native class fields at instance persistence boundaries', async function() {
    const NativeUser = evaluateNativeClass('NativePersistenceUser');
    createRealm([ NativeUser ]);
    load(NativeUser, { name: DataTypes.STRING });

    const matchesClassFieldError = error => error instanceof LeoricClassFieldError
      && error.modelName === 'NativePersistenceUser'
      && error.attributeName === 'name';

    assert.throws(
      () => new NativeUser({ name: 'Ada' }).create(),
      matchesClassFieldError,
    );
    assert.throws(
      () => new NativeUser({ name: 'Ada' }).upsert(),
      matchesClassFieldError,
    );
    await assert.rejects(
      new NativeUser({ name: 'Ada' }).save(),
      matchesClassFieldError,
    );
    await assert.rejects(
      new NativeUser({ name: 'Ada' }).update({ name: 'Grace' }),
      matchesClassFieldError,
    );
  });
});

describe('=> runtime subclasses of compiled models (egg-orm / @midwayjs/leoric)', function() {
  it('allows @midwayjs/leoric request-scoped subclass with static ctx/app', function() {
    const Post = Model()(class Post extends Bone {});
    createRealm([ Post ]);
    load(Post, { title: DataTypes.STRING });

    const mockCtx = { userId: 42 };
    const mockApp = { config: {} };
    const RequestScopedPost = class extends Post {
      static get ctx() { return mockCtx; }
      static get app() { return mockApp; }
    };

    const post = new RequestScopedPost({ title: 'Hello' });
    assert.equal(post.title, 'Hello');
    assert.equal(RequestScopedPost.ctx, mockCtx);
    assert.equal(RequestScopedPost.app, mockApp);

    const instantiated = RequestScopedPost.instantiate({ title: 'World' });
    assert.equal(instantiated.title, 'World');
    assert.ok(instantiated instanceof Post);
  });

  it('allows egg-orm proxy-based subclass with defineProperty injection', function() {
    const User = Model()(class User extends Bone {});
    createRealm([ User ]);
    load(User, { name: DataTypes.STRING });

    const mockCtx = { session: {} };
    const mockApp = { name: 'egg-app' };

    class InjectModelClass extends User {
      static get name() { return super.name; }
    }
    for (const key of ['ctx', 'app']) {
      const value = key === 'ctx' ? mockCtx : mockApp;
      for (const target of [ InjectModelClass, InjectModelClass.prototype ]) {
        Object.defineProperty(target, key, { get() { return value; } });
      }
    }

    const user = new InjectModelClass({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    assert.equal(InjectModelClass.ctx, mockCtx);
    assert.equal(user.ctx, mockCtx);

    const instantiated = InjectModelClass.instantiate({ name: 'Grace' });
    assert.equal(instantiated.name, 'Grace');
    assert.ok(instantiated instanceof User);
  });

  it('rejects subclasses whose chain has no ready ancestor', function() {
    const { AbstractBone } = require('../../src/abstract_bone');
    const Unregistered = class extends AbstractBone {};

    assert.throws(
      () => new Unregistered(),
      /not a registered Leoric model/,
    );
  });

  it('still rejects subclasses that declare new columns', function() {
    const User = Model()(class User extends Bone {});
    createRealm([ User ]);
    load(User, { name: DataTypes.STRING });

    class Admin extends User {}
    Admin.init({ name: DataTypes.STRING, role: DataTypes.STRING }, { timestamps: false });

    assert.throws(
      () => new Admin({ name: 'Ada' }),
      /Admin is not a registered Leoric model/,
    );
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
