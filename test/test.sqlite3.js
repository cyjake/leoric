'use strict'

const { connect } = require('..')

before(async function() {
  this.timeout(5000)
  await connect({
    client: 'sqlite3',
    database: '/tmp/leoric.sqlite3',
    models: `${__dirname}/models`
  })
})

require('./suite/shared')()
// require('./suite/date')()
