import 'reflect-metadata';
import assert from 'assert';
import { Column, HasOne, HasMany, BelongsTo, Bone, DataTypes } from '../../src';
import { ASSOCIATE_METADATA_MAP } from '../../src/constants';

// Helper: define classes inside test bodies to catch decorator-time errors

describe('decorators', () => {
  it('Column throws for unknown design:type (findType default)', () => {
    const defineBadModel = () => {
      class Bad extends Bone {
        @Column()
        bad!: object; // design:type is Object -> unsupported
      }
      // use the class to ensure decorator ran
      return Bad;
    };
    assert.throws(() => defineBadModel(), /unknown typescript type/i);
  });

  it('Column accepts explicit type option and creates attributes', () => {
    class Book extends Bone {
      @Column({ type: DataTypes.STRING })
      title!: string;
    }
    // attributes should be created and include the decorated property
    assert.ok((Book as any).attributes);
    assert.ok('title' in (Book as any).attributes);
    const attr = (Book as any).attributes.title;
    assert.ok(attr.type); // Data type exists
    assert.equal(attr.columnName, undefined);
  });

  it('Column handles DataType class passed directly', () => {
    class Note extends Bone {
      @Column(DataTypes.BIGINT)
      id!: bigint;
    }
    const attr = (Note as any).attributes.id;
    assert.ok(attr.type);
  });

  it('HasMany defines metadata on model', () => {
    class Tag extends Bone {}
    class Article extends Bone {
      @HasMany()
      tags!: Tag[];
    }
    const meta = Reflect.getMetadata(ASSOCIATE_METADATA_MAP.hasMany, Article);
    assert.ok(meta && meta.tags);
  });

  it('HasOne infers className from design:type', () => {
    class Profile extends Bone {}
    class User extends Bone {
      @HasOne()
      profile!: Profile;
    }
    const meta = Reflect.getMetadata(ASSOCIATE_METADATA_MAP.hasOne, User);
    assert.equal(meta.profile.className, 'Profile');
  });

  it('BelongsTo infers className from design:type', () => {
    class Author extends Bone {}
    class Post extends Bone {
      @BelongsTo()
      author!: Author;
    }
    const meta = Reflect.getMetadata(ASSOCIATE_METADATA_MAP.belongsTo, Post);
    assert.equal(meta.author.className, 'Author');
  });

  it('HasOne keeps provided className when type is Function', () => {
    class Gadget extends Bone {
      @HasOne({ className: 'CustomGadget' })
      // eslint-disable-next-line @typescript-eslint/ban-types
      device!: Function; // design:type.name === 'Function'
    }
    const meta = Reflect.getMetadata(ASSOCIATE_METADATA_MAP.hasOne, Gadget);
    assert.equal(meta.device.className, 'CustomGadget');
  });

  it('BelongsTo keeps provided className when type is Function', () => {
    class Gadget extends Bone {
      @BelongsTo({ className: 'CustomOwner' })
      // eslint-disable-next-line @typescript-eslint/ban-types
      owner!: Function; // design:type.name === 'Function'
    }
    const meta = Reflect.getMetadata(ASSOCIATE_METADATA_MAP.belongsTo, Gadget);
    assert.equal(meta.owner.className, 'CustomOwner');
  });
});
