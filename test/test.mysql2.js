'use strict'

const { connect } = require('..')
const shared = require('./shared')

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

shared.basics()
shared.querying()
shared.associations()
shared.date()
shared.crud()
shared.grouping()
shared.joining()
