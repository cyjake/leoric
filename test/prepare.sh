#!/bin/bash

set -x

if [ ${GITHUB_ACTIONS:-false} = true ]; then
  mysqladmin -h127.0.0.1 -P${MYSQL_PORT:-3306} -uroot -p${MYSQL_ROOT_PASSWORD} password '';
fi

##
# MySQL
cat <<EOF | mysql -h127.0.0.1 -P${MYSQL_PORT:-3306} -uroot
DROP DATABASE IF EXISTS leoric;
CREATE DATABASE leoric CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE leoric;
source test/dumpfile.sql;
ALTER TABLE articles CHANGE COLUMN summary summary MEDIUMTEXT;
ALTER TABLE articles CHANGE COLUMN word_count word_count MEDIUMINT DEFAULT 0;
ALTER TABLE users CHANGE COLUMN birthday birthday DATE;
ALTER TABLE users CHANGE COLUMN sex sex CHAR;
EOF

# https://stackoverflow.com/a/50377944/179691
cat <<EOF | mysql -h127.0.0.1 -P${MYSQL_PORT:-3306} -uroot
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
EOF

##
# PostgreSQL
createdb leoric > /dev/null 2>&1 || true
cat test/dumpfile.sql |
  sed 's/`/"/g' |
  sed 's/bigint(20) AUTO_INCREMENT/BIGSERIAL/g' |
  sed 's/tinyint(1) DEFAULT 0/boolean DEFAULT false/g' |
  sed -E 's/int\([[:digit:]]+\)/int/g' |
  PGPASSWORD=${POSTGRES_PASSWORD} psql \
    -h ${POSTGRES_HOST:-localhost} \
    -U ${POSTGRES_USER:-$(whoami)} \
    -p ${POSTGRES_PORT:-5432} \
    -d leoric

##
# SQLite
#
# sqlite perfers `AUTOINCREMENT` to `AUTO_INCREMENT`. Yet `AUTOINCREMENT` isn't available on columns not marked as `PRIMARY KEY`. As of `PRIMARY KEY`, with or without `AUTOINCREMENT` isn't much of difference.
# - https://sqlite.org/autoinc.html
sed 's/bigint(20) AUTO_INCREMENT/INTEGER/' test/dumpfile.sql |
  sed 's/tinyint(1) DEFAULT 0/boolean DEFAULT false/g' |
  sqlite3 /tmp/leoric.sqlite3

# References:
# - https://www.postgresql.org/docs/9.1/static/datatype-datetime.html
# - https://www.postgresql.org/docs/9.1/static/datatype-numeric.html
