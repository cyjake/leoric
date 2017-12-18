0.1.4 / 2017-12-18
==================

 * Fix: should format condition arrays by hand instead of hand it over to formatExpr
 * Fix: whereConditions of subquery should retain the order of the whereConditions in major query
 * Fix: calculated columns should be kept in the final columns when sorting out the attributes
 * Fix: doesn't depend on co anymore

0.1.3 / 2017-12-17
==================

 * Fix: `select distict foo from table`;
 * Fix: `where (a = 1 or a = 2) and b = 3`;
 * Docs: a syntax table to provide a better glance over the querying ability.

0.1.2 / 2017-12-14
==================

 * Fix: copy left table's orders into subquery to make order/limit work when combined.
 * Fix: errors should be thrown when accessing attributes that weren't selected at the first place.

0.1.1 / 2017-12-13
==================

 * Refactor: automatic versioning on spells. When client calls query methods with chaining, new versions of spell gets duplicated. Makes reuse of spells possible.
 * Docs: english verion is almost complete <http://cyj.me/leoric>.

0.1.0 / 2017-12-09
==================

 * Initial version, covers basic usage such as model authoring, database connection, query interface, and association.
