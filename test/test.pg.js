'use strict'

const { connect } = require('..')

before(async function() {
  this.timeout(5000)
  await connect({
    client: 'pg',
    host: '127.0.0.1',
    // user: 'root',
    database: 'leoric',
    models: `${__dirname}/models`
  })
})

require('./suite/shared')()
require('./suite/date')()
