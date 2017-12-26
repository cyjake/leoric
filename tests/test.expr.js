'use strict'

const expect = require('expect.js')
const expr = require('../lib/expr')

describe('=> parse indentifier', function() {
  it('parse identifiers', function() {
    expect(expr('createdAt')).to.eql({ type: 'id', value: 'createdAt' })
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
    expect(expr('COUNT(id) AS count')).to.eql({
      type: 'alias',
      args: [
        { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] },
        { type: 'id', value: 'count' }
      ]
    })
  })

  it('parse IFNULL()', function() {
    expect(expr('IFNULL(foo, UUID())')).to.eql({
      type: 'func', name: 'ifnull',
      args: [
        { type: 'id', value: 'foo' },
        { type: 'func', name: 'uuid', args: [] }
      ]
    })
  })
})

describe('=> parse modifier', function() {
  it('parse DISTINCT', function() {
    expect(expr('DISTINCT a')).to.eql({
      type: 'mod',
      name: 'distinct',
      args: [ { type: 'id', value: 'a' } ]
    })
  })
})

describe('=> parse unary operators', function() {
  it('parse NOT', function() {
    expect(expr('NOT 1')).to.eql({
      type: 'op', name: 'not',
      args: [ { type: 'number', value: 1 } ]
    })
  })

  it('parse !', function() {
    expect(expr('! (a > 1)')).to.eql({
      type: 'op', name: 'not',
      args: [
        { type: 'op', name: '>',
          args: [
            { type: 'id', value: 'a' },
            { type: 'number', value: 1 } ] }
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

    it('parse IS', function() {
      expect(expr('a is null')).to.eql({
        type: 'op', name: '=',
        args: [
          { type: 'id', value: 'a' },
          { type: 'null' }
        ]
      })
    })

    it('parse IS NOT', function() {
      expect(expr('a IS NOT null')).to.eql({
        type: 'op', name: '!=',
        args: [
          { type: 'id', value: 'a' },
          { type: 'null' }
        ]
      })
    })
  })

  it('parse BETWEEN', function() {
    expect(expr('a BETWEEN 1 AND 10')).to.eql({
      type: 'op', name: 'between',
      args: [
        { type: 'id', value: 'a' },
        { type: 'number', value: 1 },
        { type: 'number', value: 10 }
      ]
    })
  })

  it('parse NOT BETWEEN', function() {
    expect(expr('a NOT BETWEEN 1 AND 10')).to.eql({
      type: 'op', name: 'not between',
      args: [
        { type: 'id', value: 'a' },
        { type: 'number', value: 1 },
        { type: 'number', value: 10 }
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
  it('parse !', function() {
    const token = expr('! a')
    expect(token).to.eql({ type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
  })

  it('parse NOT', function() {
    const token = expr('NOT a')
    expect(token).to.eql({ type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
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
  it('parse expressions with precedences', function() {
    expect(expr('a = 1 && b = 2 && c = 3')).to.eql({
      type: 'op', name: 'and',
      args: [
        { type: 'op', name: 'and',
          args: [
            { type: 'op', name: '=',
              args: [
                { type: 'id', value: 'a' },
                { type: 'number', value: 1 } ] },
            { type: 'op', name: '=',
              args: [
                { type: 'id', value: 'b' },
                { type: 'number', value: 2 } ] } ] },
        { type: 'op', name: '=',
          args: [
            { type: 'id', value: 'c' },
            { type: 'number', value: 3 } ] }
      ]
    })
  })

  it('parse expressions with parenthesis', function() {
    const expected = {
      type: 'op', name: 'or',
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
    }
    expect(expr('id > 100 OR (id != 1 AND id != 2)')).to.eql(expected)
    // AND has higher precedence over OR, hence the parenthesis is omissible.
    expect(expr('id > 100 OR id != 1 AND id != 2')).to.eql(expected)
  })

  it('parse expressions begin with parenthesis', function() {
    const expected = {
      type: 'op', name: 'and',
      args: [
        { type: 'op', name: 'or',
          args: [
            { type: 'op', name: '=',
              args: [
                { type: 'id', value: 'foo' },
                { type: 'number', value: 1 } ] },
            { type: 'op', name: '>',
              args: [
                { type: 'id', value: 'foo' },
                { type: 'number', value: 3 } ] } ] },
        { type: 'op', name: '=',
          args: [
            { type: 'id', value: 'bar' },
            { type: 'null' } ] }
      ]
    }
    expect(expr('(foo = 1 || foo > 3) && bar = null')).to.eql(expected)
  })
})
