'use strict'

const expect = require('expect.js')
const expr = require('../lib/expr')

describe('=> parse indentifier', function() {
  it('parse identifiers', function() {
    expect(expr('createdAt')).to.eql({
      type: 'id', value: 'createdAt'
    })
  })

  it('parse identifier qualifiers', function() {
    expect(expr('leoric.articles.createdAt')).to.eql({
      type: 'id', value: 'createdAt', qualifiers: ['leoric', 'articles']
    })
  })
})

describe('=> parse functions', function() {
  it('parse COUNT()', function() {
    expect(expr('COUNT(id)')).to.eql({
      type: 'func',
      name: 'count',
      args: [ { type: 'id', value: 'id' } ]
    })
  })

  it('parse COUNT() AS', function() {
    expect(expr('COUNT(id) as count')).to.eql({
      type: 'op',
      name: 'as',
      args:[
        { type: 'func', name: 'count', args: [ { type: 'id', value: 'id' } ] },
        { type: 'id', value: 'count' }
      ]
    })
  })
})

describe('=> parse comparison operators', function() {
  it('parse LIKE', function() {
    expect(expr('title LIKE "%Leoric%"')).to.eql({
      type: 'op',
      name: 'like',
      args: [
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Leoric%' }
      ]
    })
  })

  it('parse IN', function() {
    expect(expr('id in (1, 2, 3)')).to.eql({
      type: 'op',
      name: 'in',
      args: [
        { type: 'id', value: 'id' },
        { type: 'array',
          value: [
            { type: 'number', value: 1 },
            { type: 'number', value: 2 },
            { type: 'number', value: 3 } ] }
      ]
    })
  })
})

describe('=> parse logical operators', function() {
  it('parse AND', function() {
    const ast = expr('YEAR(createdAt) <= 2017 && MONTH(createdAt) BETWEEN 4 AND 9')
    expect(ast.type).to.equal('op')
    expect(ast.name).to.equal('and')
  })
})

describe('=> parse compound expressions', function() {
  it('parse placeholder', function() {
    expect(expr('title like ?', '%Leoric%')).to.eql({
      type: 'op',
      name: 'like',
      args:[
        { type: 'id', value: 'title' },
        { type: 'string', value: '%Leoric%' }
      ]
    })
  })
})
