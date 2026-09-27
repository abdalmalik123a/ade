/**
 * الحِمل (المرحلة ٧): أرشيفُ خمسين ألف كتاب — سنواتٌ من عمل مكتبٍ مزدحم.
 *
 * يُبنى بطريق الإصدار نفسه (الرقم والبصمة والسلسلة والفهرس)، ثم يُقاس ما يفعله الموظف
 * كلّ يوم: بحثٌ باسمٍ وبرقم صادرٍ وبكلمةٍ من المتن، وصفحة الأرشيف الأولى، وإحصاء
 * السنة، و«تحقّق من سلامة الأرشيف». والحدود واسعةٌ عمدًا (جهاز المكتب أبطأ من جهاز
 * التطوير) — المقصود أن لا يصير شيءٌ منها خطّيًّا في حجم الأرشيف فيتجمّد البرنامج.
 *
 * يطول (البناء نحو دقيقة)، فلا يجري إلا بـ`DIWAN_LOAD=1`:
 *   DIWAN_LOAD=1 npx vitest run tests/load.test.ts
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { archiveStats, issueDocument, listDocuments, periodStats, prepareDocuments, verifyArchive } from '../src/main/services/documents';
import { prepareSearch } from '../src/main/services/searchIndex';
import type { IssueInput } from '../src/shared/api';

const N = 50_000;
const FIRST = ['أحمد', 'محمد', 'علي', 'حسين', 'زينب', 'فاطمة', 'مريم', 'عباس', 'كريم', 'سالم', 'نور', 'هدى'];
const LAST = ['الجبوري', 'العبيدي', 'الموسوي', 'الربيعي', 'التميمي', 'الساعدي', 'الخفاجي', 'الزبيدي'];
const TYPES = ['تأييد استمرار بالخدمة', 'تأييد سكن', 'براءة ذمة', 'كفالة', 'تأييد راتب', 'نقل خدمات', 'إجازة'];

const input = (i: number): IssueInput => {
  const name = `${FIRST[i % FIRST.length]} ${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 3) % LAST.length]} ${i}`;
  const type = TYPES[i % TYPES.length]!;
  return {
    sheetHtml: `<div class="a4-sheet"><div>م / ${type}</div><div>نؤيد أن السيد ${name} يعمل لدينا في الدائرة ${i % 40}، وأُعطي هذا بناءً على طلبه.</div></div>`,
    templateId: null,
    citizenId: null,
    authorityId: null,
    citizenName: name,
    nationalId: String(199000000000 + i),
    docType: type,
    destination: null,
    purpose: null,
    values: {},
    copies: 1,
    copyKind: 'نسخة أصلية',
    fee: 0,
    gregorianDate: '',
    hijriDate: '',
    operator: 'مشغّل',
    printer: null,
    serialPrefix: 'م',
    serialYear: 2020 + Math.floor((i / N) * 7),
    letterheadId: null
  };
};

const time = <T,>(fn: () => T): [T, number] => {
  const t0 = performance.now();
  const out = fn();
  return [out, Math.round(performance.now() - t0)];
};

describe.runIf(process.env.DIWAN_LOAD === '1')('أرشيفٌ بخمسين ألف كتاب', () => {
  it('البحث والصفحة والإحصاء والسلامة لا تتجمّد', () => {
    const db = freshDb();
    prepareDocuments(db);
    prepareSearch(db);
    const [, build] = time(() =>
      db.transaction(() => {
        for (let i = 0; i < N; i++) issueDocument(db, input(i));
      })()
    );
    // أيّامٌ عبر سبع سنوات، لا يومٌ واحد — فالمُدد والإحصاء يُقاسان على توزيعٍ حقيقي.
    db.exec(`UPDATE documents SET issued_at = datetime('2020-01-01', '+' || (id * 4) || ' hours')`);

    const [byName, tName] = time(() => listDocuments(db, { query: 'زينب 49321' }));
    const [bySerial, tSerial] = time(() => listDocuments(db, { query: 'م/2026/' }));
    const [byWord, tWord] = time(() => listDocuments(db, { query: 'براءة ذمة', limit: 500 }));
    const [page, tPage] = time(() => listDocuments(db, { limit: 500 }));
    const [year, tYear] = time(() => periodStats(db, { from: '2025-01-01', to: '2025-12-31' }));
    const [, tStats] = time(() => archiveStats(db));
    const [check, tCheck] = time(() => verifyArchive(db));

    console.log(JSON.stringify({ build, tName, tSerial, tWord, tPage, tYear, tStats, tCheck }));
    expect(byName.some((d) => d.citizenName.endsWith(' 49321'))).toBe(true);
    expect(bySerial.length).toBeGreaterThan(0);
    expect(byWord.length).toBe(500);
    expect(page).toHaveLength(500);
    expect(year.issued).toBeGreaterThan(1000);
    expect(check.problems).toEqual([]);
    expect(check.checked).toBe(N);

    expect(tName).toBeLessThan(300);
    expect(tSerial).toBeLessThan(500);
    expect(tWord).toBeLessThan(500);
    expect(tPage).toBeLessThan(500);
    expect(tYear).toBeLessThan(1000);
    expect(tStats).toBeLessThan(1000);
    // السلامة تمرّ على السلسلة كلّها بطبعها — ثوانٍ لا دقائق.
    expect(tCheck).toBeLessThan(15_000);
  }, 600_000);
});
