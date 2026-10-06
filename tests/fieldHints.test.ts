/**
 * الخانات المقترحة من الورقة: ملفّ Word كما كتبه المكتب، وما فيه من فراغاتٍ وأسماء وصياغة.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { docxToDoc } from '../src/main/services/docxDoc';
import { applyBlankFields, applyHint, fieldHints, wrongGenderWords } from '../src/shared/fieldHints';
import { docText, emptyDoc, makeField, paragraph, run, fieldRef, type Doc } from '../src/shared/doc';

const letter = () =>
  docxToDoc(unzipSync(new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'warning-letter.docx')))), () => 'x.png').doc;
const withLines = (...lines: string[]): Doc => ({ ...emptyDoc(), blocks: lines.map((l) => paragraph([run(l)])) });
const applyAll = (doc: Doc) => {
  let d = doc;
  for (const h of fieldHints(doc)) {
    const fresh = fieldHints(d).find((x) => x.kind === h.kind && x.label === h.label);
    if (fresh) d = applyHint(d, fresh);
  }
  return d;
};

describe('فراغات ملفّ Word خاناتٌ مقترحة', () => {
  it('التاريخ واسم التلميذ والصف — من الكلام قبل كلّ فراغ', () => {
    const hints = fieldHints(letter());
    const blank = (label: string) => hints.find((h) => h.kind === 'blank' && h.label === label);
    expect(blank('التاريخ')?.count).toBe(1);
    expect(blank('اسم التلميذ')?.count).toBe(2);
    expect(blank('اسم التلميذ')?.field?.role).toBe('name');
    expect(blank('الصف')?.count).toBe(1);
    expect(blank('عدد الغيابات')?.count).toBe(1);
  });

  it('ونقاط الخاتمة («مع التقدير .....») زخرفةٌ لا فراغ', () => {
    expect(fieldHints(letter()).some((h) => h.label === 'التقدير')).toBe(false);
  });

  it('وفراغا التلميذ خانةٌ واحدة تُكتب مرّة — ولا نقاط تبقى حيث كانت الفراغات', () => {
    const d = applyAll(letter());
    const text = docText(d);
    expect(text.match(/\{اسم_التلميذ\}/g)).toHaveLength(2);
    expect(text).not.toMatch(/\.{6,}/);
    expect(text).toContain('{التاريخ}');
    expect(d.fields.filter((f) => f.role === 'name')).toHaveLength(1);
  });

  it('والصياغة مع الجنس: «التلميذ» و«غياباته» خياران — لكتابٍ له صاحب علاقة', () => {
    const hints = fieldHints(letter()).filter((h) => h.kind === 'gender');
    expect(hints.find((h) => h.text === 'التلميذ')).toMatchObject({ key: 'التلميذ|التلميذة', count: 2 });
    expect(hints.find((h) => h.text === 'غياباته')?.key).toBe('غياباته|غياباتها');
    const d = applyAll(letter());
    expect(docText(d)).toContain('{التلميذ|التلميذة}');
  });
});

describe('النصّ المكتوب خاناتٌ مقترحة', () => {
  const doc = () =>
    withLines(
      'نؤيد لكم أن الطالب أحمد عادل كريم مستمر بالدوام في الصف الخامس الابتدائي',
      'للعام الدراسي 2024-2025 وقد زُوِّد بهذا الكتاب بتاريخ 12/3/2025 بناءً على طلبه'
    );

  it('الاسم بعد اللقب، والصف، والعام الدراسي، والتاريخ', () => {
    const hints = fieldHints(doc());
    expect(hints.find((h) => h.kind === 'name')?.text).toBe('أحمد عادل كريم');
    expect(hints.find((h) => h.kind === 'class')?.text).toBe('الخامس الابتدائي');
    expect(hints.find((h) => h.kind === 'year')?.text).toBe('2024-2025');
    expect(hints.find((h) => h.kind === 'date')?.text).toBe('12/3/2025');
  });

  it('والاسم خانةٌ بدوره، فيملؤها سجلّ المواطنين', () => {
    const name = fieldHints(doc()).find((h) => h.kind === 'name')!;
    const d = applyHint(doc(), name);
    expect(docText(d)).toContain('الطالب {الاسم} مستمر');
    expect(d.fields[0]).toMatchObject({ key: 'الاسم', role: 'name', source: 'fullName' });
  });

  it('«الطالب» لا تقع في «الطالبة»', () => {
    const hints = fieldHints({ ...withLines('نؤيد أن الطالبة زينب علي حسين مستمرة'), fields: [] });
    expect(hints.find((h) => h.text === 'الطالب')).toBeUndefined();
    expect(hints.find((h) => h.text === 'الطالبة')?.key).toBe('الطالب|الطالبة');
  });

  it('ولا صياغة جنسٍ لكتابٍ بلا صاحب علاقة', () => {
    expect(fieldHints(withLines('يرجى تزويد الطالب بكتاب تأييد')).some((h) => h.kind === 'gender')).toBe(false);
  });
});

describe('«جرّب باسمٍ آخر»: ما بقي نصًّا وهو خانة', () => {
  it('قيمة الخانة مكتوبةٌ في موضعٍ آخر — تصير الخانة نفسها', () => {
    const d: Doc = {
      ...emptyDoc(),
      blocks: [paragraph([run('نؤيد أن '), fieldRef('أحمد_عادل'), run(' موظف لدينا')]), paragraph([run('وأن أحمد عادل مستمر بالدوام')])],
      fields: [makeField({ key: 'أحمد_عادل', label: 'أحمد عادل' })]
    };
    const hint = fieldHints(d).find((h) => h.kind === 'repeat')!;
    expect(hint).toMatchObject({ key: 'أحمد_عادل', count: 1 });
    expect(docText(applyHint(d, hint))).toContain('وأن {أحمد_عادل} مستمر');
  });

  it('وكلمات المذكّر تُكشف حين يُجرَّب اسمٌ مؤنّث', () => {
    expect(wrongGenderWords('أنثى')).toContain('غياباته');
    expect(wrongGenderWords('ذكر')).toContain('المذكورة');
  });
});

describe('الفراغات كلّها خاناتٍ دفعةً واحدة — لـ«استورد مجلدي»', () => {
  const doc = (): Doc => ({
    ...emptyDoc(),
    blocks: [
      paragraph([run('العدد: ........ التاريخ: /   /   20')]),
      paragraph([run('الى ولي امر التلميذ ........................ بالنظر لغيابات التلميذ ............ في الصف ..........')])
    ]
  });

  it('الفراغات بأسمائها في مرّةٍ واحدة: اسمٌ واحد لموضعين، والمواضع في المقطع الواحد لا تتزحزح', () => {
    const { doc: out, suggestions } = applyBlankFields(doc(), { fillMode: 'hand' });
    expect(out.fields.map((f) => f.label)).toEqual(expect.arrayContaining(['اسم التلميذ', 'الصف', 'التاريخ']));
    const body = out.blocks[1]! as { inlines: { kind: string; ref?: string }[] };
    const refs = body.inlines.filter((i) => i.kind === 'field').map((i) => i.ref);
    const name = out.fields.find((f) => f.label === 'اسم التلميذ')!;
    // ثلاثة فراغاتٍ في مقطعٍ واحد: موضعا التلميذ خانةٌ واحدة، والصف خانته.
    expect(refs).toEqual([name.key, name.key, out.fields.find((f) => f.label === 'الصف')!.key]);
    expect(name).toMatchObject({ source: 'fullName', role: 'name', fillMode: 'hand' });
    expect(out.fields.every((f) => f.fillMode === 'hand')).toBe(true);
    // ولكلّ خانةٍ اقتراحٌ يُراجَع: «المفتاح — الاسم» بدرجته وسببه.
    expect(suggestions.find((s) => s.value === `${name.key} — اسم التلميذ`)).toMatchObject({ reason: 'اسمُ شخص' });
    expect(suggestions.find((s) => s.value.endsWith('— التاريخ'))?.confidence).toBe(0.95);
  });

  it('وسطور الخليّة لا تلتصق في اسم فراغها، ونقاط فراغٍ قبله ليست من اسمه، و«ذو العدد في» ليس عددًا', () => {
    const doc: Doc = {
      ...emptyDoc(),
      blocks: [
        paragraph([run('مدير المدرسة'), { kind: 'break' }, run('التوقيع: ..............')]),
        paragraph([run('المحافظة .............. قضاء ..............')]),
        paragraph([run('كتابكم ذو العدد في .............. نرفق لكم')])
      ]
    };
    const labels = applyBlankFields(doc).doc.fields.map((f) => f.label);
    expect(labels).toEqual(expect.arrayContaining(['التوقيع', 'المحافظة', 'قضاء']));
    expect(labels.some((l) => l.includes('المدرسة') || l.includes('.') || l === 'عدد الفي')).toBe(false);
  });

  it('وما قبل `from` رأسٌ لا يُمسّ — فراغاته تبقى نقاطًا', () => {
    const before = doc();
    const { doc: out } = applyBlankFields(before, { from: 1 });
    expect(out.blocks[0]).toEqual(before.blocks[0]);
    expect(out.fields.map((f) => f.label)).not.toContain('التاريخ');
    expect(out.fields.map((f) => f.label)).toEqual(expect.arrayContaining(['اسم التلميذ', 'الصف']));
  });
});
