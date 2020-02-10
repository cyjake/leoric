'use strict';

const assert = require('assert').strict;
const { parseExpr, parseExprList } = require('../../lib/expr');

function assertExpr(str, ast) {
  assert.deepEqual(parseExpr(str), ast);
  // remove unnecessary spaces and test again
  assert.deepEqual(parseExpr(str.replace(/\s*([-+*\/~^%!<>,=&|])\s*/g, '$1')), ast);
}

describe('=> parse literals', function() {
  it('parse NULL', function() {
    assert.deepEqual(parseExpr('NULL'), { type: 'literal', value: null });
  });

  it('parse number', function() {
    assert.deepEqual(parseExpr('1'), { type: 'literal', value: 1 });
  });

  it('parse string', function() {
    assert.deepEqual(parseExpr('"a"'), { type: 'literal', value: 'a' });
    assert.deepEqual(parseExpr("'b'"), { type: 'literal', value: 'b' });
    // incomplete literal
    assert.throws(() => parseExpr("'a"), 'Unexpected end of string');
  });

  it('parse number[]', function() {
    assert.deepEqual(
      parseExpr('a in (1, 2, 3)'),
      { type: 'op', name: 'in', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: [1, 2, 3] } ] }
    );
  });

  it('parse string[]', function() {
    assert.deepEqual(
      parseExpr('a in ("foo", "bar")'),
      { type: 'op', name: 'in', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: ['foo', 'bar'] } ] }
    );
  });
});

describe('=> parse wildcard', function() {
  it('parse select *', function() {
    assert.deepEqual(parseExpr('*'), { type: 'wildcard' });
  });

  it('parse select count(*) as count', function() {
    assert.deepEqual(
      parseExpr('count(*) as count'),
      { type: 'alias', value: 'count', args:
        [ { type: 'func', name: 'count', args:
            [ { type: 'wildcard' } ] } ] }
    );
  });
});

describe('=> parse identifiers', function() {
  it('parse identifiers', function() {
    assert.deepEqual(
      parseExpr('createdAt'),
      { type: 'id', value: 'createdAt' }
    );
  });

  it('parse identifier qualifiers', function() {
    assert.deepEqual(
      parseExpr('test.articles.createdAt'),
      { type: 'id', value: 'createdAt', qualifiers: ['test', 'articles'] }
    );
  });
});

describe('=> parse functions', function() {
  it('parse COUNT()', function() {
    assert.deepEqual(
      parseExpr('COUNT(id)'),
      { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] }
    );
  });

  it('parse COUNT() AS', function() {
    assert.deepEqual(
      parseExpr('COUNT(id) AS count'),
      { type: 'alias', value: 'count', args:
        [ { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] } ] }
    );
  });

  it('parse IFNULL()', function() {
    assert.deepEqual(
      parseExpr('IFNULL(foo, UUID())'),
      { type: 'func', name: 'ifnull', args:
        [ { type: 'id', value: 'foo' },
          { type: 'func', name: 'uuid', args: [] } ] }
    );
  });
});

describe('=> parse modifier', function() {
  it('parse DISTINCT', function() {
    assert.deepEqual(
      parseExpr('DISTINCT a'),
      { type: 'mod',
        name: 'distinct',
        args: [ { type: 'id', value: 'a' } ] }
    );
  });
});

describe('=> parse unary operators', function() {
  it('parse NOT', function() {
    assert.deepEqual(
      parseExpr('NOT a'),
      { type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] });

    assert.deepEqual(
      parseExpr('NOT 1'),
      { type: 'op', name: 'not', args: [ { type: 'literal', value: 1 } ] }
    );
  });

  it('parse !', function() {
    assertExpr(
      '! a',
      { type: 'op', name: 'not', args: [ { type: 'id', value: 'a' } ] }
    );

    assertExpr(
      '! (a > 1)',
      { type: 'op', name: 'not', args:
        [ { type: 'op', name: '>', args:
            [ { type: 'id', value: 'a' },
              { type: 'literal', value: 1 } ] } ] }
    );
  });

  it('parse unary minus', function() {
    assertExpr('- 1', { type: 'literal', value: -1 });
    assertExpr(
      '- a',
      { type: 'op', name: '-', args:
        [ { type: 'id', value: 'a' } ] }
    );
    assertExpr(
      '- (1 + 1)',
      { type: 'op', name: '-', args:
        [ { type: 'op', name: '+', args:
            [ { type: 'literal', value: 1 },
              { type: 'literal', value: 1 } ] } ] }
    );
  });

  it('parse ~', function() {
    assertExpr(
      '~ (1 + 1)',
      { type: 'op', name: '~', args:
        [ { type: 'op', name: '+', args:
            [ { type: 'literal', value: 1 },
              { type: 'literal', value: 1 } ] } ] }
    );
  });
});

describe('=> parse comparison operators', function() {
  it('parse =', function() {
    assertExpr(
      'a = 1',
      { type: 'op', name: '=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 } ] }
    );
  });

  it('parse == should throw unexpected token', function() {
    assert.throws(() => parseExpr('a == 1'), /unexpected token =/i);
    assert.throws(() => parseExpr('a % 2 == -1'), /unexpected token =/i);
  });

  it('parse !=', function() {
    assertExpr(
      'a != 1',
      { type: 'op', name: '!=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 } ] }
    );
  });

  it('parse LIKE', function() {
    assert.deepEqual(
      parseExpr('title LIKE "%Post%"'),
      { type: 'op', name: 'like', args:
        [ { type: 'id', value: 'title' },
          { type: 'literal', value: '%Post%' } ] }
    );
  });

  it('parse IN', function() {
    assertExpr(
      'id in (1, 2, 3)',
      { type: 'op', name: 'in', args:
        [ { type: 'id', value: 'id' },
          { type: 'literal',
            value: [1, 2, 3] } ] }
    );
  });

  it('parse IS', function() {
    assert.deepEqual(
      parseExpr('a is null'),
      { type: 'op', name: '=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: null } ] }
    );
  });

  it('parse IS NOT', function() {
    assert.deepEqual(
      parseExpr('a IS NOT null'),
      { type: 'op', name: '!=', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: null } ] }
    );
  });

  it('parse BETWEEN', function() {
    assert.deepEqual(
      parseExpr('a BETWEEN 1 AND 10'),
      { type: 'op', name: 'between', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 },
          { type: 'literal', value: 10 } ] }
    );
  });

  it('parse NOT BETWEEN', function() {
    assert.deepEqual(
      parseExpr('a NOT BETWEEN 1 AND 10'),
      { type: 'op', name: 'not between', args:
        [ { type: 'id', value: 'a' },
          { type: 'literal', value: 1 },
          { type: 'literal', value: 10 } ] }
    );
  });
});

describe('=> parse logical operators', function() {
  it('parse AND', function() {
    assertExpr(
      'YEAR(createdAt) <= 2017 && MONTH(createdAt) BETWEEN 4 AND 9',
      { type: 'op', name: 'and', args:
        [ { type: 'op', name: '<=', args:
            [ { type: 'func', name: 'year', args:
                [ { type: 'id', value: 'createdAt' } ] },
              { type: 'literal', value: 2017 } ] },
          { type: 'op', name: 'between', args:
            [ { type: 'func', name: 'month', args:
                [ { type: 'id', value: 'createdAt' } ] },
              { type: 'literal', value: 4 },
              { type: 'literal', value: 9 } ] } ] }
    );
  });
});

describe('=> parse placeholder', function() {
  it('parse placeholder of string', function() {
    assert.deepEqual(
      parseExpr('title like ?', '%Post%'),
      { type: 'op', name: 'like', args:
        [ { type: 'id', value: 'title' },
          { type: 'literal', value: '%Post%' } ] }
    );
  });

  it('parse placeholder of Set', function() {
    assert.deepEqual(
      parseExpr('?', new Set(['foo', 'bar'])),
      { type: 'literal', value: ['foo', 'bar'] }
    );
  });

  it('parse placeholder of Date', function() {
    const date = new Date(2012, 4, 15);
    assert.deepEqual(parseExpr('?', date), { type: 'literal', value: date });
  });

  it('parse placeholder of boolean', function() {
    assert.deepEqual(parseExpr('?', true), { type: 'literal', value: true });
    assert.deepEqual(parseExpr('?', false), { type: 'literal', value: false });
  });
});

describe('=> parse compound expressions', function() {
  it('parse expressions with precedences', function() {
    assertExpr(
      'a = 1 && b = 2 && c = 3',
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
    );
  });

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
    };

    assertExpr('id > 100 OR (id != 1 AND id != 2)', expected);
    // AND has higher precedence over OR, hence the parenthesis is omissible.
    assertExpr('id > 100 OR id != 1 AND id != 2', expected);
  });

  it('parse expressions begin with parenthesis', function() {
    assertExpr(
      '(foo = 1 || foo > 3) && bar = null',
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
    );
  });
});

describe('=> parse expression list', function() {
  it('parse select expression separated with comma', function() {
    assert.deepEqual(
      parseExprList('foo, bar, YEAR(baz)'),
      [ { type: 'id', value: 'foo' },
        { type: 'id', value: 'bar' },
        { type: 'func', name: 'year',
          args: [ { type: 'id', value: 'baz' } ] } ]
    );
  });
});

describe('=> parse arithmetic operators', function() {
  it('parse +-*/', function() {
    for (const op of ['+', '-', '*', '/']) {
      assertExpr(
        `a ${op} b`,
        { type: 'op', name: op,
          args:
          [ { type: 'id', value: 'a' },
            { type: 'id', value: 'b' } ] }
      );
    }
  });

  it('parse condition consists of arithmetic operators', function() {
    assertExpr(
      'width / height >= 520 / 280',
      { type: 'op', name: '>=', args:
        [ { type: 'op', name: '/', args:
            [ { type: 'id', value: 'width' },
              { type: 'id', value: 'height' } ] },
          { type: 'op', name: '/', args:
            [ { type: 'literal', value: 520 },
              { type: 'literal', value: 280 } ] } ] }
    );
  });

  it('parse compound +-*/ with precedences', function() {
    assertExpr(
      'a + b * c',
      { type: 'op', name: '+', args:
        [ { type: 'id', value: 'a' },
          { type: 'op', name: '*', args:
            [ { type: 'id', value: 'b' },
              { type: 'id', value: 'c' } ] } ] }
    );

    assertExpr(
      'a * b + c',
      { type: 'op', name: '+', args:
        [ { type: 'op', name: '*', args:
            [ { type: 'id', value: 'a' },
              { type: 'id', value: 'b' } ] },
          { type: 'id', value: 'c' } ] }
    );
  });

  it('parse modulo operator with precendences', function() {
    assertExpr(
      'a % 2 - 1 = -1',
      { type: 'op', name: '=', args:
        [ { type: 'op', name: '-', args:
            [ { type: 'op', name: '%', args:
                [ { type: 'id', value: 'a' },
                  { type: 'literal', value: 2 } ] },
              { type: 'literal', value: 1 } ] },
          { type: 'literal', value: -1 } ] }
    );
  });
});
