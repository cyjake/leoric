'use strict'

const expect = require('expect.js')

// const { Bone } = require('../..')
const Book = require('../models/book')
const Post = require('../models/post')

module.exports = function() {
  // https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html
  describe('=> Date Functions', function() {
    before(async function() {
      await Promise.all([
        Post.create({ title: 'New Post', createdAt: new Date(2012, 4, 15) }),
        Post.create({ title: 'Archbishop Lazarus', createdAt: new Date(2012, 4, 15) }),
        Post.create({ title: 'Leah', createdAt: new Date(2017, 10, 11) })
      ])
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('SELECT YEAR(date)', async function() {
      expect(await Post.select('YEAR(createdAt) as year').order('year')).to.eql([
        { year: 2012 }, { year: 2012 }, { year: 2017 }
      ])
    })

    it('WHERE YEAR(date)', async function() {
      const posts = await Post.select('title').where('YEAR(createdAt) = 2017')
      expect(posts.map(post => post.title)).to.eql(['Leah'])
    })

    it('GROUP BY MONTH(date)', async function() {
      expect(await Post.group('MONTH(createdAt)').count()).to.eql([
        { count: 2, 'MONTH(`gmt_create`)': 5 },
        { count: 1, 'MONTH(`gmt_create`)': 11 }
      ])
    })

    it('GROUP BY MONTH(date) AS month', async function() {
      expect(await Post.select('MONTH(createdAt) as month').group('month').count()).to.eql([
        { count: 2, month: 5 },
        { count: 1, month: 11 }
      ])
      expect(await Post.group('MONTH(createdAt) as month').count()).to.eql([
        { count: 2, month: 5 },
        { count: 1, month: 11 }
      ])
    })

    it('ORDER BY DAY(date)', async function() {
      const posts = await Post.order('DAY(createdAt)').order('title')
      expect(posts.map(post => post.title)).to.eql([
        'Leah', 'Archbishop Lazarus', 'New Post'
      ])
    })
  })

  describe('=> Calculations', function() {
    before(async function() {
      await Promise.all([
        Book.create({ isbn: 9780596006624, name: 'Hackers and Painters', price: 22.95 }),
        Book.create({ isbn: 9780881792065, name: 'The Elements of Typographic Style', price: 29.95 }),
        Book.create({ isbn: 9781575863269, name: 'Things a Computer Scientist Rarely Talks About', price: 21 })
      ])
    })

    after(async function() {
      await Book.remove({}, true)
    })

    it('Bone.count() should count records', async function() {
      const [ { count } ] = await Book.count()
      expect(count).to.equal(3)
    })

    it('Bone.average() should return the average of existing records', async function() {
      const [ { average } ] = await Book.average('price')
      expect(Math.abs((22.95 + 29.95 + 21) / 3 - average)).to.be.within(0, 1)
    })

    it('Bone.minimum() should return the minimum value of existing records', async function() {
      const [ { minimum } ] = await Book.minimum('price')
      expect(parseFloat(minimum)).to.equal(21)
    })

    it('Bone.maximum() should return the maximum value of existing records', async function() {
      const [ { maximum } ] = await Book.maximum('price')
      expect(Math.floor(maximum)).to.equal(Math.floor(29.95))
    })

    it('Bone.sum()', async function() {
      const [ { sum } ] = await Book.sum('price')
      expect(Math.floor(sum)).to.equal(Math.floor(22.95 + 29.95 + 21))
    })
  })
}
