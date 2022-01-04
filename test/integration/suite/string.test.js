'use strict';

const assert = require('assert').strict;

const Book = require('../../models/book');

describe('=> Concat', function() {
  beforeEach(async function() {
    await Book.remove({}, true);
    await Promise.all([
      Book.create({ isbn: 9780596006624, name: 'Hackers and Painters', price: 22.95 }),
      Book.create({ isbn: 9780881792065, name: 'The Elements of Typographic Style', price: 29.95 }),
      Book.create({ isbn: 9781575863269, name: 'Things a Computer Scientist Rarely Talks About', price: 21 })
    ]);
  });

  after(async function() {
    await Book.remove({}, true);
  });

  it('concat single', async function() {
    let result;
    if (Book.driver.type === 'sqlite') {
      result = await Book.select('printf("%s%s", isbn, name) as fullname').where('price=?', 21);
    } else {
      result = await Book.select('CONCAT(isbn ,name) as fullname').where('price=?', 21);
    }
    assert.equal(typeof result, 'string');
    assert.equal(result, '9781575863269Things a Computer Scientist Rarely Talks About');
  });

  it('concat more than one', async function() {
    let result;
    if (Book.driver.type === 'sqlite') {
      // sqlite ||
      result = await Book.select('printf("%s%s", isbn, name) as fullname').order('price');
    } else {
      result = await Book.select('CONCAT(isbn ,name) as fullname').order('price');
    }
    assert.equal(Array.isArray(result), true);
    assert.deepEqual(Array.from(result.map((r) => r.fullname)), [ '9781575863269Things a Computer Scientist Rarely Talks About', '9780596006624Hackers and Painters', '9780881792065The Elements of Typographic Style' ]);
  });
});
