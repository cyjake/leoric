#!/bin/bash

function run {
  text=$1;
  echo "> DEBUG=leoric mocha --exit --timeout 5000 ${test}";
  DEBUG=leoric mocha --exit --timeout 5000 ${test} || exit $?;
}

##
# Run unit tests first in order catch bugs as soon as possible
for test in $(ls test/unit/{,drivers}/test.*.js); do run ${test}; done

##
# integration tests
for test in $(ls test/integration/test.*.js); do run ${test}; done
