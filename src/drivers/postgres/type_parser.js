'use strict';

const pgTypes = require('pg-types');

pgTypes.setTypeParser(1700, 'text', function (val) {
    return Number(val);
});
