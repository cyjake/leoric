'use strict';

const assert = require('assert').strict;
const { Bone, sequelize } = require('../../..');
const { compose, getPropertyNames, logger, isBone } = require('../../../src/utils');

describe('=> compose', function() {
  it('should return a default function if nothing to compose', function() {
    const fn = compose();
    for (const arg of  [ null, 1, function() {} ]) {
      assert.equal(fn(arg), arg);
    }
  });

  it('should return as is if only one function to compose', function() {
    const fn = compose((a, b) => a + b);
    assert.equal(fn(1, 2), 3);
  });
});

describe('=> getPropertyNames', function() {
  it('should return empty result if nothing to get', async function() {
    assert.deepEqual(getPropertyNames(), []);
    assert.deepEqual(getPropertyNames(null), []);
  });

  it('should traverse up to Bone.prototype', async function() {
    class Foo extends Bone {
      get a() {
        return 1;
      }
    }
    Object.defineProperty(Foo.prototype, 'a', {
      ...Object.getOwnPropertyDescriptor(Foo.prototype, 'a'),
      enumerable: true,
    });

    class Bar extends Foo {
      get b() {
        return 2;
      }
    }
    Object.defineProperty(Bar.prototype, 'b', {
      ...Object.getOwnPropertyDescriptor(Bar.prototype, 'b'),
      enumerable: true,
    });

    assert.deepEqual(getPropertyNames(new Bar()).sort(), [ 'a', 'b' ]);
  });

  it('should exclude non-enumerable property names', async function() {
    class Foo extends Bone {
      get a() {
        return 1;
      }
      get b() {
        return 2;
      }
    }
    Object.defineProperty(Foo.prototype, 'a', {
      ...Object.getOwnPropertyDescriptor(Foo.prototype, 'a'),
      enumerable: true,
    });

    assert.deepEqual(getPropertyNames(new Foo()).sort(), [ 'a' ]);
  });
});

describe('=> logger', function() {
  it('should prefix output with [leoric]', function() {
    logger.log('foo');
  });
});

describe('=> isBone', () => {
  it('should work', () => {
    assert.equal(isBone(), false);
    assert.equal(isBone(null), false);
    assert.equal(isBone(1), false);
    assert.equal(isBone(() => {}), false);
    assert.equal(isBone({}), false);
    assert.equal(isBone(Bone), true);
    class Note {}
    assert.equal(isBone(Note), false);
    class Note1 extends Bone {}
    assert.equal(isBone(Note1), true);
    assert.equal(isBone(sequelize(Note1)), true);
    assert.equal(isBone(sequelize(Note)), false);
  });
});
