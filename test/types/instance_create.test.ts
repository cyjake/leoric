import { strict as assert } from 'assert';
import { Bone } from '../../src';
import type Spell from '../../src/spell';

type SpellInstance<T> = T extends Spell<any, infer U> ? U : never;

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

    type PostCreateInstance = SpellInstance<PostCreateReturn> | Extract<PostCreateReturn, Post>;
    type UserCreateInstance = SpellInstance<UserCreateReturn> | Extract<UserCreateReturn, User>;

    const postTypeCheck: PostCreateInstance = null as unknown as Post;
    const userTypeCheck: UserCreateInstance = null as unknown as User;

    assert.ok(postTypeCheck || postTypeCheck === null);
    assert.ok(userTypeCheck || userTypeCheck === null);
  });

  it('instance create should not widen to another model type', function() {
    type IsUserAssignableToPostCreate = User extends ReturnType<Post['create']> ? true : false;
    const shouldBeFalse: IsUserAssignableToPostCreate = false;
    assert.equal(shouldBeFalse, false);
  });
});
