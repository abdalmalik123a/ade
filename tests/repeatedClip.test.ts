/**
 * «أي فقرةٍ تتكرّر يُقترح حفظها كليشة» (د١٢، FOUNDATION §٦).
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { issueDocument } from '../src/main/services/documents';
import { repeatedParagraphs, saveClip } from '../src/main/services/clips';
import { recordCorrection } from '../src/main/services/learning';
import { normalizeFold } from '../src/shared/arabic';
import type { IssueInput } from '../src/shared/api';

const CLOSING = 'يرجى التفضل بالاطلاع وإكمال ما يلزم أصوليًّا مع فائق الاحترام والتقدير.';

const issue = (name: string, extra = CLOSING): IssueInput => ({
  sheetHtml: `<p>نؤيد أن السيد ${name} موظف لدينا.</p><p>${extra}</p>`,
  templateId: null,
  citizenId: null,
  authorityId: null,
  citizenName: name,
  nationalId: null,
  docType: 'تأييد',
  destination: null,
  purpose: null,
  values: {},
  copies: 1,
  copyKind: null,
  fee: 0,
  gregorianDate: '27 أيلول 2026',
  hijriDate: null,
  operator: null,
  printer: null,
  serialPrefix: 'م',
  serialYear: 2026,
  letterheadId: null
});

describe('الفقرة المتكرّرة', () => {
  it('ثلاث مرّاتٍ حرفيًّا تُقترح — ولا تُقترح الفقرة بالأسماء', () => {
    const db = freshDb();
    for (const n of ['أحمد علي', 'زينب حسن', 'سجاد كاظم']) issueDocument(db, issue(n));
    const now = ['نؤيد أن السيد سجاد كاظم موظف لدينا.', CLOSING];
    expect(repeatedParagraphs(db, now)).toEqual([{ text: CLOSING, count: 3 }]);
  });

  it('ومرّتان لا تكفيان', () => {
    const db = freshDb();
    for (const n of ['أحمد علي', 'زينب حسن']) issueDocument(db, issue(n));
    expect(repeatedParagraphs(db, [CLOSING])).toEqual([]);
  });

  it('وما صار كليشةً لا يُقترح، ولا ما رفضه الموظف', () => {
    const db = freshDb();
    for (const n of ['أ ب', 'ج د', 'هـ و']) issueDocument(db, issue(n));
    saveClip(db, { id: null, title: 'خاتمة', body: CLOSING });
    expect(repeatedParagraphs(db, [CLOSING])).toEqual([]);

    const db2 = freshDb();
    for (const n of ['أ ب', 'ج د', 'هـ و']) issueDocument(db2, issue(n));
    recordCorrection(db2, { kind: 'clip', input: normalizeFold(CLOSING).slice(0, 200), suggested: 'save', chosen: 'reject' });
    expect(repeatedParagraphs(db2, [CLOSING])).toEqual([]);
  });

  it('و«%» في الفقرة حرفٌ لا نمط', () => {
    const db = freshDb();
    const odd = 'نسبة الحضور ١٠٠% لكل الطلاب المذكورين أعلاه، وتُرفع القائمة إلى الإدارة.';
    for (const n of ['أ ب', 'ج د', 'هـ و']) issueDocument(db, issue(n, odd));
    expect(repeatedParagraphs(db, [odd])).toHaveLength(1);
    expect(repeatedParagraphs(db, ['نسبة الحضور %% لكل الطلاب المذكورين أعلاه، وتُرفع القائمة إلى الإدارة.'])).toEqual([]);
  });
});
