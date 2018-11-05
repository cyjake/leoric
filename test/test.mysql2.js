'use strict'

const { connect } = require('..')

before(async function() {
  this.timeout(5000)
  await connect({
    client: 'mysql2',
    host: 'localhost',
    user: 'root',
    database: 'leoric',
    models: `${__dirname}/models`
  })
})

require('./suite/shared')()
require('./suite/date')()
