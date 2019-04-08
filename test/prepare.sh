cat <<EOF | mysql -uroot
CREATE DATABASE IF NOT EXISTS leoric;
USE leoric;
source test/dumpfile.sql;
EOF

createdb leoric > /dev/null 2>&1 || true
cat test/dumpfile.sql |
  sed 's/`/"/g' |
  sed 's/bigint(20) AUTO_INCREMENT/BIGSERIAL/g' |
  sed 's/tinyint(1) DEFAULT 0/boolean DEFAULT false/g' |
  sed -E 's/int\([[:digit:]]+\)/int/g' |
  sed 's/datetime/timestamp/g' |
  psql -d leoric

# References:
# - https://www.postgresql.org/docs/9.1/static/datatype-datetime.html
# - https://www.postgresql.org/docs/9.1/static/datatype-numeric.html
