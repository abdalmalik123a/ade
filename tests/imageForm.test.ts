/**
 * الاستمارة المصوّرة (المرحلة ٤): الصناديق من البكسلات، والخانات بأسمائها من القارئ.
 */
import { describe, expect, it } from 'vitest';
import type { PixelData } from '../src/shared/deskew';
import { borderBands, findBoxes, inkShare } from '../src/shared/formBoxes';
import { imageFormDoc, planImageForm, unreadCells, withCellRead } from '../src/shared/imageForm';
import type { OcrLine, OcrWord } from '../src/shared/paperDoc';
import { derivedWords } from '../src/shared/tafqeet';

/** ورقةٌ بيضاء يُرسم عليها. */
function page(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const px: PixelData = { width: w, height: h, data };
  const dot = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) dot(x, y0), dot(x, y1);
    for (let y = y0; y <= y1; y++) dot(x0, y), dot(x1, y);
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, v = 0) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  };
  return { px, rect, fill, dot };
}

const word = (text: string, x0: number, y0: number, x1: number, y1: number): OcrWord => ({ text, conf: 90, box: { x0, y0, x1, y1 } });
const line = (...words: OcrWord[]): OcrLine => ({
  conf: 90,
  words,
  box: { x0: Math.min(...words.map((w) => w.box.x0)), y0: Math.min(...words.map((w) => w.box.y0)), x1: Math.max(...words.map((w) => w.box.x1)), y1: Math.max(...words.map((w) => w.box.y1)) }
});

describe('صناديق الاستمارة من البكسلات', () => {
  it('الخانة المحاطة بخطٍّ صندوق — وما بين الأسطر ورقةٌ لا صندوق', () => {
    const p = page(600, 800);
    p.rect(300, 100, 560, 140); // خانة عنوان
    p.rect(40, 100, 298, 140); // خانة فارغة بجانبها
    p.rect(40, 200, 52, 212); // مربّع اختيار
    p.fill(330, 115, 520, 125); // «نصٌّ» في خانة العنوان
    for (let x = 40; x < 400; x += 6) p.dot(x, 300); // نقاطٌ في سطر: لا صندوق
    const boxes = findBoxes(p.px);
    expect(boxes).toHaveLength(3);
    const empty = boxes.find((b) => b.x0 < 60 && b.y0 < 120 && b.x1 > 250)!;
    const label = boxes.find((b) => b.x0 > 290)!;
    expect(inkShare(p.px, empty)).toBeLessThan(0.01);
    expect(inkShare(p.px, label)).toBeGreaterThan(0.1);
  });

  it('وفجوةٌ صغيرة في حدّ الصندوق (صورةٌ مضغوطة) لا تُسرّب بياضه', () => {
    const p = page(400, 400);
    p.rect(50, 50, 250, 90);
    // تُمحى نقطةٌ من الحدّ الأعلى.
    const i = (50 * 400 + 120) * 4;
    p.px.data[i] = p.px.data[i + 1] = p.px.data[i + 2] = 255;
    expect(findBoxes(p.px)).toHaveLength(1);
  });

  it('وخطوط جدولٍ رماديّة باهتة بجانب إطارٍ أسود عريض («معلومات») خانات — لا ورقةٌ واحدة', () => {
    const p = page(800, 600);
    // الإطار الأسود حول الورقة كلّها، والجدول داخله بخطوطٍ رماديّة (١٩٠) رفيعة.
    p.fill(10, 10, 789, 17);
    p.fill(10, 582, 789, 589);
    p.fill(10, 10, 17, 589);
    p.fill(782, 10, 789, 589);
    for (const y of [100, 160, 220, 280]) p.fill(24, y, 776, y + 1, 190);
    for (const x of [24, 300, 520, 775]) p.fill(x, 100, x + 1, 281, 190);
    const boxes = findBoxes(p.px);
    // ثلاثة صفوف × ثلاث خانات.
    expect(boxes.filter((b) => b.y0 >= 98 && b.y1 <= 284)).toHaveLength(9);
  });

  it('وحدود الصناديق تُمحى قبل القراءة — لا فتحات الحروف الصغيرة', () => {
    const bands = borderBands([{ x0: 100, y0: 100, x1: 400, y1: 140 }, { x0: 500, y0: 100, x1: 510, y1: 108 }], 1000, 1400);
    expect(bands).toHaveLength(4);
    expect(bands[0]!.y1).toBeLessThanOrEqual(101);
  });
});

describe('الخانات بأسمائها', () => {
  const W = 1000;
  const H = 1400;

  it('الخانة الفارغة اسمها من العنوان يمينها، والمربّع من كلمته، ومربّع الصورة صورة', () => {
    const boxes = [
      { x0: 600, y0: 100, x1: 900, y1: 140 }, // «رقم الهوية»
      { x0: 300, y0: 100, x1: 598, y1: 140 }, // فارغة
      { x0: 400, y0: 200, x1: 418, y1: 218 }, // مربّع
      { x0: 50, y0: 100, x1: 200, y1: 320 } // الصورة
    ];
    const lines = [
      line(word('الهوية', 620, 110, 700, 130), word('رقم', 710, 110, 760, 130)),
      line(word('أعزب', 424, 202, 470, 216)),
      line(word('صورة', 90, 150, 160, 170))
    ];
    const slots = planImageForm({ width: W, height: H, boxes, lines });
    expect(slots.find((s) => s.kind === 'text' && s.from === 'box')?.label).toBe('رقم الهوية');
    expect(slots.find((s) => s.kind === 'check')?.label).toBe('أعزب');
    expect(slots.find((s) => s.kind === 'photo')?.key).toBe('الصورة');
  });

  it('في السطر: النقاط بعد «الصف»، والقوسان بعد «بأن»، والتاريخ «/ / 202»، والفراغ بعد «العدد :»', () => {
    const lines = [
      line(word('الصف', 820, 100, 900, 130), word('..............', 600, 110, 810, 130)),
      line(word('بأن', 850, 200, 900, 230), word('(', 830, 200, 840, 230), word(')', 500, 200, 510, 230), word('والملصقة', 380, 200, 490, 230)),
      line(word('التاريخ:', 820, 300, 900, 330), word('/', 700, 300, 710, 330), word('/', 640, 300, 650, 330), word('202', 560, 300, 620, 330)),
      line(word('العدد', 840, 400, 900, 430), word(':', 820, 400, 830, 430))
    ];
    const slots = planImageForm({ width: W, height: H, boxes: [], lines });
    const labels = slots.map((s) => `${s.kind}:${s.label}`);
    expect(labels).toContain('text:الصف');
    expect(slots.find((s) => s.box.x0 === 510)?.from).toBe('line');
    expect(slots.some((s) => s.kind === 'date')).toBe(true);
    expect(labels.some((l) => l.startsWith('text:العدد'))).toBe(true);
  });

  it('جدول الدرجات: «رقمًا» و«كتابةً» زوجان بالصفّ، فيُكتب الرقم فتُكتب الكلمات — والمجموع يجمع', () => {
    const head = { x0: 100, y0: 100, x1: 400, y1: 130 };
    const boxes = [
      head,
      { x0: 300, y0: 132, x1: 400, y1: 160 }, // «رقما»
      { x0: 100, y0: 132, x1: 298, y1: 160 }, // «كتابة»
      { x0: 402, y0: 162, x1: 450, y1: 190 }, // «1»
      { x0: 300, y0: 162, x1: 400, y1: 190 },
      { x0: 100, y0: 162, x1: 298, y1: 190 },
      { x0: 402, y0: 192, x1: 450, y1: 220 }, // «2»
      { x0: 300, y0: 192, x1: 400, y1: 220 },
      { x0: 100, y0: 192, x1: 298, y1: 220 },
      { x0: 600, y0: 300, x1: 900, y1: 330 }, // «المجموع»
      { x0: 300, y0: 300, x1: 598, y1: 330 } // المجموع رقمًا (بعنوانه يمينه)
    ];
    const lines = [
      line(word('الدرجة', 220, 105, 300, 125)),
      line(word('رقما', 330, 137, 380, 155), word('كتابة', 170, 137, 240, 155)),
      line(word('1', 420, 168, 430, 185)),
      line(word('2', 420, 198, 430, 215)),
      line(word('المجموع', 700, 305, 800, 325), word('رقما', 820, 305, 880, 325))
    ];
    const slots = planImageForm({ width: W, height: H, boxes, lines });
    const keys = slots.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['الدرجة_1_رقما', 'الدرجة_1_كتابة', 'الدرجة_2_رقما', 'الدرجة_2_كتابة']));
    expect(derivedWords({ الدرجة_1_رقما: '95' }, keys)['الدرجة_1_كتابة']).toContain('تسعون');
    const total = slots.find((s) => s.key.startsWith('المجموع'));
    expect(total?.sumOf).toEqual(expect.arrayContaining(['الدرجة_1_رقما', 'الدرجة_2_رقما']));
  });

  it('عمودٌ لم يُكشف رأسه يسار «رقمًا» ملاصقٍ له «كتابةً» — ولا يأخذ اسمه من رأس الصفحة فوق الجدول', () => {
    const boxes = [
      { x0: 50, y0: 20, x1: 950, y1: 60 }, // رأس الصفحة: «إدارة مدرسة»
      { x0: 300, y0: 132, x1: 400, y1: 160 }, // «رقمًا» — ورأس «كتابةً» يساره انغلق على كلمته فلم يُكشف
      { x0: 402, y0: 162, x1: 450, y1: 190 }, // «1»
      { x0: 300, y0: 162, x1: 400, y1: 190 },
      { x0: 100, y0: 162, x1: 298, y1: 190 }
    ];
    const lines = [line(word('مدرسة', 700, 30, 800, 50), word('إدارة', 820, 30, 900, 50)), line(word('رقمًا', 330, 137, 380, 155)), line(word('1', 420, 168, 430, 185))];
    const keys = planImageForm({ width: W, height: H, boxes, lines }).map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['الدرجة_1_رقما', 'الدرجة_1_كتابة']));
  });

  it('والقوس الملاصق للفراغ إذا قُرئ «١» لا يكون اسمه — «بأن» تبقى «الاسم»', () => {
    const lines = [line(word('بأن', 850, 200, 900, 230), word('١', 830, 200, 840, 230), word('..........', 520, 205, 820, 230))];
    expect(planImageForm({ width: W, height: H, boxes: [], lines }).map((s) => s.label)).toContain('الاسم');
  });

  it('خانةٌ فيها حبرٌ لم يُقرأ منها إلا حرف تُقرأ وحدها، وقراءتها تحلّ محلّ الحرف', () => {
    const total = { x0: 600, y0: 300, x1: 900, y1: 360 };
    const lines = [line(word('١', 740, 320, 750, 340)), line(word('الدرجة', 100, 100, 200, 130))];
    expect(unreadCells([total, { x0: 50, y0: 90, x1: 250, y1: 140 }], [0.09, 0.2], lines)).toEqual([total]);
    // المقصوصة بهامش ٢٤ عند (٥٧٦، ٢٧٦) من الصفحة.
    const got = [line(word('المجموع', 60, 40, 260, 70))];
    const after = withCellRead(lines, total, got, 576, 276);
    const texts = after.flatMap((l) => l.words.map((w) => w.text));
    expect(texts).toEqual(['الدرجة', 'المجموع']);
    expect(after[1]!.words[0]!.box.x0).toBe(636);
  });

  it('والاستمارة نموذجٌ يُقيَّد: صورتها خلفيّة، وفوق كلّ خانةٍ حقلها', () => {
    const slots = planImageForm({
      width: W,
      height: H,
      boxes: [
        { x0: 600, y0: 100, x1: 900, y1: 140 },
        { x0: 300, y0: 100, x1: 598, y1: 140 }
      ],
      lines: [line(word('الاسم', 650, 110, 720, 130))]
    });
    const doc = imageFormDoc({ title: 'معلومات', image: 'forms/x.png', width: W, height: H, slots });
    expect(doc.kind).toBe('canvas');
    expect(doc.issuing).toBe('registered');
    expect(doc.meta.form).toBe(true);
    expect(doc.canvas?.background).toMatchObject({ kind: 'image', src: 'forms/x.png' });
    expect(doc.canvas?.size).toEqual({ w: 210, h: 297 });
    const el = doc.canvas!.elements[0]!;
    // من اليمين: الخانة تبدأ عند ٥٩٨ من ١٠٠٠ ← ٤٠٪ من الحافّة اليمنى.
    expect(el.box.x).toBeCloseTo(0.402, 3);
    expect(doc.fields[0]).toMatchObject({ key: 'الاسم', source: 'fullName', role: 'name' });
  });
});
