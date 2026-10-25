/**
 * سيناريو: استيراد تصميمٍ من Word — المقاس والمواضع من الملف.
 *
 * يبني ملف .docx حقيقيًّا: صفحةٌ A4 أفقية بمربّع نصٍّ مثبّتٍ بموضعه وصورةِ شعار،
 * ثم يستورده في التطبيق المبنيّ ويتفقّد: أخرجت الشهادة كما صُمّمت، أم كومةَ
 * أسطرٍ في أعلى الورقة؟
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import Database from 'better-sqlite3';

/** سنتيمترٌ بالـEMU — وحدةُ المواضع في Word. */
const CM = 360000;

const anchored = (x, y, cx, cy, inner) => `
<w:drawing><wp:anchor>
  <wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>
  <wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV>
  <wp:extent cx="${cx}" cy="${cy}"/>
  ${inner}
</wp:anchor></w:drawing>`;

/**
 * أنماط المستند (S44): الافتراض Cairo ١٤ من اليمين، ونمطٌ عريضٌ خطّه Tahoma (ليس في البرنامج) يرثه السطر الثاني.
 */
const STYLES = `<?xml version="1.0"?>
<w:styles xmlns:w="w">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Cairo" w:cs="Cairo"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Grant"><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Tahoma" w:cs="Tahoma"/><w:b/><w:bCs/></w:rPr></w:style>
</w:styles>`;

function certificateDocx() {
  const body =
    anchored(
      6 * CM,
      5 * CM,
      18 * CM,
      2 * CM,
      // العنوان بتنسيقه على المقطع (S44): Amiri عريضٌ أحمر في الوسط بحجم ٢٨.
      '<w:txbxContent><w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Amiri" w:cs="Amiri"/><w:b/><w:bCs/>' +
        '<w:color w:val="C00000"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr><w:t>شهادة شكر وتقدير</w:t></w:r></w:p></w:txbxContent>'
    ) +
    anchored(
      9 * CM,
      9 * CM,
      12 * CM,
      1.5 * CM,
      '<w:txbxContent><w:p><w:pPr><w:pStyle w:val="Grant"/></w:pPr><w:r><w:t>تُمنح هذه الشهادة إلى {اسم الطالب}</w:t></w:r></w:p></w:txbxContent>'
    ) +
    anchored(1 * CM, 1 * CM, 3 * CM, 3 * CM, '<a:blip r:embed="rId5"/>');

  const document = `<?xml version="1.0"?>
<w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:r="r">
  <w:body>${body}
    <w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr>
  </w:body>
</w:document>`;

  const rels = `<?xml version="1.0"?>
<Relationships><Relationship Id="rId5" Target="media/crest.png"/></Relationships>`;

  // شعارٌ صغير: PNG صالحٌ يُفتح في المتصفّح.
  const crest = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  return zipSync({
    'word/document.xml': strToU8(document),
    'word/styles.xml': strToU8(STYLES),
    'word/_rels/document.xml.rels': strToU8(rels),
    'word/media/crest.png': crest
  });
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-wordsign-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'شهادة-شكر.docx');
  writeFileSync(file, certificateDocx());
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);

  await page.goto('designed-documents');
  await wait(700);

  ok('لباب الاستيراد زرُّه', (await page.text()).includes('من Word أو Photoshop أو PDF'));

  await click('button[data-act="import"]');
  await wait(2500);

  // ── المقاس من الملف: A4 أفقي ──────────────────────────────────────
  const size = await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  ok('قُرئ مقاس صفحة Word', size.includes('297.0') && size.includes('210.0'));

  let text = await page.text();
  // والخطّ الذي ليس في البرنامج يُقال بنصّه (S44) — لا بديلٌ صامت.
  ok('والخطّ الغائب يُقال: «خطوطٌ في الملفّ ليست في البرنامج: Tahoma — أضفها من الخطوط»', text.includes('خطوطٌ في الملفّ ليست في البرنامج: Tahoma — أضفها من الخطوط'));
  // قيمةُ خانةٍ ليست في `innerText` — فتُقرأ من الخانة نفسها.
  const named = await page.eval(`return document.querySelector('input[data-title]')?.value ?? '';`);
  ok('واسمُ الملف صار اسم التصميم', named === 'شهادة-شكر');

  // ── المواضع: ثلاثةُ عناصرَ لا كومةُ أسطر ─────────────────────────
  const layers = await page.eval(`
    return [...document.querySelectorAll('[data-layer]')].map((e) => e.textContent.trim());
  `);
  ok('وخرجت ثلاثةُ عناصرَ بمواضعها', layers.length === 3);
  ok('فيها عنوانُ الشهادة', layers.some((l) => l.includes('شهادة شكر')));
  ok('وصورةُ الشعار', layers.some((l) => l.includes('صورة')));

  ok('و`{اسم الطالب}` صار حقلًا', text.includes('املأ الحقول (1)'));

  // موضعُ العنوان: ٦ سم من اليسار بعرض ١٨ سم على ورقةٍ ٢٩٧ ملم،
  // فمن اليمين ٢٩٧ − (٦٠ + ١٨٠) = ٥٧ ملم — أي نسبةُ ٠٫١٩٢.
  const boxes = await page.eval(`
    return [...document.querySelectorAll('[data-handle]')].map((el) => ({
      right: parseFloat(el.style.right),
      top: parseFloat(el.style.top),
      width: parseFloat(el.style.width)
    }));
  `);
  const mmPx = 96 / 25.4;
  const title = boxes.find((b) => Math.abs(b.width - 180 * mmPx) < 4);
  ok('وعرضُ العنوان ١٨ سم كما في الملف', Boolean(title));
  ok('وموضعُه من اليمين ٥٧ ملم', title && Math.abs(title.right - 57 * mmPx) < 4);
  ok('وارتفاعُه ٥ سم من الأعلى', title && Math.abs(title.top - 50 * mmPx) < 4);

  // ── شكل العنوان كما في Word (S44): لوحة التنسيق للمربّع الأوّل ──────
  await page.eval(`[...document.querySelectorAll('[data-layer]')].find((b) => b.textContent.includes('شهادة شكر'))?.click(); return true;`);
  await wait(500);
  const look = await page.eval(`
    const bar = document.querySelector('[data-context-bar]');
    if (!bar) return null;
    const on = (b) => Boolean(b) && b.className.includes('bg-primary-fixed');
    return {
      font: bar.querySelector('select[data-act="quick-font"]')?.value ?? '',
      size: bar.querySelector('input[title="حجم الخط بالنقاط"]')?.value ?? '',
      bold: on(bar.querySelector('button[title^="عريض"]')),
      center: on([...bar.querySelectorAll('button')].find((b) => b.textContent.trim() === 'format_align_center'))
    };
  `);
  ok(`ولوحة التنسيق للعنوان: Amiri و٢٨ وعريض ووسط (${JSON.stringify(look)})`, look?.font === 'Amiri' && look.size === '28' && look.bold && look.center);
  ok(
    'ولونه الأحمر من الملف على اللوحة',
    await page.eval(`return [...document.querySelectorAll('[data-design] *')].some((e) => e.textContent.trim() === 'شهادة شكر وتقدير' && getComputedStyle(e).color === 'rgb(192, 0, 0)');`)
  );

  if (shotsDir) await page.shot(join(shotsDir, 'design-import.png'));

  // ── يُملأ ويُحفظ ───────────────────────────────────────────────────
  await page.type('input[data-value="اسم الطالب"]', 'مريم عادل حسن');
  await wait(400);
  ok(
    'والقيمة تُرسم في مكانها من التصميم',
    (await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`)).includes(
      'مريم عادل حسن'
    )
  );

  await click('button[data-act="save"]');
  await wait(1500);

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, doc_json AS docJson FROM templates').get();
  db.close();
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;

  ok('وحُفظ التصميم لوحةً', doc?.kind === 'canvas');
  ok('بمقاس A4 أفقي', Math.round(doc?.canvas?.size?.w ?? 0) === 297);
  ok('وبعناصره الثلاثة', doc?.canvas?.elements?.length === 3);
  ok('وفيها صورةُ الشعار من داخل الملف', doc?.canvas?.elements?.some((el) => el.kind === 'image'));

  return steps.join('\n');
}
