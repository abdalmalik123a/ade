/**
 * مولّد `tests/fixtures/aged-60ad42f.db` — قاعدة مكتبٍ بالإصدار الذي سبق التطوير كلّه.
 *
 * لا يجري من هذا المستودع: يُنسخ إلى نسخةٍ من الإصدار القديم فيجري بخدماته هو ومخططه
 * هو وترحيلات إقلاعه — فالقاعدة ما كان سيكتبه ذلك الإصدار فعلًا، لا ما نظنّه كتب:
 *
 *   git worktree add --detach ../old60 60ad42f
 *   (وصلةٌ لـnode_modules: mklink /J ..\old60
ode_modules node_modules)
 *   انسخ هذا الملف إلى ../old60/tests/_aged.test.ts
 *   cd ../old60 && AGED_OUT=<المستودع>/tests/fixtures/aged-60ad42f.db npx vitest run tests/_aged.test.ts
 *   (احذف الوصلة بـrmdir قبل حذف النسخة — لا حذفًا متكرّرًا يتبعها إلى node_modules)
 *   git worktree remove ../old60
 *
 * ويقرؤه `tests/agedDb.test.ts`.
 */
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import Database from 'better-sqlite3';
import { ensureSearchColumn, saveCitizen } from '../src/main/services/citizens';
import { prepareLetterheads, saveLetterhead } from '../src/main/services/letterheads';
import { prepareTemplates, saveDraft, saveTemplate } from '../src/main/services/templates';
import { issueDocument, issueTransaction, prepareDocuments } from '../src/main/services/documents';
import { prepareClips, saveClip } from '../src/main/services/clips';
import { prepareClients } from '../src/main/services/clients';
import { prepareLearning } from '../src/main/services/learning';
import { emptyLayout } from '../src/shared/letterhead';
import { docFromLegacy } from '../src/shared/doc';
import { FINGERPRINT_SLOT, QR_SLOT, SERIAL_SLOT, type CitizenInput, type IssueInput } from '../src/shared/api';

it('aged db', () => {
  const out = process.env.AGED_OUT!;
  rmSync(out, { force: true });
  const db = new Database(out);
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');
  for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(process.cwd(), 'src', 'main', 'db', f), 'utf8'));
  // كما يفعل إقلاع ذلك الإصدار: كلّ خدمةٍ تضيف أعمدتها.
  prepareDocuments(db);
  prepareLetterheads(db);
  prepareTemplates(db);
  prepareClips(db);
  prepareClients(db);
  prepareLearning(db);
  ensureSearchColumn(db);

  const citizen = (patch: Partial<CitizenInput>): CitizenInput => ({
    id: null, fullName: '', nationalId: null, jobTitle: null, workplace: null, employeeCode: null, serviceStatus: null,
    birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null, landmark: null,
    phone: null, photoPath: null, category: null, notes: null, verified: false, ...patch
  });
  const zainab = saveCitizen(db, citizen({ fullName: 'زينب علي حسن الربيعي', nationalId: '199011112222', jobTitle: 'محاسبة', category: 'موظفو الدائرة' }));
  saveCitizen(db, citizen({ fullName: 'أحمد كريم جاسم', nationalId: '198822223333', phone: '07701234567' }));

  const lh = saveLetterhead(db, { id: null, name: 'رأس المديرية', authorityId: null, layout: emptyLayout() });
  const legacy = saveTemplate(db, {
    id: null, code: null, title: 'تأييد استمرار بالخدمة', subtitle: null, category: 'دوائر', subjectLine: 'م/ تأييد',
    bodyHtml: 'نؤيد أن السيد {الاسم} يعمل لدينا بصفة {العنوان_الوظيفي}.', letterheadId: lh.id,
    variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }]
  });
  saveTemplate(db, {
    id: null, code: 'T-2', title: 'تأييد سكن', subtitle: null, category: 'بلدية', subjectLine: null,
    bodyHtml: 'يشهد المختار أن {الاسم} ساكنٌ في {العنوان}.', letterheadId: null, variables: [],
    doc: docFromLegacy('يشهد المختار أن {الاسم} ساكنٌ في {العنوان}.')
  });
  saveDraft(db, { id: null, templateId: legacy.id, citizenId: zainab.id, title: 'مسودة زينب', values: { الاسم: 'زينب علي حسن الربيعي' }, bodyHtml: '<p>مسودة</p>' });
  saveClip(db, { id: null, title: 'ختام', body: 'مع وافر الشكر والتقدير.', category: null });

  const sheet = (name: string) =>
    `<div class="a4-sheet"><div>العدد: <span data-slot="serial">${SERIAL_SLOT}</span></div>` +
    `<div>إلى / مصرف الرشيد</div><div>نؤيد لكم أن السيد ${name} يعمل لدينا.</div>` +
    `<div data-slot="qr">${QR_SLOT}</div><span data-slot="fingerprint">${FINGERPRINT_SLOT}</span></div>`;
  const doc = (name: string, patch: Partial<IssueInput> = {}): IssueInput => ({
    sheetHtml: sheet(name), templateId: legacy.id, citizenId: null, authorityId: null, citizenName: name, nationalId: null,
    docType: 'تأييد استمرار بالخدمة', destination: 'مصرف الرشيد', purpose: 'سلفة', values: { الاسم: name }, copies: 1,
    copyKind: 'نسخة أصلية', fee: 1000, gregorianDate: '17 أيلول 2026', hijriDate: '5 ربيع الأول 1448', operator: 'مشغّل 01',
    printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: lh.id, ...patch
  });
  issueDocument(db, doc('زينب علي حسن الربيعي', { citizenId: zainab.id, nationalId: '199011112222' }));
  issueDocument(db, doc('سالم محمود علي'));
  issueDocument(db, doc('هدى عباس كاظم', { serialYear: 2025 }));
  issueTransaction(db, {
    citizenId: null, citizenName: 'أحمد كريم جاسم', nationalId: '198822223333', operator: 'مشغّل 01', printer: null,
    serialPrefix: 'م', serialYear: 2026, gregorianDate: '19 أيلول 2026', hijriDate: null,
    sheets: [0, 1].map((i) => ({
      sheetHtml: `<div class="a4-sheet">نؤيد لكم أن السيد أحمد كريم جاسم (${i}) يعمل لدينا.<div data-slot="qr">${QR_SLOT}</div></div>`,
      templateId: null, letterheadId: null, authorityId: null, docType: i ? 'تأييد سكن' : 'تأييد راتب', destination: null, purpose: null,
      values: {}, copies: 1, copyKind: 'نسخة أصلية', fee: 1000
    }))
  });
  db.close();
});
