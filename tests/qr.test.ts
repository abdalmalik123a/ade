import { describe, expect, it } from 'vitest';
import {
  blockLayout,
  buildCodewords,
  encodeQr,
  formatBits,
  functionModules,
  gfMul,
  pickVersion,
  qrSvg,
  reedSolomon,
  versionBits,
  zigzag
} from '@shared/qr';

/**
 * رمز الكتاب الرسمي لا يُتحقّق منه بالنظر. فهنا فاكّ ترميز كامل يقرأ المصفوفة
 * كما تقرأها الماسحة — يستخرج القناع، ويزيله، ويقرأ الكلمات بترتيب المواصفة،
 * ويفكّ التشبيك، ويعيد النصّ — ثم تُفحص كلمات التصحيح رياضيًا بحساب المتلازمات.
 */

/** المتلازمات: قيمة كثير حدود الكلمة عند جذور المولّد. صفرها دليل سلامة الترميز. */
function syndromes(codeword: Uint8Array, ecCount: number): number[] {
  const EXP: number[] = [];
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP.push(x);
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  const out: number[] = [];
  for (let i = 0; i < ecCount; i++) {
    const root = EXP[i]!;
    let acc = 0;
    for (const byte of codeword) acc = gfMul(acc, root) ^ byte;
    out.push(acc);
  }
  return out;
}

/** يقرأ المصفوفة ويعيد النصّ — الطريق العكسي كاملًا. */
function decode(matrix: { size: number; modules: boolean[][] }): string {
  const size = matrix.size;
  const version = (size - 17) / 4;
  const { reserved } = functionModules(version);
  const bit = (x: number, y: number) => (matrix.modules[y]![x] ? 1 : 0);

  // معلومات الصيغة من نسختها الأولى: خمس بتّات بيانات بعد فكّ القناع الثابت.
  let format = 0;
  const formatCells: [number, number][] = [];
  for (let i = 0; i <= 5; i++) formatCells.push([8, i]);
  formatCells.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) formatCells.push([14 - i, 8]);
  formatCells.forEach(([x, y], i) => {
    format |= bit(x, y) << i;
  });
  const mask = ((format ^ 0x5412) >> 10) & 0b111;
  expect(formatBits(mask)).toBe(format); // الصيغة المقروءة تطابق الصيغة المحسوبة

  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];

  const bits: number[] = [];
  for (const [x, y] of zigzag(size, reserved)) {
    bits.push(masks[mask]!(x, y) ? bit(x, y) ^ 1 : bit(x, y));
  }

  const [ecCount, b1, d1, b2, d2] = blockLayout(version);
  const totalCodewords = b1 * (d1 + ecCount) + b2 * (d2 + ecCount);
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length && codewords.length < totalCodewords; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    codewords.push(byte);
  }

  // فكّ التشبيك: كلمات البيانات أولًا بالدور، ثم كلمات التصحيح.
  const sizes = [...Array(b1).fill(d1), ...Array(b2).fill(d2)] as number[];
  const blocks: number[][] = sizes.map(() => []);
  let read = 0;
  for (let i = 0; i < Math.max(d1, d2); i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < sizes[b]!) blocks[b]!.push(codewords[read++]!);
    }
  }
  const ecOf: number[][] = sizes.map(() => []);
  for (let i = 0; i < ecCount; i++) {
    for (let b = 0; b < blocks.length; b++) ecOf[b]!.push(codewords[read++]!);
  }

  // كل كتلة بكلمات تصحيحها يجب أن تكون كلمة ريد-سولومون صحيحة.
  blocks.forEach((block, b) => {
    const full = Uint8Array.from([...block, ...ecOf[b]!]);
    expect(syndromes(full, ecCount)).toEqual(new Array(ecCount).fill(0));
  });

  const data = blocks.flat();
  const stream: number[] = [];
  for (const cw of data) for (let i = 7; i >= 0; i--) stream.push((cw >> i) & 1);
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | stream.shift()!;
    return v;
  };
  expect(take(4)).toBe(0b0100); // نمط البايت
  const length = take(version <= 9 ? 8 : 16);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = take(8);
  return new TextDecoder().decode(bytes);
}

describe('حقل غالوا وكلمات التصحيح', () => {
  it('الضرب في الحقل يوافق خواصّه: محايد وصفر', () => {
    expect(gfMul(1, 123)).toBe(123);
    expect(gfMul(0, 255)).toBe(0);
    expect(gfMul(2, 128)).toBe(0x11d & 0xff); // تجاوز يردّه كثير الحدود الأولي
  });

  it('كلمات التصحيح تُصفّر المتلازمات', () => {
    const data = Uint8Array.from({ length: 16 }, (_, i) => (i * 37) & 0xff);
    const ec = reedSolomon(data, 10);
    expect(ec).toHaveLength(10);
    expect(syndromes(Uint8Array.from([...data, ...ec]), 10)).toEqual(new Array(10).fill(0));
  });

  it('حشو الكلمات يتناوب 0xEC و0x11 كما تنصّ المواصفة', () => {
    // «AB» في الإصدار 1: أربع كلمات بيانات، ثم الحشو إلى ستّ عشرة.
    const cw = buildCodewords(new TextEncoder().encode('AB'), 1);
    expect([...cw.slice(4, 8)]).toEqual([0xec, 0x11, 0xec, 0x11]);
  });
});

describe('بنية الرمز', () => {
  it('الإصدار يكبر مع الحمولة', () => {
    expect(pickVersion(10)).toBe(1);
    expect(pickVersion(100)).toBeGreaterThan(4);
    expect(() => pickVersion(5000)).toThrow(/طاقة/);
  });

  it('معلومات الإصدار تطابق قيم المواصفة المنشورة', () => {
    // قيم معروفة من الجدول القياسي للإصدارات 7 و10 و20.
    expect(versionBits(7)).toBe(0x07c94);
    expect(versionBits(10)).toBe(0x0a4d3);
    expect(versionBits(20)).toBe(0x149a6);
  });

  it('مربّعات التموضع الثلاثة في زواياها', () => {
    const { size, modules } = encodeQr('م/2026/1');
    const finder = (ox: number, oy: number) =>
      modules[oy]![ox] && modules[oy + 1]![ox + 1] === false && modules[oy + 3]![ox + 3];
    expect(finder(0, 0)).toBe(true);
    expect(finder(size - 7, 0)).toBe(true);
    expect(finder(0, size - 7)).toBe(true);
  });
});

describe('دورة كاملة: ترميز ثم فكّ', () => {
  const cases = [
    'م/2026/1',
    'DIW-2026-000001',
    'م/2026/184 · a1b2c3d4e5f60718',
    'تأييد سكن — أحمد عبد الله — 199912345678',
    'x'.repeat(200),
    'ديوان '.repeat(30)
  ];

  for (const text of cases) {
    it(`يعيد النصّ كما هو: ${text.slice(0, 24)}`, () => {
      expect(decode(encodeQr(text))).toBe(text);
    });
  }

  it('الترميز حتميّ — النصّ نفسه يعطي المصفوفة نفسها', () => {
    expect(encodeQr('م/2026/9').modules).toEqual(encodeQr('م/2026/9').modules);
  });
});

describe('الرسم', () => {
  it('SVG مضمّن بلا أي مرجع خارجي', () => {
    const svg = qrSvg('م/2026/1 · بصمة');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    // فضاء الأسماء عنوان معياري لا يُجلب؛ المحظور هو مرجع يُحمَّل من الشبكة.
    expect(svg).not.toMatch(/(?:href|src)\s*=/);
    expect(svg).not.toContain('<image');
  });

  it('الهامش الصامت أربع وحدات على كل جانب', () => {
    const { size } = encodeQr('م/2026/1');
    expect(qrSvg('م/2026/1')).toContain(`viewBox="0 0 ${size + 8} ${size + 8}"`);
  });
});

describe('في اللوحة', () => {
  it('يملأ صندوقه مربّعًا في وسطه — لا ٦٤ بكسلًا ثابتة تفيض أو تصغر', () => {
    const svg = qrSvg('198421098312');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(qrSvg('x', 64)).toContain('width="64"');
  });
});
