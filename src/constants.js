'use strict';

const AGGREGATOR_MAP = {
  count: 'count',
  average: 'avg',
  minimum: 'min',
  maximum: 'max',
  sum: 'sum'
};

const AGGREGATORS = Object.values(AGGREGATOR_MAP);

const LEGACY_TIMESTAMP_MAP = {
  gmtCreate: 'createdAt',
  gmtModified: 'updatedAt',
  gmtDeleted: 'deletedAt',
};

const LEGACY_TIMESTAMP_COLUMN_MAP = {
  created_at: 'gmt_create',
  updated_at: 'gmt_modified',
  deleted_at: 'gmt_deleted',
};

const TIMESTAMP_ATTRIBUTE_NAMES = [
  'createdAt', 'updatedAt', 'deletedAt',
  'gmtCreate', 'gmtModified', 'gmtDeleted',
  'created_at', 'updated_at', 'deleted_at',
  'gmt_create', 'gmt_modified', 'gmt_deleted',
];
const TIMESTAMP_NAMES = [ 'createdAt', 'updatedAt', 'deletedAt' ];

const ASSOCIATE_METADATA_MAP = {
  hasMany: Symbol('hasMany'),
  hasOne: Symbol('hasOne'),
  belongsTo: Symbol('belongsTo'),
};

const IS_LEORIC_BONE = Symbol('leoric#bone');

module.exports = {
  AGGREGATOR_MAP,
  LEGACY_TIMESTAMP_MAP,
  TIMESTAMP_NAMES,
  LEGACY_TIMESTAMP_COLUMN_MAP,
  ASSOCIATE_METADATA_MAP,
  TIMESTAMP_ATTRIBUTE_NAMES,
  AGGREGATORS,
  IS_LEORIC_BONE,
};
