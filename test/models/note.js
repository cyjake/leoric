'use strict';

const { Bone } = require('../..');
const { INTEGER, STRING, DATE, TEXT } = Bone;

const Note = Bone.define('Note', {
  id: INTEGER,
  title: STRING,
  body: TEXT,
  createdAt: DATE,
}, {
  tableName: 'notes',
});

module.exports = Note;
