'use strict'

const { connect } = require('..')
const path = require('path')
const shared = require('./shared')

before(async function() {
  this.timeout(5000)
  await connect({
    client: 'sqlite3',
    database: path.resolve(__dirname, '../tmp/leoric.sqlite3'),
    models: `${__dirname}/models`
  })
})

shared.basics()
shared.querying()
shared.associations()
shared.crud()
shared.grouping()
shared.joining()
