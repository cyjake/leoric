'use strict'

const assert = require('assert').strict
const { parseExpr, parseExprList } = require('../lib/expr')

describe('=> parse indentifier', function() {
  it('parse identifiers', function() {
    assert.deepEqual(
      parseExpr('createdAt'),
      { type: 'id', value: 'createdAt' }
    )
  })

  it('parse identifier qualifiers', function() {
    assert.deepEqual(
      parseExpr('test.articles.createdAt'),
      { type: 'id', value: 'createdAt', qualifiers: ['test', 'articles'] }
    )
  })
})

describe('=> parse functions', function() {
  it('parse COUNT()', function() {
    assert.deepEqual(
      parseExpr('COUNT(id)'),
      { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] }
    )
  })

  it('parse COUNT() AS', function() {
    assert.deepEqual(
      parseExpr('COUNT(id) AS count'),
      { type: 'alias', value: 'count', args:
        [ { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] } ] }
    )
  })

  it('parse IFNULL()', function() {
    assert.deepEqual(
      parseExpr('IFNULL(foo, UUID())'),
      { type: 'func', name: 'ifnull', args:
        [ { type: 'id', value: 'foo' },
          { type: 'func', name: 'uuid', args: [] } ] }
    )
  })
})

describe('=> parse modifier', function() {
  it('parse DISTINCT', function() {
    assert.deepEqual(
      parseExpr('DISTINCT a'),
      { type: 'mod',
        name: 'distinct',
        args: [ { type: 'id', value: 'a' } ] }
    )
  })
})

describe('=> parse unary operators', function() {
  it('parse NOT', function() {
    assert.deepEqual(
      parseExpr('NOT 1'),
      { type: 'op', name: 'not', args: [ { type: 'literal', value: 1 } ] }
    )
  })

  it('parse !', function() {
    assert.deepEqual(
      parseExpr('! (a > 1)'),
      { type: 'op', name: 'not', args:
        [ { type: 'op', name: '>', args:
            [ { type: 'id', value: 'a' },
              { type: 'literal', value: 1 } ] } ] }
    )
  })
})

describe('=> parse comparison operators', function() {
  it('parse LIKE', function() {
    assert.deepEqual(
      parseExpr('title LIKE "%Post%"'),
      { type: 'op', name: 'like', args:
        [ { type: 'id', value: 'title' },
          { type: 'literal', value: '%Post%' } ] }
    )
  })

  it('parse IN', function() {
    assert.deepEqual(
      parseExpr('id in (1, 2, 3)'),
      { type: 'op', name: 'in', args:
        [ { type: 'id', value: 'id' },
          { type: 'literal',
            value: [1, 2, 3] } ] }
    )
  })

  it('parse IS', function() {
    assert.deepEqual(
      parseExpr('a is null'),
      { type: 'op', name: '=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: null } ] }
    )
  })

  it('parse IS NOT', function() {
    assert.deepEqual(
      parseExpr('a IS NOT null'),
      { type: 'op', name: '!=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: null } ] }
    )
  })

  it('parse BETWEEN', function() {
    assert.deepEqual(
      parseExpr('a BETWEEN 1 AND 10'),
      { type: 'op', name: 'between', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 },
          { type: 'literal', value: 10 } ] }
    )
  })

  it('parse NOT BETWEEN', function() {
    assert.deepEqual(
      parseExpr('a NOT BETWEEN 1 AND 10'),
      { type: 'op', name: 'not between', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 },
          { type: 'literal', value: 10 } ] }
    )
  })
})

describe('=> parse logical operators', function() {
  it('parse AND', function() {
    const token = parseExpr('YEAR(createdAt) <= 2017 && MONTH(createdAt) BETWEEN 4 AND 9')
    assert.equal(token.type, 'op')
    assert.equal(token.name, 'and')
  })
})

describe('=> parse unary operators', function() {
  it('parse !', function() {
    assert.deepEqual(
      parseExpr('! a'),
      { type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
  })

  it('parse NOT', function() {
    assert.deepEqual(
      parseExpr('NOT a'),
      { type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] })
  })
})

describe('=> parse placeholder', function() {
  it('parse placeholder of string', function() {
    assert.deepEqual(
      parseExpr('title like ?', '%Post%'),
      { type: 'op', name: 'like', args:
        [ { type: 'id', value: 'title' },
          { type: 'literal', value: '%Post%' } ] }
    )
  })

  it('parse placeholder of Set', function() {
    assert.deepEqual(
      parseExpr('?', new Set(['foo', 'bar'])),
      { type: 'literal', value: ['foo', 'bar'] }
    )
  })

  it('parse placeholder of Date', function() {
    const date = new Date(2012, 4, 15)
    assert.deepEqual(parseExpr('?', date), { type: 'literal', value: date })
  })

  it('parse placeholder of boolean', function() {
    assert.deepEqual(parseExpr('?', true), { type: 'literal', value: true })
    assert.deepEqual(parseExpr('?', false), { type: 'literal', value: false })
  })
})

describe('=> parse compound expressions', function() {
  it('parse expressions with precedences', function() {
    assert.deepEqual(
      parseExpr('a = 1 && b = 2 && c = 3'),
      { type: 'op', name: 'and', args:
        [ { type: 'op', name: 'and', args:
            [ { type: 'op', name: '=', args:
                [ { type: 'id', value: 'a' },
                  { type: 'literal', value: 1 } ] },
              { type: 'op', name: '=', args:
                [ { type: 'id', value: 'b' },
                  { type: 'literal', value: 2 } ] } ] },
          { type: 'op', name: '=', args:
            [ { type: 'id', value: 'c' },
              { type: 'literal', value: 3 } ] } ] }
    )
  })

  it('parse expressions with parenthesis', function() {
    const expected = {
      type: 'op', name: 'or', args:
      [ { type: 'op', name: '>', args:
          [ { type: 'id', value: 'id' },
            { type: 'literal', value: 100 } ] },
        { type: 'op', name: 'and', args:
          [ { type: 'op', name: '!=', args:
              [ { type: 'id', value: 'id' },
                { type: 'literal', value: 1 } ] },
            { type: 'op', name: '!=', args:
              [ { type: 'id', value: 'id' },
                { type: 'literal', value: 2 } ] } ] } ]
    }

    assert.deepEqual(
      parseExpr('id > 100 OR (id != 1 AND id != 2)'),
      expected)

      // AND has higher precedence over OR, hence the parenthesis is omissible.
    assert.deepEqual(
      parseExpr('id > 100 OR id != 1 AND id != 2'),
      expected)
  })

  it('parse expressions begin with parenthesis', function() {
    assert.deepEqual(
      parseExpr('(foo = 1 || foo > 3) && bar = null'),
      { type: 'op', name: 'and', args:
        [ { type: 'op', name: 'or', args:
            [ { type: 'op', name: '=', args:
                [ { type: 'id', value: 'foo' },
                  { type: 'literal', value: 1 } ] },
              { type: 'op', name: '>', args:
                [ { type: 'id', value: 'foo' },
                  { type: 'literal', value: 3 } ] } ] },
          { type: 'op', name: '=', args:
            [ { type: 'id', value: 'bar' },
              { type: 'literal', value: null } ] } ] }
    )
  })
})

describe('parse repeated select expr', function() {
  it('parse select expr separated with comma', function() {
    assert.deepEqual(
      parseExprList('foo, bar, YEAR(baz)'),
      [ { type: 'id', value: 'foo' },
        { type: 'id', value: 'bar' },
        { type: 'func', name: 'year',
          args: [ { type: 'id', value: 'baz' } ] } ]
    )
  })
})

describe('parse arithmetic operators', function() {
  it('parse +-*/', function() {
    for (const op of ['+', '-', '*', '/']) {
      assert.deepEqual(
        parseExpr(`a ${op} b`),
        { type: 'op', name: op,
          args:
          [ { type: 'id', value: 'a' },
            { type: 'id', value: 'b' } ] }
      )
    }
  })

  it('parse condition consists of arithmetic operators', function() {
    assert.deepEqual(
      parseExpr('width / height >= 520 / 280'),
      { type: 'op', name: '>=', args:
        [ { name: '/', type: 'op',
            args:
            [ { type: 'id', value: 'width' },
              { type: 'id', value: 'height' } ] },
          { name: '/', type: 'op',
            args:
            [ { type: 'literal', value: 520 },
              { type: 'literal', value: 280 } ] } ] }
    )
  })

  it('parse compound +-*/ with precedences', function() {
    assert.deepEqual(
      parseExpr('a + b * c'),
      { name: '+', type: 'op', args:
        [ { type: 'id', value: 'a' },
          { type: 'op', name: '*', args:
            [ { type: 'id', value: 'b' },
              { type: 'id', value: 'c' } ] } ] }
    )
  })
})
