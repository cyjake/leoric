import { strict as assert } from 'assert';
import { AttributeMeta, Bone, DataTypes, Column, HasMany, connect } from '../..';

const { TEXT } = DataTypes;

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
