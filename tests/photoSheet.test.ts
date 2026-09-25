import { describe, expect, it } from 'vitest';
import { CENTER, PAPERS, PHOTO_SIZES, cropBox, photoLayout, photoSheetsHtml } from '../src/shared/photoSheet';

const size = (key: string) => PHOTO_SIZES.find((s) => s.key === key)!.size;
const paper = (key: string) => PAPERS.find((p) => p.key === key)!.size;

describe('الصور الشخصية', () => {
  it('٣٫٥ × ٤٫٥ على ورق الصور ستّ، وعلى A4 ثلاثون', () => {
    expect(photoLayout(paper('photo'), size('35x45')).per).toBe(6);
    expect(photoLayout(paper('a4'), size('35x45')).per).toBe(30);
    expect(photoLayout(paper('photo'), size('2x3')).per).toBe(16);
  });

  it('والشبكة في وسط الورقة ومن اليمين', () => {
    const l = photoLayout(paper('photo'), size('35x45'));
    const right = l.cells[0]!.x + 35;
    const left = l.cells[1]!.x;
    expect(l.cells[0]!.x).toBeGreaterThan(l.cells[1]!.x);
    expect(Math.round((paper('photo').w - right) * 10)).toBe(Math.round(left * 10));
  });

  it('القصّ: الصورة تغطّي الإطار دائمًا، ولو سُحب مركزها إلى الحافّة', () => {
    const frame = { w: 35, h: 45 };
    const natural = { w: 3000, h: 4000 };
    for (const crop of [CENTER, { zoom: 2, x: 0, y: 0 }, { zoom: 1.5, x: 1, y: 1 }, { zoom: 3, x: 0.2, y: 0.9 }]) {
      const b = cropBox(frame, natural, crop);
      expect(b.left).toBeLessThanOrEqual(1e-9);
      expect(b.top).toBeLessThanOrEqual(1e-9);
      expect(b.left + b.width).toBeGreaterThanOrEqual(frame.w - 1e-9);
      expect(b.top + b.height).toBeGreaterThanOrEqual(frame.h - 1e-9);
    }
  });

  it('وبلا تكبير تملأ الصورة الإطار بالكاد', () => {
    const b = cropBox({ w: 30, h: 40 }, { w: 1200, h: 1600 }, CENTER);
    expect(b).toMatchObject({ left: 0, top: 0, width: 30, height: 40 });
  });

  it('والنسخ تتوزّع على الأوراق ولا تُكرَّر الأخيرة', () => {
    const pages = photoSheetsHtml(
      { src: 'photos/a.jpg', natural: { w: 1200, h: 1600 }, crop: CENTER, photo: size('35x45'), paper: paper('photo'), count: 8 },
      (s) => `diwan://store/${s}`
    );
    expect(pages).toHaveLength(2);
    expect((pages[1]!.match(/<img/g) ?? []).length).toBe(2);
    expect(pages[0]).toContain('width:101.6mm');
  });
});
