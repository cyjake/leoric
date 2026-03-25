import assert from 'assert';
import { Bone, DataTypes, Column, connect, sequelize } from '../../src';

const { STRING, INTEGER } = DataTypes;

describe('=> ES2022 class fields', () => {
  before(async () => {
    (Bone as any).driver = null;
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
    });
  });

  after(() => {
    (Bone as any).driver = null;
  });

  // === Basic functionality ===

  describe('basic functionality', () => {
    it('new Model(values) sets attributes correctly', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;

        @Column({ type: DataTypes.INTEGER })
        declare age: number;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'age', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John', age: 30 });
      assert.equal(user.attribute('name'), 'John');
      assert.equal(user.attribute('age'), 30);
      assert.equal(user.name, 'John');
      assert.equal(user.age, 30);
    });

    it('setter triggers attribute write after construction', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John' });
      user.name = 'Jane';
      assert.equal(user.attribute('name'), 'Jane');
      assert.equal(user.name, 'Jane');
    });

    it('toJSON() / toObject() / JSON.stringify() output complete attributes', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;

        @Column({ type: DataTypes.INTEGER })
        declare wordCount: number;
      }
      (Post as any).load([
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'word_count', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      const post = new Post({ title: 'Hello', wordCount: 100 });
      const json = post.toJSON();
      assert.equal(json.title, 'Hello');
      assert.equal(json.wordCount, 100);
      const obj = post.toObject();
      assert.equal(obj.title, 'Hello');
      assert.equal(obj.wordCount, 100);
      const parsed = JSON.parse(JSON.stringify(post));
      assert.equal(parsed.title, 'Hello');
    });
  });

  // === Proxy defineProperty trap (simulating ES2022 [[DefineOwnProperty]]) ===

  describe('defineProperty trap (ES2022 simulation)', () => {
    it('defineProperty on attribute is intercepted and routes to attribute()', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John' });
      // Simulate what ES2022 class field initializer does:
      // Object.defineProperty(this, 'name', { value: 'overwrite', writable: true, ... })
      Object.defineProperty(user, 'name', {
        value: 'Override',
        writable: true,
        enumerable: true,
        configurable: true,
      });
      // The Proxy should intercept this and route through attribute()
      assert.equal(user.name, 'Override');
      assert.equal(user.attribute('name'), 'Override');
    });

    it('defineProperty with undefined value is intercepted but not set', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John' });
      // ES2022: `name!: string;` (declare-like, no initializer) emits defineProperty with undefined
      Object.defineProperty(user, 'name', {
        value: undefined,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      // Should NOT overwrite the value since initializer is undefined
      assert.equal(user.name, 'John');
    });

    it('defineProperty on non-attribute passes through', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John' });
      // Non-attribute property should pass through to Reflect.defineProperty
      Object.defineProperty(user, '_cache', {
        value: 'cached',
        writable: true,
        enumerable: true,
        configurable: true,
      });
      assert.equal((user as any)._cache, 'cached');
    });
  });

  // === Deep inheritance chain ===

  describe('deep inheritance chain', () => {
    it('3-level: Bone → BaseBone → ConcernBone → Model with declare fields', () => {
      class BaseBone extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'test', status: 1, title: 'Hello' });
      assert.equal(instance.name, 'test');
      assert.equal(instance.status, 1);
      assert.equal(instance.title, 'Hello');

      // Non-attribute defineProperty should pass through
      Object.defineProperty(instance, '_cache', { value: null, writable: true, configurable: true });
      assert.equal((instance as any)._cache, null);
    });

    it('3-level with defineProperty trap: class field initializers intercepted at every level', () => {
      class BaseBone extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'original', status: 1, title: 'Hello' });

      // Simulate ES2022 class field initializers at each inheritance level
      Object.defineProperty(instance, 'name', { value: 'overridden', writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, 'status', { value: 99, writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, 'title', { value: 'New Title', writable: true, enumerable: true, configurable: true });

      // All should be routed through attribute()
      assert.equal(instance.attribute('name'), 'overridden');
      assert.equal(instance.attribute('status'), 99);
      assert.equal(instance.attribute('title'), 'New Title');
      assert.equal(instance.name, 'overridden');
      assert.equal(instance.status, 99);
      assert.equal(instance.title, 'New Title');
    });

    it('3-level: non-attribute class fields at intermediate levels pass through', () => {
      class BaseBone extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'test', status: 1, title: 'Hello' });

      // Simulate non-attribute class fields defined at various inheritance levels
      // (e.g., ConcernBone level: PERMISSION = 'read', _cache = null)
      Object.defineProperty(instance, 'PERMISSION', { value: 'read', writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, '_cache', { value: { key: 'val' }, writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, '_logger', { value: console, writable: true, enumerable: false, configurable: true });

      // Non-attribute fields pass through Reflect.defineProperty
      assert.equal((instance as any).PERMISSION, 'read');
      assert.deepEqual((instance as any)._cache, { key: 'val' });
      assert.equal((instance as any)._logger, console);

      // Attribute fields remain intact
      assert.equal(instance.name, 'test');
      assert.equal(instance.status, 1);
      assert.equal(instance.title, 'Hello');
    });

    it('4-level: skylark pattern (SequelizeBone → BaseBone → ConcernBone → Model)', () => {
      const Spine = sequelize(Bone);

      class BaseBone extends Spine {}
      BaseBone.init({
        name: STRING,
      });

      class ConcernBone extends BaseBone {}
      ConcernBone.init({
        ...((BaseBone as any).attributes),
        status: INTEGER,
      });

      class Model extends ConcernBone {}
      Model.init({
        ...((ConcernBone as any).attributes),
        title: STRING,
      });

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'test', status: 1, title: 'Hello' });
      assert.equal(instance.name, 'test');
      assert.equal(instance.status, 1);
      assert.equal(instance.title, 'Hello');

      // SequelizeBone compat API works through the chain
      assert.equal((instance as any).getDataValue('name'), 'test');
      (instance as any).setDataValue('title', 'World');
      assert.equal(instance.title, 'World');
      assert.equal((instance as any).dataValues.title, 'World');

      // defineProperty trap intercepts attribute fields
      Object.defineProperty(instance, 'name', { value: 'intercepted', writable: true, enumerable: true, configurable: true });
      assert.equal(instance.attribute('name'), 'intercepted');

      // defineProperty on non-attribute passes through
      Object.defineProperty(instance, '_flag', { value: true, writable: true, configurable: true });
      assert.equal((instance as any)._flag, true);
    });

    it('4-level: instantiate() through deep chain produces correct instances', () => {
      class BaseBone extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class AppBone extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare category: string;
      }

      class Model extends AppBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'category', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      // instantiate() simulates what Model.find() returns
      const instance = (Model as any).instantiate({
        id: 42, name: 'test', status: 1, category: 'tech', title: 'Hello',
      });
      assert.equal(instance.id, 42);
      assert.equal(instance.name, 'test');
      assert.equal(instance.status, 1);
      assert.equal(instance.category, 'tech');
      assert.equal(instance.title, 'Hello');
      assert.equal(instance.isNewRecord, false);

      // mutation + change tracking work
      instance.title = 'Changed';
      assert.ok(instance.changed('title'));
      assert.deepEqual(instance.changes('title'), { title: ['Hello', 'Changed'] });

      // toJSON includes all inherited attributes
      const json = instance.toJSON();
      assert.equal(json.name, 'test');
      assert.equal(json.category, 'tech');
      assert.equal(json.title, 'Changed');
    });

    it('4-level: egg-orm dynamic subclass on top of deep chain', () => {
      class BaseBone extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      // egg-orm wraps with an empty dynamic subclass + injects ctx/app
      class InjectModelClass extends Model {}
      const fakeCtx = { id: 'ctx-1' };
      const fakeApp = { name: 'app' };
      for (const target of [InjectModelClass, InjectModelClass.prototype]) {
        Object.defineProperty(target, 'ctx', { get() { return fakeCtx; }, configurable: true });
        Object.defineProperty(target, 'app', { get() { return fakeApp; }, configurable: true });
      }

      const instance = new InjectModelClass({ name: 'test', status: 1, title: 'Hello' });
      // All attributes from deep chain work
      assert.equal(instance.name, 'test');
      assert.equal(instance.status, 1);
      assert.equal(instance.title, 'Hello');
      // Injected properties accessible
      assert.equal((instance as any).ctx, fakeCtx);
      assert.equal((instance as any).app, fakeApp);
      // Static injected properties accessible
      assert.equal((InjectModelClass as any).ctx, fakeCtx);
    });

    // --- sequelize(Bone) multi-level inheritance + decorators ---

    it('sequelize(Bone) 3-level with @Column decorators', () => {
      const Spine = sequelize(Bone);

      class BaseBone extends Spine {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'Alice', status: 2, title: 'Post' });
      // attribute getter/setter from all levels
      assert.equal(instance.name, 'Alice');
      assert.equal(instance.status, 2);
      assert.equal(instance.title, 'Post');
      // SequelizeBone API works through the chain
      assert.equal((instance as any).getDataValue('name'), 'Alice');
      assert.equal((instance as any).dataValues.status, 2);
      (instance as any).setDataValue('title', 'Updated');
      assert.equal(instance.title, 'Updated');
      // change tracking
      assert.ok(instance.changed('title'));
    });

    it('sequelize(Bone) 3-level with custom getter/setter on leaf model', () => {
      const Spine = sequelize(Bone);

      class BaseBone extends Spine {}
      BaseBone.init({ email: STRING });

      class ConcernBone extends BaseBone {}
      ConcernBone.init({
        ...((BaseBone as any).attributes),
        status: INTEGER,
      });

      class Model extends ConcernBone {}
      Model.init({
        ...((ConcernBone as any).attributes),
        login: STRING,
        title: STRING,
      });

      // Custom getter/setter must be on the leaf class prototype
      // (loadAttribute uses Object.getOwnPropertyDescriptor(this.prototype, name))
      Object.defineProperty(Model.prototype, 'login', {
        get() { return (this.attribute('login') as string || '').toLowerCase(); },
        set(value: string) { this.attribute('login', value.trim()); },
        enumerable: true,
        configurable: true,
      });

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'email', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'login', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ email: 'a@b.com', status: 1, login: '  Admin  ', title: 'Post' });
      // custom getter lowercases, custom setter trims
      assert.equal(instance.login, 'admin');
      assert.equal(instance.attribute('login'), 'Admin');
      // regular attributes from other levels unaffected
      assert.equal(instance.email, 'a@b.com');
      assert.equal(instance.status, 1);
      assert.equal(instance.title, 'Post');
      // setDataValue bypasses custom setter
      (instance as any).setDataValue('login', 'Raw');
      assert.equal(instance.attribute('login'), 'Raw');
    });

    it('sequelize(Bone) 3-level with defineProperty trap interception', () => {
      const Spine = sequelize(Bone);

      class BaseBone extends Spine {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare age: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare bio: string;
      }

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'age', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'bio', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = new Model({ name: 'Alice', age: 25, bio: 'Hello' });

      // Simulate ES2022 class field initializers from each level
      Object.defineProperty(instance, 'name', { value: 'Bob', writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, 'age', { value: 30, writable: true, enumerable: true, configurable: true });
      Object.defineProperty(instance, 'bio', { value: 'World', writable: true, enumerable: true, configurable: true });

      // All intercepted and routed through attribute()
      assert.equal(instance.attribute('name'), 'Bob');
      assert.equal(instance.attribute('age'), 30);
      assert.equal(instance.attribute('bio'), 'World');

      // SequelizeBone compat API still works after interception
      assert.equal((instance as any).getDataValue('name'), 'Bob');
      assert.equal((instance as any).dataValues.age, 30);

      // non-attribute defineProperty passes through
      Object.defineProperty(instance, '_temp', { value: 42, writable: true, configurable: true });
      assert.equal((instance as any)._temp, 42);
    });

    it('sequelize(Bone) 3-level: build() + instantiate() produce correct instances', () => {
      const Spine = sequelize(Bone);

      class BaseBone extends Spine {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }

      class ConcernBone extends BaseBone {
        @Column({ type: DataTypes.INTEGER })
        declare status: number;
      }

      class Model extends ConcernBone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }

      (Model as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'status', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      // build() — SequelizeBone's factory method
      const built = (Model as any).build({ name: 'built', status: 1, title: 'Hello' });
      assert.equal(built.name, 'built');
      assert.equal(built.status, 1);
      assert.equal(built.title, 'Hello');
      assert.equal(built.isNewRecord, true);

      // instantiate() — the query result path
      const fetched = (Model as any).instantiate({ id: 1, name: 'fetched', status: 2, title: 'World' });
      assert.equal(fetched.name, 'fetched');
      assert.equal(fetched.status, 2);
      assert.equal(fetched.title, 'World');
      assert.equal(fetched.isNewRecord, false);

      // _clone between instances
      built._clone(fetched);
      assert.equal(built.name, 'fetched');
      assert.equal(built.title, 'World');
    });
  });

  // === Custom getter/setter ===

  describe('custom getter/setter', () => {
    it('@Column with custom getter/setter works under Proxy', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        get login(): string {
          return (this.attribute('login') as string || '').toLowerCase();
        }
        set login(value: string) {
          this.attribute('login', value.trim());
        }
      }
      (User as any).load([
        { columnName: 'login', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ login: '  Admin  ' });
      assert.equal(user.login, 'admin');
    });
  });

  // === egg-orm patterns ===

  describe('egg-orm patterns', () => {
    it('dynamic empty subclass works', () => {
      class Original extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (Original as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      class InjectModelClass extends Original {}

      const instance = new InjectModelClass({ name: 'test' });
      assert.equal(instance.name, 'test');
      assert.equal(instance.attribute('name'), 'test');
    });

    it('Object.defineProperty injection on prototype works', () => {
      class Original extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (Original as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      class InjectModelClass extends Original {}

      const fakeCtx = { id: 1 };
      Object.defineProperty(InjectModelClass.prototype, 'ctx', {
        get() { return fakeCtx; },
      });

      const instance = new InjectModelClass({ name: 'test' });
      assert.equal(instance.name, 'test');
      assert.equal((instance as any).ctx, fakeCtx);
    });

    it('Object.setPrototypeOf dynamic prototype replacement works', () => {
      class Original extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (Original as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      // Simulate egg-orm's prototype replacement
      class AnotherBase extends Bone {}
      Object.setPrototypeOf(Original, AnotherBase);
      Object.setPrototypeOf(Original.prototype, AnotherBase.prototype);

      const instance = new Original({ name: 'test' });
      assert.equal(instance.name, 'test');
    });
  });

  // === egg-orm full lifecycle integration ===

  describe('egg-orm full lifecycle integration', () => {
    // Replicate egg-orm/lib/loader.js createProxy logic
    function createProxy(realm: Record<string, any>, injects: Record<string, any>) {
      return new Proxy(realm, {
        get(target, property: string) {
          const injected = (this as any)[property];
          if (injected) return injected;
          if (injects.hasOwnProperty(property)) return injects[property];

          const OriginModelClass = target[property];
          if (!(OriginModelClass && typeof OriginModelClass === 'function'
            && OriginModelClass.prototype instanceof Bone)) {
            return OriginModelClass;
          }

          class InjectModelClass extends OriginModelClass {}
          // egg-orm uses `static get name() { return super.name }` (valid JS, TS2699 in TS)
          // replicate the intent: preserve original class name
          Object.defineProperty(InjectModelClass, 'name', {
            get() { return OriginModelClass.name; },
            configurable: true,
          });
          for (const key of Object.keys(injects)) {
            const value = injects[key];
            for (const t of [InjectModelClass, InjectModelClass.prototype]) {
              Object.defineProperty(t, key, {
                get() { return value; },
                configurable: true,
              });
            }
          }
          (this as any)[property] = InjectModelClass;
          return InjectModelClass;
        },
      });
    }

    it('createProxy + InjectModelClass + ctx/app injection (unit)', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;

        @Column({ type: DataTypes.INTEGER })
        declare age: number;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'age', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      // Simulate realm object (like egg-orm's Realm instance)
      const realm: Record<string, any> = { User };

      // Simulate app injection on Model (like loadDatabase does)
      const fakeApp = { name: 'my-egg-app', config: {} };
      for (const t of [Bone, Bone.prototype]) {
        Object.defineProperty(t, 'app', {
          get() { return fakeApp; },
          configurable: true,
          enumerable: false,
        });
      }

      // Simulate ctx access — createProxy wraps realm per request
      const fakeCtx = { id: 'request-1', app: fakeApp };
      const ctxModel = createProxy(realm, { app: fakeApp, ctx: fakeCtx });

      // Access model through proxy — triggers InjectModelClass creation
      const InjectedUser = ctxModel.User;
      assert.ok(InjectedUser);
      assert.equal(InjectedUser.name, 'User');
      assert.notStrictEqual(InjectedUser, User); // different class

      // Cached on second access
      assert.strictEqual(ctxModel.User, InjectedUser);

      // ctx/app accessible on class and prototype
      assert.strictEqual((InjectedUser as any).ctx, fakeCtx);
      assert.strictEqual((InjectedUser as any).app, fakeApp);

      // Create instance — Proxy intercepts defineProperty from super()
      const user = new InjectedUser({ name: 'Alice', age: 25 });
      assert.equal(user.name, 'Alice');
      assert.equal(user.age, 25);
      assert.equal(user.attribute('name'), 'Alice');

      // Instance inherits ctx/app from InjectModelClass.prototype
      assert.strictEqual((user as any).ctx, fakeCtx);
      assert.strictEqual((user as any).app, fakeApp);

      // Mutation works
      user.name = 'Bob';
      assert.equal(user.name, 'Bob');
      assert.ok(user.changed('name'));

      // toJSON / toObject work
      const json = user.toJSON();
      assert.equal(json.name, 'Bob');
      assert.equal(json.age, 25);

      // Clean up global Bone.prototype.app
      delete (Bone as any).app;
      delete (Bone.prototype as any).app;
    });

    it('setPrototypeOf + createProxy: model with different base class', () => {
      // Simulate: user defines `class Post extends require('leoric').Bone {}`
      // but egg-orm's realm has its own Model base class
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      // Simulate egg-orm's realm.Bone (a subclass created per realm)
      class RealmBone extends Bone {}

      // egg-orm's loadDatabase: rewire prototype chain if klass doesn't extend realm.Bone
      Object.setPrototypeOf(Post, RealmBone);
      Object.setPrototypeOf(Post.prototype, Object.create(RealmBone.prototype));

      // Object.defineProperty for name (like loadDatabase does)
      Object.defineProperty(Post, 'name', { value: 'Post' });

      // fullPath/pathName as non-enumerable (like loadDatabase does for models)
      Object.defineProperty(Post.prototype, 'fullPath', {
        value: '/app/model/post.ts',
        writable: true,
        enumerable: false,
        configurable: true,
      });
      Object.defineProperty(Post.prototype, 'pathName', {
        value: 'post',
        writable: true,
        enumerable: false,
        configurable: true,
      });

      const realm: Record<string, any> = { Post };
      const fakeCtx = { id: 'ctx-2' };
      const fakeApp = { name: 'app' };
      const ctxModel = createProxy(realm, { app: fakeApp, ctx: fakeCtx });

      const InjectedPost = ctxModel.Post;
      const post = new InjectedPost({ title: 'Hello World' });
      assert.equal(post.title, 'Hello World');
      assert.equal(post.attribute('title'), 'Hello World');
      assert.strictEqual((post as any).ctx, fakeCtx);

      // fullPath/pathName not in toJSON (non-enumerable)
      const json = post.toJSON();
      assert.equal(json.fullPath, undefined);
    });

    it('createProxy + DB operations: create, query, update, reload', async () => {
      // Use real DB table `articles`
      class Post extends Bone {
        static table = 'articles';
      }
      Post.init({
        title: STRING,
        isPrivate: DataTypes.BOOLEAN,
        wordCount: INTEGER,
      });
      (Post as any).load([
        { columnName: 'id', columnType: 'bigint(20)', dataType: 'bigint', isNullable: 'NO', primaryKey: true },
        { columnName: 'title', columnType: 'varchar(1000)', dataType: 'varchar', isNullable: 'NO' },
        { columnName: 'is_private', columnType: 'tinyint(1)', dataType: 'tinyint', isNullable: 'NO', defaultValue: '0' },
        { columnName: 'word_count', columnType: 'int', dataType: 'int', isNullable: 'YES', defaultValue: '0' },
        { columnName: 'gmt_create', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
        { columnName: 'gmt_modified', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
        { columnName: 'gmt_deleted', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
      ]);

      const realm: Record<string, any> = { Post };
      const fakeCtx = { id: 'request-99' };
      const fakeApp = { name: 'test-app' };
      const ctxModel = createProxy(realm, { app: fakeApp, ctx: fakeCtx });
      const InjectedPost = ctxModel.Post;

      // 1. Create via injected class
      const post = await InjectedPost.create({ title: 'EggOrmTest', wordCount: 42 });
      assert.ok(post.id);
      assert.equal(post.title, 'EggOrmTest');
      assert.equal(post.wordCount, 42);
      assert.strictEqual((post as any).ctx, fakeCtx);

      const postId = post.id;

      // 2. Query via injected class
      const found = await InjectedPost.findOne({ id: postId });
      assert.ok(found);
      assert.equal(found.title, 'EggOrmTest');
      assert.strictEqual((found as any).ctx, fakeCtx);

      // 3. Update via static method, then reload
      await InjectedPost.update({ id: postId }, { title: 'Updated', wordCount: 100 });
      assert.equal(post.title, 'EggOrmTest'); // local still old
      await post.reload();
      assert.equal(post.title, 'Updated');
      assert.equal(post.wordCount, 100);

      // 4. Instance update
      post.title = 'FinalTitle';
      assert.ok(post.changed('title'));
      await post.save();
      const reloaded = await InjectedPost.findOne({ id: postId });
      assert.ok(reloaded);
      assert.equal(reloaded.title, 'FinalTitle');

      // 5. Remove
      await post.remove();
      const deleted = await InjectedPost.findOne({ id: postId });
      assert.ok(!deleted);
    });

    it('multiple ctx proxies share same model data but different injections', () => {
      class Item extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (Item as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const realm: Record<string, any> = { Item };
      const ctx1 = { id: 'ctx-1' };
      const ctx2 = { id: 'ctx-2' };
      const app = { name: 'app' };

      // Each request gets its own proxy (like egg-orm per-ctx caching)
      const model1 = createProxy(realm, { app, ctx: ctx1 });
      const model2 = createProxy(realm, { app, ctx: ctx2 });

      const Injected1 = model1.Item;
      const Injected2 = model2.Item;

      // Different InjectModelClass per ctx
      assert.notStrictEqual(Injected1, Injected2);

      // But instances from both work correctly
      const item1 = new Injected1({ name: 'from-ctx-1' });
      const item2 = new Injected2({ name: 'from-ctx-2' });
      assert.equal(item1.name, 'from-ctx-1');
      assert.equal(item2.name, 'from-ctx-2');

      // Each sees its own ctx
      assert.strictEqual((item1 as any).ctx, ctx1);
      assert.strictEqual((item2 as any).ctx, ctx2);
    });
  });

  // === Internal mechanisms ===

  describe('internal mechanisms', () => {
    it('instantiate() path returns instances with correct attributes', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = (Post as any).instantiate({ id: 1, title: 'Hello' });
      assert.equal(instance.id, 1);
      assert.equal(instance.title, 'Hello');
      assert.equal(instance.isNewRecord, false);
    });

    it('changed() / changes() work correctly', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const instance = (Post as any).instantiate({ id: 1, title: 'Hello' });
      assert.equal(instance.changed('title'), false);

      instance.title = 'World';
      assert.ok(instance.changed('title'));
      const changes = instance.changes('title');
      assert.deepEqual(changes, { title: ['Hello', 'World'] });
    });
  });

  // === SequelizeBone compat API (3.6) ===

  describe('SequelizeBone compat API', () => {
    it('getDataValue() / setDataValue() / dataValues work under Proxy', () => {
      const Spine = sequelize(Bone);
      class User extends Spine {}
      User.init({
        name: STRING,
        age: INTEGER,
      });
      (User as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'age', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John', age: 30 });
      // getDataValue reads raw
      assert.equal((user as any).getDataValue('name'), 'John');
      assert.equal((user as any).getDataValue('age'), 30);
      // dataValues getter returns all raw
      const dv = (user as any).dataValues;
      assert.equal(dv.name, 'John');
      assert.equal(dv.age, 30);
      // setDataValue writes through attribute()
      (user as any).setDataValue('name', 'Jane');
      assert.equal(user.name, 'Jane');
      assert.equal((user as any).getDataValue('name'), 'Jane');
    });
  });

  // === applyMixins pattern (3.8) ===

  describe('applyMixins pattern', () => {
    it('mixin methods copied to prototype work with attribute()/getRaw()', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;

        @Column({ type: DataTypes.INTEGER })
        declare wordCount: number;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'word_count', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      // Simulate skylark's applyMixins: copy methods to prototype via Object.defineProperty
      const mixin = {
        getTitle(this: any) {
          return this.attribute('title');
        },
        getTitleRaw(this: any) {
          return this.getRaw('title');
        },
        setTitle(this: any, value: string) {
          this.attribute('title', value);
        },
      };
      for (const [key, fn] of Object.entries(mixin)) {
        Object.defineProperty(Post.prototype, key, {
          value: fn,
          writable: true,
          configurable: true,
        });
      }

      const post = new Post({ title: 'Hello', wordCount: 42 });
      assert.equal((post as any).getTitle(), 'Hello');
      assert.equal((post as any).getTitleRaw(), 'Hello');
      (post as any).setTitle('World');
      assert.equal(post.title, 'World');
      assert.equal((post as any).getTitle(), 'World');
    });
  });

  // === _clone / reload (3.12) ===

  describe('_clone', () => {
    it('_clone() transfers data between Proxy instances', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;

        @Column({ type: DataTypes.INTEGER })
        declare wordCount: number;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'word_count', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      const source = (Post as any).instantiate({ id: 1, title: 'Source', word_count: 10 });
      const target = new Post({ title: 'Target', wordCount: 20 });

      // _clone merges source data into target
      target._clone(source);
      assert.equal(target.title, 'Source');
      assert.equal(target.wordCount, 10);
      // getRaw also updated
      assert.equal(target.getRaw('title'), 'Source');
    });

    it('_clone() after mutation: proxy state remains consistent', () => {
      class Post extends Bone {
        @Column({ type: DataTypes.STRING })
        declare title: string;

        @Column({ type: DataTypes.INTEGER })
        declare wordCount: number;
      }
      (Post as any).load([
        { columnName: 'id', columnType: 'int(11)', dataType: 'int', isNullable: 'NO' },
        { columnName: 'title', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'word_count', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      // Simulate reload() flow: instance exists, gets cloned from fresh DB result
      const instance = (Post as any).instantiate({ id: 1, title: 'Original', word_count: 10 });
      instance.title = 'Modified';
      assert.ok(instance.changed('title'));

      // Fresh data from DB (simulates what reload() fetches)
      const fresh = (Post as any).instantiate({ id: 1, title: 'FromDB', word_count: 99 });

      // _clone replaces internal state (this is what reload() does)
      instance._clone(fresh);
      assert.equal(instance.title, 'FromDB');
      assert.equal(instance.wordCount, 99);
      assert.equal(instance.getRaw('title'), 'FromDB');
      assert.equal(instance.getRawSaved('title'), 'FromDB');

      // After clone, further mutations still work correctly
      instance.title = 'AfterReload';
      assert.equal(instance.title, 'AfterReload');
      assert.ok(instance.changed('title'));
      assert.deepEqual(instance.changes('title'), { title: ['FromDB', 'AfterReload'] });
    });

    it('reload() fetches from DB and updates Proxy instance via _clone()', async () => {
      // Map to the real `articles` table from test/dumpfile.sql
      class Post extends Bone {
        static table = 'articles';
      }
      Post.init({
        title: STRING,
        isPrivate: DataTypes.BOOLEAN,
        wordCount: INTEGER,
      });
      (Post as any).load([
        { columnName: 'id', columnType: 'bigint(20)', dataType: 'bigint', isNullable: 'NO', primaryKey: true },
        { columnName: 'title', columnType: 'varchar(1000)', dataType: 'varchar', isNullable: 'NO' },
        { columnName: 'is_private', columnType: 'tinyint(1)', dataType: 'tinyint', isNullable: 'NO', defaultValue: '0' },
        { columnName: 'word_count', columnType: 'int', dataType: 'int', isNullable: 'YES', defaultValue: '0' },
        { columnName: 'gmt_create', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
        { columnName: 'gmt_modified', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
        { columnName: 'gmt_deleted', columnType: 'timestamp(3)', dataType: 'timestamp', isNullable: 'YES' },
      ]);

      // Create a record
      const post = await (Post as any).create({ title: 'BeforeReload', wordCount: 10 });
      assert.equal(post.title, 'BeforeReload');
      const postId = post.id;

      // Modify in DB directly (simulate external update)
      await (Post as any).update({ id: postId }, { title: 'UpdatedInDB', wordCount: 99 });

      // Local instance still has old data
      assert.equal(post.title, 'BeforeReload');

      // reload() → _clone() should refresh from DB
      await post.reload();
      assert.equal(post.title, 'UpdatedInDB');
      assert.equal(post.wordCount, 99);

      // After reload, mutations + change tracking still work
      post.title = 'AfterReload';
      assert.ok(post.changed('title'));
      assert.equal(post.attribute('title'), 'AfterReload');

      // Cleanup
      await (Post as any).remove({ id: postId }, true);
    });
  });

  // === Edge cases ===

  describe('edge cases', () => {
    it('no attributes defined — no Proxy created', () => {
      const bone = new Bone();
      assert.ok(bone instanceof Bone);
      assert.equal(bone.isNewRecord, true);
    });

    it('declare-modified fields do not trigger trap', () => {
      class User extends Bone {
        @Column({ type: DataTypes.STRING })
        declare name: string;
      }
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John' });
      assert.equal(user.name, 'John');
      assert.equal(user.attribute('name'), 'John');
    });

    it('pure JS class fields via Model.init() API', () => {
      class User extends Bone {}
      User.init({ name: STRING, age: INTEGER });
      (User as any).load([
        { columnName: 'name', columnType: 'varchar(255)', dataType: 'varchar', isNullable: 'YES' },
        { columnName: 'age', columnType: 'int(11)', dataType: 'int', isNullable: 'YES' },
      ]);

      const user = new User({ name: 'John', age: 30 });
      assert.equal(user.name, 'John');
      assert.equal(user.age, 30);
    });
  });
});
