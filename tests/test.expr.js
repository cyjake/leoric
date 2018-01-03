'use strict'

const expect = require('expect.js')
const { parseExpr, parseExprList } = require('../lib/expr')

describe('=> parse indentifier', function() {
  it('parse identifiers', function() {
    expect(parseExpr('createdAt')).to.eql({ type: 'id', value: 'createdAt' })
  })

  it('parse identifier qualifiers', function() {
    expect(parseExpr('test.articles.createdAt')).to.eql({
      type: 'id', value: 'createdAt', qualifiers: ['test', 'articles']
    })
  })
})

describe('=> parse functions', function() {
  it('parse COUNT()', function() {
    expect(parseExpr('COUNT(id)')).to.eql({
      type: 'func',
      name: 'count',
      args: [ { type: 'id', value: 'id' } ]
    })
  })

  it('parse COUNT() AS', function() {
    expect(parseExpr('COUNT(id) AS count')).to.eql({
      type: 'alias',
      value: 'count',
      args: [
        { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] }
      ]
    })
  })

  it('parse IFNULL()', function() {
    expect(parseExpr('IFNULL(foo, UUID())')).to.eql({
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
    expect(parseExpr('DISTINCT a')).to.eql({
      type: 'mod',
      name: 'distinct',
      args: [ { type: 'id', value: 'a' } ]
    })
  })
})

describe('=> parse unary operators', function() {
  it('parse NOT', function() {
    expect(parseExpr('NOT 1')).to.eql({
      type: 'op', name: 'not',
      args: [ { type: 'number', value: 1 } ]
    })
  })

  it('parse !', function() {
    expect(parseExpr('! (a > 1)')).to.eql({
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
    expect(parseExpr('title LIKE "%Post%"')).to.eql({
      type: 'op',
      name: 'like',
      args: [
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Post%' }
      ]
    })
  })

  it('parse IN', function() {
    expect(parseExpr('id in (1, 2, 3)')).to.eql({
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
      expect(parseExpr('a is null')).to.eql({
        type: 'op', name: '=',
        args: [
          { type: 'id', value: 'a' },
          { type: 'null' }
        ]
      })
    })

    it('parse IS NOT', function() {
      expect(parseExpr('a IS NOT null')).to.eql({
        type: 'op', name: '!=',
        args: [
          { type: 'id', value: 'a' },
          { type: 'null' }
        ]
      })
    })
  })

  it('parse BETWEEN', function() {
    expect(parseExpr('a BETWEEN 1 AND 10')).to.eql({
      type: 'op', name: 'between',
      args: [
        { type: 'id', value: 'a' },
        { type: 'number', value: 1 },
        { type: 'number', value: 10 }
      ]
    })
  })

  it('parse NOT BETWEEN', function() {
    expect(parseExpr('a NOT BETWEEN 1 AND 10')).to.eql({
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
    const token = parseExpr('YEAR(createdAt) <= 2017 && MONTH(createdAt) BETWEEN 4 AND 9')
    expect(token.type).to.equal('op')
    expect(token.name).to.equal('and')
  })
})

describe('=> parse unary operators', function() {
  it('parse !', function() {
    const token = parseExpr('! a')
    expect(token).to.eql({ type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
  })

  it('parse NOT', function() {
    const token = parseExpr('NOT a')
    expect(token).to.eql({ type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
  })
})

describe('=> parse placeholder', function() {
  it('parse placeholder of string', function() {
    expect(parseExpr('title like ?', '%Post%')).to.eql({
      type: 'op',
      name: 'like',
      args:[
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Post%' }
      ]
    })
  })

  it('parse placeholder of Set', function() {
    expect(parseExpr('?', new Set(['foo', 'bar']))).to.eql({
      type: 'array', value: ['foo', 'bar']
    })
  })

  it('parse placeholder of Date', function() {
    const date = new Date(2012, 4, 15)
    expect(parseExpr('?', date)).to.eql({ type: 'date', value: date })
  })

  it('parse placeholder of boolean', function() {
    expect(parseExpr('?', true)).to.eql({ type: 'boolean', value: true })
    expect(parseExpr('?', false)).to.eql({ type: 'boolean', value: false })
  })
})

describe('=> parse compound expressions', function() {
  it('parse expressions with precedences', function() {
    expect(parseExpr('a = 1 && b = 2 && c = 3')).to.eql({
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
    expect(parseExpr('id > 100 OR (id != 1 AND id != 2)')).to.eql(expected)
    // AND has higher precedence over OR, hence the parenthesis is omissible.
    expect(parseExpr('id > 100 OR id != 1 AND id != 2')).to.eql(expected)
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
    expect(parseExpr('(foo = 1 || foo > 3) && bar = null')).to.eql(expected)
  })
})

describe('parse repeated select expr', function() {
  it('parse select expr separated with comma', function() {
    expect(parseExprList('foo, bar, YEAR(baz)')).to.eql([
      { type: 'id', value: 'foo' },
      { type: 'id', value: 'bar' },
      { type: 'func', name: 'year',
        args: [ { type: 'id', value: 'baz' } ] }
    ])
  })
})
