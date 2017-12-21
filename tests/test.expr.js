'use strict'

const expect = require('expect.js')
const expr = require('../lib/expr')

describe('=> parse indentifier', function() {
  it('parse identifiers', function() {
    expect(expr('createdAt')).to.eql({
      type: 'id', value: 'createdAt'
    })
  })

  it('parse identifier qualifiers', function() {
    expect(expr('leoric.articles.createdAt')).to.eql({
      type: 'id', value: 'createdAt', qualifiers: ['leoric', 'articles']
    })
  })
})

describe('=> parse functions', function() {
  it('parse COUNT()', function() {
    expect(expr('COUNT(id)')).to.eql({
      type: 'func',
      name: 'count',
      args: [ { type: 'id', value: 'id' } ]
    })
  })

  it('parse COUNT() AS', function() {
    expect(expr('COUNT(id) as count')).to.eql({
      type: 'op',
      name: 'as',
      args:[
        { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] },
        { type: 'id', value: 'count' }
      ]
    })
  })
})

describe('=> parse comparison operators', function() {
  it('parse LIKE', function() {
    expect(expr('title LIKE "%Leoric%"')).to.eql({
      type: 'op',
      name: 'like',
      args: [
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Leoric%' }
      ]
    })
  })

  it('parse IN', function() {
    expect(expr('id in (1, 2, 3)')).to.eql({
      type: 'op',
      name: 'in',
      args: [
        { type: 'id', value: 'id' },
        { type: 'array',
          value: [
            { type: 'number', value: 1 },
            { type: 'number', value: 2 },
            { type: 'number', value: 3 } ] }
      ]
    })
  })
})

describe('=> parse logical operators', function() {
  it('parse AND', function() {
    const token = expr('YEAR(createdAt) <= 2017 && MONTH(createdAt) BETWEEN 4 AND 9')
    expect(token.type).to.equal('op')
    expect(token.name).to.equal('and')
  })
})

describe('=> parse unary operators', function() {
  it('parse DISTINCT', function() {
    const token = expr('DISTINCT a')
    expect(token).to.eql({ type: 'op', name: 'distinct', args: [ { type: 'id', value: 'a' } ] })
  })
})

describe('=> parse placeholder', function() {
  it('parse placeholder of string', function() {
    expect(expr('title like ?', '%Leoric%')).to.eql({
      type: 'op',
      name: 'like',
      args:[
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Leoric%' }
      ]
    })
  })

  it('parse placeholder of Set', function() {
    expect(expr('?', new Set(['foo', 'bar']))).to.eql({
      type: 'array', value: ['foo', 'bar']
    })
  })

  it('parse placeholder of Date', function() {
    const date = new Date(2012, 4, 15)
    expect(expr('?', date)).to.eql({ type: 'date', value: date })
  })

  it('parse placeholder of boolean', function() {
    expect(expr('?', true)).to.eql({ type: 'boolean', value: true })
    expect(expr('?', false)).to.eql({ type: 'boolean', value: false })
  })
})

describe('=> parse compound expressions', function() {
  it('parse expressions with priorities', function() {
    expect(expr('id > 100 OR (id != 1 AND id != 2)')).to.eql({
      type: 'op',
      name: 'or',
      args: [
        { type: 'op', name: '>',
          args: [
            { type: 'id', value: 'id' },
            { type: 'number', value: 100 } ] },
        { type: 'op', name: 'and',
          args: [
            { type: 'op', name: '!=',
              args: [
                { type: 'id', value: 'id' },
                { type: 'number', value: 1 } ] },
            { type: 'op', name: '!=',
              args: [
                { type: 'id', value: 'id' },
                { type: 'number', value: 2 } ] } ] }
      ]
    })
  })
})
