'use strict'

const expect = require('expect.js')

// const { Bone } = require('../..')
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
      switch (Post.pool.Leoric_type) {
        case 'mysql':
        case 'mysql2':
          expect(await Post.group('MONTH(createdAt)').count()).to.eql([
            { count: 2, 'MONTH(`gmt_create`)': 5 },
            { count: 1, 'MONTH(`gmt_create`)': 11 }
          ])
          break
        case 'pg':
          expect(await Post.group('MONTH(createdAt)').count()).to.eql([
            { count: 2, 'date_part': 5 },
            { count: 1, 'date_part': 11 }
          ])
          break
        default:
          break
      }
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
}
