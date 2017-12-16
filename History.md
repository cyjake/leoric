0.1.3 / 2017-12-??
==================

 * Fix: `select distict foo from table`;
 * Fix: `where (a = 1 or a = 2) and b = 3`;

0.1.2 / 2017-12-14
==================

 * Copy left table's orders into subquery to make order/limit work when combined.

0.1.1 / 2017-12-13
==================

 * Refactor: automatic versioning on spells. When client calls query methods with chaining, new versions of spell gets duplicated. Makes reuse of spells possible.
 * Docs: english verion is almost complete <http://cyj.me/leoric>.

0.1.0 / 2017-12-09
==================

 * Initial version, covers basic usage such as model authoring, database connection, query interface, and association.
