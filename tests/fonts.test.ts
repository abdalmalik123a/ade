/**
 * «خطوط ديوان» (DESIGNS.md ٠٫٧): السجلّ الخالص (`shared/fonts`)، وفحص ملفّ الخطّ قبل قبوله (`fontFile.ts`) —
 * بخطوطٍ حقيقية من الحزم المحزومة (WOFF)، وبها نفسها مفكوكةً إلى TTF.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BUNDLED_FONTS,
  bundledFont,
  cleanFamily,
  familyOf,
  fontFaceCss,
  libraryFonts,
  missingFamilies,
  stackOf,
  suggestFor,
  type ImportedFace
} from '../src/shared/fonts';
import { bufferReader, readFontInfo } from '../src/main/services/fontFile';

const woff = (pkg: string, file: string) => readFileSync(join(__dirname, '..', 'node_modules', '@fontsource', pkg, 'files', file));

/** WOFF ← TTF كما في ملفّ Windows: الجداول مفكوكةً ومصفوفةً على ٤ بايتات. */
function woffToSfnt(w: Buffer): Buffer {
  const flavor = w.readUInt32BE(4);
  const n = w.readUInt16BE(12);
  const tables = Array.from({ length: n }, (_, i) => {
    const at = 44 + i * 20;
    const tag = w.subarray(at, at + 4);
    const offset = w.readUInt32BE(at + 4);
    const comp = w.readUInt32BE(at + 8);
    const orig = w.readUInt32BE(at + 12);
    const raw = w.subarray(offset, offset + comp);
    return { tag, data: comp < orig ? inflateSync(raw) : Buffer.from(raw) };
  });
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(flavor, 0);
  head.writeUInt16BE(n, 4);
  let offset = head.length;
  const bodies: Buffer[] = [];
  tables.forEach((t, i) => {
    t.tag.copy(head, 12 + i * 16);
    head.writeUInt32BE(offset, 12 + i * 16 + 8);
    head.writeUInt32BE(t.data.length, 12 + i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(t.data.length / 4) * 4);
    t.data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([head, ...bodies]);
}

describe('ملفّ الخطّ يُفحص قبل قبوله', () => {
  it('WOFF: العائلة والوزن والميل والعربية', () => {
    expect(readFontInfo(bufferReader(woff('amiri', 'amiri-arabic-400-normal.woff')))).toEqual({
      format: 'woff', family: 'Amiri', subfamily: 'Regular', weight: 400, italic: false, arabic: true
    });
    expect(readFontInfo(bufferReader(woff('amiri', 'amiri-arabic-700-italic.woff')))).toMatchObject({ weight: 700, italic: true });
    expect(readFontInfo(bufferReader(woff('lalezar', 'lalezar-latin-400-normal.woff'))).arabic).toBe(false);
  });

  it('وTTF مفكوكًا من الخطّ نفسه يُقرأ مثله', () => {
    const ttf = woffToSfnt(woff('noto-naskh-arabic', 'noto-naskh-arabic-arabic-700-normal.woff'));
    expect(readFontInfo(bufferReader(ttf))).toEqual({ format: 'ttf', family: 'Noto Naskh Arabic', subfamily: 'Bold', weight: 700, italic: false, arabic: true });
  });

  it('وما ليس خطًّا أو فسد يُرفض بسببه — لا يُقبل ولا يُسقط', () => {
    const ttf = woffToSfnt(woff('amiri', 'amiri-arabic-400-normal.woff'));
    const reject = (buf: Buffer) => {
      try {
        readFontInfo(bufferReader(buf));
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(reject(Buffer.from('not a font at all, just text'))).toContain('ليس ملفّ خطّ');
    expect(reject(Buffer.alloc(5))).toContain('أقصر من رأسه');
    expect(reject(Buffer.concat([Buffer.from('ttcf'), Buffer.alloc(40)]))).toContain('TTC');
    expect(reject(Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(60)]))).toContain('WOFF2');
    expect(reject(ttf.subarray(0, 200))).toMatch(/خارج حدود الملفّ|مقطوع/);
    // جدولٌ يشير إلى ما بعد آخر الملفّ.
    const broken = Buffer.from(ttf);
    broken.writeUInt32BE(ttf.length + 10, 12 + 8);
    expect(reject(broken)).toContain('خارج حدود الملفّ');
    // بلا جدول الأسماء.
    const noName = Buffer.from(ttf);
    const n = noName.readUInt16BE(4);
    for (let i = 0; i < n; i++) if (noName.toString('latin1', 12 + i * 16, 16 + i * 16) === 'name') noName.write('nam_', 12 + i * 16, 'latin1');
    expect(reject(noName)).toContain('«name»');
  });
});

describe('سجلّ خطوط ديوان', () => {
  it('الاسم نظيفٌ لا يكسر النمط المضمَّن', () => {
    expect(cleanFamily("'Simplified Arabic'")).toBe('Simplified Arabic');
    expect(cleanFamily("x';color:red;background:url(evil)")).toBe('xcolorredbackgroundurlevil');
    expect(cleanFamily('  خط   الديواني  ')).toBe('خط الديواني');
    expect(cleanFamily(42)).toBe('');
    expect(cleanFamily('a'.repeat(100))).toHaveLength(64);
  });

  it('أوّل عائلةٍ في السلسلة، والعامّة ليست عائلة', () => {
    expect(familyOf("'Amiri', serif")).toBe('Amiri');
    expect(familyOf('"Simplified Arabic",serif')).toBe('Simplified Arabic');
    expect(familyOf('serif')).toBe('');
    expect(familyOf(undefined)).toBe('');
  });

  it('السلسلة باحتياط صنفها', () => {
    expect(stackOf('Amiri')).toBe("'Amiri', serif");
    expect(stackOf('cairo')).toBe("'cairo', sans-serif");
    expect(stackOf('Simplified Arabic')).toBe("'Simplified Arabic', serif");
    expect(bundledFont('noto naskh arabic')?.family).toBe('Noto Naskh Arabic');
  });

  it('الغائب يُقال باسمه مرّةً — بلا اعتبارٍ للحالة ولا للعامّة', () => {
    const have = BUNDLED_FONTS.map((f) => f.family);
    expect(missingFamilies(['Amiri', 'amiri', 'serif', 'Simplified Arabic', 'simplified arabic', 'Tahoma'], have)).toEqual(['Simplified Arabic', 'Tahoma']);
    expect(missingFamilies(['Simplified Arabic'], [...have, 'Simplified Arabic'])).toEqual([]);
  });

  it('وبديله يُقترح من أقرب المحزوم', () => {
    expect(suggestFor('Simplified Arabic')).toBe('Noto Naskh Arabic');
    expect(suggestFor('Traditional Arabic')).toBe('Amiri');
    expect(suggestFor('Arial')).toBe('Cairo');
    expect(suggestFor('PT Bold Kufi')).toBe('Noto Kufi Arabic');
    expect(suggestFor('خط مجهول')).toBe('Noto Naskh Arabic');
  });

  it('المكتبة: المحزوم ثم المستورد بأوزانه، ولا يُكرَّر المحزوم', () => {
    const face = (family: string, weight: number, id: number): ImportedFace => ({
      id, family, weight, italic: false, file: `fonts/${'a'.repeat(31)}${id}.ttf`, source: 'windows', originalName: 'x.ttf', createdAt: ''
    });
    const lib = libraryFonts([face('Simplified Arabic', 700, 1), face('Simplified Arabic', 400, 2), face('Amiri', 400, 3)]);
    expect(lib.slice(0, BUNDLED_FONTS.length)).toEqual(BUNDLED_FONTS);
    expect(lib.slice(BUNDLED_FONTS.length)).toEqual([{ family: 'Simplified Arabic', label: 'Simplified Arabic', category: 'naskh', source: 'imported', weights: [400, 700] }]);
  });

  it('@font-face للمستورد وحده بمساره في المخزن — وما سواه يسقط', () => {
    const css = fontFaceCss([
      { family: 'Simplified Arabic', weight: 700, italic: false, file: 'fonts/0123456789abcdef0123456789abcdef.ttf' },
      { family: "x'}body{color:red", weight: 400, italic: true, file: 'fonts/0123456789abcdef0123456789abcdef.otf' },
      { family: 'Bad', weight: 400, italic: false, file: '../license.json' },
      { family: 'Bad', weight: 400, italic: false, file: 'fonts/abc.ttf' }
    ]);
    expect(css.split('\n')).toEqual([
      "@font-face{font-family:'Simplified Arabic';src:url('diwan://store/fonts/0123456789abcdef0123456789abcdef.ttf');font-weight:700;font-style:normal;font-display:block}",
      "@font-face{font-family:'xbodycolorred';src:url('diwan://store/fonts/0123456789abcdef0123456789abcdef.otf');font-weight:400;font-style:italic;font-display:block}"
    ]);
  });
});
