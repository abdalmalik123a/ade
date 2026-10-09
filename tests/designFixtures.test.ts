/**
 * تصاميم كلّ إصدارٍ تُفتح وتُرسم كما رُسمت (DESIGNS.md ٣٫٥ و٠٫٥) — كقواعد الإصدارات المبيعة.
 *
 * `tests/fixtures/designs/v<إصدار النموذج>/` كتبها إصدارها (`makeDesignFixtures.test.ts`) ولا تُعاد: ووثيقةُ كلٍّ تمرّ
 * بالتقويم والترحيل (`normalizeDoc`) كما تُقرأ من القاعدة، ثم تُرسم بقيمها وتُقارن بلقطتها. فإن غيّر إصدارٌ لاحق شكلَ
 * تصميمٍ محفوظ فشل هنا حتى يُراجَع ويُقبل عن قصد. و`legacy-unversioned` ما حُفظ قبل رقم الإصدار، بعناصره القديمة والتالفة.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeDoc } from '../src/shared/doc';
import { renderCanvasHtml } from '../src/shared/canvasHtml';
import { CANVAS_VERSION, canvasVersionOf, migrateCanvas, normalizeCanvas, SCREEN_DPI } from '../src/shared/canvas';

const ROOT = join(__dirname, 'fixtures', 'designs');
const FIXTURES = readdirSync(ROOT).flatMap((dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).map((f) => ({ dir, name: f.replace(/\.json$/, '') })));

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** كما في لقطات الرسّام: معرّفاتٌ بترتيبها، وخلفياتٌ مرسومة مفكوكة، وعنصرٌ في سطر. */
function stable(html: string): string {
  const seen = new Map<string, string>();
  return `${html
    .replace(/data:image\/svg\+xml;utf8,([^"')\s]+)/g, (_m, svg: string) => `data:image/svg+xml;utf8,⟦${decodeURIComponent(svg)}⟧`)
    .replace(UUID, (k) => {
      const key = k.toLowerCase();
      if (!seen.has(key)) seen.set(key, `id-${seen.size + 1}`);
      return seen.get(key)!;
    })
    .replace(/></g, '>\n<')}\n`;
}

describe('تصاميم الإصدارات تُفتح كما رُسمت (DESIGNS.md ٠٫٥)', () => {
  it('في المجلّد تجهيزات الإصدار الحاضر', () => {
    expect(FIXTURES.filter((f) => f.dir === `v${CANVAS_VERSION}`).length).toBeGreaterThanOrEqual(3);
  });

  it.each(FIXTURES)('$dir/$name يُفتح ويُرسم كما رُسم', async ({ dir, name }) => {
    const { doc: raw, values } = JSON.parse(readFileSync(join(ROOT, dir, `${name}.json`), 'utf8')) as { doc: unknown; values: Record<string, string> };
    const doc = normalizeDoc(raw);
    expect(doc.kind).toBe('canvas');
    expect(doc.canvas?.v).toBe(CANVAS_VERSION);
    const front = stable(renderCanvasHtml(doc, values, { dpi: SCREEN_DPI }));
    const back = doc.backCanvas ? stable(renderCanvasHtml({ ...doc, canvas: doc.backCanvas }, values, { dpi: SCREEN_DPI })) : '';
    await expect(front + (back ? `\n<!-- الظهر -->\n${back}` : '')).toMatchFileSnapshot(`./snapshots/fixtures/${dir}-${name}.html`);
  });

  it('وما حُفظ قبل رقم الإصدار: عناصره القديمة تُقرأ والتالفة تسقط ولا تُسقط اللوحة', () => {
    const { doc: raw } = JSON.parse(readFileSync(join(ROOT, 'v1', 'legacy-unversioned.json'), 'utf8')) as { doc: { canvas: unknown } };
    expect(canvasVersionOf(raw.canvas)).toBe(1);
    const canvas = normalizeCanvas(raw.canvas);
    // النصّ القديم بلا عقد عقدةٌ، والرسمة صورة، وعنصر الويب و«constructor» يسقطان، والجدول يُكمَّل.
    expect(canvas.elements.map((el) => el.kind)).toEqual(['text', 'text', 'image', 'table']);
    expect(canvas.elements[1]!.box).toEqual({ w: 1, h: 0.1, x: 0, y: 0.9 });
    expect(JSON.stringify(canvas)).not.toContain('script');
  });
});

describe('ترحيل النموذج (DESIGNS.md ٣٫٥)', () => {
  it('ما لا رقم له — أو رقمه فاسد — إصداره ١، ويُرفع إلى الحاضر', () => {
    for (const v of [undefined, 0, -3, 1.5, '2', null]) expect(canvasVersionOf({ v })).toBe(1);
    expect(migrateCanvas({ size: { w: 1, h: 1 } }).version).toBe(CANVAS_VERSION);
    expect(normalizeCanvas({ size: { w: 90, h: 50 } }).v).toBe(CANVAS_VERSION);
  });

  it('ولوحةٌ من برنامجٍ أحدث تُقرأ بما يُعرف منها ويبقى رقمها — لا تُوسَم بأقدم', () => {
    const newer = { v: CANVAS_VERSION + 3, size: { w: 90, h: 50 }, elements: [{ kind: 'text', inlines: [], box: { x: 0, y: 0, w: 1, h: 1 } }, { kind: 'path3d', box: { x: 0, y: 0, w: 1, h: 1 } }] };
    const canvas = normalizeCanvas(newer);
    expect(canvas.v).toBe(CANVAS_VERSION + 3);
    expect(canvas.elements.map((el) => el.kind)).toEqual(['text']);
  });

  it('والتقويم مرّتين كمرّة', () => {
    const once = normalizeCanvas({ size: { w: 148, h: 210 }, bleed: 3, elements: [{ kind: 'shape', id: 'a', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] });
    expect(normalizeCanvas(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
