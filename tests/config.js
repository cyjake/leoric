'use strict'

module.exports = {
  host: 'localhost',
  user: 'root',
  db: 'leoric',
  path: `${__dirname}/models`,
  logger: {
    debug: function(...args) { console.log(...args) },
    warn: function(...args) { console.warn(...args) },
    info: function(...args) { console.log(...args) }
  }
}
