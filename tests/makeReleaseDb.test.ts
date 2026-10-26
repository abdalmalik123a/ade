/**
 * مولّد `tests/fixtures/release-X.Y.Z.db` — قاعدة مكتبٍ بالإصدار المبيع (خطة Production، ٧٫٣).
 *
 * يجري بخدمات هذا الإصدار نفسه وترحيلات إقلاعه، مرّةً عند الإصدار — فالقاعدة ما كتبه الإصدار فعلًا — ثم
 * تُحفظ ولا تُعاد: كلّ إصدارٍ بعده يفتحها في `tests/releaseDb.test.ts` كما يفتحها إقلاعه. ولكلّ إصدارٍ
 * يُباع قاعدته بالطريقة نفسها، واسمها بإصدار `package.json` وحده — فلا تُكتب قاعدةُ إصدارٍ قديم بشيفرةٍ أحدث.
 *
 *   RELEASE_OUT=tests/fixtures/release-1.1.0.db npx vitest run tests/makeReleaseDb.test.ts
 */
import { readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { it } from 'vitest';
import Database from 'better-sqlite3';
import { addAttachment, saveCitizen } from '../src/main/services/citizens';
import { saveLetterhead } from '../src/main/services/letterheads';
import { saveDraft, saveTemplate } from '../src/main/services/templates';
import { voidDocument } from '../src/main/services/documents';
import { issueBatch, issueDocument, issueTransaction } from '../src/main/services/issue';
import { addPrintedCopy, recordPrint } from '../src/main/services/printRecords';
import { saveOrder, setOrderStatus } from '../src/main/services/orders';
import { recordWork } from '../src/main/services/workLog';
import { saveClip } from '../src/main/services/clips';
import { saveClient } from '../src/main/services/clients';
import { prepareSearch } from '../src/main/services/searchIndex';
import { saveQuestion } from '../src/main/services/questionBank';
import { stampDataVersion } from '../src/main/services/dataVersion';
import { runMigrations } from '../src/main/db/migrations';
import { normalizeLayout } from '../src/shared/letterhead';
import { docFromLegacy, run } from '../src/shared/doc';
import { normalizePrintRoles } from '../src/shared/printRoles';
import type { CitizenInput, IssueInput, SheetStyle } from '../src/shared/api';
import { canvasDoc, emptyCanvas, imageElement, normalizeCanvas, pathElement, tableElement, textElement } from '../src/shared/canvas';
import { designDraftValues } from '../src/shared/design/draft';

const { version: VERSION } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };
/** ما جاء به إصدارٌ يُكتب في قاعدته وما بعدها — بالأرقام لا بالنصّ («1.10.0» بعد «1.3.0»). */
const atLeast = (v: string) => VERSION.localeCompare(v, undefined, { numeric: true }) >= 0;
/** خليّة جدولٍ بنصّها. */
const run0 = (text: string) => ({ text });
const STYLE: SheetStyle = { css: '.a4-sheet{font-family:"IBM Plex Sans Arabic"}', bodyClass: 'font-body-md' };

it.runIf(process.env['RELEASE_OUT'])('قاعدة الإصدار المبيع', () => {
  const out = process.env['RELEASE_OUT']!;
  if (basename(out) !== `release-${VERSION}.db`) throw new Error(`القاعدة المبيعة بإصدار الحزمة وحده: release-${VERSION}.db`);
  rmSync(out, { force: true });
  const db = new Database(out);
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');
  for (const f of ['schema.sql', 'search.sql']) db.exec(readFileSync(join(process.cwd(), 'src', 'main', 'db', f), 'utf8'));
  // كما يقلع البرنامج (D195): الترقيات المرقّمة كلّها ثم فهرس البحث — لا نداءاتٌ بيدٍ تتخلّف عن المشغّل (A17).
  runMigrations(db);
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
  const school = saveClient(db, { id: null, name: 'مدرسة الرافدين', kind: 'مدرسة', schoolGender: 'للبنين', governorate: 'الأنبار', principal: 'سالم حسن' });
  saveQuestion(db, { item: { id: 'q1', inlines: [run('ما عاصمة العراق؟')], score: 5 }, subject: 'اجتماعيات', grade: 'الخامس' });

  const doc = (name: string, patch: Partial<IssueInput> = {}): IssueInput => ({
    sheetHtml: `<div class="a4-sheet"><div>إلى / مصرف الرشيد</div><div>نؤيد لكم أن السيد ${name} يعمل لدينا.</div></div>`,
    templateId: t.id, citizenId: null, authorityId: null, citizenName: name, nationalId: null, docType: 'تأييد استمرار بالخدمة',
    destination: 'مصرف الرشيد', purpose: 'سلفة', values: { الاسم: name }, copies: 1, copyKind: 'نسخة أصلية',
    gregorianDate: '2 تشرين الأول 2026', hijriDate: null, operator: 'مشغّل 01', printer: 'ليزر المكتب', serialPrefix: 'م',
    serialYear: 2026, letterheadId: lh.id, style: STYLE, ...patch
  });
  const printed = issueDocument(db, doc('زينب علي حسن الربيعي', { citizenId: zainab.id, nationalId: '199011112222' }));
  // ١٫٢٫٠: الطبعة تُقيَّد حين تتمّ — وما سواها حُفظ بلا طباعة.
  recordPrint(db, printed.id, { copies: 1, printer: 'ليزر المكتب', operator: 'مشغّل 01' });
  // ١٫٣٫٠: النسخ عند الشبّاك — طبعةٌ واحدة تزيد نسخها ورقةً ورقة (د٣).
  if (atLeast('1.3.0')) {
    addPrintedCopy(db, printed.id);
    addPrintedCopy(db, printed.id);
  }
  const wrong = issueDocument(db, doc('اسمٌ خاطئ'));
  voidDocument(db, wrong.id, 'صدر باسمٍ خاطئ', 'مشغّل 01');
  const sheet = (n: string) => ({ sheetHtml: `<div class="a4-sheet">${n}</div>`, templateId: null, letterheadId: null, authorityId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null });
  const tx = (name: string) => ({ citizenId: null, citizenName: name, nationalId: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, gregorianDate: '2 تشرين الأول 2026', hijriDate: null, style: STYLE, sheets: [sheet(`${name} ١`), sheet(`${name} ٢`)] });
  issueTransaction(db, tx('أحمد كريم جاسم'));
  issueBatch(db, [tx('سالم'), tx('ليلى')]);

  // ١٫٢٫٠: طلبٌ بوصل استلامه وما تركه الزبون، وآخر سُلّم، وعدّاد ما خرج.
  saveOrder(db, { id: null, clientId: school.id, title: 'هويّات الطلبة', quantity: 40, dueDate: '2026-10-10', received: 'قائمة الأسماء وصور الطلبة' });
  const done = saveOrder(db, { id: null, clientId: null, customer: 'أحمد كريم جاسم', phone: '07701234567', title: 'صور شخصية', received: 'صورة الهوية' });
  setOrderStatus(db, done.id, 'delivered');
  // ١٫٣٫٠: الطلب مربوطٌ بملفّ الزبون (د٨).
  if (atLeast('1.3.0')) saveOrder(db, { id: null, clientId: null, citizenId: zainab.id, customer: 'زينب علي حسن الربيعي', title: 'صور جواز', received: 'صورة البطاقة' });
  // ١٫٤٫٠ (التصاميم، المرحلة ١): تصميمٌ بما جاءت به — شكلٌ حرّ بتدرّج، وصورةٌ مقصوصةٌ دائرةً بإطار، ونصٌّ على قوسٍ
  // بحدٍّ وظلّ، وجدولٌ بأسطرٍ وصفٍّ ملوّن، وشفافية ومجموعة — ومسودّة تصميمٍ لم يُحفظ، وخطٌّ استورده المكتب وعنصرٌ في
  // مكتبته (صفّاهما كما يكتبهما `importFace` و`importElement`؛ ملفّاهما في المخزن لا في القاعدة).
  if (atLeast('1.4.0')) {
    const gold = { type: 'linear' as const, angle: 90, stops: [{ offset: 0, color: '#f5d77a' }, { offset: 1, color: '#9a7524' }] };
    const canvas = normalizeCanvas({
      ...emptyCanvas({ w: 148, h: 105 }),
      elements: [
        pathElement({ id: 'wave', box: { x: 0, y: 0.8, w: 1, h: 0.2 }, d: 'M0 50 Q25 0 50 50 T100 50 V100 H0 Z', fill: gold, z: 1 }),
        imageElement({ id: 'photo', box: { x: 0.05, y: 0.25, w: 0.2, h: 0.35 }, ref: 'صورة الطالب', shape: 'circle', frame: { color: '#9a7524', width: 0.8, rings: 2, gap: 0.6 }, z: 2 }),
        textElement({ id: 'name', box: { x: 0.3, y: 0.08, w: 0.6, h: 0.2 }, inlines: [run('مدرسة الرافدين')], size: 18, bold: true, color: '#1f3a8a', arc: 40, outline: { color: '#ffffff', width: 0.5 }, shadow: { color: '#00000059', dx: 0.6, dy: 1, blur: 2 }, z: 3, group: 'g1' }),
        textElement({ id: 'year', box: { x: 0.3, y: 0.28, w: 0.6, h: 0.1 }, inlines: [run('{العام الدراسي}')], size: 12, opacity: 0.8, z: 4, group: 'g1' }),
        tableElement({ id: 'imsak', box: { x: 0.3, y: 0.42, w: 0.65, h: 0.35 }, borders: 'rows', hideHeader: true, rowStyles: [null, { bg: '#fde68a', bold: true }, null], z: 5 })
      ]
    });
    const design = canvasDoc(canvas, { title: 'هوية مدرسة الرافدين', category: 'تصاميم' });
    saveTemplate(db, { id: null, code: null, title: 'هوية مدرسة الرافدين', subtitle: '148.0 × 105.0 ملم', category: 'تصاميم', subjectLine: null, bodyHtml: 'مدرسة الرافدين', letterheadId: null, variables: [], doc: design });
    saveDraft(db, { id: null, templateId: null, citizenId: null, title: 'تصميمٌ لم يُحفظ', values: designDraftValues({ doc: design, values: { 'العام الدراسي': '٢٠٢٦ – ٢٠٢٧' } }), bodyHtml: '' });
    db.prepare("INSERT INTO fonts (family, weight, italic, file, source, original_name) VALUES ('Diwani Office', 400, 0, 'fonts/0123456789abcdef0123456789abcdef.ttf', 'windows', 'DiwaniOffice.ttf')").run();
    db.prepare("INSERT INTO elements (name, category, kind, file, width, height) VALUES ('زخرفة الزاوية', 'زخارف', 'svg', 'elements/fedcba9876543210fedcba9876543210.svg', 120, 120)").run();
  }
  // ١٫٦٫٠ (التصاميم، المرحلة ٣): خطّ الجهة في ملفّها (٣٫٣)، وإمساكيةٌ بجدولها المتقارب وإعدادها وأوقاتها، وحقل تاريخٍ
  // بتقويمه في اللوحة (٣٫٤).
  if (atLeast('1.6.0')) {
    saveClient(db, { id: null, name: 'أسواق النور', kind: 'محلّ', color: '#0f6b50', font: 'Cairo', phone: '07700000000', address: 'الرمادي' });
    const rows = [
      [run0('الإثنين'), run0('١'), run0('٨ شباط'), run0('٤:٥٥'), run0('٥:٠٥')],
      [run0('الثلاثاء'), run0('٢'), run0('٩ شباط'), run0('٤:٥٤'), run0('٥:٠٤')]
    ];
    const canvas = normalizeCanvas({
      ...emptyCanvas({ w: 210, h: 297 }, 3),
      calendars: { التاريخ: 'hijri' },
      elements: [
        textElement({ id: 'year', name: 'سنة الإمساكية', box: { x: 0.25, y: 0.17, w: 0.5, h: 0.03 }, inlines: [run('١٤٤٨ هـ — ٢٠٢٧ م')], size: 15, z: 1 }),
        textElement({ id: 'date', box: { x: 0.25, y: 0.21, w: 0.5, h: 0.03 }, inlines: [run('{التاريخ}')], size: 10, z: 2 }),
        tableElement({
          id: 'imsakiya',
          name: 'جدول الإمساكية',
          box: { x: 0.1, y: 0.232, w: 0.8, h: 0.62 },
          columns: ['اليوم', 'رمضان', 'الميلادي', 'الإمساك', 'الفجر'].map((title) => ({ title, widthPercent: 20, align: 'center' as const })),
          rows,
          dense: true,
          imsakiya: { start: '2027-02-08', calendar: 'both', digits: 'indic', fridays: true },
          rowStyles: [{ color: '#f3ead6' }, { color: '#f3ead6' }],
          z: 3
        })
      ]
    });
    saveTemplate(db, { id: null, code: null, title: 'إمساكية أسواق النور', subtitle: '210.0 × 297.0 ملم', category: 'تصاميم', subjectLine: null, bodyHtml: 'إمساكية', letterheadId: null, variables: [], doc: canvasDoc(canvas, { title: 'إمساكية أسواق النور', category: 'تصاميم' }) });
  }
  // ١٫٧٫٠ (قائمة التحسينات): كتابٌ بالشطب وأعلى السطر ولون النصّ (البند ٣)، وتصميمٌ بجدولٍ بعرض أعمدته وارتفاع صفوفه
  // (البند ٢ — صيغة الحزمة ٤).
  if (atLeast('1.7.0')) {
    const letter = docFromLegacy('نؤيد أن السيدة زينب علي حسن تعمل لدينا.');
    letter.blocks = [
      { id: 'marks', kind: 'paragraph', align: 'right', inlines: [run('العنوان '), run('السابق', { strike: true }), run(' الجديد'), run('١', { script: 'sup' }), run(' بالأحمر', { color: '#c00000' })] },
      ...letter.blocks
    ];
    saveTemplate(db, { id: null, code: null, title: 'تأييد بعلامات النصّ', subtitle: null, category: 'ملاك', subjectLine: null, bodyHtml: 'تأييد', letterheadId: null, variables: [], doc: letter });
    const grid = normalizeCanvas({
      ...emptyCanvas({ w: 210, h: 148 }),
      elements: [
        tableElement({
          id: 'lessons',
          name: 'جدول الدروس',
          box: { x: 0.08, y: 0.15, w: 0.84, h: 0.6 },
          columns: [
            { title: 'اليوم', widthPercent: 30, align: 'center' as const },
            { title: 'الأولى', widthPercent: 35, align: 'center' as const },
            { title: 'الثانية', widthPercent: 35, align: 'center' as const }
          ],
          rows: [
            [run0('الأحد'), run0('عربي'), run0('رياضيات')],
            [run0('الإثنين'), run0('علوم'), run0('إنكليزي')]
          ],
          rowHeights: [2, 1],
          headerHeight: 1.5,
          z: 1
        })
      ]
    });
    saveTemplate(db, { id: null, code: null, title: 'جدول دروس مدرسة الرافدين', subtitle: '210.0 × 148.0 ملم', category: 'تصاميم', subjectLine: null, bodyHtml: 'جدول الدروس', letterheadId: null, variables: [], doc: canvasDoc(grid, { title: 'جدول دروس مدرسة الرافدين', category: 'تصاميم' }) });
  }
  recordWork(db, '2026-10-03', { sheets: 12, files: 2 });
  recordWork(db, '2026-10-04', { sheets: 5, files: 0 });

  const setting = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  setting.run('officeName', 'مكتب الاختبار');
  setting.run('printRoles', JSON.stringify(normalizePrintRoles({ documents: { normal: 'ليزر المكتب', color: 'ملوّنة', dialog: false } }, null)));
  setting.run('hiddenSections', JSON.stringify(['designs']));
  setting.run('sidebarPinned', 'false');
  setting.run('schoolFiles', 'true');
  setting.run('receiptSlip', 'true');
  setting.run('officePhone', '07801112233');
  setting.run('officeAddress', 'الرمادي — شارع المعارض');
  setting.run('firstWorkAt', '2026-10-02T09:00:00.000Z');
  setting.run('weekSeen', '2026-10-03');
  stampDataVersion(db, VERSION);
  db.close();
});
