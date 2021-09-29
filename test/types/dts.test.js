'use strict';

const path = require('path');
const coffee = require('coffee');

describe('typescript', () => {
  it('should compile ts without error', () => {
    return coffee.fork(
      require.resolve('typescript/bin/tsc'),
      [
        '-p', path.resolve(__dirname, './fixtures/tsconfig.json'),
        '--noEmit',
      ]
    )
      .debug()
      .expect('code', 0)
      .end();
  });
});
