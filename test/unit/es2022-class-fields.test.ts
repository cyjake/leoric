import assert from 'assert';
import Realm, {
  Bone,
  Column,
  DataTypes,
  LeoricModelDefinitionError,
  Model,
  connect,
  sequelize,
} from '../../src';
import { AbstractBone } from '../../src/abstract_bone';

const { INTEGER, STRING } = DataTypes;

describe('=> ES2022 class fields', () => {
  let realm: Awaited<ReturnType<typeof connect>>;

  before(async () => {
    (Bone as any).driver = null;
    realm = await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
    });
  });

  after(() => {
    (Bone as any).driver = null;
  });

  it('rejects a concrete model that was not finalized', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }
    load(User, ['name']);

    assert.throws(
      () => new User({ name: 'Ada' }),
      error => error instanceof LeoricModelDefinitionError
        && /Add @Model\(\) or define it through realm\.define\(\)/.test(error.message),
    );
  });

  it('rejects unfinalized models during Realm registration', () => {
    class User extends Bone {}

    assert.throws(
      () => new Realm({ models: [ User ] }),
      /User is not a finalized Leoric model/,
    );
  });

  it('supports declare fields through @Model()', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }
    load(User, ['name']);

    const user = new User({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    user.name = 'Grace';
    assert.equal(user.attribute('name'), 'Grace');
  });

  it('repairs native fields and keeps supplied values ahead of initializers', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name!: string;

      @Column({ type: STRING })
      role = 'guest';

      cache = new Map<string, string>();
    }
    load(User, ['name', 'role']);

    const supplied = new User({ name: 'Ada', role: 'admin' });
    assert.equal(supplied.name, 'Ada');
    assert.equal(supplied.role, 'admin');
    assert.equal(supplied.attribute('role'), 'admin');
    assert.ok(supplied.cache instanceof Map);
    assert.equal(Object.prototype.hasOwnProperty.call(supplied, 'name'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(supplied, 'role'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(supplied, 'cache'), true);

    const defaulted = new User({ name: 'Grace' });
    assert.equal(defaulted.role, 'guest');
    assert.equal(defaulted.attribute('role'), 'guest');
  });

  it('lets explicit values override schema and class-field defaults', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING, defaultValue: 'schema' })
      name = 'field';
    }
    load(User, ['name']);

    assert.equal(new User().name, 'field');
    assert.equal(new User({ name: 'caller' }).name, 'caller');
  });

  it('preserves values transformed by an explicit constructor', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name = 'field';

      constructor(values: { name?: string } = {}) {
        super({ ...values, name: values.name?.toUpperCase() });
      }
    }
    load(User, ['name']);

    assert.equal(new User({ name: 'Ada' }).name, 'ADA');
  });

  it('preserves custom mapped accessors on the finalized prototype', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      get name(): string {
        return String(this.attribute('name')).toUpperCase();
      }

      set name(value: string) {
        this.attribute('name', value.trim());
      }
    }
    load(User, ['name']);

    const user = new User({ name: '  Ada  ' });
    assert.equal(user.name, 'ADA');
    assert.equal(user.attribute('name'), 'Ada');
  });

  it('finalizes mapped fields across a deep inheritance chain', () => {
    class BaseUser extends Bone {
      @Column({ type: STRING })
      name!: string;
    }

    class AuditedUser extends BaseUser {
      @Column({ type: INTEGER })
      status = 1;
    }

    @Model()
    class User extends AuditedUser {
      @Column({ type: STRING })
      role = 'member';
    }
    load(User, ['name', 'status', 'role']);

    const user = new User({ name: 'Ada', status: 2 });
    assert.equal(user.name, 'Ada');
    assert.equal(user.status, 2);
    assert.equal(user.role, 'member');
  });

  it('supports finalized leaves on the Sequelize adapter', () => {
    const Spine = sequelize(Bone);

    @Model()
    class User extends Spine {
      @Column({ type: STRING })
      declare name: string;
    }
    load(User, ['name']);

    const user = new User({ name: 'Ada' });
    assert.equal(user.getDataValue('name'), 'Ada');
    user.setDataValue('name', 'Grace');
    assert.equal(user.name, 'Grace');
  });

  it('supports explicitly finalized framework subclasses and injections', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }

    const ContextUser = Model()(class ContextUser extends User {});
    const fakeContext = { requestId: 'ctx-1' };
    Object.defineProperty(ContextUser.prototype, 'ctx', {
      configurable: true,
      get: () => fakeContext,
    });
    load(ContextUser, ['name']);

    const user = new ContextUser({ name: 'Ada' }) as User & { ctx: typeof fakeContext };
    assert.equal(user.name, 'Ada');
    assert.equal(user.ctx, fakeContext);
    assert.ok(user instanceof User);
  });

  it('requires every concrete leaf model to be finalized', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name!: string;
    }

    class Admin extends User {
      @Column({ type: STRING })
      role = 'admin';
    }
    load(Admin, ['name', 'role']);

    assert.throws(() => new Admin({ name: 'Ada' }), /Admin is not a finalized Leoric model/);
  });

  it('realm.define() finalizes and registers a JavaScript-style model', () => {
    class User extends Bone {
      name!: string;
      role = 'guest';
    }

    const DefinedUser = realm.define(User, {
      name: STRING,
      role: STRING,
    });
    load(DefinedUser, ['name', 'role']);

    assert.equal(realm.models.User, DefinedUser);
    assert.notEqual(DefinedUser, User);
    assert.throws(() => new User({ name: 'Ada' }), /User is not a finalized Leoric model/);

    const user = new DefinedUser({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    assert.equal(user.role, 'guest');
    assert.ok(user instanceof User);
    assert.ok(user instanceof DefinedUser);
  });

  it('does not proxy finalized instances', () => {
    @Model()
    class User extends Bone {
      #secret = 'normal instance';

      @Column({ type: STRING })
      name!: string;

      get secret() {
        return this.#secret;
      }
    }
    load(User, ['name']);

    const user = new User({ name: 'Ada' });
    assert.equal(user.secret, 'normal instance');
  });

  it('preserves instantiate(), mutation, and change tracking', () => {
    @Model()
    class Post extends Bone {
      @Column({ type: STRING })
      title!: string;

      @Column({ type: INTEGER })
      wordCount = 0;
    }
    load(Post, ['title', 'wordCount']);

    const post = Post.instantiate({ id: 1, title: 'Hello', word_count: 10 });
    assert.equal(post.title, 'Hello');
    assert.equal(post.wordCount, 10);
    assert.equal(post.isNewRecord, false);

    post.title = 'Updated';
    assert.equal(post.attribute('title'), 'Updated');
    assert.deepEqual(post.changes('title'), { title: [ 'Hello', 'Updated' ] });
  });
});

function load(ModelClass: typeof AbstractBone, names: string[]) {
  ModelClass.load(names.map(name => ({
    columnName: name === 'wordCount' ? 'word_count' : name,
    columnType: name === 'status' || name === 'wordCount' ? 'int(11)' : 'varchar(255)',
    dataType: name === 'status' || name === 'wordCount' ? 'int' : 'varchar',
    isNullable: 'YES',
  })));
}
