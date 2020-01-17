#!/bin/bash

args=

function run {
  file=$1;
  echo ""
  echo "> DEBUG=leoric mocha --exit --timeout 5000 ${file} ${args}";
  DEBUG=leoric mocha --exit --timeout 5000 ${file} ${args} || exit $?;
}

##
# Run unit tests first in order catch bugs as soon as possible
function unit {
  for file in $(ls test/unit/{,drivers/}test.*.js); do run ${file}; done
}

##
# integration tests
function integration {
  for file in $(ls test/integration/test.*.js); do run ${file}; done
}

case $1 in
  unit)
    args="${@:2}"
    unit
    ;;
  integration)
    args="${@:2}"
    integration
    ;;
  *.js)
    args="${@:1}"
    run $1
    ;;
  *)
    args="$@"
    unit
    integration
    ;;
esac
