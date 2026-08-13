import assert from 'assert';
import Realm, {
  Bone,
  BelongsTo,
  Column,
  DataTypes,
  LeoricClassFieldError,
  LeoricModelCompilationError,
  LeoricModelDefinitionError,
  Model,
  connect,
} from '../../src';
import { AbstractBone } from '../../src/abstract_bone';
import { ASSOCIATE_METADATA_MAP } from '../../src/constants';

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

  it('rejects a concrete model before registration', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }

    assert.throws(
      () => new User({ name: 'Ada' }),
      error => error instanceof LeoricModelDefinitionError
        && /Add it to the realm models/.test(error.message),
    );
  });

  it('registers direct models without replacing them', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }

    const registered = realm.registerModel(User);
    load(User, ['name']);

    assert.equal(registered, User);
    const user = new User({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    user.name = 'Grace';
    assert.equal(user.attribute('name'), 'Grace');
  });

  it('registers direct models supplied to Realm', () => {
    class User extends Bone {
      declare name: string;
    }

    const localRealm = new Realm({ models: [ User ] });
    User.init({ name: STRING }, { timestamps: false });
    load(User, ['name']);

    assert.equal(localRealm.models.User, User);
    assert.equal(new User({ name: 'Ada' }).name, 'Ada');
  });

  it('treats explicit attribute loading as direct-model setup', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }

    load(User, ['name']);

    assert.equal(new User({ name: 'Ada' }).name, 'Ada');
  });

  it('reports unsafe fields on the first ORM-managed direct instance', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;

      constructor(...args: ConstructorParameters<typeof Bone>) {
        super(...args);
        Object.defineProperty(this, 'name', {
          value: undefined,
          configurable: true,
          enumerable: true,
          writable: true,
        });
      }
    }

    realm.registerModel(User);
    load(User, ['name']);

    assert.throws(
      () => User.instantiate({ name: 'Ada' }),
      error => error instanceof LeoricClassFieldError
        && error.modelName === 'User'
        && error.attributeName === 'name'
        && /Add `declare`/.test(error.message),
    );
  });

  it('caches successful direct-model field validation', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }

    realm.registerModel(User);
    load(User, ['name']);

    assert.equal(User.instantiate({ name: 'Ada' }).name, 'Ada');
    assert.equal(User.instantiate({ name: 'Grace' }).name, 'Grace');
  });

  it('compiles decorated fields without running their initializers', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name!: string;

      @Column({ type: STRING, defaultValue: 'member' })
      role = 'field initializer is not executed';

      cache = new Map<string, string>();
    }
    load(User, ['name', 'role']);

    const user = new User({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    assert.equal(user.role, 'member');
    assert.equal(user.attribute('role'), 'member');
    assert.equal(user.cache, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(user, 'name'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(user, 'role'), false);
  });

  it('does not execute a compiled definition constructor', () => {
    let constructed = 0;

    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name!: string;

      constructor(values: { name?: string } = {}) {
        constructed++;
        super({ ...values, name: values.name?.toUpperCase() });
      }
    }
    load(User, ['name']);

    assert.equal(new User({ name: 'Ada' }).name, 'Ada');
    assert.equal(constructed, 0);
  });

  it('copies methods, accessors, and public static configuration', () => {
    @Model()
    class User extends Bone {
      static table = 'people';
      static indexes = [{ fields: ['name'], unique: true }] as const;

      @Column({ type: STRING })
      get name(): string {
        return String(this.attribute('name')).toUpperCase();
      }

      set name(value: string) {
        this.attribute('name', value.trim());
      }

      greet() {
        return `Hello ${this.name}`;
      }
    }
    load(User, ['name']);

    const user = new User({ name: '  Ada  ' });
    assert.equal(User.table, 'people');
    assert.deepEqual(User.indexes, [{ fields: ['name'], unique: true }]);
    assert.equal(user.name, 'ADA');
    assert.equal(user.attribute('name'), 'Ada');
    assert.equal(user.greet(), 'Hello ADA');
  });

  it('compiles children onto an already compiled parent', () => {
    @Model()
    class User extends Bone {
      @Column({ type: STRING })
      name!: string;

      greet() {
        return `Hello ${this.name}`;
      }
    }

    @Model()
    class Admin extends User {
      @Column({ type: INTEGER })
      level = 1;
    }
    load(Admin, ['name', 'level']);

    const admin = new Admin({ name: 'Ada', level: 2 });
    assert.ok(admin instanceof User);
    assert.equal(admin.greet(), 'Hello Ada');
    assert.equal(admin.level, 2);
  });

  it('compiles an unready definition chain onto the nearest ready base', () => {
    class BaseUser extends Bone {
      baseField = 'not executed';

      baseMethod() {
        return 'base method';
      }
    }

    const User = Model()(class User extends BaseUser {
      userField = 'not executed';
    });

    const user = new User();
    assert.equal(user.baseField, undefined);
    assert.equal(user.userField, undefined);
    assert.equal(user.baseMethod(), 'base method');
    assert.equal(user instanceof BaseUser, false);
  });

  it('preserves lexical super calls while flattening a definition chain', () => {
    class BaseUser extends Bone {
      greet() {
        return 'Hello';
      }
    }

    const User = Model()(class User extends BaseUser {
      greet() {
        return `${super.greet()} Ada`;
      }
    });

    assert.equal(new User().greet(), 'Hello Ada');
  });

  it('copies association metadata collected before class compilation', () => {
    @Model()
    class User extends Bone {}

    @Model()
    class Post extends Bone {
      @BelongsTo({ className: 'User', foreignKey: 'authorId' })
      declare author: User;
    }

    assert.deepEqual(Reflect.getMetadata(ASSOCIATE_METADATA_MAP.belongsTo, Post), {
      author: { className: 'User', foreignKey: 'authorId' },
    });
  });

  it('copies class-level prototype metadata', () => {
    const metadataKey = Symbol('prototype metadata');
    class UserDefinition extends Bone {}
    Reflect.defineMetadata(metadataKey, { enabled: true }, UserDefinition.prototype);

    const User = Model()(UserDefinition);

    assert.deepEqual(Reflect.getOwnMetadata(metadataKey, User.prototype), { enabled: true });
  });

  it('reuses a compiled model through the direct decorator form', () => {
    @Model()
    class User extends Bone {}

    assert.equal(Model(User), User);
  });

  it('rejects compilation of classes outside the Bone hierarchy', () => {
    class NotAModel {}

    assert.throws(
      () => Model()(NotAModel as unknown as typeof Bone),
      error => error instanceof LeoricModelCompilationError
        && /must extend Bone or another Leoric model/.test(error.message),
    );
  });

  it('requires every concrete direct leaf to be registered', () => {
    class User extends Bone {
      @Column({ type: STRING })
      declare name: string;
    }
    realm.registerModel(User);

    class Admin extends User {
      @Column({ type: STRING })
      declare role: string;
    }

    assert.throws(() => new Admin({ name: 'Ada' }), /Admin is not a registered Leoric model/);
  });

  it('allows transparent runtime subclasses of compiled models', () => {
    @Model()
    class Post extends Bone {
      @Column({ type: STRING })
      title!: string;
    }
    load(Post, ['title']);

    const RequestScopedPost = class extends Post {
      static get ctx() { return {}; }
    };

    assert.equal(new RequestScopedPost({ title: 'Hello' }).title, 'Hello');
    assert.equal(RequestScopedPost.instantiate({ title: 'World' }).title, 'World');
  });

  it('compiles and registers the class overload of realm.define()', () => {
    class UserDefinition extends Bone {
      name!: string;
      role = 'field initializer is not executed';

      greet() {
        return `Hello ${this.name}`;
      }
    }

    const User = realm.define(UserDefinition, {
      name: STRING,
      role: { type: STRING, defaultValue: 'member' },
    });
    load(User, ['name', 'role']);

    assert.equal(realm.models.UserDefinition, User);
    assert.notEqual(User, UserDefinition);

    const user = new User({ name: 'Ada' });
    assert.equal(user.name, 'Ada');
    assert.equal(user.role, 'member');
    assert.equal(user.greet(), 'Hello Ada');
    assert.equal(user instanceof UserDefinition, false);
    assert.ok(user instanceof User);
  });

  it('rejects a realm definition outside its Bone hierarchy', () => {
    class User {}

    assert.throws(
      () => realm.define(User as unknown as typeof Bone),
      /User must extend this realm's Bone/,
    );
  });

  it('registers a compiled class overload without explicit attributes', () => {
    @Model()
    class Marker extends Bone {}

    assert.equal(realm.define(Marker), Marker);
    assert.equal(realm.models.Marker, Marker);
  });

  it('keeps the string overload of realm.define() as the generated path', () => {
    const User = realm.define('GeneratedUser', {
      name: STRING,
    }, { timestamps: false });
    load(User, ['name']);

    assert.equal(realm.models.GeneratedUser, User);
    assert.equal(new User({ name: 'Ada' }).name, 'Ada');
  });

  it('preserves instantiate(), mutation, and change tracking on compiled models', () => {
    @Model()
    class Post extends Bone {
      @Column({ type: STRING })
      title!: string;

      @Column({ type: INTEGER })
      wordCount!: number;
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
    columnType: name === 'level' || name === 'wordCount' ? 'int(11)' : 'varchar(255)',
    dataType: name === 'level' || name === 'wordCount' ? 'int' : 'varchar',
    isNullable: 'YES',
  })));
}
