import { strict as assert } from 'assert';
import { Bone, DataTypes, Column, HasMany, BelongsTo, connect, HasOne } from '../../src';

const { TEXT, STRING, INTEGER } = DataTypes;

describe('=> Decorators (TypeScript)', function() {
  before(async function() {
    (Bone as any).driver = null;
    await connect({
      host: 'localhost',
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      charset: 'utf8mb4',
    });
  });

  describe('=> @Column()', function() {
    it('should be able to deduce column type from typescript', async function() {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({ allowNull: false })
        declare name: string;

        @Column({ defaultValue: true })
        declare isPrivate: boolean;

        @Column()
        declare createdAt: Date;

        @Column()
        declare updatedAt: Date;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [
        'id', 'name', 'isPrivate', 'createdAt', 'updatedAt',
      ]);
      const { id, name, isPrivate, createdAt } = Note.attributes;
      assert.equal(id.toSqlString!(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(name.toSqlString!(), '`name` VARCHAR(255) NOT NULL');
      assert.equal(isPrivate.toSqlString!(), '`is_private` TINYINT(1) DEFAULT true');
      assert.equal(createdAt.toSqlString!(), '`created_at` DATETIME');
    });

    it('should be able to override column type', async function() {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column(TEXT)
        declare content: string;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'content' ]);
      const { id, content } = Note.attributes;
      assert.equal(id.toSqlString!(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(content.toSqlString!(), '`content` TEXT');
    });

    it('should be able to override column name', async function() {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({ name: 'gmt_create' })
        declare createdAt: Date;

        @Column({ name: 'gmt_modified' })
        declare updatedAt: Date;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'createdAt', 'updatedAt' ]);
      const { id, createdAt, updatedAt } = Note.attributes;
      assert.equal(id.toSqlString!(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(createdAt.columnName, 'gmt_create');
      assert.equal(updatedAt.columnName, 'gmt_modified');
    });

    it('should work with setter', async () => {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({ defaultValue: true })
        declare isPrivate: boolean;

        @Column()
        declare createdAt: Date;

        @Column()
        declare updatedAt: Date;

        get name(): string {
          return (this.attribute('name') as string)?.toUpperCase() as string;
        }

        @Column({
          allowNull: false,
        })
        set name(v: string) {
          if (v === 'zeus') {
            this.attribute('name', 'thor');
            return;
          }
          this.attribute('name', v);
        }
      }
      await Note.sync({ force: true });
      const note = new Note({ name: 'zeus' });
      assert.equal(note.name, 'THOR');
      await note.save();
      await note.reload();
      assert.equal(note.name, 'THOR');
      assert.equal(note.attribute('name'), 'thor');
    });

    it('should work with getter', async () => {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({ defaultValue: true })
        declare isPrivate: boolean;

        @Column()
        declare createdAt: Date;

        @Column()
        declare updatedAt: Date;

        @Column({
          allowNull: false,
        })
        get name(): string {
          return (this.attribute('name') as string)?.toUpperCase() as string;
        }

        set name(v: string) {
          if (v === 'zeus') {
            this.attribute('name', 'thor');
            return;
          }
          this.attribute('name', v);
        }

        @Column(DataTypes.VIRTUAL)
        get lowerCaseName(): string {
          return this.name?.toLowerCase();
        }
      }
      await Note.sync({ force: true });
      const note = new Note({ name: 'zeus' });
      assert.equal(note.name, 'THOR');
      await note.save();
      await note.reload();
      assert.equal(note.name, 'THOR');
      assert.equal(note.attribute('name'), 'thor');
      assert.ok(Object.keys(note.toObject()).includes('lowerCaseName'));
    });

    it('should work with validate',async () => {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({
          allowNull: false,
          validate: {
            isNotNull(v?: string) {
              if (!v) throw new Error('name cannot be null');
            },
            notIn: [['Yhorm', 'Gwyn']],
          }
        })
        declare name: string;

        @Column({
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isNumeric: true,
            isIn: {
              args: [['1', '2']],
              msg: 'Error status',
            },
          },
        })
        declare status: number;

        @Column({
          type: DataTypes.INTEGER,
          validate: {
            min: 0,
            max: 10,
          },
        })
        declare count: number;
      }
      await Note.sync({ force: true });
      let note = new Note({ name: '' });
      await assert.rejects(async () => {
        await note.save();
      }, /name cannot be null/);
      note = new Note({ name: 'Yhorm' });
      await assert.rejects(async () => {
        await note.save();
      }, /Validation notIn on name failed/);

      note = new Note({ name: 'Github', status: 3 });
      await assert.rejects(async () => {
        await note.save();
      }, /Error status/);

      note = new Note({ name: 'Github', count: 11 });
      await assert.rejects(async () => {
        await note.save();
      }, /Validation max on count failed/);
    });

    it('should work with other options', async () => {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column({
          type: STRING
        })
        declare body: string;

        @Column({
          type: STRING(64)
        })
        declare description: string;

        @Column({
          type: INTEGER(2).UNSIGNED,
        })
        declare status: number;

      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'body', 'description', 'status' ]);

      const { id, body, description, status } = Note.attributes;
      assert.equal(id.toSqlString!(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(body.toSqlString!(), '`body` VARCHAR(255)');
      assert.equal(description.toSqlString!(), '`description` VARCHAR(64)');
      assert.equal(status.toSqlString!(), '`status` INTEGER(2) UNSIGNED');

    });

    it('should work with type options', async () => {
      class Note extends Bone {
        @Column({
          primaryKey: true,
          autoIncrement: true,
        })
        declare noteId: bigint;

        @Column({
          comment: 'note index',
          unique: true,
        })
        declare noteIndex: number;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'noteId', 'noteIndex' ]);

      const { noteId, noteIndex } = Note.attributes;
      assert.equal(noteId.toSqlString!(), '`note_id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(noteIndex.toSqlString!(), '`note_index` INTEGER UNIQUE COMMENT \'note index\'');
    });

    it('should work with invokable data types', async () => {
      class Note extends Bone {
        @Column()
        declare id: bigint;

        @Column(STRING)
        declare body: string;

        @Column(STRING(64))
        declare description: string;

        @Column(INTEGER(2).UNSIGNED)
        declare status: number;

      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'body', 'description', 'status' ]);

      const { id, body, description, status } = Note.attributes;
      assert.equal(id.toSqlString!(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal(body.toSqlString!(), '`body` VARCHAR(255)');
      assert.equal(description.toSqlString!(), '`description` VARCHAR(64)');
      assert.equal(status.toSqlString!(), '`status` INTEGER(2) UNSIGNED');
    });

    it('should not override attributes of parent class', async function() {
      class Base extends Bone {
        @Column()
        declare id: bigint;
      }

      class Note extends Base {
        @Column()
        declare body: string;
      }

      class Comment extends Note {
        static table = 'comments';

        @Column()
        declare targetType: string;

        @Column()
        declare targetId: number;
      }

      class SubContent extends Comment {
        static table = 'contents';

        @Column()
        declare description: string;

        @Column({
          allowNull: false,
        })
        declare status: number;
      }

      // normal subclass that not sync will inherent all the features from parent class
      class ContentChildClass extends SubContent {
        getMyDesc() {
          return this.description?.toUpperCase();
        }
      }

      await Note.sync({ force: true });
      await Comment.sync({ force: true });
      await SubContent.sync({ force: true });

      assert.deepEqual(Object.keys(Base.attributes), ['id']);
      assert.deepEqual(Object.keys(Note.attributes), ['id', 'body']);
      assert.deepEqual(Object.keys(Comment.attributes), ['id', 'body', 'targetType', 'targetId']);
      assert.deepEqual(Object.keys(SubContent.attributes), ['id', 'body', 'targetType', 'targetId', 'description', 'status']);
      assert.equal(SubContent.table, 'contents');
      assert.equal(Note.table, 'notes');
      assert.equal(Comment.table, 'comments');
      assert.equal(ContentChildClass.table, 'contents');

      const note = await Note.create({
        body: 'yes',
      });
      assert.ok(note.id);
      assert.equal(note.body, 'yes');

      const comment = await Comment.create({
        body: 'halo',
        targetId: 1,
        targetType: 'User',
      });
      assert.ok(comment.id);
      assert.equal(comment.body, 'halo');
      assert.equal(comment.targetType, 'User');

      const subContent = await SubContent.create({
        body: 'hello',
        targetId: 2,
        targetType: 'Book',
        description: 'desc',
        status: 1,
      });

      assert.ok(subContent.id);
      assert.equal(subContent.body, 'hello');
      assert.equal(subContent.targetType, 'Book');
      assert.equal(subContent.description, 'desc');
      assert.equal(subContent.status, 1);

      const contentChildInstance = await ContentChildClass.create({
        body: 'bloodborne',
        targetId: 3,
        targetType: 'Book',
        description: 'bloodborne',
        status: 1,
      });

      assert.ok(contentChildInstance.id);
      assert.equal(contentChildInstance.body, 'bloodborne');
      assert.equal(contentChildInstance.targetType, 'Book');
      assert.equal(contentChildInstance.description, 'bloodborne');
      assert.equal(contentChildInstance.status, 1);
      assert.equal(contentChildInstance.getMyDesc(), 'bloodborne'.toUpperCase());

    });
  });

  describe('=> @HasMany()', function() {
    class Note extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare memberId: bigint;
    }

    class Member extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare email: string;

      @HasMany()
      declare notes: Note[];
    }

    before(async function() {
      Object.assign(Bone.models, { Note, Member });
      await Note.sync({ force: true });
      await Member.sync({ force: true });
      // TODO: merge this method into `static sync()`?
      Member.initialize();
    });

    beforeEach(async function() {
      await Promise.all([
        Note.truncate(),
        Member.truncate(),
      ]);
    });

    it('should be able to declare 1:n association', async function() {
      const { id: memberId } = await Member.create({ email: 'hi@example.com' });
      await Note.create({ memberId });
      const member = await Member.findOne().with('notes');
      assert.equal(member!.notes.length, 1);
      assert.ok(member!.notes[0] instanceof Note);
      assert.equal(member!.notes[0].memberId, memberId);
    });
  });

  describe('=> @HasMany({ through })', function() {
    class Tag extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare type: number;

      @Column()
      declare name: string;
    }

    enum TARGET_TYPE {
      note = 1,
    }

    class TagMap extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare targetId: bigint;

      @Column()
      declare targetType: number;

      @Column()
      declare tagId: bigint;

      @BelongsTo()
      declare tag: Tag;
    }

    class Note extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare content: string;

      @HasMany({
        foreignKey: 'targetId',
        where: { targetType: TARGET_TYPE.note },
      })
      declare tagMaps: TagMap[];

      @HasMany({ through: 'tagMaps' })
      declare tags: Tag[];
    }

    before(async function() {
      Object.assign(Bone.models, { Note, TagMap, Tag });
      await Note.sync({ force: true });
      await TagMap.sync({ force: true });
      await Tag.sync({ force: true });
      TagMap.initialize();
      Note.initialize();
    });

    beforeEach(async function() {
      await Promise.all([
        Note.truncate(),
        TagMap.truncate(),
        Tag.truncate(),
      ]);
    });

    it('should be able to declare n:m association', async function() {
      const note = await Note.create({ content: '明月几时有' });
      const tag = await Tag.create({ name: '中秋' });
      await TagMap.create({ targetId: note.id, targetType: TARGET_TYPE.note, tagId: tag.id });
      const result = await Note.findOne().with('tags');
      assert.ok(Array.isArray(result!.tagMaps));
      assert.ok(Array.isArray(result!.tags));
      assert.equal(result!.tags.length, 1);
      assert.equal(result!.tags[0].name, '中秋');
    });
  });

  describe('HasMany({ select })', function() {
    class Note extends Bone {
      @Column()
      declare id: bigint;

      @Column({ type: DataTypes.TEXT })
      declare content: string;

      @Column()
      declare memberId: bigint;
    }

    class Member extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare email: string;

      @HasMany({
        select(name) {
          return name !== 'content';
        },
      })
      declare notes?: Note[];
    }

    before(async function() {
      Object.assign(Bone.models, { Note, Member });
      await Note.sync({ force: true });
      await Member.sync({ force: true });
      // TODO: merge this method into `static sync()`?
      Member.initialize();
    });

    beforeEach(async function() {
      await Promise.all([
        Note.truncate(),
        Member.truncate(),
      ]);
    });

    it('should be able to filter select fields of association', async function() {
      const member = await Member.create({ email: 'hi@example.com' });
      await Note.create({ memberId: member.id, content: 'hello' });
      const result = await Member.findOne().with('notes');
      assert.equal(result!.notes?.length, 1);
      assert.equal(result!.notes?.[0].content, undefined);
      const [note] = result!.notes;
      await note.reload();
      assert.equal(note.content, 'hello');
    });
  });

  describe('HasOne()', function() {
    class Profile extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare bio: string;

      @Column()
      declare userId: bigint;
    }

    class User extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare username: string;

      @HasOne()
      declare profile?: Profile;
    }

    before(async function() {
      Object.assign(Bone.models, { User, Profile });
      await Profile.sync({ force: true });
      await User.sync({ force: true });
      User.initialize();
    });

    beforeEach(async function() {
      await Promise.all([
        User.truncate(),
        Profile.truncate(),
      ]);
    });

    it('should be able to declare 1:1 association', async function() {
      const user = await User.create({ username: 'alice' });
      await Profile.create({ bio: 'Hello, I am Alice.', userId: user.id });
      const result = await User.findOne().with('profile');
      assert.ok(result!.profile);
      assert.equal(result!.profile!.bio, 'Hello, I am Alice.');
    });
  });

  describe('BelongsTo()', function() {
    class Member extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare email: string;
    }

    class Note extends Bone {
      @Column()
      declare id: bigint;

      @Column()
      declare content: string;

      @Column()
      declare authorId: bigint;

      @BelongsTo({ foreignKey: 'authorId', className: 'Member' })
      declare author?: Member;
    }

    before(async function() {
      Object.assign(Bone.models, { Note, Member });
      await Note.sync({ force: true });
      await Member.sync({ force: true });
      // TODO: merge this method into `static sync()`?
      Note.initialize();
    });

    beforeEach(async function() {
      await Promise.all([
        Note.truncate(),
        Member.truncate(),
      ]);
    });

    it('should inference the type of note.author correctly', async function() {
      const member = await Member.create({ email: 'hi@example.com' });
      await Note.create({ authorId: member.id, content: 'hello' });
      const note = await Note.findOne().with('author');
      assert.ok(note!.author);
      assert.equal(note!.author.email, member.email);
    });
  });
});
