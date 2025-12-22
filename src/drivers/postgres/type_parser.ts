import pgTypes from 'pg-types';

// Cast NUMERIC/DECIMAL to number when returned as text
pgTypes.setTypeParser(1700, 'text', (val: string) => Number(val));
