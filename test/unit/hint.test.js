'use strict';

const assert = require('assert').strict;

const {
  connect, Bone,
  Hint, IndexHint, INDEX_HINT_TYPE, INDEX_HINT_SCOPE,
} = require('../../src');

describe('Hint', () => {
  it('.build() should throw if unknown hint', () => {
    assert.throws(() => {
      Hint.build(123);
    }, /unknown hint/i);

    assert.throws(() => {
      Hint.build({});
    }, /unknown hint/i);

    assert.throws(() => {
      Hint.build(null);
    }, /unknown hint/i);
  });

  it('text= should strip comment syntax', () => {
    const hint = new Hint('/*+ SET_VAR(foreign_key_checks=OFF) */');
    assert.equal(hint.text, 'SET_VAR(foreign_key_checks=OFF)');
  });

  it('text= should throw when value is not valid', () => {
    assert.throws(() => {
      new Hint(123);
    }, /unknown optimizer hint/i);
  });

  it('isEqual() should compare with actual hint text', () => {
    const hint = new Hint('SET_VAR(foreign_key_checks=OFF)');
    const hint2 = new Hint('SET_VAR(foreign_key_checks=OFF)');
    assert.notEqual(hint, hint2);
    assert.ok(hint.isEqual(hint2));
  });
});

describe('IndexHint', () => {
  it('.build() should throw if unknown index hint', () => {
    assert.throws(() => {
      IndexHint.build({ orderBy: null });
    }, /unknown index hint/i);

    assert.throws(() => {
      IndexHint.build(456);
    }, /unknown index hint/i);

    assert.throws(() => {
      IndexHint.build({});
    }, /unknown index hint/i);
  });

  it('.build() should create IndexHint from plain object', () => {
    const obj = { index: 'idx_name', type: INDEX_HINT_TYPE.force, scope: INDEX_HINT_SCOPE.groupBy };
    const hint = IndexHint.build(obj);
    assert.ok(hint instanceof IndexHint);
    assert.deepEqual(hint.index, ['idx_name']);
    assert.equal(hint.type, INDEX_HINT_TYPE.force);
    assert.equal(hint.scope, INDEX_HINT_SCOPE.groupBy);
  });

  it('.build() should return as is if input is IndexHint', () => {
    const hint = new IndexHint('idx_name');
    assert.strictEqual(IndexHint.build(hint), hint);
  });

  it('.merge() should return as is if input is not IndexHint array', () => {
    assert.equal(IndexHint.merge(null), null);
    assert.deepEqual(IndexHint.merge([]), []);
  });

  it('index= should convert value to string[]', () => {
    const hint = new IndexHint('idx_name');
    assert.deepEqual(hint.index, ['idx_name']);
  });

  it('index= should throw when value is not valid', () => {
    assert.throws(() => {
      const hint = new IndexHint('idx_name');
      hint.index = '';
    }, /unknown index hint/i);

    assert.throws(() => {
      const hint = new IndexHint('idx_name');
      hint.index = 123;
    }, /unknown index hint/i);
  });

  it('type= should throw when value is not valid', () => {
    const hint = new IndexHint('idx_name');
    assert.doesNotThrow(() => {
      hint.type = INDEX_HINT_TYPE.force;
      assert.equal(hint.type, INDEX_HINT_TYPE.force);
    });
    assert.throws(() => {
      hint.type = 'foo';
    }, /unknown index hint type/i);
  });

  it('scope= should throw when value is not valid', () => {
    const hint = new IndexHint('idx_name', INDEX_HINT_TYPE.ignore, INDEX_HINT_SCOPE.groupBy);
    assert.equal(hint.scope, INDEX_HINT_SCOPE.groupBy);
    assert.throws(() => {
      hint.scope = 'bar';
    }, /unknown index hint scope/i);
  });
});

describe('MySQL', async () => {
  class Post extends Bone {
    static table = 'articles';
  }

  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ Post ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  describe('optimizer hint', () => {
    it('insert', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, {
          hint: new Hint('SET_VAR(foreign_key_checks=OFF)')
        }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );
      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date })
          .optimizerHints('SET_VAR(foreign_key_checks=OFF)')
          .toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );
      // array
      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, {
          hints: [
            new Hint('SET_VAR(foreign_key_checks=OFF)'),
            new Hint('SET_VAR(sort_buffer_size = 16M)'),
          ],
        }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date })
          .optimizerHints('SET_VAR(foreign_key_checks=OFF)', 'SET_VAR(sort_buffer_size = 16M)')
          .toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).optimizerHints('SET_VAR(foreign_key_checks=OFF)').optimizerHints('SET_VAR(sort_buffer_size = 16M)').toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, {
          hints: [
            new Hint('SET_VAR(foreign_key_checks=OFF)'),
            new Hint('SET_VAR(sort_buffer_size = 16M)'),
            new Hint('BKA(users)'),
          ],
        }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) BKA(users) */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, {
          hint: new Hint('SET_VAR(optimizer_switch = \'mrr_cost_based=off\')'),
          hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('SET_VAR(sort_buffer_size = 16M)') ]
        }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) SET_VAR(optimizer_switch = 'mrr_cost_based=off') */ INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
      );
    });

    it('find', () => {
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }).optimizerHints('SET_VAR(foreign_key_checks=OFF)').toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }).optimizerHints('SET_VAR(foreign_key_checks=OFF)', 'MAX_EXECUTION_TIME(1000)').toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });

    it('update', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) */ `articles` SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ `articles` SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });

    it('delete', () => {
      assert.equal(
        Post.remove({ title: { $like: '%Post%' } }, true , { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "DELETE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ FROM `articles` WHERE `title` LIKE '%Post%'"
      );
    });

  });

  describe('index hint', () => {
    it('find', () => {
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }).useIndex('idx_title').toString(),
        "SELECT * FROM `articles` USE INDEX (idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      // unique and merge
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hints: [ new IndexHint('idx_id'), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "SELECT * FROM `articles` USE INDEX (idx_id,idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      // use for
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { order: 'id', hints: [ new IndexHint('idx_id', INDEX_HINT_TYPE.use, INDEX_HINT_SCOPE.orderBy), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "SELECT * FROM `articles` USE INDEX FOR ORDER BY (idx_id) USE INDEX (idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, {
          order: 'id asc',
          hints: [
            new IndexHint('idx_id', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force, INDEX_HINT_SCOPE.orderBy), // USE INDEX FOR ** ()
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle1', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle2', INDEX_HINT_TYPE.use),
          ]
        }).toString(),
        "SELECT * FROM `articles` FORCE INDEX (idx_id,idx_title) FORCE INDEX FOR ORDER BY (idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { order: 'id asc' })
          .forceIndex('idx_id', 'idx_title')
          .forceIndex('idx_title')
          .forceIndex({ orderBy: 'idx_title' })
          .ignoreIndex('idx_hle', 'idx_hle1')
          .ignoreIndex('idx_hle')
          .useIndex('idx_hle2')
          .toString(),
        "SELECT * FROM `articles` FORCE INDEX (idx_id,idx_title) FORCE INDEX FOR ORDER BY (idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );

      // mixing
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, {
          order: 'id asc',
          hints: [
            new IndexHint('idx_id', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force, INDEX_HINT_SCOPE.orderBy), // FORCE INDEX FOR ORDER BY ()
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle1', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle2', INDEX_HINT_TYPE.use),
          ]
        })
          .forceIndex('idx_id', 'idx_title')
          .forceIndex('idx_title')
          .forceIndex({ orderBy: 'idx_title' })
          .ignoreIndex('idx_hle', 'idx_hle1')
          .ignoreIndex('idx_hle')
          .useIndex('idx_hle2')
          .toString(),
        "SELECT * FROM `articles` FORCE INDEX (idx_id,idx_title) FORCE INDEX FOR ORDER BY (idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );
    });

    it('update', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hint: new IndexHint('idx_id') }).toString(),
        "UPDATE `articles` USE INDEX (idx_id) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({
          title: { $like: '%Post%' }
        },
        { title: 'hello', updatedAt: date },
        { hints: [ new IndexHint('idx_id'), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, {
          hints: [
            new IndexHint('idx_id'),
            { index: 'idx_title' },
            new IndexHint('idx_title'),
          ],
        }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, {
          hints: [
            new IndexHint('idx_id'),
            { index: 'idx_title', type: INDEX_HINT_TYPE.use },
            new IndexHint('idx_title')
          ],
        }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, {
          hints: [
            new IndexHint('idx_id', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force),
            new IndexHint('idx_title', INDEX_HINT_TYPE.force), // ignore duplicated
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle1', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
            new IndexHint('idx_hle2', INDEX_HINT_TYPE.use),
          ]
        }).toString(),
        "UPDATE `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date })
          .forceIndex('idx_id', 'idx_title', 'idx_title')
          .forceIndex('idx_title')
          .ignoreIndex('idx_hle', 'idx_hle1')
          .useIndex('idx_hle2')
          .toString(),
        "UPDATE `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });
  });

  it('mixing hint', () => {
    const date = new Date(2017, 11, 12);

    assert.equal(
      Post.update({title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, {
        hints: [
          new IndexHint('idx_id', INDEX_HINT_TYPE.force),
          new IndexHint('idx_title', INDEX_HINT_TYPE.force),
          new IndexHint('idx_title', INDEX_HINT_TYPE.force),
          new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
          new IndexHint('idx_hle1', INDEX_HINT_TYPE.ignore),
          new IndexHint('idx_hle', INDEX_HINT_TYPE.ignore),
          new IndexHint('idx_hle2', INDEX_HINT_TYPE.use),
          new Hint('SET_VAR(foreign_key_checks=OFF)'),
          new Hint('MAX_EXECUTION_TIME(1000)')
        ]
      }).toString(),
      "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.update({title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date })
        .optimizerHints('SET_VAR(foreign_key_checks=OFF)', 'MAX_EXECUTION_TIME(1000)')
        .forceIndex('idx_id', 'idx_title')
        .ignoreIndex('idx_hle', 'idx_hle1')
        .useIndex('idx_hle2')
        .toString(),
      "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    );
  });
});



