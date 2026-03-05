import { strict as assert } from 'assert';
import { Bone } from '../../src';
import type Spell from '../../src/spell';

describe('=> Instance Create Type (TypeScript)', function() {
  class Post extends Bone {
    id!: bigint;
    title!: string;
  }

  class User extends Bone {
    id!: bigint;
    email!: string;
    nickname!: string;
    status!: number;
  }

  it('instance create should keep model-specific return type', function() {
    type PostCreateReturn = ReturnType<Post['create']>;
    type UserCreateReturn = ReturnType<User['create']>;

    const postTypeCheck: PostCreateReturn = null as unknown as Post | Spell<typeof Bone, Post>;
    const userTypeCheck: UserCreateReturn = null as unknown as User | Spell<typeof Bone, User>;

    assert.ok(postTypeCheck || postTypeCheck === null);
    assert.ok(userTypeCheck || userTypeCheck === null);
  });

  it('instance create should not widen to another model type', function() {
    type IsUserAssignableToPostCreate = User extends ReturnType<Post['create']> ? true : false;
    const shouldBeFalse: IsUserAssignableToPostCreate = false;
    assert.equal(shouldBeFalse, false);
  });
});
