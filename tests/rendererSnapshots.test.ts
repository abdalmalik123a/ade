/**
 * لقطات الرسّام (DESIGNS.md ٠٫٢ و٣٫٦) — قبل أيّ نقلٍ أو ميزة: ما يرسمه `renderCanvasHtml` اليوم محفوظٌ في
 * `tests/snapshots/renderer/`، وأيّ فرقٍ يُفشل الاختبار حتى يُراجَع ويُقبل عن قصد (`npx vitest run -u` بعد المراجعة).
 *
 * - **الأنواع الستّة عشر بأنماطها الخمسة** كما تُطبع بعيّنتها — واللوحة تتبدّل بينها فتُرسم الألوان كلّها.
 * - **وباسم الجهة وشعارها** لكلّ نمط — طريق الشعار واسم الجهة المكتوب في التصميم نفسه.
 * - **وفي المحرّر** (`missing: 'token'`) — الحقل الفارغ وسمٌ يُرى.
 * - **واستمارات الشبّاك المصوّرة** — لأنّها تُصدر كتبًا تُقيَّد في السجلّ: سطرٌ وصندوقٌ ومربّعٌ وتاريخٌ وصورةٌ ومجموع،
 *   بقيمها كما تُطبع للزبون (`missing: 'hide'`) وفارغةً.
 *
 * والمعرّفات العشوائية (`newUuid`) تُبدَّل بأرقامٍ بترتيب ظهورها — فاللقطة ما يُرى لا ما يُولَّد.
 */
import { describe, expect, it } from 'vitest';
import { FIRST_STYLES, KINDS, PALETTES, STYLES, buildDoc, sampleValues } from '../src/shared/design/kit';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { SCREEN_DPI } from '../src/shared/canvas';
import { imageFormDoc, type FormSlot } from '../src/shared/imageForm';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * المعرّفات بأرقامٍ بترتيب ظهورها، والخلفيات المرسومة (SVG مرمَّزًا في رابط) مفكوكةً بين ⟦ ⟧، وكلّ عنصرٍ في سطره —
 * فيُقرأ فرق اللقطة: أيّ شكلٍ تغيّر لا «سطرٌ من مئة ألف حرف تغيّر».
 */
function stable(html: string): string {
  const seen = new Map<string, string>();
  const decoded = html.replace(/data:image\/svg\+xml;utf8,([^"')\s]+)/g, (_m, svg: string) => `data:image/svg+xml;utf8,⟦${decodeURIComponent(svg)}⟧`);
  return `${decoded
    .replace(UUID, (id) => {
      const key = id.toLowerCase();
      if (!seen.has(key)) seen.set(key, `id-${seen.size + 1}`);
      return seen.get(key)!;
    })
    .replace(/></g, '>\n<')}\n`;
}

const snap = (name: string) => `./snapshots/renderer/${name}.html`;

/** الأنماط الثمانية الجديدة (٣٫١) بأنواعٍ تمثّل عائلاتها — لا بالتسعة عشر كلّها (فاللقطات لا تتضخّم). */
const REPRESENTATIVE = ['thanks', 'student-id', 'invitation', 'menu', 'invoice'];

describe('لقطات الرسّام (DESIGNS.md ٠٫٢)', () => {
  KINDS.forEach((kind, k) => {
    STYLES.forEach((style, s) => {
      if (s >= FIRST_STYLES && !REPRESENTATIVE.includes(kind.key)) return;
      it(`${kind.key} بنمط ${style.key}`, async () => {
        const palette = PALETTES[(k + s) % PALETTES.length]!;
        const doc = buildDoc({ kind: kind.key, style: style.key, palette });
        const html = renderCanvasHtml(doc, sampleValues(), { dpi: SCREEN_DPI, missing: 'blank' });
        await expect(stable(html)).toMatchFileSnapshot(snap(`kit-${kind.key}-${style.key}`));
      });
    });
  });

  STYLES.forEach((style) => {
    it(`باسم الجهة وشعارها بنمط ${style.key}`, async () => {
      const brand = { name: 'مدرسة النور الابتدائية', logo: 'letterheads/logo.png' };
      const doc = buildDoc({ kind: KINDS[0]!.key, style: style.key, palette: PALETTES[0]!, brand });
      const html = renderCanvasHtml(doc, sampleValues(brand), { dpi: SCREEN_DPI, missing: 'blank' });
      await expect(stable(html)).toMatchFileSnapshot(snap(`brand-${KINDS[0]!.key}-${style.key}`));
    });
  });

  it('في المحرّر: الحقل الفارغ وسمٌ يُرى', async () => {
    const doc = buildDoc({ kind: KINDS[0]!.key, style: STYLES[0]!.key, palette: PALETTES[0]! });
    await expect(stable(renderCanvasHtml(doc, {}, { dpi: SCREEN_DPI, missing: 'token' }))).toMatchFileSnapshot(snap('editor-tokens'));
  });

  /** استمارةٌ مصوّرة مختلَقة بأنواع خاناتها كلّها — صورةٌ ٢١٠٠×٢٩٧٠ (A4 بمئتين وخمسين نقطة). */
  const W = 2100;
  const H = 2970;
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
  const SLOTS: FormSlot[] = [
    { key: 'الاسم', label: 'الاسم الرباعي', kind: 'text', box: box(400, 500, 1700, 580), from: 'line' },
    { key: 'التولد', label: 'تاريخ الولادة', kind: 'date', box: box(400, 650, 1000, 730), from: 'line' },
    { key: 'الرقم', label: 'رقم الهوية', kind: 'text', box: box(1100, 650, 1700, 730), from: 'box' },
    { key: 'متزوج', label: 'متزوج', kind: 'check', box: box(1600, 800, 1660, 860), from: 'box' },
    { key: 'صورة', label: 'الصورة', kind: 'photo', box: box(150, 300, 450, 700), from: 'box' },
    { key: 'درجة1', label: 'الدرجة الأولى', kind: 'text', box: box(400, 1000, 700, 1080), from: 'box' },
    { key: 'درجة2', label: 'الدرجة الثانية', kind: 'text', box: box(800, 1000, 1100, 1080), from: 'box' },
    { key: 'المجموع', label: 'المجموع', kind: 'text', box: box(1200, 1000, 1500, 1080), from: 'box', sumOf: ['درجة1', 'درجة2'] }
  ];
  const form = imageFormDoc({ title: 'استمارة معلومات', image: 'forms/0123456789abcdef0123456789abcdef.png', width: W, height: H, dpi: 250, slots: SLOTS });

  it('استمارة الشبّاك المصوّرة بقيمها كما تُطبع للزبون', async () => {
    const values = { الاسم: 'سالم حسن علي الربيعي', التولد: '2001-03-14', الرقم: '199011112222', متزوج: '✓', صورة: 'attachments/abc.jpg', درجة1: '45', درجة2: '38', المجموع: '83' };
    await expect(stable(renderCanvasHtml(form, values, { dpi: SCREEN_DPI, marks: false, missing: 'hide' }))).toMatchFileSnapshot(snap('form-filled'));
  });

  it('واستمارة الشبّاك فارغةً — لا وسمٌ يُطبع على ورقة الدائرة', async () => {
    const html = renderCanvasHtml(form, {}, { dpi: SCREEN_DPI, marks: false, missing: 'hide' });
    expect(html).not.toContain('{');
    await expect(stable(html)).toMatchFileSnapshot(snap('form-empty'));
  });
});
