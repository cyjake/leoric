#!/bin/bash

args=

function run {
  file=$1;
  if [ "${args[0]}" = "${file}" ]; then
    args=("${args[@]:1}");
  fi
  echo "";
  printf '"%s" ' "${args[@]}" | xargs echo "> DEBUG=leoric mocha --exit --timeout 5000 ${file}";
  printf '"%s" ' "${args[@]}" | DEBUG=leoric xargs mocha --exit --timeout 5000 ${file} || exit $?;
}

##
# Run unit tests first in order catch bugs as soon as possible
function unit {
  # recursive glob nor available in bash 3
  # - https://unix.stackexchange.com/questions/49913/recursive-glob
  run "$(ls test/unit/{,drivers/,drivers/*/,adapters/}*.test.js)";
}

##
# integration tests
function integration {
  for file in $(ls test/integration/*.test.js); do run ${file}; done
}

case $1 in
  unit)
    args=("${@:2}")
    unit
    ;;
  integration)
    args=("${@:2}")
    integration
    ;;
  *.js)
    args=("${@:1}")
    run $1
    ;;
  *)
    args="$@"
    unit
    integration
    ;;
esac
