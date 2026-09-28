import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUIET_128, bars128, barcodeSvg, checksum128, encode128, units128 } from '../src/shared/barcode';

/**
 * جدول الرموز يُفحص بحسابين لا بالعين.
 *
 * سطرٌ زائدٌ أو ناقصٌ فيه يزيح البدءَ والإيقافَ عن موضعهما، فيخرج باركودٌ يبدو
 * سليمًا ولا يقرؤه ماسح. وقد وقع ذلك فعلًا: سطران مكرّران أزاحا الجدول رمزين،
 * وكشفهما مجموعُ العروض لا النظر.
 */
function patterns(): string[] {
  const src = readFileSync(join(process.cwd(), 'src', 'shared', 'barcode.ts'), 'utf8');
  const at = src.indexOf('const PATTERNS');
  return [...src.slice(at, src.indexOf('];', at)).matchAll(/'(\d+)'/g)].map((m) => m[1]!);
}

describe('جدول Code128 يحرسه حسابان', () => {
  it('مئةٌ وسبعة رموز — وموضعُ البدء والإيقاف يتبعه', () => {
    const table = patterns();
    expect(table).toHaveLength(107);
    expect(table[103]).toBe('211412'); // START_A
    expect(table[104]).toBe('211214'); // START_B
    expect(table[105]).toBe('211232'); // START_C
    expect(table[106]).toBe('2331112'); // STOP
  });

  it('ومجموعُ عروض كل رمزٍ أحدَ عشرة، والإيقافُ وحده ثلاثةَ عشر', () => {
    const table = patterns();
    const sum = (p: string) => [...p].reduce((a, c) => a + Number(c), 0);
    for (let i = 0; i < 106; i++) expect([i, sum(table[i]!)]).toEqual([i, 11]);
    expect(sum(table[106]!)).toBe(13);
  });
});

describe('Code128: ما يُطبع على الهوية ويُقرأ بالماسح', () => {
  it('يرمّز النصّ في الوضع B — والقيمة هي الحرف ناقص ٣٢', () => {
    // المثال المعياري: START_B ثم P R I N T
    expect(encode128('PRINT')).toEqual([104, 48, 50, 41, 46, 52]);
  });

  it('وخانةُ التحقّق مجموعٌ موزون بالمواضع', () => {
    // 104 + 1×48 + 2×50 + 3×41 + 4×46 + 5×52 = 819، و819 % 103 = 98
    expect(checksum128(encode128('PRINT'))).toBe(98);
  });

  it('والأرقام تُضغط زوجًا في رمز — وبه يسع الباركود على هوية', () => {
    const codes = encode128('2026003112');
    // START_C ثم خمسة رموزٍ لعشرة أرقام.
    expect(codes[0]).toBe(105);
    expect(codes).toEqual([105, 20, 26, 0, 31, 12]);
    expect(codes).toHaveLength(6);
  });

  it('ونصٌّ كلُّه أرقامٌ زوجيّة يبدأ بالوضع C ولو قصُر — فهو أقصر', () => {
    // START_C + رمزٌ واحد = اثنان، مقابل START_B + رمزين = ثلاثة.
    expect(encode128('12')).toEqual([105, 12]);
  });

  it('ورقمٌ قصير داخل نصٍّ يبقى في الوضع B — فالتبديل يكلّف أكثر ممّا يوفّر', () => {
    expect(encode128('A12B')).not.toContain(99);
  });

  it('والمختلط يبدّل الوضع في موضعه', () => {
    const codes = encode128('A12345678');
    expect(codes[0]).toBe(104); // START_B للحرف
    expect(codes).toContain(99); // ثم CODE_C للأرقام
  });

  it('وكل رمزٍ ستّةُ شرائط تبدأ بالأسود، والإيقاف سبعة', () => {
    const bars = bars128('A');
    // البدء + الحرف + التحقّق = ثلاثةُ رموزٍ × ٦، والإيقاف ٧.
    expect(bars).toHaveLength(3 * 6 + 7);
    expect(bars[0]!.dark).toBe(true);
    expect(bars[1]!.dark).toBe(false);
  });

  it('والعرض يُقاس بالوحدات — وبه يُحسب عرض الوحدة داخل صندوق', () => {
    const bars = bars128('2026003112');
    expect(units128(bars)).toBeGreaterThan(0);
    // ضغطُ الأرقام يجعل العشرة أقصر من عشرة أحرف.
    expect(units128(bars128('2026003112'))).toBeLessThan(units128(bars128('ABCDEFGHIJ')));
  });

  it('والرسم SVG بوحداته لا ببكسلاته — فيُطبع بدقّة الطابعة', () => {
    const svg = barcodeSvg('2026-0031');
    expect(svg).toContain('viewBox="0 0');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect');
  });

  it('وما لا يُرمز يُرفض ولا يُطبع باركودٌ كاذب', () => {
    // والسبب يُقال بلغة المكتب — ويُقال نفسه في المحرّر وفي فاحص ما قبل الطباعة.
    expect(() => encode128('اسم')).toThrow('الباركود لا يحمل الحروف العربية');
  });
});

describe('ما يحتاجه قارئ الهاتف', () => {
  it('هامشٌ صامت عشر وحداتٍ أبيض قبل الرمز وبعده — فيُقرأ على خلفيةٍ ملوّنة', () => {
    const text = '198421098312';
    const width = units128(bars128(text));
    const svg = barcodeSvg(text);
    expect(svg).toContain(`viewBox="0 0 ${width + QUIET_128 * 2} 40"`);
    // الخلفية البيضاء تغطّي الهامشين، وأوّل خطٍّ أسود بعد الهامش لا عند الصفر.
    expect(svg).toContain(`<rect width="${width + QUIET_128 * 2}" height="40" fill="#fff"/>`);
    const firstBar = /<rect x="(\d+)"/.exec(svg);
    expect(Number(firstBar?.[1])).toBe(QUIET_128);
  });
});
