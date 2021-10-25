"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const __1 = require("../..");
describe('=> Basics (TypeScript)', function () {
    class Post extends __1.Bone {
    }
    Post.table = 'articles';
    before(async function () {
        await (0, __1.connect)({
            dialect: 'sqlite',
            database: '/tmp/leoric.sqlite3',
            models: [Post],
        });
    });
    beforeEach(async function () {
        await Post.truncate();
    });
    describe('=> Attributes', function () {
        it('bone.attribute(name)', async function () {
            const post = await Post.create({ title: 'Cain' });
            assert_1.strict.equal(post.attribute('title'), 'Cain');
        });
        it('bone.attribute(name, value)', async function () {
            const post = new Post({});
            post.attribute('title', 'Cain');
            assert_1.strict.equal(post.title, 'Cain');
        });
    });
    describe('=> Accessors', function () {
        it('Bone.primaryColumn', async function () {
            assert_1.strict.equal(Post.primaryColumn, 'id');
        });
    });
    describe('=> Integration', function () {
        it('bone.toJSON()', async function () {
            const post = await Post.create({ title: 'Nephalem' });
            assert_1.strict.equal(post.toJSON().title, 'Nephalem');
        });
        it('bone.toObject()', async function () {
            const post = await Post.create({ title: 'Leah' });
            assert_1.strict.equal(post.toObject().title, 'Leah');
        });
    });
    describe('=> Collection', function () {
    });
    describe('=> Create', function () {
        it('Bone.create()', async function () {
            const post = await Post.create({ title: 'Tyrael' });
            assert_1.strict.ok(post instanceof Post);
            assert_1.strict.ok(post.id);
            assert_1.strict.equal(post.title, 'Tyrael');
            assert_1.strict.equal(post.toJSON().title, 'Tyrael');
            assert_1.strict.equal(post.toObject().title, 'Tyrael');
        });
        it('bone.create()', async function () {
            const post = new Post({ title: 'Cain' });
            await post.create();
            assert_1.strict.ok(post.id);
            assert_1.strict.equal(post.title, 'Cain');
        });
        it('bone.save()', async function () {
            await Post.create({ id: 1, title: 'Leah' });
            const post = new Post({ id: 1, title: 'Diablo' });
            await post.save();
            const posts = await Post.all;
            assert_1.strict.equal(posts.length, 1);
        });
    });
    describe('=> Read', function () {
        beforeEach(async function () {
            const posts = await Post.bulkCreate([
                { title: 'Leah' },
                { title: 'Cain' },
                { title: 'Nephalem' }
            ]);
        });
        it('Post.find()', async function () {
            const posts = await Post.find();
            assert_1.strict.equal(posts.length, 3);
            assert_1.strict.deepEqual(Array.from(posts, post => post.title).sort(), [
                'Cain',
                'Leah',
                'Nephalem',
            ]);
        });
        it('Post.findOne()', async function () {
            const post = await Post.findOne({ title: 'Leah' });
            assert_1.strict.equal(post.title, 'Leah');
        });
    });
    describe('=> Update', function () {
        it('Post.update()', async function () {
            await Post.bulkCreate([
                { title: 'Leah' },
                { title: 'Cain' },
            ]);
            await Post.update({ title: 'Leah' }, { title: 'Diablo' });
            assert_1.strict.equal(await Post.findOne({ title: 'Leah' }), null);
            assert_1.strict.equal((await Post.findOne({ title: 'Cain' })).title, 'Cain');
            assert_1.strict.equal((await Post.findOne({ title: 'Diablo' })).title, 'Diablo');
        });
        it('post.update()', async function () {
            const post = await Post.create({ title: 'Tyrael' });
            assert_1.strict.equal(post.title, 'Tyrael');
            const result = await post.update({ title: 'Stranger' });
            assert_1.strict.equal(result, 1);
            await post.reload();
            assert_1.strict.equal(post.title, 'Stranger');
        });
    });
    describe('=> Remove', function () {
        it('Post.remove()', async function () {
            await Post.bulkCreate([
                { title: 'Leah' },
                { title: 'Cain' },
            ]);
            await Post.remove({ title: 'Cain' });
            assert_1.strict.equal((await Post.find()).length, 1);
            assert_1.strict.equal((await Post.findOne()).title, 'Leah');
        });
        it('post.remove()', async function () {
            const post = await Post.create({ title: 'Untitled' });
            await post.remove();
            assert_1.strict.equal((await Post.find()).length, 0);
        });
    });
    describe('=> Bulk', function () {
        it('Post.bulkCreate()', async function () {
            const posts = await Post.bulkCreate([
                { title: 'Leah' },
                { title: 'Cain' },
                { title: 'Nephalem' }
            ]);
            assert_1.strict.equal(posts.length, 3);
            assert_1.strict.equal(posts[0].title, 'Leah');
            assert_1.strict.equal(posts[1].title, 'Cain');
            assert_1.strict.equal(posts[2].title, 'Nephalem');
        });
    });
});
