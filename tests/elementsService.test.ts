/**
 * مكتبة العناصر في القاعدة والمخزن (DESIGNS.md ٠٫٨): الـSVG يُحفظ معقَّمًا لا كما جاء، والـPNG يُفحص، والملفّ نفسه لا
 * يُكرَّر، وما ليس عنصرًا يُرفض بسببه ولا يمنع غيره — والحذف لا يمسّ ملفًّا يستعمله تصميم.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { elementBox } from '../src/shared/design/elements';

const root = mkdtempSync(join(tmpdir(), 'diwan-elements-'));
vi.mock('electron', () => ({ app: { getPath: () => root } }));
const { importElements, listElements, removeElement } = await import('../src/main/services/elements');

const db = new Database(':memory:');
db.exec(readFileSync(join(__dirname, '..', 'src', 'main', 'db', 'schema.sql'), 'utf8'));
const file = (name: string, data: string | Buffer) => {
  const p = join(root, name);
  writeFileSync(p, data);
  return p;
};
const store = (rel: string) => join(root, 'data', 'store', rel);

/** PNG حقيقيّ ١×١. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
const frame = file('إطار ذهبي.svg', '<svg viewBox="0 0 200 100" onload="x()"><script>alert(1)</script><rect width="200" height="100" fill="gold"/></svg>');

describe('مكتبة العناصر في القاعدة والمخزن', () => {
  it('الـSVG يُحفظ معقَّمًا بأبعاده، والـPNG بأبعاده، وكلٌّ بصنفه واسمه', () => {
    const out = importElements(db, [frame, file('نجمة.png', PIXEL)], 'إطارات');
    expect(out.errors).toEqual([]);
    expect(out.added.map((e) => [e.name, e.category, e.kind, e.width, e.height])).toEqual([
      ['إطار ذهبي', 'إطارات', 'svg', 200, 100],
      ['نجمة', 'إطارات', 'png', 1, 1]
    ]);
    const saved = readFileSync(store(out.added[0]!.file), 'utf8');
    expect(saved).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="gold"/></svg>');
    expect(out.added[1]!.file).toMatch(/^elements\/[0-9a-f]{32}\.png$/);
  });

  it('والملفّ نفسه لا يُكرَّر — يُعاد صنفه', () => {
    importElements(db, [frame], 'زخارف');
    const list = listElements(db);
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.kind === 'svg')?.category).toBe('زخارف');
  });

  it('وما ليس عنصرًا يُرفض باسمه وسببه، والصنف المجهول «أخرى»', () => {
    const out = importElements(db, [file('صورة.jpg', 'x'), file('تالف.png', 'ليس png'), file('صفحة.svg', '<html>x</html>'), file('أيقونة.svg', '<svg width="24" height="24"/>')], 'غريب');
    expect(out.errors).toEqual([
      { name: 'صورة.jpg', reason: 'العناصر SVG أو PNG' },
      { name: 'تالف.png', reason: 'ليست صورة PNG سليمة' },
      { name: 'صفحة.svg', reason: 'ليس رسمةً متّجهة (SVG)' }
    ]);
    expect(out.added.map((e) => [e.name, e.category])).toEqual([['أيقونة', 'أخرى']]);
  });

  it('والحذف يمحو الملفّ — إلا ما يستعمله تصميم', () => {
    const [svg, png] = listElements(db).filter((e) => e.name !== 'أيقونة');
    // تصميمٌ أدرج الإطار: مساره في وثيقته.
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('design-uses', JSON.stringify({ src: svg!.file }));
    removeElement(db, svg!.id);
    removeElement(db, png!.id);
    expect(listElements(db).map((e) => e.name)).toEqual(['أيقونة']);
    expect(existsSync(store(svg!.file))).toBe(true);
    expect(existsSync(store(png!.file))).toBe(false);
  });

  it('صندوق العنصر حين يُدرج: في الوسط بنسبة أبعاده', () => {
    expect(elementBox({ width: 200, height: 100 }, { w: 90, h: 60 })).toEqual({ x: (1 - 20 / 90) / 2, y: (1 - 10 / 60) / 2, w: 20 / 90, h: 10 / 60 });
    const square = elementBox({ width: 0, height: 0 }, { w: 60, h: 60 });
    for (const v of [square.x, square.y, square.w, square.h]) expect(v).toBeCloseTo(1 / 3, 10);
  });
});
