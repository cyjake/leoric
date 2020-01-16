'use strict';

require('./basics');
require('./querying');
require('./associations');
require('./data_types');
require('./definitions');
require('./migrations');

// an adapter layer that makes opting sequelize compliant API possible
require('../adapters/sequelize');
