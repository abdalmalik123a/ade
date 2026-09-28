/**
 * ما كشفه التدقيق المستقل (أيلول ٢٠٢٦) — اختبارات ارتدادٍ لكلّ بندٍ ثبت.
 *
 * أربعة أخطاء أُعيد إنتاجها حرفيًّا قبل الإصلاح: التفقيط يكتب «ألف فلس»، والرقم الوطني
 * بهمزةٍ أو تطويلٍ يمرّ صامتًا (ويُحفظ فلا يُعرف صاحبه)، والباركود يختفي صامتًا بالأرقام
 * الهندية، و«تحقّق من السلامة» ينهار فوق ١٢٥ ألف كتاب في السنة. وثلاثة مواضع دونها:
 * مجلّد المخزن من الواجهة بلا فحص، وملفّ الأوراق يُقرأ مع كلّ ورقة، وتصدير النموذج إلى
 * Word نصًّا بلا تنسيق.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { tafqeet } from '../src/shared/tafqeet';
import { canonicalNationalId, nationalIdHint } from '../src/shared/idChecks';
import { barcodeSvg, code128Text, encodes128 } from '../src/shared/barcode';
import { inlineBarcodes } from '../src/shared/imposition';
import { designPreflight } from '../src/shared/preflight';
import { barcodeElement, emptyCanvas } from '../src/shared/canvas';
import { canonicalizeNationalIds, ensureSearchColumn, saveCitizen } from '../src/main/services/citizens';
import { citizenByNationalId, prepareDocuments, verifyArchive } from '../src/main/services/documents';
import { printJournal } from '../src/main/services/printJobs';
import { docToDocx } from '../src/main/services/docDocx';
import { importTemplateFile } from '../src/main/services/import';
import { docFromLegacy, emptyDoc, fieldRef, newUuid, paragraph, run, type Doc } from '../src/shared/doc';
import type { CitizenInput } from '../src/shared/api';

const HAMZA = String.fromCharCode(0x621);
const TATWEEL = String.fromCharCode(0x640);
const FATHA = String.fromCharCode(0x64e);
const RLM = String.fromCharCode(0x200f);

describe('١. التفقيط: الكسر الذي يُدوَّر إلى وحدةٍ كاملة وحدةٌ تُضاف', () => {
  it('لا «ألف فلس» ولا «مئة سنت»', () => {
    expect(tafqeet(1.9999, { currency: 'IQD' })).toBe(tafqeet(2, { currency: 'IQD' }));
    expect(tafqeet(1.9999, { currency: 'IQD' })).toBe('فقط ديناران عراقيان لا غير');
    expect(tafqeet(5.999, { currency: 'USD' })).toBe(tafqeet(6, { currency: 'USD' }));
    expect(tafqeet(0.999, { currency: 'USD' })).toBe(tafqeet(1, { currency: 'USD' }));
    expect(tafqeet('0.9996', { currency: 'IQD' })).toBe(tafqeet(1, { currency: 'IQD' }));
  });

  it('والكسر الحقيقي باقٍ كما هو', () => {
    expect(tafqeet(2.5, { currency: 'IQD' })).toBe('فقط ديناران عراقيان وخمسمئة فلس لا غير');
    expect(tafqeet(1.999, { currency: 'IQD' })).toContain('تسعمئة وتسعة وتسعون فلسًا');
  });
});

describe('٢. الرقم الوطني: لا حرفٌ يمرّ صامتًا، ويُحفظ أرقامًا لاتينية', () => {
  it('الهمزة والتطويل والحركة تُنبَّه — والعلامة الخفيّة وحدها لا', () => {
    for (const v of [`199912345678${HAMZA}`, `19991234567${TATWEEL}8`, `199912345678${FATHA}`]) {
      expect(nationalIdHint(v), JSON.stringify(v)).toContain('أرقامٌ فقط');
    }
    expect(nationalIdHint(`${RLM}199912345678${RLM}`)).toBeNull();
    expect(nationalIdHint('١٩٩٩١٢٣٤٥٦٧٨')).toBeNull();
  });

  it('الصورة الموحّدة: الهندية لاتينية، والفواصل والشوائب تُمحى، والحرف لا يُخمَّن', () => {
    expect(canonicalNationalId('١٩٩٩ ١٢٣٤-٥٦٧٨')).toBe('199912345678');
    expect(canonicalNationalId(`19991234567${TATWEEL}8${FATHA}${RLM}`)).toBe('199912345678');
    expect(canonicalNationalId(`199912345678${HAMZA}`)).toBeNull();
    expect(canonicalNationalId('   ')).toBeNull();
  });

  const citizen = (fullName: string, nationalId: string): CitizenInput => ({
    id: null, fullName, nationalId, jobTitle: null, workplace: null, employeeCode: null, serviceStatus: null, birthDate: null,
    birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null, landmark: null, phone: null, photoPath: null,
    category: null, notes: null, verified: false
  } as CitizenInput);

  it('يُحفظ موحَّدًا، فالمكرّر بالهندية يُكشف، والكتاب يجد صاحبه', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    prepareDocuments(db);
    const saved = saveCitizen(db, citizen('زينب علي حسن', '١٩٩٩١٢٣٤٥٦٧٨'));
    expect(saved.nationalId).toBe('199912345678');
    expect(() => saveCitizen(db, citizen('زينب علي', `199912345678${RLM}`))).toThrow('مسجَّل لمواطن آخر');
    expect(citizenByNationalId(db, '١٩٩٩ ١٢٣٤ ٥٦٧٨')).toBe(saved.id);
  });

  it('والمحفوظ قبل التوحيد يُوحَّد مرّةً — والمكرّر المخفيّ يُترك للمكتب لا يُدمج', () => {
    const db = freshDb();
    ensureSearchColumn(db);
    const put = db.prepare('INSERT INTO citizens (full_name, national_id, name_fold) VALUES (?, ?, ?)');
    put.run('أ', '١٩٩٠١١١١٢٢٢٢', 'ا');
    put.run('ب', '198822223333', 'ب');
    put.run('ج', '١٩٨٨٢٢٢٢٣٣٣٣', 'ج'); // هو «ب» نفسه بأرقامٍ هندية
    put.run('د', `1985${HAMZA}33334444`, 'د'); // فيه حرف — لا يُخمَّن
    expect(canonicalizeNationalIds(db)).toEqual({ changed: 1, clashes: 1 });
    const nids = db.prepare("SELECT full_name AS n, national_id AS nid FROM citizens ORDER BY citizens.id").all();
    expect(nids).toEqual([
      { n: 'أ', nid: '199011112222' },
      { n: 'ب', nid: '198822223333' },
      { n: 'ج', nid: '١٩٨٨٢٢٢٢٣٣٣٣' },
      { n: 'د', nid: `1985${HAMZA}33334444` }
    ]);
    expect(canonicalizeNationalIds(db)).toEqual({ changed: 0, clashes: 1 });
  });
});

describe('٣. الباركود: الأرقام الهندية تُرمَّز، والحروف تُقال لا تُطبع فراغًا', () => {
  it('الأرقام الهندية والفارسية أرقامٌ لاتينية — الرمز نفسه', () => {
    expect(code128Text('١٢٣٤٥۶۷')).toBe('1234567');
    expect(encodes128('١٢٣٤٥')).toBe(true);
    expect(barcodeSvg('١٢٣٤٥')).toBe(barcodeSvg('12345'));
    expect(inlineBarcodes('<div data-barcode="code128" data-value="١٢٣٤٥" style="w"></div>')).toContain('<rect');
  });

  it('والحروف العربية لا تُرمَّز — وفاحص ما قبل الطباعة يعدّ بطاقاتها', () => {
    expect(encodes128('رقم5')).toBe(false);
    const canvas = emptyCanvas({ w: 85.6, h: 54 });
    canvas.elements.push(barcodeElement({ box: { x: 0.1, y: 0.7, w: 0.5, h: 0.2 }, ref: 'الرقم' }));
    const issues = designPreflight(canvas, [{ الرقم: 'رقم5' }, { الرقم: '١٢٣' }, { الرقم: 'A-77' }]);
    const bar = issues.find((i) => i.text.includes('الباركود لا يحمل الحروف العربية'));
    expect(bar?.level).toBe('warn');
    expect(bar?.text).toContain('١ بطاقة');
    expect(bar?.text).toContain('رقم5');
    expect(designPreflight(canvas, [{ الرقم: '١٢٣' }]).some((i) => i.text.includes('الباركود'))).toBe(false);
  });
});

describe('٤. «تحقّق من السلامة» فوق ١٢٥ ألف كتابٍ في السنة', () => {
  it('لا يفيض المكدّس، ولا ثقب يُخترع', () => {
    const db = freshDb();
    prepareDocuments(db);
    const N = 130_000;
    const put = db.prepare(
      `INSERT INTO documents (serial, serial_year, serial_seq, citizen_name, doc_type, body_html, copies, copy_kind, fee,
         gregorian_date, sha256, status) VALUES (?, 2026, ?, 'م', 'ت', '', 1, 'ن', 0, '', 'x', 'issued')`
    );
    db.transaction(() => {
      for (let i = 1; i <= N; i++) put.run(`م/2026/${i}`, i);
    })();
    const check = verifyArchive(db);
    expect(check.checked).toBe(N);
    expect(check.problems.some((p) => p.kind === 'gap')).toBe(false);
  }, 60_000);
});

describe('مواضع دون الأخطاء', () => {
  it('ملفّ أوراق الطباعة يُقرأ مرّةً للدفعة لا مع كلّ ورقة', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-jobs-'));
    const journal = printJournal(dir);
    const job = journal.create({ label: 'دفعة', pages: ['<p>1</p>', '<p>2</p>', '<p>3</p>'], printer: null, page: { w: 210, h: 297 }, duplex: false });
    expect(journal.sheetPages(job.id, 0)).toEqual(['<p>1</p>']);
    // لو قُرئ من القرص ثانيةً لفشل: الملف صار تالفًا.
    writeFileSync(join(dir, `${job.id}.pages.json`), 'تالف');
    expect(journal.sheetPages(job.id, 2)).toEqual(['<p>3</p>']);
    journal.finish(job.id);
    rmSync(dir, { recursive: true, force: true });
  });

  it('مجلّد المخزن اسمٌ لا مسار — «..» تُرفض قبل أيّ قراءة', async () => {
    const { importFile } = await import('../src/main/ipc/files');
    await expect(importFile('C:/لا-يوجد.png', '../..')).rejects.toThrow('مجلّد تخزينٍ غير معروف');
    await expect(importFile('C:/لا-يوجد.png', 'photos/../x')).rejects.toThrow('مجلّد تخزينٍ غير معروف');
  });
});

describe('تصدير النموذج إلى Word بتنسيقه', () => {
  const doc = (): Doc => {
    const d = emptyDoc();
    d.blocks = [
      { id: newUuid(), kind: 'columns', widths: [2, 1], columns: [[paragraph([run('جمهورية العراق', { bold: true })])], [paragraph([run('العدد: '), fieldRef('العدد')])]] },
      paragraph([run('م / تأييد')], { align: 'center' }),
      paragraph([run('نؤيد أن السيد '), fieldRef('الاسم'), run(' يعمل لدينا.')], { align: 'justify', size: 18 }),
      {
        id: newUuid(),
        kind: 'table',
        columns: [2, 1],
        header: true,
        rows: [
          { id: newUuid(), cells: [{ id: newUuid(), blocks: [paragraph([run('الاسم')])] }, { id: newUuid(), blocks: [paragraph([run('الصف')])] }] },
          { id: newUuid(), cells: [{ id: newUuid(), blocks: [paragraph([fieldRef('الاسم')])] }, { id: newUuid(), blocks: [paragraph([run('الخامس')])] }] }
        ]
      },
      { id: newUuid(), kind: 'list', styles: ['question'], items: [{ id: newUuid(), inlines: [run('عرّف الفعل')], score: 10 }] },
      { id: newUuid(), kind: 'pageBreak' },
      paragraph([run('مع التقدير')], { align: 'left' })
    ];
    return d;
  };
  const xml = async (d: Doc) => strFromU8(unzipSync(new Uint8Array(await docToDocx(d, { title: 'تأييد' })))['word/document.xml']!);

  it('الجداول والأعمدة والمحاذاة والعريض والحقول وفاصل الصفحة — لا نصٌّ مسطَّح', async () => {
    const x = await xml(doc());
    expect(x.match(/<w:tbl>/g)?.length).toBe(2); // الترويسة عمودان + الجدول
    expect(x).toContain('<w:tblHeader/>');
    expect(x).toContain('<w:bidiVisual/>');
    expect(x).toContain('<w:jc w:val="center"/>');
    expect(x).toContain('<w:jc w:val="both"/>');
    expect(x).toContain('<w:jc w:val="end"/>'); // «مع التقدير» يسارًا في الفقرة العربية
    expect(x).toContain('<w:b/>');
    expect(x).toContain('{الاسم}');
    expect(x).toContain('<w:highlight w:val="yellow"/>');
    expect(x).toContain('س1:');
    expect(x).toContain('(10 درجة)');
    expect(x).toContain('<w:br w:type="page"/>');
    expect(x).toContain('w:w="11907"'); // A4 عرضًا
    expect(x).not.toMatch(/&lt;p&gt;|&lt;strong&gt;/);
  });

  it('ويعود بالاستيراد نموذجًا: الجدول جدول، والحقول حقول', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-docx-'));
    const file = join(dir, 'تأييد.docx');
    writeFileSync(file, await docToDocx(doc(), { title: 'تأييد' }));
    const back = await importTemplateFile(file, () => '');
    expect(back.doc?.blocks.some((b) => b.kind === 'table')).toBe(true);
    expect(back.doc?.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['الاسم', 'العدد']));
    rmSync(dir, { recursive: true, force: true });
  });

  it('والنموذج القديم (نصٌّ بوسومه) يُصدَّر أيضًا', async () => {
    const x = await xml(docFromLegacy('نؤيد أن {الاسم} يعمل لدينا.'));
    expect(x).toContain('{الاسم}');
  });
});
