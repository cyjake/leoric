import Spellbook from '../abstract/spellbook';
import type Spell from '../../spell';
import { AbstractBone } from '../../types/abstract_bone';

class PostgresSpellBook extends Spellbook {
  formatInsert<T extends typeof AbstractBone>(spell: Spell<T>) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = super.formatInsert(spell);
    return { sql, values };
  }

  formatUpsert<T extends typeof AbstractBone>(spell: Spell<T>) {
    if (!spell.returning) spell.returning = true;
    const { sql, values } = super.formatUpsert(spell);
    return { sql, values };
  }
}

export default PostgresSpellBook;
