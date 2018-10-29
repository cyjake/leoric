'use strict'

const expect = require('expect.js')
const { connect } = require('..')

describe('connect', function() {
  this.timeout(5000)

  it('connect models passed in opts.models', async function() {
    await connect({
      user: 'root',
      database: 'leoric',
      models: `${__dirname}/models`
    })
    const Book = require('./models/book')
    expect(Object.keys(Book.schema).length).to.be.above(0)
  })
})
