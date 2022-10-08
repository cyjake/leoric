import { strict as assert } from 'assert';
import sinon from 'sinon';

import { 
  Bone, DataTypes, Column,
  connect, INDEX_HINT_SCOPE_TYPE,
  INDEX_HINT_TYPE, INDEX_HINT_SCOPE, Hint, IndexHint, Raw
} from '../..';

describe('=> Spell (TypeScript)', function() {
  const { STRING, TEXT, TINYINT } = DataTypes;
  class Post extends Bone {
    static table = 'articles'

    @Column()
    id: bigint;

    @Column()
    authorId: bigint

    @Column()
    title: string;

    @Column({
      name: 'gmt_create',
    })
    createdAt: Date;

    @Column({
      name: 'gmt_modified',
    })
    updatedAt: Date;

    @Column({
      name: 'gmt_deleted',
    })
    deletedAt: Date;

    @Column(TEXT)
    content: string;

    @Column(TEXT)
    extra: string;

    @Column(STRING(1000))
    thumb: string;

    @Column({
      type: TINYINT,
      defaultValue: 0,
    })
    isPrivate: number;

    @Column(TEXT)
    summary: string;

    @Column({
      defaultValue: 0,
    })
    word_count: number;

    @Column(TEXT)
    settings: string;
  }

  before(async function() {
    Bone.driver = null;
    await connect({
      host: 'localhost',
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Post ],
    });
  });

  after(() => {
    Bone.driver = null;
  });

  it('get/first/last/all', () => {
    assert.equal(Post.where({ id: 1 }).get(2).toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL LIMIT 1 OFFSET 2');
    assert.equal(Post.where({ id: 1 }).first.toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL ORDER BY `id` LIMIT 1');
    assert.equal(Post.where({ id: 1 }).last.toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL ORDER BY `id` DESC LIMIT 1');
    assert.equal(Post.where({ id: 1 }).all.toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL');
  });

  it('unscoped/unparanoid', () => {
    assert.equal(Post.where({ id: 1 }).unscoped.toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1');
    assert.equal(Post.where({ id: 1 }).unparanoid.toSqlString(), 'SELECT * FROM `articles` WHERE `id` = 1');
  });

  describe('hints', () => {
    it('optimizerHints', () => {
      assert.equal(
        Post.update({ id: 1 }, { title: 'ssss' }, { silent: true }).optimizerHints('idx_title').toSqlString(),
        'UPDATE /*+ idx_title */ `articles` SET `title` = \'ssss\' WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );

      assert.equal(
        Post.update({ id: 1 }, { title: 'ssss' }, { silent: true }).optimizerHints('idx_title', 'idx_user_id').toSqlString(),
        'UPDATE /*+ idx_title idx_user_id */ `articles` SET `title` = \'ssss\' WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );

      assert.equal(
        Post.update({ id: 1 }, { title: 'ssss' }, { silent: true }).order('authorId').optimizerHints(
          'idx_title',
          'idx_user_id',
          { index: 'idx_is' },
          { index: 'idx_hello', type: INDEX_HINT_TYPE.use, scope: INDEX_HINT_SCOPE.orderBy },
          new Hint('idx_halo'),
          new IndexHint('idx_haw', INDEX_HINT_TYPE.ignore, INDEX_HINT_SCOPE.orderBy)
        ).toSqlString(),
        'UPDATE /*+ idx_title idx_user_id idx_halo */ `articles` USE INDEX (idx_is) USE INDEX FOR ORDER BY (idx_hello) IGNORE INDEX FOR ORDER BY (idx_haw) SET `title` = \'ssss\' WHERE `id` = 1 AND `gmt_deleted` IS NULL ORDER BY `author_id`'
      );
    });

    it('useIndex', () => {
      assert.equal(Post.where({ id: 1 })
        .useIndex(
          'idx_user',
          { [INDEX_HINT_SCOPE_TYPE.orderBy]: 'idx_yes' },
          { index: 'idx_is' },
          new IndexHint('idx_haw', INDEX_HINT_TYPE.use, INDEX_HINT_SCOPE.orderBy)
        )
        .toSqlString(),
        'SELECT * FROM `articles` USE INDEX (idx_user,idx_is) USE INDEX FOR ORDER BY (idx_yes,idx_haw) WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );
    });

    it('forceIndex', () => {
      assert.equal(Post.where({ id: 1 })
        .forceIndex(
          'idx_user',
          { [INDEX_HINT_SCOPE_TYPE.orderBy]: 'idx_yes' },
          { index: 'idx_is' },
          new IndexHint('idx_haw', INDEX_HINT_TYPE.force, INDEX_HINT_SCOPE.orderBy)
        )
        .toSqlString(),
        'SELECT * FROM `articles` FORCE INDEX (idx_user,idx_is) FORCE INDEX FOR ORDER BY (idx_yes,idx_haw) WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );
    });

    it('ignoreIndex', () => {
      assert.equal(Post.where({ id: 1 })
        .ignoreIndex(
          'idx_user',
          { [INDEX_HINT_SCOPE_TYPE.orderBy]: 'idx_yes' },
          { index: 'idx_is' },
          new IndexHint('idx_haw', INDEX_HINT_TYPE.ignore, INDEX_HINT_SCOPE.orderBy)
        )
        .toSqlString(),
        'SELECT * FROM `articles` IGNORE INDEX (idx_user,idx_is) IGNORE INDEX FOR ORDER BY (idx_yes,idx_haw) WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );
    });

    it('mixing', () => {
      assert.equal(
        Post.update({ id: 1 }, { title: 'ssss' }, { 
          silent: true,
          hints: [
            'idx_title',
            'idx_user_id',
            { index: 'idx_is' },
            { index: 'idx_hello', type: INDEX_HINT_TYPE.use, scope: INDEX_HINT_SCOPE.orderBy },
            new Hint('idx_halo'),
            new IndexHint('idx_haw', INDEX_HINT_TYPE.ignore, INDEX_HINT_SCOPE.orderBy)
          ]
        }).order('authorId').toSqlString(),
        'UPDATE /*+ idx_title idx_user_id idx_halo */ `articles` USE INDEX (idx_is) USE INDEX FOR ORDER BY (idx_hello) IGNORE INDEX FOR ORDER BY (idx_haw) SET `title` = \'ssss\' WHERE `id` = 1 AND `gmt_deleted` IS NULL ORDER BY `author_id`'
      );
    });
  });

  describe('Num', () => {
    let clock;
    before(() => {
      const date = new Date(2017, 11, 12);
      const fakeDate = date.getTime();
      sinon.useFakeTimers(fakeDate);
    });
  
    after(() => {
      clock?.restore();
    });
  
    it('count', () => {
      assert.equal(Post.all.count('authorId').toSqlString(), 'SELECT COUNT(`author_id`) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL');
      assert.equal(Post.all.count(new Raw(`DISTINCT(author_id)`)).toSqlString(), 'SELECT COUNT(DISTINCT(author_id)) AS count FROM `articles` WHERE `gmt_deleted` IS NULL');
    });

    it('average', () => {
      assert.equal(Post.all.average('word_count').toSqlString(), 'SELECT AVG(`word_count`) AS `average` FROM `articles` WHERE `gmt_deleted` IS NULL');
      assert.equal(Post.all.average(new Raw(`DISTINCT(word_count)`)).toSqlString(), 'SELECT AVG(DISTINCT(word_count)) AS average FROM `articles` WHERE `gmt_deleted` IS NULL');
    });

    it('minimum', () => {
      assert.equal(Post.all.minimum('word_count').toSqlString(), 'SELECT MIN(`word_count`) AS `minimum` FROM `articles` WHERE `gmt_deleted` IS NULL');
      assert.equal(Post.all.minimum(new Raw(`DISTINCT(word_count)`)).toSqlString(), 'SELECT MIN(DISTINCT(word_count)) AS minimum FROM `articles` WHERE `gmt_deleted` IS NULL');
    });

    it('maximum', () => {
      assert.equal(Post.all.maximum('word_count').toSqlString(), 'SELECT MAX(`word_count`) AS `maximum` FROM `articles` WHERE `gmt_deleted` IS NULL');
      assert.equal(Post.all.maximum(new Raw(`DISTINCT(word_count)`)).toSqlString(), 'SELECT MAX(DISTINCT(word_count)) AS maximum FROM `articles` WHERE `gmt_deleted` IS NULL');
    });

    it('sum', () => {
      assert.equal(Post.all.sum('word_count').toSqlString(), 'SELECT SUM(`word_count`) AS `sum` FROM `articles` WHERE `gmt_deleted` IS NULL');
      assert.equal(Post.all.sum(new Raw(`DISTINCT(word_count)`)).toSqlString(), 'SELECT SUM(DISTINCT(word_count)) AS sum FROM `articles` WHERE `gmt_deleted` IS NULL');
    });

    it('increment', () => {
      assert.equal(Post.all.increment('word_count').toSqlString(), 'UPDATE `articles` SET `word_count` = `word_count` + 1, `gmt_modified` = \'2017-12-12 00:00:00.000\' WHERE `gmt_deleted` IS NULL');
    });

    it('decrement', () => {
      assert.equal(Post.all.decrement('word_count').toSqlString(), 'UPDATE `articles` SET `word_count` = `word_count` - 1, `gmt_modified` = \'2017-12-12 00:00:00.000\' WHERE `gmt_deleted` IS NULL');
    });
  });
});
