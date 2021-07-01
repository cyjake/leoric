'use strict';

const assert = require('assert').strict;
const { Bone } = require('../../..');
const { getPropertyNames } = require('../../../src/utils');

describe('=> getPropertyNames', function() {
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
