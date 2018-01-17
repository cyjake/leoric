'use strict'

const { connect } = require('..')
const shared = require('./shared')

before(async function() {
  this.timeout(5000)
  await connect({
    client: 'mysql',
    host: 'localhost',
    user: 'root',
    database: 'jorma',
    models: `${__dirname}/models`
  })
})

shared.basics()
shared.querying()
shared.associations()
shared.crud()
shared.date()
shared.grouping()
shared.joining()
