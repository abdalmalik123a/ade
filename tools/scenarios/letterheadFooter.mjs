/**
 * سيناريو: تفعيل تذييل الورقة (عنوان وهاتف المكتب) في مصمّم الترويسات وظهوره على الورقة وفي القاعدة.
 *
 * و(D136): التذييل لا يُطبع فوق المتن — كتابٌ من ٤٠ فقرة بترويسةٍ لها تذييل يصدر، ثم PDF من الأرشيف وصور صفحاته (`tools/pdfImage.mjs`):
 * شريط التذييل أسفل كلّ صفحة لا حبر فيه إلا التذييل، وما فوقه كالكتاب نفسه بلا تذييل أو نزلت سطوره إلى الصفحة التالية — ولا سطر ضاع،
 * وصفحات المحرّر (الشريط و«اطبع») عدد صفحات PDF. وبترويسةٍ مكرّرة وترقيم الصفحات أيضًا.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { pdfToImages } from '../pdfImage.mjs';

const FOOT = { show: true, text: 'بغداد — شارع الرشيد | هاتف 07700000000', align: 'center', size: 10 };
/** كتابٌ من ٤٠ فقرةً قصيرة مرقّمة — كلّ سطرٍ يختلف عن غيره فيُعرف موضعه في الصورة. */
const bookDoc = (title, repeatLetterhead, pageNumbers) => ({
  id: title, schemaVersion: 1, kind: 'flow', issuing: 'registered',
  pageSetup: { size: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 }, letterheadMode: 'print', repeatLetterhead, pageNumbers, numerals: 'arabic' },
  blocks: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, kind: 'paragraph', align: 'right', inlines: [{ kind: 'run', text: `الفقرة ${i + 1}: نصٌّ لكتابٍ طويل إلى مدرسة النور` }] })),
  fields: [], meta: {}
});

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // فتح شاشة الترويسات
  await page.goto('header-seal-configuration');
  await wait(500);
  ok('فُتحت شاشة مصمّم الترويسات', (await page.text()).includes('مصمّم الترويسات'));

  // كتابة اسم الترويسة ومحتواها
  await page.type('input[placeholder^="مثال: مديرية"]', 'ترويسة مكتب الفجر الرسمية');
  await wait(200);

  const typedHeader = await page.eval(`
    const el = document.querySelector('textarea[placeholder^="جمهورية العراق"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'جمهورية العراق\\nمحكمة بداءة الرصافة');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('كُتب نص الترويسة في القسم الأول', typedHeader);
  await wait(200);

  // التحقق من وجود قسم خيارات التذييل
  const hasFooterOpt = await page.eval(`return Boolean(document.querySelector('[data-footer-options]'));`);
  ok('عنصر خيارات تذييل الورقة ظاهر في المصمّم', hasFooterOpt);

  // تفعيل التذييل
  const toggleFooter = await page.eval(`
    const box = document.querySelector('input[data-act="footer-toggle"]');
    if (!box) return false;
    box.click();
    return true;
  `);
  ok('أُشعل خيار تذييل الورقة', toggleFooter);
  await wait(300);

  // إدخال نص التذييل
  const footerText = 'بغداد — شارع الرشيد | هاتف: 07701234567 | info@alfajr.iq';
  const typedFooter = await page.eval(`
    const el = document.querySelector('input[data-act="footer-text"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(footerText)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('أُدخل نص تذييل الورقة', typedFooter);
  await wait(300);

  // فحص ظهور التذييل في المعاينة الحيّة
  const previewFooterText = await page.eval(`
    const el = document.querySelector('[data-letterhead-footer]');
    return el ? el.textContent.trim() : '';
  `);
  ok('ظهر التذييل في معاينة الورقة أسفل الصفحة', previewFooterText.includes('بغداد — شارع الرشيد'));

  // حفظ الترويسة
  await page.clickText('حفظ الترويسة');
  await wait(500);
  ok('حُفظت الترويسة بنجاح', (await page.text()).includes('حُفظت الترويسة'));

  // التحقق من الحفظ في قاعدة البيانات
  const dbPath = join(profile, 'data', 'diwan.db');
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT * FROM letterheads WHERE name = ?').get('ترويسة مكتب الفجر الرسمية');
  db.close();

  ok('سُجّلت الترويسة في قاعدة البيانات', Boolean(row));
  const savedLayout = row ? JSON.parse(row.layout_json) : null;
  ok('بيانات التذييل محفوظة في layout_json', savedLayout?.footer?.show === true && savedLayout?.footer?.text.includes('07701234567'));

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-footer.png'));

  // ── (D136) الكتاب الطويل يُطبع وتذييله في شريطه — وPDF يُحفظ في مجلّد الحفظ الذي يعطيه `drive.mjs` ──
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  /** يُصدر الكتاب من نموذجه في المحرّر، ويعيد صفحات المحرّر وشريطه المحجوز وPDF من الأرشيف صفوفًا (حبر كلّ صفّ وموضعه). */
  const issueBook = async ({ title, owner, footer, repeat = false, numbers = false }) => {
    await page.eval(`
      const lh = await window.diwan.letterheads.save({ id: null, name: ${JSON.stringify(title)}, authorityId: null, category: null,
        layout: { sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: 'مدرسة النور الابتدائية', align: 'center', size: 14, bold: true }] }],
          footer: ${JSON.stringify(footer ?? { show: false, text: '', align: 'center', size: 10 })} } });
      await window.diwan.templates.save({ id: null, code: null, title: ${JSON.stringify(title)}, subtitle: null, category: 'اختبار', subjectLine: null,
        letterheadId: lh.id, bodyHtml: '<p>كتاب</p>', variables: [], doc: ${JSON.stringify(bookDoc(title, repeat, numbers))} });
      return true;
    `);
    await page.goto('templates-library-drafts');
    await wait(900);
    await page.eval(`
      const open = [...document.querySelectorAll('button')].filter((b) => b.innerText.includes('فتح في المحرر')).find((b) => {
        let card = b;
        while (card.parentElement && [...card.parentElement.querySelectorAll('button')].filter((x) => x.innerText.includes('فتح في المحرر')).length === 1) card = card.parentElement;
        return card.innerText.includes(${JSON.stringify(title)});
      });
      open?.click();
      return Boolean(open);
    `);
    await wait(1800);
    // «اطبع» بعدد أوراقه بعد اسم صاحب الكتاب (وقبله «اطبع — بعد إكمال ما يمنع»).
    await page.type('[data-editor-owner]', owner);
    await wait(500);
    const editor = await page.eval(`
      const sheet = document.querySelector('[data-letter-sheet][data-page]');
      const word = (document.querySelector('[data-act="issue"]')?.innerText ?? '').replace(/^print\\s*/, '');
      const print = /ورقتين/.test(word) ? 2 : /واحدة/.test(word) ? 1 : Number(word.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\\d+/)?.[0]);
      return { bar: Number(document.querySelector('[data-page-count]')?.dataset.pageCount), print, word, footMm: Number(sheet?.dataset.footMm) || 0 };
    `);
    await page.eval(`document.querySelector('[data-act="issue"]').click(); return true;`);
    await wait(700);
    await page.clickText('احفظ بلا طباعة');
    await wait(3000);
    const issued = (await page.text()).includes('صدر الكتاب');
    await page.clickExact('تم');
    await wait(500);
    // PDF من الأرشيف بالباب نفسه الذي يناديه زرّ «حفظ نسخة PDF».
    const pdf = await page.eval(`
      const [row] = await window.diwan.documents.list({ from: null, to: null, query: ${JSON.stringify(owner)} });
      return row ? await window.diwan.documents.exportPdf(row.id) : null;
    `);
    const pages = pdf ? await pdfToImages(pdf, { dpi: 72 }) : [];
    const images = [];
    for (const p of pages) {
      images.push(await page.eval(`
        const img = new Image();
        img.src = 'data:image/png;base64,${p.png.toString('base64')}';
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const rows = [];
        for (let y = 0; y < c.height; y++) {
          let n = 0, h = 0;
          for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4] < 160) { n++; h = (h * 31 + x) | 0; }
          rows.push(n ? n + ':' + h : '');
        }
        return { h: c.height, rows };
      `));
    }
    return { issued, editor, pdf, images };
  };
  const K = 72 / 25.4;
  /** أسطر النصّ فوق الصفّ \`to\`: صفوف حبرٍ متّصلة، وما بينها فراغٌ دون ٥ صفوف (التشكيل فوق حروفه) سطرٌ واحد. */
  const lineGroups = (rows, to) => {
    let lines = 0;
    let blank = Infinity;
    for (const r of rows.slice(0, to)) {
      if (r && blank >= 5) lines++;
      blank = r ? 0 : blank + 1;
    }
    return lines;
  };
  /** شريط التذييل في كلّ صفحة: فسحته بيضاء، وما تحتها التذييلُ وحده — كما في الصفحة الأخيرة. */
  const bandOf = (img, footMm) => {
    const bottom = Math.round(img.h - 20 * K);
    const top = Math.round(img.h - (20 + footMm) * K);
    return { top, gap: img.rows.slice(top + 1, Math.round(top + 2 * K) - 1), foot: img.rows.slice(Math.round(top + 2 * K) - 1, bottom + 2).join('|') };
  };
  const checkBook = (label, book) => {
    const n = book.images.length;
    ok(`${label}: صدر، وPDF من الأرشيف ${n} صفحات، وشريطٌ محجوز ${book.editor.footMm} ملم`, book.issued && n >= 2 && book.editor.footMm > 5);
    ok(`${label}: صفحات المحرّر (الشريط ${book.editor.bar}، و«${book.editor.word}») = صفحات PDF (${n})`, book.editor.bar === n && book.editor.print === n);
    const bands = book.images.map((img) => bandOf(img, book.editor.footMm));
    const last = bands.at(-1);
    ok(`${label}: فسحة الشريط بيضاء في كلّ صفحة (لا سطر من المتن فيها)`, bands.every((b) => b.gap.length > 2 && b.gap.every((r) => !r)));
    ok(`${label}: والشريط فيه التذييل وحده، مطبوعًا في كلّ صفحة كما في الأخيرة`, Boolean(last.foot.replace(/\|/g, '')) && bands.every((b) => b.foot === last.foot));
    return bands;
  };

  const foot = await issueBook({ title: 'كتاب بتذييل', owner: 'زينب علي حسن', footer: FOOT });
  const plain = await issueBook({ title: 'كتاب بلا تذييل', owner: 'سالم حسن', footer: null });
  const bands = checkBook('بتذييل', foot);
  ok(`بلا تذييل: صدر بلا شريط، وصفحات المحرّر = PDF (${plain.images.length})`, plain.issued && plain.editor.footMm === 0 && plain.editor.bar === plain.images.length && plain.editor.print === plain.images.length);
  // ما فوق الشريط في الصفحة الأولى كالكتاب بلا تذييل صفًّا صفًّا، أو أبيض (نزل سطره إلى الصفحة التالية) — لا مغطًّى.
  const p1 = foot.images[0];
  const q1 = plain.images[0];
  const differ = p1 && q1 ? p1.rows.slice(0, bands[0].top).filter((r, y) => r && r !== q1.rows[y]).length : -1;
  ok(`بتذييل: ما فوق الشريط في الصفحة الأولى كالكتاب بلا تذييل أو نازلٌ إلى التالية (صفوفٌ مختلفة: ${differ})`, differ === 0);
  const lines = foot.images.reduce((s, img, i) => s + lineGroups(img.rows, bands[i].top), 0);
  const plainLines = plain.images.reduce((s, img) => s + lineGroups(img.rows, Math.round(img.h - 20 * K) + 1), 0);
  ok(`بتذييل: لا سطر ضاع — أسطر المتن والترويسة ${lines} كما بلا تذييل ${plainLines}`, lines > 40 && lines === plainLines);
  checkBook('بترويسةٍ مكرّرة وترقيم', await issueBook({ title: 'كتاب بتذييل مكرر', owner: 'مريم جاسم', footer: FOOT, repeat: true, numbers: true }));

  return steps.join('\n');
}
