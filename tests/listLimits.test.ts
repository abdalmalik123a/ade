/**
 * القوائم التي بلغت حدّها تقول ذلك — فلا يظنّ المكتب أنّ ما يراه كلّ ما عنده (الموجة ١، البند ٦).
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { ensureSearchColumn, listCitizens, saveCitizen } from '../src/main/services/citizens';
import { LIST_LIMITS, limitNote } from '../src/shared/limits';
import type { CitizenInput } from '../src/shared/api';

const citizen = (fullName: string): CitizenInput => ({ id: null, fullName, nationalId: null, verified: false }) as CitizenInput;

describe('حدود القوائم', () => {
  it('سجلّ الزبائن يعرض حدّه — وما زاد يُبحث عنه', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    db.transaction(() => {
      for (let i = 0; i <= LIST_LIMITS.citizens; i++) saveCitizen(db, citizen(`زبون رقم ${i}`));
    })();
    const shown = listCitizens(db);
    expect(shown).toHaveLength(LIST_LIMITS.citizens);
    // والأحدث تعديلًا أوّلًا — والبحث يصل إلى ما لم يُعرض.
    expect(listCitizens(db, { query: 'زبون رقم 0' }).some((c) => c.fullName === 'زبون رقم 0')).toBe(true);
  });

  it('والتنبيه يُكتب حين تبلغ القائمة حدّها وحده', () => {
    expect(limitNote(299, 300, 'ملف', 'ابحث')).toBeNull();
    expect(limitNote(300, 300, 'ملف', 'ابحث بالاسم')).toBe('تُعرض ٣٠٠ ملف فقط — ابحث بالاسم');
    expect(limitNote(500, LIST_LIMITS.documents, 'كتاب', 'ضيّق المدّة')).toBe('تُعرض ٥٠٠ كتاب فقط — ضيّق المدّة');
  });
});
