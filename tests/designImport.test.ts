import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  EMU_MM,
  POINT_MM,
  TWIP_MM,
  canvasFromImport,
  imageDesign,
  pdfSize,
  readDesign,
  wordDesign
} from '../src/main/services/designImport';
import { psdMeta, readPsd } from '../src/main/services/psd';

// ── ملفاتٌ تُبنى بايتًا بايتًا، فما يُقاس هو القراءة ─────────────────

/** A4 أفقي: ١٦٨٣٨ × ١١٩٠٦ twip. */
function docx(body: string, pgSz = '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'): Uint8Array {
  const document = `<?xml version="1.0"?>
<w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:r="r">
  <w:body>${body}<w:sectPr>${pgSz}</w:sectPr></w:body>
</w:document>`;
  const rels = `<?xml version="1.0"?>
<Relationships><Relationship Id="rId5" Target="media/crest.png"/></Relationships>`;
  return zipSync({
    'word/document.xml': strToU8(document),
    'word/_rels/document.xml.rels': strToU8(rels),
    'word/media/crest.png': new Uint8Array([1, 2, 3, 4])
  });
}

/** مربّعُ نصٍّ مثبّتٌ بموضعه — وهذا ما تُبنى به الشهادات في Word. */
const anchoredText = (xEmu: number, yEmu: number, cx: number, cy: number, text: string) => `
<w:drawing><wp:anchor>
  <wp:positionH relativeFrom="page"><wp:posOffset>${xEmu}</wp:posOffset></wp:positionH>
  <wp:positionV relativeFrom="page"><wp:posOffset>${yEmu}</wp:posOffset></wp:positionV>
  <wp:extent cx="${cx}" cy="${cy}"/>
  <w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent>
</wp:anchor></w:drawing>`;

const anchoredImage = (xEmu: number, yEmu: number, cx: number, cy: number) => `
<w:drawing><wp:anchor>
  <wp:positionH relativeFrom="page"><wp:posOffset>${xEmu}</wp:posOffset></wp:positionH>
  <wp:positionV relativeFrom="page"><wp:posOffset>${yEmu}</wp:posOffset></wp:positionV>
  <wp:extent cx="${cx}" cy="${cy}"/>
  <a:blip r:embed="rId5"/>
</wp:anchor></w:drawing>`;

/** PSD: ترويسةٌ ومَورد `ResolutionInfo`. */
function psd(w: number, h: number, dpi?: number, colorMode = 3, channelValues = [10, 20, 30]): Uint8Array {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(channelValues.length, 12); // قنوات
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(colorMode, 24); // 3=RGB, 4=CMYK, 1=Grayscale

  const color = Buffer.alloc(4); // صفر: لا بيانات صيغة

  let resources = Buffer.alloc(0);
  if (dpi !== undefined) {
    const block = Buffer.alloc(12 + 16);
    block.write('8BIM', 0, 'ascii');
    block.writeUInt16BE(1005, 4);
    block.writeUInt8(0, 6); // اسمٌ فارغ
    block.writeUInt8(0, 7); // حشوٌ إلى زوج
    block.writeUInt32BE(16, 8);
    block.writeUInt32BE(Math.round(dpi * 65536), 12); // ١٦٫١٦ أفقيًّا
    block.writeUInt32BE(Math.round(dpi * 65536), 12 + 8); // وعموديًّا
    resources = block;
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(resources.length);

  const layers = Buffer.alloc(16);
  layers.writeUInt32BE(12, 0);
  layers.writeUInt32BE(8, 4);

  const compression = Buffer.alloc(2); // ٠ = خام
  const px = Buffer.alloc(w * h * channelValues.length);
  for (let c = 0; c < channelValues.length; c++) {
    for (let i = 0; i < w * h; i++) {
      px[c * w * h + i] = channelValues[c]!;
    }
  }

  return Buffer.concat([head, color, length, resources, layers, compression, px]);
}

/**
 * PSD مضغوطٌ بـPackBits — وهو ما يخرج من Photoshop فعلًا.
 *
 * وكل صفٍّ يُرمَّز «كرّر القيمة ن مرّة»: بايتُ عدّادٍ سالب ثم البايت المكرَّر.
 */
function rlePsd(w: number, h: number, channelValues: number[]): Uint8Array {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(channelValues.length, 12);
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(3, 24);

  const color = Buffer.alloc(4);
  const resources = Buffer.alloc(4);
  const layers = Buffer.alloc(16);
  layers.writeUInt32BE(12, 0);
  layers.writeUInt32BE(8, 4);

  const compression = Buffer.alloc(2);
  compression.writeUInt16BE(1); // RLE

  const rows: Buffer[] = [];
  const lengths = Buffer.alloc(h * channelValues.length * 2);
  let at = 0;
  for (const value of channelValues) {
    for (let y = 0; y < h; y++) {
      const row = Buffer.from([256 - (w - 1), value]); // «كرّر w مرّة»
      rows.push(row);
      lengths.writeUInt16BE(row.length, at);
      at += 2;
    }
  }

  return Buffer.concat([head, color, resources, layers, compression, lengths, ...rows]);
}

const pdf = (wPt: number, hPt: number) =>
  strToU8(`%PDF-1.7\n1 0 obj<</Type/Page/MediaBox [0 0 ${wPt} ${hPt}]>>endobj\n%%EOF`);

describe('Word: المقاس بالـtwip والمواضع بالـEMU', () => {
  it('يقرأ مقاس الصفحة ويصحّح الاتجاه', () => {
    const out = wordDesign(docx(''), 'شهادة.docx');
    expect(out.source).toBe('word');
    expect(out.size!.w).toBeCloseTo(16838 * TWIP_MM, 1);
    expect(out.size!.h).toBeCloseTo(11906 * TWIP_MM, 1);
    // A4 أفقي.
    expect(Math.round(out.size!.w)).toBe(297);
    expect(Math.round(out.size!.h)).toBe(210);
  });

  it('وملفٌ عمودي الأبعاد مع `orient="landscape"` يُقلب', () => {
    const out = wordDesign(docx('', '<w:pgSz w:w="11906" w:h="16838" w:orient="landscape"/>'), 'x.docx');
    expect(Math.round(out.size!.w)).toBe(297);
    expect(Math.round(out.size!.h)).toBe(210);
  });

  it('ويقرأ مربّع النصّ بموضعه — لا نصَّه وحده', () => {
    // ٥ سم من اليسار، و٣ سم من الأعلى، بمقاس ١٠×٢ سم.
    const cm = 360000;
    const out = wordDesign(docx(anchoredText(5 * cm, 3 * cm, 10 * cm, 2 * cm, 'شهادة شكر')), 'ش.docx');

    expect(out.elements).toHaveLength(1);
    const el = out.elements[0]!;
    expect(el.inlines?.[0]).toMatchObject({ kind: 'run', text: 'شهادة شكر' });

    // المواضع نِسَبًا: العرض ١٠٠ ملم من ٢٩٧.
    expect(el.box.w).toBeCloseTo(100 / 297, 3);
    expect(el.box.h).toBeCloseTo(20 / 210, 3);
    // والمحور الأفقي من اليمين: ٢٩٧ − (٥٠ + ١٠٠) = ١٤٧ ملم.
    expect(el.box.x).toBeCloseTo(147 / 297, 3);
    expect(el.box.y).toBeCloseTo(30 / 210, 3);
  });

  it('ويستخرج الصورة المثبّتة بعلاقتها', () => {
    const cm = 360000;
    const out = wordDesign(docx(anchoredImage(2 * cm, 2 * cm, 3 * cm, 3 * cm)), 'ش.docx');
    expect(out.images).toHaveLength(1);
    expect(out.images[0]!.name).toBe('crest.png');
    expect(out.elements[0]!.imageIndex).toBe(0);
  });

  it('وملفٌ بلا مربّعاتٍ يُنبَّه عليه ولا يُترك فارغًا', () => {
    const out = wordDesign(docx('<w:p><w:r><w:t>نصٌّ عادي</w:t></w:r></w:p>'), 'ش.docx');
    expect(out.warnings.join(' ')).toContain('مثبّتةً بمواضعها');
    expect(out.elements).toHaveLength(1);
  });

  it('ووحدةُ EMU هي ٩١٤٤٠٠ للإنش', () => {
    expect(914400 * EMU_MM).toBeCloseTo(25.4, 6);
  });
});

describe('Photoshop: المقاس من الترويسة والدقّة من المورد ١٠٠٥', () => {
  it('يقرأ الأبعاد والدقّة', () => {
    const meta = psdMeta(psd(1011, 638, 300))!;
    expect(meta.w).toBe(1011);
    expect(meta.h).toBe(638);
    expect(meta.dpi).toBe(300);
  });

  it('ويبني مقاسًا بالملّم — هوية CR80', () => {
    const out = readDesign(psd(1011, 638, 300), 'هوية.psd');
    expect(out.source).toBe('psd');
    expect(out.size!.w).toBeCloseTo(85.6, 1);
    expect(out.size!.h).toBeCloseTo(54, 1);
  });

  it('وبلا دقّةٍ لا مقاس — فيُسأل المكتب', () => {
    const out = readDesign(psd(1011, 638), 'هوية.psd');
    expect(out.size).toBeNull();
    expect(out.warnings.join(' ')).toContain('اختر المقاس');
  });

  it('وما ليس PSD يُرفض', () => {
    expect(psdMeta(strToU8('ليس PSD'))).toBeNull();
  });

  /**
   * القنواتُ مستوياتٌ لا مشتبكة.
   *
   * وهذا بالضبط ما أخطأت فيه `@webtoon/psd`: أعادت صورةً رماديةً من ملفٍ بلا
   * طبقات — كرّرت القناة الأولى في الثلاث. فالاختبارُ يمسك اللون لا الحجم.
   */
  it('والصورة المسطَّحة تخرج بألوانها — لا رماديةً', () => {
    const read = readPsd(psd(4, 2, 300))!;
    expect(read.rgba).not.toBeNull();
    expect([...read.rgba!.slice(0, 4)]).toEqual([10, 20, 30, 255]);
    expect(read.rgba!.length).toBe(4 * 2 * 4);
  });

  /**
   * وPhotoshop يخزّن CMYK **مقلوبًا**: ٢٥٥ ورقٌ بلا حبر. فالأحمر (M وY كاملان)
   * يُخزَّن [٢٥٥، ٠، ٠، ٢٥٥]. وكان الاختبار يكتبه حبرًا فأجاز قارئًا يُخرج
   * هويّات Photoshop كلّها سالبةً — وكُشف ذلك بملفّات قوالب حقيقية لا بالنظر هنا.
   */
  it('ويقرأ ملفات CMYK كما يخزّنها Photoshop: مقلوبةً', () => {
    const red = readPsd(psd(2, 2, 300, 4, [255, 0, 0, 255]))!;
    expect([...red.rgba!.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    const paper = readPsd(psd(2, 2, 300, 4, [255, 255, 255, 255]))!;
    expect([...paper.rgba!.slice(0, 4)]).toEqual([255, 255, 255, 255]);
    const black = readPsd(psd(2, 2, 300, 4, [255, 255, 255, 0]))!;
    expect([...black.rgba!.slice(0, 4)]).toEqual([0, 0, 0, 255]);
  });

  it('ويقرأ ملفات Grayscale', () => {
    // Gray=128 -> (128, 128, 128, 255)
    const read = readPsd(psd(2, 2, 300, 1, [128]))!;
    expect(read.rgba).not.toBeNull();
    expect([...read.rgba!.slice(0, 4)]).toEqual([128, 128, 128, 255]);
  });

  it('ويفكّ ضغط PackBits كما يفكّ الخام', () => {
    const packed = rlePsd(4, 1, [10, 20, 30]);
    const read = readPsd(packed)!;
    expect([...read.rgba!.slice(0, 8)]).toEqual([10, 20, 30, 255, 10, 20, 30, 255]);
  });
});

describe('PDF: المقاس من `MediaBox` بالنقاط', () => {
  it('يقرأ A4 عموديًّا', () => {
    const size = pdfSize(pdf(595.28, 841.89))!;
    expect(Math.round(size.w)).toBe(210);
    expect(Math.round(size.h)).toBe(297);
  });

  it('وملفًّا بلا `MediaBox` يُسأل عن مقاسه', () => {
    const out = readDesign(strToU8('%PDF-1.7\nبلا صفحة'), 'ملصق.pdf');
    expect(out.size).toBeNull();
    expect(out.warnings.join(' ')).toContain('اختر المقاس');
  });

  it('والنقطةُ ١/٧٢ إنش', () => {
    expect(72 * POINT_MM).toBeCloseTo(25.4, 6);
  });
});

describe('من المستورَد إلى لوحة', () => {
  const png = (w: number, h: number, ppm: number) => {
    const chunk = (type: string, data: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    const phys = Buffer.alloc(9);
    phys.writeUInt32BE(ppm, 0);
    phys.writeUInt32BE(ppm, 4);
    phys.writeUInt8(1, 8);
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('pHYs', phys),
      chunk('IEND', Buffer.alloc(0))
    ]);
  };

  it('صورةٌ وحدها تصير خلفيةً بدقّتها', () => {
    const canvas = canvasFromImport(imageDesign(png(1011, 638, 11811), 'id.png'), ['designs/id.png'])!;
    expect(canvas.background).toEqual({ kind: 'image', src: 'designs/id.png', dpi: 300 });
    expect(canvas.size.w).toBeCloseTo(85.6, 1);
    // الهوية تُقصّ، فالنزف أصلٌ فيها.
    expect(canvas.bleed).toBe(3);
  });

  it('وملفُ Word يصير عناصرَ بمواضعها', () => {
    const cm = 360000;
    const imported = wordDesign(
      docx(anchoredText(5 * cm, 3 * cm, 10 * cm, 2 * cm, 'شهادة شكر') + anchoredImage(cm, cm, cm, cm)),
      'ش.docx'
    );
    const canvas = canvasFromImport(imported, ['designs/crest.png'])!;
    expect(canvas.elements).toHaveLength(2);
    expect(canvas.elements[0]!.kind).toBe('text');
    expect(canvas.elements[1]!.kind).toBe('image');
    // صورةٌ لها موضع ليست خلفية.
    expect(canvas.background.kind).toBe('none');
  });

  it('وما سكت ملفُّه لا يُبنى إلا بمقاسٍ يختاره المكتب', () => {
    const imported = readDesign(psd(1000, 500), 'x.psd');
    expect(canvasFromImport(imported, [])).toBeNull();
    const canvas = canvasFromImport(imported, [], { w: 210, h: 297 })!;
    expect(canvas.size).toEqual({ w: 210, h: 297 });
  });
});
