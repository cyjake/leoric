import { SequelizeBone, SequelizeConditions, SequelizeInstanceUpdateOptions } from 'leoric';

class Post extends SequelizeBone {
  title!: string;
}

// TS2339 regression: build() must exist on SequelizeBone subclasses
Post.build({ title: 'hi' });

// TS2305 regression: condition types must be exported from the package root
const cond: SequelizeConditions<typeof Post> = {};
const opts: SequelizeInstanceUpdateOptions<Post> = {};

// TS2558 regression: generic type arguments must be accepted
Post.findAll<typeof Post>({});
Post.findOne<typeof Post>({});
Post.count<typeof Post>({});
