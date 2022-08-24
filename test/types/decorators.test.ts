import { strict as assert } from 'assert';
import { AttributeMeta, Bone, DataTypes, Column, HasMany, connect } from '../..';

const { TEXT, STRING, INTEGER } = DataTypes;

describe('=> Decorators (TypeScript)', function() {
  before(async function() {
    Bone.driver = null;
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
        id: bigint;

        @Column({ allowNull: false })
        name: string;

        @Column({ defaultValue: true })
        isPrivate: boolean;

        @Column()
        createdAt: Date;

        @Column()
        updatedAt: Date;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [
        'id', 'name', 'isPrivate', 'createdAt', 'updatedAt',
      ]);
      const { id, name, isPrivate, createdAt } = Note.attributes;
      assert.equal((id as AttributeMeta).toSqlString(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal((name as AttributeMeta).toSqlString(), '`name` VARCHAR(255) NOT NULL');
      assert.equal((isPrivate as AttributeMeta).toSqlString(), '`is_private` TINYINT(1) DEFAULT true');
      assert.equal((createdAt as AttributeMeta).toSqlString(), '`created_at` DATETIME');
    });

    it('should be able to override column type', async function() {
      class Note extends Bone {
        @Column()
        id: bigint;

        @Column(TEXT)
        content: string;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'content' ]);
      const { id, content } = Note.attributes;
      assert.equal((id as AttributeMeta).toSqlString(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal((content as AttributeMeta).toSqlString(), '`content` TEXT');
    });

    it('should be able to override column name', async function() {
      class Note extends Bone {
        @Column()
        id: bigint;

        @Column({ name: 'gmt_create' })
        createdAt: Date;

        @Column({ name: 'gmt_modified' })
        updatedAt: Date;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'createdAt', 'updatedAt' ]);
      const { id, createdAt, updatedAt } = Note.attributes;
      assert.equal((id as AttributeMeta).toSqlString(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal((createdAt as AttributeMeta).columnName, 'gmt_create');
      assert.equal((updatedAt as AttributeMeta).columnName, 'gmt_modified');
    });

    it('should work with setter', async () => {
      class Note extends Bone {
        @Column()
        id: bigint;

        @Column({ defaultValue: true })
        isPrivate: boolean;

        @Column()
        createdAt: Date;

        @Column()
        updatedAt: Date;

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
        id: bigint;

        @Column({ defaultValue: true })
        isPrivate: boolean;

        @Column()
        createdAt: Date;

        @Column()
        updatedAt: Date;

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
      }
      await Note.sync({ force: true });
      const note = new Note({ name: 'zeus' });
      assert.equal(note.name, 'THOR');
      await note.save();
      await note.reload();
      assert.equal(note.name, 'THOR');
      assert.equal(note.attribute('name'), 'thor');
    });

    it('should work with validate',async () => {
      class Note extends Bone {
        @Column()
        id: bigint;

        @Column({ 
          allowNull: false,
          validate: {
            isNotNull(v?: string) {
              if(!v) throw new Error('name cannot be null')
            },
            notIn: [ [ 'Yhorm', 'Gwyn' ] ],
          }
        })
        name: string;

        @Column({
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: {
            isNumeric: true,
            isIn: {
              args: [ [ '1', '2' ] ],
              msg: 'Error status',
            },
          },
        })
        status: number;
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
    });

    it('should work with other options', async () => {
      class Note extends Bone {
        @Column()
        id: bigint;

        @Column({
          type: STRING
        })
        body: string;

        @Column({
          type: STRING(64)
        })
        description: string;

        @Column({
          type: INTEGER(2).UNSIGNED,
        })
        status: number;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'id', 'body', 'description', 'status' ]);

      const { id, body, description, status } = Note.attributes;
      assert.equal((id as AttributeMeta).toSqlString(), '`id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal((body as AttributeMeta).toSqlString(), '`body` VARCHAR(255)');
      assert.equal((description as AttributeMeta).toSqlString(), '`description` VARCHAR(64)');
      assert.equal((status as AttributeMeta).toSqlString(), '`status` INTEGER(2) UNSIGNED');

    });

    it('should work with type options', async () => {
      class Note extends Bone {
        @Column({
          primaryKey: true,
          autoIncrement: true,
        })
        noteId: bigint;

        @Column({
          comment: 'note index',
          unique: true,
        })
        noteIndex: number;
      }
      await Note.sync({ force: true });
      assert.deepEqual(Object.keys(Note.attributes), [ 'noteId', 'noteIndex' ]);

      const { noteId, noteIndex } = Note.attributes;
      assert.equal((noteId as AttributeMeta).toSqlString(), '`note_id` BIGINT PRIMARY KEY AUTO_INCREMENT');
      assert.equal((noteIndex as AttributeMeta).toSqlString(), '`note_index` INTEGER UNIQUE COMMENT \'note index\'');
    });
  });

  describe('=> @HasMany()', function() {
    class Note extends Bone {
      @Column()
      id: bigint;

      @Column()
      memberId: bigint;
    }

    class Member extends Bone {
      @Column()
      id: bigint;

      @Column()
      email: string;

      @HasMany()
      notes: Note[];
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
    })

    it('should be able to declare 1:n association', async function() {
      const { id: memberId } = await Member.create({ email: 'hi@example.com' });
      await Note.create({ memberId })
      const member = await Member.findOne().with('notes');
      assert.equal(member.notes.length, 1);
      assert.ok(member.notes[0] instanceof Note);
      assert.equal(member.notes[0].memberId, memberId);
    });
  });
});
