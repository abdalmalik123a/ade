import { appendFileSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { BrowserWindow } from 'electron';
import { fitCanvasText } from '@shared/canvasFit';
import type { SheetStyle } from '@shared/api';
import { getDb } from '../db';

/**
 * محرّك الإخراج: الطباعة وPDF والصورة عالية الدقّة.
 *
 * المبدأ: ما يُطبع هو علامات ورقة المعاينة نفسها، بأنماط التطبيق نفسها وخطوطه،
 * في نافذة بمقاس A4 — فلا تنشأ فجوة بين ما يراه الموظف وما يخرج من الطابعة.
 *
 * ولذلك تُحمَّل صفحة التطبيق ذاتها (بعلامة mode=print فلا تُركَّب الواجهة)، ثم
 * تُحقن الورقة في جسمها. الطريق الأول — صفحة data: تربط ملف الأنماط — كان
 * يسقط صامتًا: المتصفّح يمنع مورد file:// داخل مستند data:، فكانت الورقة تخرج
 * بخطّ بديل بلا أنماط. أما هنا فالأصل واحد، فتعمل الأنماط والخطوط بلا حيلة.
 *
 * لا يُفتح متصفح ولا قارئ PDF: كل شيء داخل التطبيق.
 */

/** مقاس الورقة بالملّم — A4 عموديًّا ما لم يُذكر غيره. */
export type PageMm = { w: number; h: number };
const A4: PageMm = { w: 210, h: 297 };

/** أطول ما تُنتظر الخطوط — من القرص لا من الشبكة، فما جاوزه عطلٌ لا بطء. */
const FONT_WAIT_MS = 10_000;

let styleCache: SheetStyle | null | undefined;

/**
 * أنماط الورقة كما ترسمها نافذة الإخراج الآن: ملفّات الأنماط التي تربطها `index.html`، وصنف
 * `<body>` الذي يرث منه خطّها — تُحفظ مع كلّ كتابٍ يصدر (خطة Production، ١٫٣).
 *
 * تُقرأ من الملفّ المبنيّ نفسه الذي تحمّله نافذة الإخراج، لا من الواجهة: فهي ما رُسم به فعلًا.
 * و`url(./…)` في الأنماط نسبيٌّ إلى مجلّدها، فيُكتب نسبيًّا إلى `index.html` لتُحقن يومًا في
 * صفحتها. وفي نمط التطوير (خادم Vite) لا ملفّ مبنيًّا يُوثق به، فلا يُلتقط شيء.
 */
export function sheetStyle(): SheetStyle | null {
  if (styleCache !== undefined) return styleCache;
  styleCache = null;
  if (process.env['ELECTRON_RENDERER_URL']) return styleCache;
  try {
    const dir = join(__dirname, '../renderer');
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/<link\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /\brel="stylesheet"/.test(tag))
      .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1])
      .filter((href): href is string => Boolean(href));
    const css = hrefs
      .map((href) => {
        const base = posix.dirname(href.replace(/^\.\//, ''));
        return readFileSync(join(dir, href), 'utf8').replace(/url\(\s*(['"]?)\.\//g, `url($1./${base}/`);
      })
      .join('\n');
    const bodyClass = /<body\b[^>]*\bclass="([^"]*)"/.exec(html)?.[1] ?? null;
    if (css.trim()) styleCache = { css, bodyClass };
  } catch {
    // لا ملفّ مبنيّ يُقرأ — يصدر الكتاب بلا أنماطٍ محفوظة، ويُعاد طبعه بأنماط يومه كما كان.
  }
  return styleCache;
}

/**
 * أنماط الورقة وقت الإخراج: مقاسها الفيزيائي بلا تكبير ولا ظلّ ولا حدود.
 *
 * والمقاس وسيط: الشهادة A4 أفقي، ولوحة الشرف A3. وكان مثبّتًا A4 عموديًّا،
 * فتخرج الشهادة الأفقية مقصوصةً نصفها خارج الورقة.
 */
function printCss(page: PageMm, offset: { x: number; y: number } = { x: 0, y: 0 }): string {
  return `
  @page { size: ${page.w}mm ${page.h}mm; margin: 0; }
  .print-root { position: relative; left: ${offset.x}mm; top: ${offset.y}mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body > :not(.print-root) { display: none !important; }
  /* أنماط التطبيق تُخفي عند الطباعة كلَّ ‎body *‎ عدا ‎.print-sheet‎. وهذه النافذة لا
     تحوي إلا الورقة المحقونة، فتظهر أيًّا كان صنفها — وكانت ورقة الشبّاك والتصاميم
     والكتاب المشترك تخرج بيضاء. وبالخصوصية نفسها لا أعلى: ما أُخفي عمدًا
     (‎.invisible‎ أو نمطٌ مضمَّن) يبقى مخفيًّا. */
  body * { visibility: visible; }
  .print-root {
    width: ${page.w}mm;
    min-height: ${page.h}mm;
    margin: 0;
    background: #fff;
    transform: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .print-root * { box-shadow: none !important; }
  /* تكبير المعاينة يُنزع — إلا دوران عناصر اللوحة، فهو من التصميم لا من الشاشة. */
  .print-root *:not([data-canvas] *) { transform: none !important; }
`;
}

/**
 * أنماط الطبقة: ما يُضاف فوق صفحة PDF قائمة (نصٌّ وشعارٌ وعلامة مائية — محرّر PDF).
 *
 * وخلافًا للورقة: **لا خلفية** — ما لا يُرسم شفّافٌ فيبقى الأصل تحته ظاهرًا — ولا يُنزع
 * الدوران: العلامة المائية مائلةٌ بقصد. والصفحة بمقاس الصفحة التي تُختم عليها تمامًا.
 */
function layerCss(page: PageMm): string {
  return `
  @page { size: ${page.w}mm ${page.h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: transparent !important; }
  body > :not(.print-root) { display: none !important; }
  body * { visibility: visible; }
  .print-root { position: relative; width: ${page.w}mm; height: ${page.h}mm; overflow: hidden; background: transparent; }
`;
}

/** مقاس الطابعة: ما كان A4 باسمه، وغيره بالميكرون كما تطلبه Chromium. */
function pageSizeOf(page: PageMm): { landscape: boolean; pageSize: 'A4' | { width: number; height: number } } {
  const landscape = page.w > page.h;
  const long = Math.max(page.w, page.h);
  const short = Math.min(page.w, page.h);
  if (Math.abs(long - 297) < 1 && Math.abs(short - 210) < 1) return { landscape, pageSize: 'A4' };
  return { landscape, pageSize: { width: Math.round(short * 1000), height: Math.round(long * 1000) } };
}

async function withRenderWindow<T>(
  sheetHtml: string,
  work: (win: BrowserWindow) => Promise<T>,
  opts: {
    width?: number;
    height?: number;
    /** الرسم خارج الشاشة أسرع، لكن حوار الطباعة يحتاج نافذة نظام حقيقية. */
    offscreen?: boolean;
    parent?: BrowserWindow | null;
    page?: PageMm;
    /** إزاحة الطابعة المُعايَرة — للطباعة الورقية وحدها. */
    offset?: { x: number; y: number };
    /** طبقةٌ تُختم فوق صفحة PDF: شفّافة، ودورانها من التصميم لا يُنزع (`layerCss`). */
    layer?: boolean;
    /**
     * أنماط الكتاب يوم صدر (`sheet_styles`، خطة Production ٢٫٤): تحلّ محلّ أنماط اليوم، فيُعاد
     * طبعه بما رُسم به — وإلا غيّر تحديثٌ للواجهة خطّه وتقسيم صفحاته.
     */
    style?: SheetStyle | null;
  } = {}
): Promise<T> {
  const page = opts.page ?? A4;
  const win = new BrowserWindow({
    show: false,
    width: opts.width,
    height: opts.height,
    useContentSize: true,
    parent: opts.parent ?? undefined,
    webPreferences: {
      offscreen: opts.offscreen ?? true,
      // لا preload ولا Node: الصفحة هنا ورقة تُرسم، لا واجهة تعمل.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    // صفحة التطبيق نفسها، بعلامة تمنع تركيب الواجهة — فتبقى الأنماط والخطوط.
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) await win.loadURL(`${devUrl}/index.html?mode=print`);
    else
      await win.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'print' } });

    const fonts = (await win.webContents.executeJavaScript(`
      (() => {
        const kept = ${JSON.stringify(opts.style ?? null)};
        if (kept) {
          // أنماط يوم الإصدار مكان أنماط اليوم — وصنف <body> الذي يرث منه خطّ الورقة.
          for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) node.remove();
          const old = document.createElement('style');
          old.textContent = kept.css;
          document.head.appendChild(old);
          document.body.className = kept.bodyClass || '';
        }
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(opts.layer ? layerCss(page) : printCss(page, opts.offset))};
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.className = 'print-root';
        root.innerHTML = ${JSON.stringify(sheetHtml)};
        document.body.appendChild(root);
        void root.offsetHeight; // التخطيط يطلب الخطوط التي تستعملها الورقة
        // انتظار الخطوط قبل الرسم — وإلا خرجت الورقة بخطّ بديل. وبمهلة قصوى
        // كي لا يتعلّق الإصدار كلّه على خطّ لم يُحمَّل. ثم تُقاس الأسماء بخطّها
        // الحقيقي فتصغر ما يلزم لتسع — كما قيست في المعاينة.
        let timedOut = false;
        return Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(() => { timedOut = true; r(null); }, ${FONT_WAIT_MS}))
        ]).then(() => {
          (${fitCanvasText.toString()})(root);
          const failed = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
          const waiting = [...document.fonts].filter((f) => f.status === 'loading').map((f) => f.family);
          return { failed: [...new Set([...failed, ...(timedOut ? waiting : [])])] };
        });
      })()
    `)) as { failed: string[] };

    // خطٌّ لم يُحمَّل لا يُرسم بديله صامتًا (خطة Production ٢٫٥): كتابٌ رسميّ بخطّ النظام الاحتياطي
    // تقسيمُ أسطره وصفحاته غير ما رآه الموظف — فيُقال ولا يُطبع.
    if (fonts.failed.length) {
      throw new Error(`خطّ الورقة لم يُحمَّل (${fonts.failed.join('، ')}) — لم تُطبع حتى لا تخرج بخطٍّ بديل`);
    }

    return await work(win);
  } finally {
    win.destroy();
  }
}

export type PrintRequest = {
  sheetHtml: string;
  deviceName?: string;
  copies?: number;
  silent?: boolean;
  /** النافذة التي يُعلَّق عليها حوار الطباعة. */
  parent?: BrowserWindow | null;
  /** مقاس الورقة بالملّم — A4 عموديًّا ما لم يُذكر. */
  page?: PageMm;
  /**
   * وجهان: الوجه ثم ظهره معكوس الأعمدة. والقلب يمينًا ويسارًا في الحالين —
   * على الحافّة الطويلة للعموديّة، والقصيرة للأفقيّة.
   */
  duplex?: boolean;
  /** ورقة المعايرة تُطبع بلا إزاحة — فهي ما تُقاس به الإزاحة. */
  raw?: boolean;
  /** أنماط الكتاب يوم صدر — لإعادة طبع ما في الأرشيف كما صدر. */
  style?: SheetStyle | null;
};

/**
 * تحت المِقْود وحده (`DIWAN_TEST_PRINT_LOG`): لا يُرسل شيءٌ إلى طابعة، بل يُكتب سطرٌ لكلّ طلب
 * طباعة — الطابعة، وأصامتٌ هو، وأوّل ما في الورقة — فتُختبر الطباعة على التطبيق الحقيقي بلا ورق.
 * وطابعةٌ يبدأ اسمها بـ«معطّلة» تُرفض دائمًا، و«تتوقّف» تقف مرّةً واحدة عند ورقتها الثالثة (نفد
 * الورق) — ليُختبر ما يُقال حين لا تُطبع ورقة، والاستئناف من حيث وقفت.
 */
function testPrintLog(req: PrintRequest): { ok: boolean; reason?: string } | null {
  const file = process.env['DIWAN_TEST_PRINT_LOG'];
  if (!file) return null;
  const printer = req.deviceName ?? null;
  let before = 0;
  try {
    before = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line && (JSON.parse(line) as { printer: string | null }).printer === printer).length;
  } catch {
    // لا سجلّ بعد.
  }
  const text = req.sheetHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  appendFileSync(file, `${JSON.stringify({ printer, silent: req.silent ?? false, style: Boolean(req.style), text })}\n`, 'utf8');
  if (printer?.startsWith('معطّلة')) return { ok: false, reason: 'الطابعة لا تستجيب' };
  if (printer?.startsWith('تتوقّف') && before === 2) return { ok: false, reason: 'نفد الورق' };
  return { ok: true };
}

/**
 * إزاحة الطابعة التي ستطبع، من إعدادات المكتب — باسمها، أو الافتراضية إن لم تُسمَّ.
 * تُقرأ هنا لا في كل مُنادٍ: كل طباعةٍ ورقيّة (الإصدار والشبّاك والتصاميم) تمرّ بها.
 */
export function printerOffset(deviceName: string | undefined): { x: number; y: number } {
  try {
    const rows = getDb()
      .prepare("SELECT key, value FROM settings WHERE key IN ('printOffsets', 'defaultPrinter')")
      .all() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const offsets = JSON.parse(map.get('printOffsets') ?? '{}') as Record<string, { x: number; y: number }>;
    const o = offsets[deviceName ?? map.get('defaultPrinter') ?? ''];
    return o && Number.isFinite(o.x) && Number.isFinite(o.y) ? { x: o.x, y: o.y } : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

/**
 * ورقة المعايرة: علامتان على ٢٠ ملم من الحافّة اليمنى والعليا، ومسطرتان بالملّم.
 * يُقاس بعد الطباعة بُعدُ العلامة عن حافّتي الورقة، ويُكتب القياس كما هو —
 * والحساب في `offsetFromMeasure` (shared/calibration.ts) لا في رأس الموظف.
 */
export function calibrationSheet(): string {
  const tick = (i: number, horizontal: boolean) =>
    horizontal
      ? `<div style="position:absolute;right:${i}mm;top:0;width:0.15mm;height:${i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5}mm;background:#000"></div>`
      : `<div style="position:absolute;top:${i}mm;right:0;height:0.15mm;width:${i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5}mm;background:#000"></div>`;
  const ticks = Array.from({ length: 61 }, (_, i) => tick(i, true) + tick(i, false)).join('');
  const cross = (right: string, top: string) =>
    `<div style="position:absolute;right:calc(${right} - 6mm);top:${top};width:12mm;height:0.2mm;background:#000"></div>` +
    `<div style="position:absolute;right:${right};top:calc(${top} - 6mm);width:0.2mm;height:12mm;background:#000"></div>`;
  return (
    `<div dir="rtl" style="position:relative;width:210mm;height:297mm;font-family:'IBM Plex Sans Arabic',sans-serif;color:#000">` +
    ticks +
    cross('20mm', '20mm') +
    cross('105mm', '148.5mm') +
    `<div style="position:absolute;right:40mm;left:30mm;top:70mm;font-size:15px;line-height:1.9">` +
    `<div style="font-size:22px;font-weight:700;margin-bottom:6mm">ورقة معايرة الطابعة</div>` +
    `<div>١. قِس بالمسطرة بُعدَ الخطّ العمودي في العلامة العليا عن <b>حافّة الورقة اليمنى</b>. الصحيح ٢٠ ملم.</div>` +
    `<div>٢. وقِس بُعدَ الخطّ الأفقي فيها عن <b>حافّة الورقة العليا</b>. الصحيح ٢٠ ملم أيضًا.</div>` +
    `<div>٣. اكتب القياسين في «معايرة الطابعة» كما هما — والبرنامج يحسب الإزاحة.</div>` +
    `<div style="margin-top:4mm;color:#555">والعلامة الوسطى في منتصف الورقة تمامًا — للتحقّق بعد الضبط.</div>` +
    `</div></div>`
  );
}

export async function printSheet(req: PrintRequest): Promise<{ ok: boolean; reason?: string }> {
  const logged = testPrintLog(req);
  if (logged) return logged;
  const silent = req.silent ?? false;
  const page = req.page ?? A4;
  const { landscape, pageSize } = pageSizeOf(page);
  try {
    return await printWith(req, silent, page, landscape, pageSize);
  } catch (e) {
    // خطٌّ لم يُحمَّل أو نافذةٌ لم تُفتح: ورقةٌ لم تُطبع، يُقال سببها — لا استثناءٌ يُسقط الدفعة.
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

function printWith(
  req: PrintRequest,
  silent: boolean,
  page: PageMm,
  landscape: boolean,
  pageSize: ReturnType<typeof pageSizeOf>['pageSize']
): Promise<{ ok: boolean; reason?: string }> {
  return withRenderWindow(
    req.sheetHtml,
    (win) =>
      new Promise((resolve) => {
        win.webContents.print(
          {
            silent,
            printBackground: true,
            copies: req.copies ?? 1,
            deviceName: req.deviceName,
            pageSize,
            // «default» يأخذ هوامش `@page` التي تعلنها الورقة: الكتاب يعلن هوامشه فتتكرّر
            // في كل صفحة (LetterSheet)، والتصاميم تعلن صفرًا (printCss). و«none» كان يُسقط
            // هوامش الورقة فتبدأ الصفحة الثانية من كتابٍ طويل عند حافّة الورق.
            margins: { marginType: 'default' },
            landscape,
            duplexMode: req.duplex ? (landscape ? 'shortEdge' : 'longEdge') : 'simplex',
            scaleFactor: 100
          },
          (ok, reason) => resolve({ ok, reason })
        );
      }),
    // حوار النظام لا يظهر فوق نافذة مرسومة خارج الشاشة، فالطباعة غير الصامتة
    // تحتاج نافذة حقيقية مخفية معلَّقة على نافذة التطبيق.
    { offscreen: silent, parent: silent ? null : req.parent, page, offset: req.raw ? undefined : printerOffset(req.deviceName), style: req.style }
  );
}

/** PDF بمقاس الورقة الحقيقي وبالخلفيات (الشعار والعلامة المائية) — وبأنماط الكتاب يوم صدر إن أُعطيت. */
export async function renderPdf(sheetHtml: string, page: PageMm = A4, style: SheetStyle | null = null): Promise<Buffer> {
  const { landscape, pageSize } = pageSizeOf(page);
  return withRenderWindow(
    sheetHtml,
    (win) =>
      win.webContents.printToPDF({
        pageSize,
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        landscape,
        preferCSSPageSize: true
      }),
    { page, style }
  );
}

/**
 * طبقةٌ PDF شفّافة بمقاس صفحةٍ بعينها — تُختم فوق صفحةٍ قائمة (`pdfEdit.ts`).
 *
 * والنصّ العربي يُرسم هنا لا في مكتبة PDF: Chromium يصل الحروف ويرتّبها من اليمين،
 * ويبقى النصّ نصًّا يُحدَّد ويُبحث فيه — ومكتبات PDF ترسم الحروف منفصلةً معكوسة.
 */
export async function renderLayerPdf(html: string, page: PageMm): Promise<Buffer> {
  const { landscape, pageSize } = pageSizeOf(page);
  return withRenderWindow(
    html,
    (win) =>
      win.webContents.printToPDF({
        pageSize,
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        landscape,
        preferCSSPageSize: true
      }),
    { page, layer: true }
  );
}

/** جدول CRC لترميز مقاطع PNG. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/**
 * يكتب الدقّة داخل الصورة نفسها (مقطع pHYs).
 *
 * صورة بمقاس 2480×3508 بلا هذا المقطع تُفتح في برامج الطباعة على أنها 96
 * نقطة/إنش فتُطبع بحجم أكبر من A4. الدقّة تُقاس بالمتر في المواصفة:
 * 300 نقطة/إنش = 11811 نقطة/متر.
 */
function withDensity(png: Buffer, dpi: number): Buffer {
  const perMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(perMetre, 0);
  data.writeUInt32BE(perMetre, 4);
  data[8] = 1; // الوحدة: المتر

  const type = Buffer.from('pHYs', 'ascii');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  const chunk = Buffer.alloc(21);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 17);

  // بعد IHDR مباشرةً: ثمانية بايتات توقيع + 25 بايت مقطع IHDR.
  const head = 8 + 25;
  if (png.indexOf('pHYs', head, 'ascii') > 0) return png; // لا يُكرَّر مقطع موجود
  return Buffer.concat([png.subarray(0, head), chunk, png.subarray(head)]);
}

/**
 * صورة الورقة بدقّة الطباعة الاحترافية — A4 عند 300 نقطة/إنش = 2480×3508.
 *
 * capturePage تصوّر ما تراه النافذة بمقاسها، فلا تتجاوز حدود الشاشة ولا تكبّر.
 * ولذلك يجري التصوير عبر مُنقِّح الصفحة: قصاصة بمقاس الورقة مضروبة في نسبة
 * الدقّتين، وcaptureBeyondViewport ليخرج ما تحت حافة النافذة أيضًا — فتُرسم
 * الصفحة من جديد بالمقاس الكبير، وتبقى الحروف حادّة لا ممطوطة.
 */
export async function renderPng(sheetHtml: string, dpi = 300, page: PageMm = A4): Promise<Buffer> {
  const width = Math.round((page.w / 25.4) * 96); // 794 لـA4 — الورقة بمقاسها على الشاشة
  const height = Math.round((page.h / 25.4) * 96); // 1123
  // النسبة تُشتقّ من البكسلات المطلوبة لا من الدقّة وحدها، فيخرج المقاس مضبوطًا.
  const scale = Math.round((page.w / 25.4) * dpi) / width;

  return withRenderWindow(
    sheetHtml,
    async (win) => {
      const dbg = win.webContents.debugger;
      if (!dbg.isAttached()) dbg.attach('1.3');
      try {
        const result = (await dbg.sendCommand('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale }
        })) as { data: string };
        return withDensity(Buffer.from(result.data, 'base64'), dpi);
      } finally {
        dbg.detach();
      }
    },
    { width, height, page }
  );
}
