mkdir -p tmp

cat <<EOF | mysql -uroot
CREATE DATABASE IF NOT EXISTS jorma;
USE jorma;
source tests/dumpfile.sql;
EOF

# SQLite perfers `AUTOINCREMENT` to `AUTO_INCREMENT`. Yet `AUTOINCREMENT` isn't available on columns not marked as `PRIMARY KEY`. As of `PRIMARY KEY`, with or without `AUTOINCREMENT` isn't much of difference.
# - https://sqlite.org/autoinc.html
sed 's/bigint(20) AUTO_INCREMENT/INTEGER/' tests/dumpfile.sql | sqlite3 tmp/jorma.sqlite3
npm rebuild sqlite3 --build-from-source
