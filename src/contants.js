'use strict';

const AGGREGATOR_MAP = {
  count: 'count',
  average: 'avg',
  minimum: 'min',
  maximum: 'max',
  sum: 'sum'
};

const LEGACY_TIMESTAMP_MAP = {
  gmtCreate: 'createdAt',
  gmtModified: 'updatedAt',
  gmtDeleted: 'deletedAt',
};

const LEGACY_TIMESTAMP_CLOUMN_MAP = {
  created_at: 'gmt_create',
  updated_at: 'gmt_modified',
  deleted_at: 'gmt_deleted',
};

const TIMESTAMPS_ATTRNAME = [ 'createdAt', 'updatedAt', 'deletedAt' ];

module.exports = {
  AGGREGATOR_MAP,
  LEGACY_TIMESTAMP_MAP,
  TIMESTAMPS_ATTRNAME,
  LEGACY_TIMESTAMP_CLOUMN_MAP
};
