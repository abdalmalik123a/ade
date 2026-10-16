/**
 * سيناريو: كتابٌ يمتدّ إلى ثلاث صفحاتٍ فأكثر (G01) — يُصدَر ويُحفظ PDF من الأرشيف، فيُفحص **بمحتواه** لا بترويسته (L02):
 * «صفحة ن من م» في كلّ صفحة، والترويسة في كلّ صفحة، وصفّ عناوين الجدول أعلى الصفحة التي يمتدّ إليها، والأسماء الثلاثون
 * مرّةً واحدة. والضدّ: النموذج نفسه بلا ترقيمٍ ولا تكرار ← لا «صفحة … من» ولا ترويسة في الثانية.
 *
 * البيانات بالجسر (ترويسةٌ ونموذجان) والإصدار بالواجهة؛ وحفظ PDF بطريق `issue.mjs` نفسه («حفظ نسخة PDF» من الأرشيف،
 * والضدّ بالنداء نفسه الذي يناديه الزرّ). والنصّ العربيّ من pdfjs يأتي حرفًا حرفًا بترتيب العرض (L35): فيُقارن بلا مسافاتٍ
 * ولا تشكيل، مستقيمًا أو معكوسًا.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEAD = 'مدرسة النور الابتدائية';
const FIRST = ['زينب', 'سالم', 'مريم', 'جاسم', 'نور', 'أحمد', 'هدى', 'كريم', 'سارة', 'عمر', 'ليلى', 'باسم', 'رنا', 'ياسر', 'دعاء'];
const NAMES = FIRST.flatMap((f) => [`${f} علي`, `${f} حسن`]);
const FILLER = 'نرجو التفضّل بالاطّلاع على قائمة التلاميذ أدناه واتّخاذ ما يلزم بشأن توزيعهم على الصفوف للعام الدراسي القادم مع التقدير.';

/** نموذجٌ بترويسته: فقراتٌ، ثم جدولٌ بصفّ عناوين وثلاثين صفًّا، ثم فقراتٌ تمدّه إلى صفحةٍ ثالثة. */
function templateDoc(title, paged) {
  const p = (id, text) => ({ id, kind: 'paragraph', align: 'right', inlines: [{ kind: 'run', text }] });
  const cell = (id, text) => ({ id, blocks: [p(`${id}-p`, text)] });
  const rows = [['الاسم', 'الصفّ'], ...NAMES.map((n, i) => [n, i % 2 ? 'السادس' : 'الخامس'])].map((r, i) => ({
    id: `r${i}`,
    cells: [cell(`r${i}a`, r[0]), cell(`r${i}b`, r[1])]
  }));
  return {
    id: title,
    schemaVersion: 1,
    kind: 'flow',
    issuing: 'registered',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      letterheadMode: 'print',
      repeatLetterhead: paged,
      pageNumbers: paged,
      numerals: 'arabic'
    },
    blocks: [
      p('a', 'إلى / مديرية التربية — قسم التعليم الابتدائي'),
      p('b', 'م / قائمة التلاميذ'),
      p('c', FILLER),
      { id: 't', kind: 'table', columns: [2, 1], header: true, rows },
      ...Array.from({ length: 28 }, (_, i) => p(`z${i}`, FILLER))
    ],
    fields: [],
    meta: {}
  };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  mkdirSync(saveDir, { recursive: true });
  const pdfsIn = () => readdirSync(saveDir).filter((f) => f.toLowerCase().endsWith('.pdf'));

  // ── البيانات بالجسر: ترويسةٌ مميّزة، ونموذجان (مرقَّمٌ مكرَّرة الترويسة، وضدّه) ──
  await page.eval(`
    const lh = await window.diwan.letterheads.save({ id: null, name: ${JSON.stringify(HEAD)}, authorityId: null, category: null,
      layout: { sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: ${JSON.stringify(HEAD)}, align: 'center', size: 14, bold: true }] }] } });
    for (const [title, doc] of ${JSON.stringify([
      ['قائمة التلاميذ', templateDoc('قائمة التلاميذ', true)],
      ['قائمة بلا ترقيم', templateDoc('قائمة بلا ترقيم', false)]
    ])}) {
      await window.diwan.templates.save({ id: null, code: null, title, subtitle: null, category: 'اختبار', subjectLine: null,
        letterheadId: lh.id, bodyHtml: '<p>قائمة</p>', variables: [], doc });
    }
    return true;
  `);

  /** يفتح النموذج في المحرّر ويُصدره بلا طباعة. */
  const issue = async (title) => {
    await page.goto('templates-library-drafts');
    await wait(900);
    // زرّ «فتح في المحرر» في بطاقة النموذج: أوّل جدٍّ له يحمل العنوان، قبل أن يبلغ الشبكة (وفيها أزرار البطاقات كلّها).
    const opened = await page.eval(`
      const opens = (el) => [...el.querySelectorAll('button')].filter((b) => b.innerText.includes('فتح في المحرر')).length;
      const btn = [...document.querySelectorAll('button')].filter((b) => b.innerText.includes('فتح في المحرر')).find((b) => {
        for (let el = b.parentElement; el; el = el.parentElement) {
          if (opens(el) > 1) return false;
          if (el.innerText.includes(${JSON.stringify(title)})) return true;
        }
        return false;
      });
      btn?.click();
      return Boolean(btn);
    `);
    await wait(1500);
    const sheet = await page.eval(`return document.querySelector('[data-screen="editor"] .a4-sheet')?.innerText ?? '';`);
    await page.type('[data-editor-owner]', 'زينب علي حسن');
    await wait(300);
    await page.eval(`document.querySelector('[data-act="issue"]').click(); return true;`);
    await wait(700);
    const dialog = (await page.text()).includes('اطبع الكتاب');
    await page.clickText('احفظ بلا طباعة');
    await wait(3000);
    const issued = (await page.text()).includes('صدر الكتاب');
    await page.clickExact('تم');
    await wait(500);
    return { opened, sheet, dialog, issued };
  };

  const main = await issue('قائمة التلاميذ');
  ok('فُتح النموذج في المحرّر بترويسته', main.opened && main.sheet.includes(HEAD));
  ok('وصدر الكتاب بلا طباعة', main.dialog && main.issued);

  await page.goto('transactions-archive-ledger');
  await wait(900);
  await page.clickText('حفظ نسخة PDF');
  let file = null;
  for (let i = 0; i < 30 && !file; i++) {
    await wait(300);
    file = pdfsIn()[0] ?? null;
  }
  ok('حُفظ الكتاب PDF من الأرشيف', Boolean(file));

  const contrast = await issue('قائمة بلا ترقيم');
  ok('وصدر الضدّ بلا ترقيمٍ ولا تكرار', contrast.issued);
  const contrastFile = await page.eval(`
    const rows = await window.diwan.documents.list({});
    const id = Math.max(...rows.map((r) => r.id));
    return await window.diwan.documents.exportPdf(id);
  `);

  // ── الفحص بمحتوى PDF ──
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const flat = (s) =>
    s.normalize('NFKC').replace(/ی/g, 'ي').replace(/ھ/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[\u064B-\u0652\u0640]/g, '').replace(/\s+/g, '');
  const rev = (s) => [...s].reverse().join('');
  const key = (s) => [...s].sort().join('');
  /**
   * مواضع الكلمة في النصّ المسطَّح، مستقيمةً أو معكوسة. وإن غابت: مقطعٌ بطولها فيه حروفها نفسها — فالحرفان المتلاصقان
   * قد يتبادلان موضعيهما في الاستخراج («لا» في «الابتدائية» و«الاسم»)، كما في `pdfTools`.
   */
  const at = (text, word) => {
    const w = flat(word);
    const out = [];
    for (const needle of new Set([w, rev(w)])) for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) out.push(i);
    if (!out.length) {
      const want = key(w);
      const chars = [...text];
      for (let i = 0; i + w.length <= chars.length; i++) if (key(chars.slice(i, i + w.length).join('')) === want) out.push(i), (i += w.length - 1);
    }
    return out.sort((a, b) => a - b);
  };
  const pagesOf = async (path) => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const items = (await (await doc.getPage(i)).getTextContent()).items;
      out.push(flat(items.map((it) => it.str ?? '').join('')));
    }
    return out;
  };

  if (file) {
    const pages = await pagesOf(join(saveDir, file));
    const n = pages.length;
    // أوّل اسمٍ في كلّ صفحة: الجدول الأطول من صفحةٍ ينزل إلى صفحةٍ جديدة ثم يُقسم (`docHtml.ts`) — فيُفحص رأسه في كلّ صفحةٍ يمتدّ إليها.
    const firsts = pages.map((t) => Math.min(...NAMES.flatMap((nm) => at(t, nm))));
    const spans = firsts.map((f, i) => (Number.isFinite(f) ? i : -1)).filter((i) => i >= 0);
    steps.push(`  … ${n} صفحات، والأسماء فيها: ${pages.map((t) => NAMES.filter((nm) => at(t, nm).length).length).join(' + ')}`);
    ok(`الكتاب ثلاث صفحاتٍ فأكثر (${n})`, n >= 3);
    ok('«صفحة ن من م» في كلّ صفحة', pages.every((t, i) => at(t, `صفحة${i + 1}من${n}`).length === 1));
    ok('ونصّ الترويسة في كلّ صفحة', pages.every((t) => at(t, HEAD).length === 1));
    ok(`والجدول يعبر حدّ الصفحة (الصفحات ${spans.map((i) => i + 1).join(' و')})`, spans.length >= 2);
    ok(
      '«الاسم» و«الصفّ» أعلى كلّ صفحةٍ يمتدّ إليها الجدول، قبل أوّل اسمٍ فيها',
      spans.length >= 2 && spans.every((i) => at(pages[i], 'الاسم').some((x) => x < firsts[i]) && at(pages[i], 'الصفّ').some((x) => x < firsts[i]))
    );
    const counts = NAMES.map((nm) => pages.reduce((s, t) => s + at(t, nm).length, 0));
    ok('والأسماء الثلاثون كلٌّ مرّةً واحدة — لا مكرّرٌ ولا ضائع', counts.length === 30 && counts.every((c) => c === 1));
  }

  ok('وحُفظ الضدّ PDF', typeof contrastFile === 'string' && contrastFile.endsWith('.pdf'));
  if (typeof contrastFile === 'string') {
    const pages = await pagesOf(contrastFile);
    ok(`والضدّ صفحاتٌ أيضًا (${pages.length})`, pages.length >= 3);
    ok('بلا «صفحة … من» في أيّ صفحة', pages.every((t) => !at(t, 'صفحة').length));
    ok('والترويسة في الأولى وحدها', at(pages[0], HEAD).length === 1 && pages.slice(1).every((t) => !at(t, HEAD).length));
  }
  return steps.join('\n');
}
