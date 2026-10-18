/**
 * حقل غالوا GF(256) وتصحيح ريد-سولومون وبناء كلمات رمز QR (المستوى M، الإصدارات 1..20) — نُقل من `qr.ts` (D89).
 */

/** لكل إصدار: [كلمات التصحيح لكل كتلة، كتل المجموعة الأولى، كلمات بياناتها،
 *  كتل المجموعة الثانية، كلمات بياناتها] — مستوى M حصرًا. */
const EC_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0], //  1
  [16, 1, 28, 0, 0], //  2
  [26, 1, 44, 0, 0], //  3
  [18, 2, 32, 0, 0], //  4
  [24, 2, 43, 0, 0], //  5
  [16, 4, 27, 0, 0], //  6
  [18, 4, 31, 0, 0], //  7
  [22, 2, 38, 2, 39], //  8
  [22, 3, 36, 2, 37], //  9
  [26, 4, 43, 1, 44], // 10
  [30, 1, 50, 4, 51], // 11
  [22, 6, 36, 2, 37], // 12
  [22, 8, 37, 1, 38], // 13
  [24, 4, 40, 5, 41], // 14
  [24, 5, 41, 5, 42], // 15
  [28, 7, 45, 3, 46], // 16
  [28, 10, 46, 1, 47], // 17
  [26, 9, 43, 4, 44], // 18
  [26, 3, 44, 11, 45], // 19
  [26, 3, 41, 13, 42] // 20
];

/** بتّات البقايا بعد آخر كلمة — تُملأ أصفارًا. */
export function remainderBits(version: number): number {
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  return 3; // الإصدارات 14..20
}

// ── حقل غالوا GF(256) ────────────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // كثير الحدود الأولي للمواصفة
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

/** كثير حدود المولّد لعدد كلمات تصحيح معيّن. */
function generatorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** كلمات التصحيح لكتلة بيانات — باقي القسمة على كثير حدود المولّد. */
export function reedSolomon(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = generatorPoly(ecCount);
  const rest = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ rest[0]!;
    rest.copyWithin(0, 1);
    rest[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) rest[i] = rest[i]! ^ gfMul(gen[i + 1]!, factor);
    }
  }
  return rest;
}

// ── تيار البتّات ─────────────────────────────────────────────────────
function pushBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
}

export function pickVersion(byteLength: number): number {
  for (let v = 1; v <= EC_M.length; v++) {
    const [, b1, d1, b2, d2] = EC_M[v - 1]!;
    const dataCodewords = b1 * d1 + b2 * d2;
    const header = 4 + (v <= 9 ? 8 : 16);
    if (dataCodewords * 8 >= header + byteLength * 8) return v;
  }
  throw new Error('الحمولة أكبر من طاقة رمز QR المدعومة');
}

/** كلمات الرمز مرتّبة للرسم: تجزئة إلى كتل، تصحيح لكل كتلة، ثم تشبيك. */
export function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const [ecCount, b1, d1, b2, d2] = EC_M[version - 1]!;
  const totalData = b1 * d1 + b2 * d2;

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // نمط البايت
  pushBits(bits, bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(bits, b, 8);

  // الإنهاء: أربع بتّات صفرية أو ما يتّسع، ثم إكمال إلى بايت كامل.
  const capacity = totalData * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalData);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    data[i / 8] = byte;
  }
  // بايتات الحشو المنصوص عليها، بالتناوب.
  for (let i = bits.length / 8, alt = 0; i < totalData; i++, alt++) {
    data[i] = alt % 2 === 0 ? 0xec : 0x11;
  }

  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, size] of [
    [b1, d1],
    [b2, d2]
  ] as const) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      blocks.push(block);
      ecBlocks.push(reedSolomon(block, ecCount));
    }
  }

  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]!);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) out.push(block[i]!);
  }
  return new Uint8Array(out);
}

/** بنية الكتل لإصدار: [كلمات التصحيح، كتل أولى، كلماتها، كتل ثانية، كلماتها]. */
export function blockLayout(version: number): readonly [number, number, number, number, number] {
  return EC_M[version - 1]!;
}
