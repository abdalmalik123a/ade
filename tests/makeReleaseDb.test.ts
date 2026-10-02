/**
 * مولّد `tests/fixtures/release-1.0.0.db` — قاعدة مكتبٍ بالإصدار ١٫٠٫٠ المبيع (خطة Production، ٧٫٣).
 *
 * يجري بخدمات هذا الإصدار نفسه وترحيلات إقلاعه، مرّةً عند الإصدار — فالقاعدة ما كتبه ١٫٠٫٠ فعلًا — ثم
 * تُحفظ ولا تُعاد: كلّ إصدارٍ بعده يفتحها في `tests/releaseDb.test.ts` كما يفتحها إقلاعه. ولكلّ إصدارٍ
 * يُباع قاعدته (`release-X.Y.Z.db`) بالطريقة نفسها.
 *
 *   RELEASE_OUT=tests/fixtures/release-1.0.0.db npx vitest run tests/makeReleaseDb.test.ts
 */
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import Database from 'better-sqlite3';
import { addAttachment, ensureSearchColumn, saveCitizen } from '../src/main/services/citizens';
import { prepareLetterheads, saveLetterhead } from '../src/main/services/letterheads';
import { prepareTemplates, saveDraft, saveTemplate } from '../src/main/services/templates';
import { issueBatch, issueDocument, issueTransaction, prepareDocuments, voidDocument } from '../src/main/services/documents';
import { prepareClips, saveClip } from '../src/main/services/clips';
import { prepareClients, saveClient } from '../src/main/services/clients';
import { prepareLearning } from '../src/main/services/learning';
import { prepareSearch } from '../src/main/services/searchIndex';
import { saveQuestion } from '../src/main/services/questionBank';
import { stampDataVersion } from '../src/main/services/dataVersion';
import { normalizeLayout } from '../src/shared/letterhead';
import { docFromLegacy, run } from '../src/shared/doc';
import { normalizePrintRoles } from '../src/shared/printRoles';
import type { CitizenInput, IssueInput, SheetStyle } from '../src/shared/api';

const VERSION = '1.0.0';
const STYLE: SheetStyle = { css: '.a4-sheet{font-family:"IBM Plex Sans Arabic"}', bodyClass: 'font-body-md' };

it.runIf(process.env['RELEASE_OUT'])('قاعدة الإصدار المبيع', () => {
  const out = process.env['RELEASE_OUT']!;
  rmSync(out, { force: true });
  const db = new Database(out);
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');
  for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(process.cwd(), 'src', 'main', 'db', f), 'utf8'));
  ensureSearchColumn(db);
  prepareDocuments(db);
  prepareLetterheads(db);
  prepareTemplates(db);
  prepareClips(db);
  prepareClients(db);
  prepareLearning(db);
  prepareSearch(db);

  const citizen = (patch: Partial<CitizenInput>): CitizenInput => ({
    id: null, fullName: '', nationalId: null, jobTitle: null, workplace: null, employeeCode: null, serviceStatus: null,
    birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null, landmark: null,
    phone: null, photoPath: null, category: null, notes: null, verified: false, ...patch
  });
  const zainab = saveCitizen(db, citizen({ fullName: 'زينب علي حسن الربيعي', nationalId: '199011112222', jobTitle: 'محاسبة', category: 'موظفو الدائرة' }));
  saveCitizen(db, citizen({ fullName: 'أحمد كريم جاسم', nationalId: '198822223333', phone: '07701234567' }));
  addAttachment(db, { citizenId: zainab.id, docType: 'البطاقة الوطنية — الوجه', filePath: 'attachments/0123456789abcdef0123456789abcdef.jpg', fileFormat: 'jpg', dpi: 300, sha256: null });

  const lh = saveLetterhead(db, {
    id: null,
    name: 'مديرية تربية الأنبار',
    authorityId: null,
    category: 'تربية',
    layout: normalizeLayout({ sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: 'جمهورية العراق', align: 'center', size: 14, bold: true }] }] })
  });
  const t = saveTemplate(db, {
    id: null, code: 'DIW-1', title: 'تأييد استمرار بالخدمة', subtitle: null, category: 'ملاك', subjectLine: 'م/ تأييد',
    bodyHtml: 'نؤيد أن السيد {الاسم} يعمل لدينا.', letterheadId: lh.id,
    variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }],
    doc: docFromLegacy('نؤيد أن السيد {الاسم} يعمل لدينا.')
  });
  saveDraft(db, { id: null, templateId: t.id, citizenId: zainab.id, title: 'مسودة زينب', values: { الاسم: 'زينب علي حسن الربيعي' }, bodyHtml: '<p>مسودة</p>' });
  saveClip(db, { id: null, title: 'ختام', body: 'مع وافر الشكر والتقدير.', category: null });
  saveClient(db, { id: null, name: 'مدرسة الرافدين', kind: 'مدرسة' });
  saveQuestion(db, { item: { id: 'q1', inlines: [run('ما عاصمة العراق؟')], score: 5 }, subject: 'اجتماعيات', grade: 'الخامس' });

  const doc = (name: string, patch: Partial<IssueInput> = {}): IssueInput => ({
    sheetHtml: `<div class="a4-sheet"><div>إلى / مصرف الرشيد</div><div>نؤيد لكم أن السيد ${name} يعمل لدينا.</div></div>`,
    templateId: t.id, citizenId: null, authorityId: null, citizenName: name, nationalId: null, docType: 'تأييد استمرار بالخدمة',
    destination: 'مصرف الرشيد', purpose: 'سلفة', values: { الاسم: name }, copies: 1, copyKind: 'نسخة أصلية', fee: 0,
    gregorianDate: '2 تشرين الأول 2026', hijriDate: null, operator: 'مشغّل 01', printer: 'ليزر المكتب', serialPrefix: 'م',
    serialYear: 2026, letterheadId: lh.id, style: STYLE, ...patch
  });
  issueDocument(db, doc('زينب علي حسن الربيعي', { citizenId: zainab.id, nationalId: '199011112222' }));
  const wrong = issueDocument(db, doc('اسمٌ خاطئ'));
  voidDocument(db, wrong.id, 'صدر باسمٍ خاطئ', 'مشغّل 01');
  const sheet = (n: string) => ({ sheetHtml: `<div class="a4-sheet">${n}</div>`, templateId: null, letterheadId: null, authorityId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0 });
  const tx = (name: string) => ({ citizenId: null, citizenName: name, nationalId: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, gregorianDate: '2 تشرين الأول 2026', hijriDate: null, style: STYLE, sheets: [sheet(`${name} ١`), sheet(`${name} ٢`)] });
  issueTransaction(db, tx('أحمد كريم جاسم'));
  issueBatch(db, [tx('سالم'), tx('ليلى')]);

  const setting = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  setting.run('officeName', 'مكتب الاختبار');
  setting.run('printRoles', JSON.stringify(normalizePrintRoles({ documents: { normal: 'ليزر المكتب', color: 'ملوّنة', dialog: false } }, null)));
  setting.run('hiddenSections', JSON.stringify(['designs']));
  setting.run('sidebarPinned', 'false');
  stampDataVersion(db, VERSION);
  db.close();
});
