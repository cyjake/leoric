import { Hint, IndexHint } from '../../hint';
import Spellbook from '../abstract/spellbook';
import type Spell from '../../spell';
import { AbstractBone } from '../../abstract_bone';

class MySQLSpellBook extends Spellbook {
  formatOptimizerHints<T extends typeof AbstractBone>(spell: Spell<T>): string {
    const optimizerHints = spell.hints.filter((hint: any) => hint instanceof Hint);
    if (Array.isArray(optimizerHints) && optimizerHints.length > 0) {
      const hints = optimizerHints.map((hint: any) => hint.toSqlString()).join(' ');
      return `/*+ ${hints} */`;
    }
    return '';
  }

  formatIndexHints<T extends typeof AbstractBone>(spell: Spell<T>): string {
    const indexHints = spell.hints.filter((hint: any) => hint instanceof IndexHint);
    if (Array.isArray(indexHints) && indexHints.length > 0) {
      const hints = IndexHint.merge(indexHints as IndexHint[]);
      return hints.map(hint => hint.toSqlString()).join(' ');
    }
    return '';
  }

  formatUpdateOnDuplicate<T extends typeof AbstractBone>(spell: Spell<T>, columns: string[]): string {
    const { updateOnDuplicate, Model } = spell;
    if (!updateOnDuplicate) return '';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { escapeId } = Model.driver!;
    const { columnAttributes, primaryColumn } = Model;

    if (Array.isArray(updateOnDuplicate) && updateOnDuplicate.length) {
      columns = updateOnDuplicate.map((column: string) => columnAttributes[column].columnName)
        .filter((column: string) => column !== primaryColumn);
    }

    const sets: string[] = [];
    if (!columns.includes(primaryColumn)) {
      sets.push(`${escapeId(primaryColumn)} = LAST_INSERT_ID(${escapeId(primaryColumn)})`);
    }
    sets.push(...columns.map(column => `${escapeId(column)}=VALUES(${escapeId(column)})`));

    return `ON DUPLICATE KEY UPDATE ${sets.join(', ')}`;
  }

  formatReturning() {
    return '';
  }

  formatUpdate<T extends typeof AbstractBone>(spell: Spell<T>) {
    const result = super.formatUpdate(spell);
    const { rowCount, orders } = spell;
    const chunks: string[] = [];

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (Number(rowCount) > 0) chunks.push(`LIMIT ${rowCount}`);
    if (chunks.length > 0) result.sql += ` ${chunks.join(' ')}`;

    return result;
  }

  formatDelete<T extends typeof AbstractBone>(spell: Spell<T>) {
    const result = super.formatDelete(spell);
    const { rowCount, orders } = spell;
    const chunks: string[] = [];

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (Number(rowCount) > 0) chunks.push(`LIMIT ${rowCount}`);
    if (chunks.length > 0) result.sql += ` ${chunks.join(' ')}`;

    return result;
  }
}

export default MySQLSpellBook;
