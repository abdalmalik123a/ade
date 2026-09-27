import { describe, expect, it } from 'vitest';
import { gradeOmr, omrCapacity, omrLayout, omrSheetHtml, parseKey, readOmr, type OmrSpec } from '../src/shared/omr';
import type { PixelData } from '../src/shared/deskew';

/**
 * «مسحٌ» مصنوع من المخطّط نفسه: الورقة مائلةٌ درجتين، مزاحة، وبدقّةٍ غير دقّة
 * الطباعة — كما تخرج من ماسح المكتب. والدوائر كلّها مطبوعةٌ حلقاتٍ، والمظلّل منها
 * مملوء: فالقارئ يجب أن يفرّق الحلقة المطبوعة عن الظلّ.
 */
function scan(spec: OmrSpec, marks: { answers: Record<number, number[]>; id: string }): PixelData {
  const W = 1240;
  const H = 1754;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const s = 5.7;
  const theta = (2 * Math.PI) / 180;
  const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
  const toPx = (x: number, y: number) => {
    const dx = (x - 105) * s;
    const dy = (y - 148.5) * s;
    return { x: W / 2 + 12 + dx * cos - dy * sin, y: H / 2 - 8 + dx * sin + dy * cos };
  };
  const toMm = (px: number, py: number) => {
    const dx = px - W / 2 - 12;
    const dy = py - H / 2 + 8;
    return { x: 105 + (dx * cos + dy * sin) / s, y: 148.5 + (-dx * sin + dy * cos) / s };
  };
  const paint = (cx: number, cy: number, reach: number, inside: (x: number, y: number) => boolean) => {
    const c = toPx(cx, cy);
    const rr = Math.ceil(reach * s * 1.5);
    for (let y = Math.floor(c.y - rr); y <= c.y + rr; y++) {
      for (let x = Math.floor(c.x - rr); x <= c.x + rr; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const m = toMm(x + 0.5, y + 0.5);
        if (inside(m.x - cx, m.y - cy)) data.set([20, 20, 20], (y * W + x) * 4);
      }
    }
  };
  for (const [x, y] of [
    [14, 14],
    [196, 14],
    [196, 283],
    [14, 283]
  ]) {
    paint(x!, y!, 4, (dx, dy) => Math.abs(dx) <= 4 && Math.abs(dy) <= 4);
  }
  const lay = omrLayout(spec);
  const ring = (dx: number, dy: number) => Math.abs(Math.hypot(dx, dy) - 2.2) < 0.13;
  const dot = (dx: number, dy: number) => Math.hypot(dx, dy) < 2.1;
  for (const b of lay.answers) paint(b.x, b.y, 2.5, (marks.answers[b.q] ?? []).includes(b.c) ? dot : ring);
  for (const b of lay.id) paint(b.x, b.y, 2.5, marks.id[b.digit] === String(b.value) ? dot : ring);
  return { width: W, height: H, data };
}

describe('ورقة الإجابة بالدوائر', () => {
  const spec: OmrSpec = { questions: 30, choices: 4, idDigits: 3, key: [] };

  it('تُقرأ من مسحٍ مائلٍ مزاح: الإجابات، والفارغ، والمتعدّد، ورقم الطالب', () => {
    const answers: Record<number, number[]> = {};
    for (let q = 0; q < 30; q++) answers[q] = [q % 4];
    delete answers[7]; // فارغ
    answers[12] = [0, 2]; // ظُلّلت دائرتان
    const read = readOmr(scan(spec, { answers, id: '407' }), spec)!;
    expect(read).not.toBeNull();
    expect(read.id).toBe('407');
    expect(read.answers[0]).toBe(0);
    expect(read.answers[5]).toBe(1);
    expect(read.answers[29]).toBe(1);
    expect(read.answers[7]).toBe(-1);
    expect(read.answers[12]).toBe(-2);
    const expected = Array.from({ length: 30 }, (_, q) => (q === 7 ? -1 : q === 12 ? -2 : q % 4));
    expect(read.answers).toEqual(expected);
  });

  it('صورةٌ بلا مربّعاتها الأربعة لا تُقرأ ولا يُخترع لها جواب', () => {
    const blank: PixelData = { width: 400, height: 560, data: new Uint8ClampedArray(400 * 560 * 4).fill(255) };
    expect(readOmr(blank, spec)).toBeNull();
  });

  it('التصحيح بالمفتاح: المتعدّد والفارغ ليسا صوابًا', () => {
    const g = gradeOmr([0, 1, -1, -2, 3], [0, 2, 1, 1, -1]);
    expect(g).toEqual({ correct: 1, wrong: 1, blank: 1, multi: 1, total: 4, percent: 25 });
  });

  it('المفتاح يُكتب حروفًا أو أرقامًا', () => {
    expect(parseKey('أ ب ج د هـ', 5)).toEqual([0, 1, 2, 3, 4]);
    expect(parseKey('1، 4، ٢ -', 4)).toEqual([0, 3, 1, -1]);
  });

  it('الورقة تسع ٧٥ سؤالًا بأربعة بدائل، ومربّعاتها الأربعة مرسومة', () => {
    expect(omrCapacity(4)).toBeGreaterThanOrEqual(75);
    const html = omrSheetHtml(spec, { title: 'امتحان العلوم' });
    expect(html.match(/background:#000/g)).toHaveLength(4);
    expect(html).toContain('امتحان العلوم');
  });
});
