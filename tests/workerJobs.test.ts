/**
 * أعمال العامل المستقلّ بلا Electron (A03، D54): جدوله يُنادى مباشرةً بالنموذجين الحقيقيّين، والنتيجة **مطابقةٌ بايتًا ببايت** لنداء
 * الخدمة نفسها في العملية الرئيسة (`objectCutout`، و`cutout` مع `detectFace`) — فنقل «أزل الخلفية» إلى العامل لا يغيّر ما يعود.
 * و`answer` يردّ بالمعرّف، وما رماه العمل إخفاقٌ برسالته كما هي. ويُتخطّى ما غاب نموذجه.
 * و(D56) «استورد تصميمًا»: Photoshop (مسطّحًا وبطبقة نصّ) وWord صغير — الوصف والصور مطابقةٌ لـ`readDesign`/`flattenPsd` مباشرةً،
 * ورأسٌ ٣٠٠٠٠×٣٠٠٠٠ يُرفض برسالة D51 بنصّها.
 * و(D57) قراءة Word نموذجًا: النموذج مطابقٌ لـ`importTemplateFile` مباشرةً بحافظٍ يعطي `letterheadImagePath` (بلا المعرّفات)، والصور بأسمائها
 * وبايتاتها من الحزمة، وملفّ `.doc` وحزمةٌ تالفة إخفاقٌ برسالة النداء المباشر.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { afterAll, describe, expect, it } from 'vitest';
import { answer, JOBS } from '../src/main/worker/index';
import { objectCutout } from '../src/main/services/objectCutout';
import { closePortrait, cutout, detectFace } from '../src/main/services/portrait';
import { readDesign } from '../src/main/services/designImport';
import { flattenPsd } from '../src/main/services/design/flatten';
import { importTemplateFile } from '../src/main/services/import';
import { letterheadImagePath } from '../src/main/services/letterheadImage';
import { withoutIds } from '../src/main/services/revisions';
import { layeredPsd, tysh } from './psdBuilder';
import { readPngRgba } from './helpers';

const MODELS = join(__dirname, '..', 'resources', 'models');
const OBJECT = join(MODELS, 'birefnet-lite-matting-q8.onnx');
const PORTRAIT = join(MODELS, 'modnet-portrait-q8.onnx');
const FACE = join(MODELS, 'face_detection_yunet_2023mar.onnx');
afterAll(() => closePortrait());

/** صورةٌ مولّدة ٣٨٤×٣٨٤: قرصٌ أحمر على جدارٍ متدرّج (كما في `objectCutout.test.ts`). */
function scene(size = 384): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = Math.hypot(x - size * 0.5, y - size * 0.56) < size * 0.27;
      rgba[i] = inside ? 190 : 150 + Math.round((y / size) * 60);
      rgba[i + 1] = inside ? 30 : 160 - Math.round((x / size) * 40);
      rgba[i + 2] = inside ? 35 : 120;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

/** النتيجة بلا زمنها: القناع والألوان بايتًا ببايت. */
const bytes = (r: { alpha: Uint8Array; pixels: Uint8ClampedArray }) => ({ alpha: Buffer.from(r.alpha), pixels: Buffer.from(r.pixels), kind: r.pixels.constructor.name });

describe('أعمال العامل المستقلّ', () => {
  it('«أنا هنا» برقم العملية، والعمل المجهول إخفاقٌ بالمعرّف', async () => {
    expect(await answer({ id: 7, job: 'ping', input: null })).toMatchObject({ type: 'result', id: 7, output: { pid: process.pid } });
    expect(await answer({ id: 8, job: 'nothing' as never, input: null })).toEqual({ type: 'failure', id: 8, message: 'عملٌ غير معروف: nothing' });
  });

  it('ما رماه العمل إخفاقٌ برسالته كما هي', async () => {
    const reply = await answer({ id: 9, job: 'cutoutObject', input: { modelPath: join(MODELS, 'لا-يوجد.onnx'), pixels: new Uint8Array(16), width: 2, height: 2 } });
    expect(reply.type).toBe('failure');
    expect(reply).toHaveProperty('id', 9);
  }, 60_000);

  it.skipIf(!existsSync(OBJECT))('«أزل الخلفية» للأشياء: مطابقٌ لـobjectCutout بايتًا ببايت', async () => {
    const rgba = scene();
    const direct = await objectCutout(OBJECT, rgba, 384, 384);
    const viaJob = await JOBS.cutoutObject({ modelPath: OBJECT, pixels: rgba, width: 384, height: 384 });
    expect(bytes(viaJob)).toEqual(bytes(direct));
    expect(viaJob.pixels).toBeInstanceOf(Uint8ClampedArray);
  }, 60_000);

  it.skipIf(!existsSync(PORTRAIT) || !existsSync(FACE))('«أزل الخلفية» للأشخاص: القناع والألوان والوجه مطابقةٌ للنداء المباشر', async () => {
    const img = readPngRgba(readFileSync(join(__dirname, 'fixtures', 'portrait-generated.png')));
    const rgba = new Uint8Array(img.rgba);
    const direct = await cutout(PORTRAIT, rgba, img.width, img.height);
    const face = await detectFace(FACE, rgba, img.width, img.height);
    const viaJob = await JOBS.cutout({ modelPath: PORTRAIT, facePath: FACE, pixels: rgba, width: img.width, height: img.height });
    expect(bytes(viaJob)).toEqual(bytes(direct));
    expect(face).not.toBeNull();
    expect(viaJob.face).toEqual(face);
  }, 60_000);

  it.skipIf(!existsSync(PORTRAIT))('وبلا نموذج الوجه يُكمل بلا وجه', async () => {
    const rgba = scene(128);
    const viaJob = await JOBS.cutout({ modelPath: PORTRAIT, facePath: null, pixels: rgba, width: 128, height: 128 });
    expect(viaJob.face).toBeNull();
    expect(viaJob.alpha.length).toBe(128 * 128);
  }, 60_000);

  describe('«استورد تصميمًا» (D56)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-workerjobs-'));
    const file = (name: string, bytes: Uint8Array) => {
      const path = join(dir, name);
      writeFileSync(path, bytes);
      return path;
    };
    /** الوصف نصًّا والبايتات base64 — فيُقارن كلّ شيء. */
    const plain = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (x instanceof Uint8Array ? `b64:${Buffer.from(x).toString('base64')}` : x));
    const FONTS = ['Amiri', 'Cairo'];
    const bg = [240, 230, 200];

    it.each([
      ['بلا طبقات', layeredPsd({ w: 40, h: 30, dpi: 300, composite: (x) => (x < 20 ? [200, 30, 30] : bg), layers: [] })],
      [
        'بطبقة نصّ',
        layeredPsd({
          w: 40,
          h: 30,
          dpi: 300,
          composite: () => bg,
          layers: [
            { name: 'BG', rect: { top: 0, left: 0, bottom: 30, right: 40 }, color: () => bg },
            { name: 'الاسم', rect: { top: 10, left: 5, bottom: 20, right: 35 }, color: () => [0, 0, 0], text: tysh('زينب علي حسن', '/EngineDict << /FontSize 8.0 >>') }
          ]
        })
      ]
    ])('Photoshop %s: مطابقٌ للنداء المباشر (والتسطيح حيث يلزم)', async (_label, bytes) => {
      const path = file('بطاقة.psd', bytes);
      const viaJob = await JOBS.readDesign({ path, name: 'بطاقة.psd', fonts: FONTS });
      const imported = readDesign(bytes, 'بطاقة.psd', FONTS);
      const flat = imported.source === 'psd' && !imported.images.length ? flattenPsd(bytes) : null;
      expect(plain(viaJob)).toBe(plain({ imported, flat }));
      expect((viaJob.imported as { source: string }).source).toBe('psd');
    });

    it('Word صغير: مطابقٌ للنداء المباشر، ولا تسطيح', async () => {
      const document = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:r><w:t>شهادة شكر</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr></w:body></w:document>`;
      const bytes = zipSync({ 'word/document.xml': strToU8(document) });
      const path = file('شهادة.docx', bytes);
      const viaJob = await JOBS.readDesign({ path, name: 'شهادة.docx', fonts: FONTS });
      expect(plain(viaJob)).toBe(plain({ imported: readDesign(bytes, 'شهادة.docx', FONTS), flat: null }));
    });

    it('رأسٌ ٣٠٠٠٠×٣٠٠٠٠ ← رسالة D51 بنصّها إخفاقًا', async () => {
      const head = Buffer.alloc(26);
      head.write('8BPS', 0, 'ascii');
      head.writeUInt16BE(1, 4);
      head.writeUInt16BE(3, 12);
      head.writeUInt32BE(30_000, 14);
      head.writeUInt32BE(30_000, 18);
      head.writeUInt16BE(8, 22);
      head.writeUInt16BE(3, 24);
      const path = file('ضخم.psd', Buffer.concat([head, Buffer.alloc(22)]));
      const reply = await answer({ id: 3, job: 'readDesign', input: { path, name: 'ضخم.psd', fonts: [] } });
      expect(reply).toEqual({ type: 'failure', id: 3, message: 'ملفّ Photoshop أكبر من ٢٥ مليون نقطة (٣٠٠٠٠×٣٠٠٠٠) — صغّره ثم استورده' });
    });
  });

  describe('قراءة Word نموذجًا (D57)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-workerjobs-word-'));
    /** المعرّفات عشوائية في كلّ قراءة — فيُقارن ما يُرى (`withoutIds`). */
    const seen = (v: unknown) => withoutIds(JSON.stringify(v));

    it.each(['warning-letter.docx', 'school-warning.docx'])('%s: النموذج مطابقٌ للنداء المباشر، والصور بأسمائها وبايتاتها من الحزمة', async (name) => {
      const path = join(__dirname, 'fixtures', name);
      const named = new Set<string>();
      const direct = await importTemplateFile(path, (bytes, ext) => {
        const at = letterheadImagePath(bytes, ext);
        named.add(at);
        return at;
      });
      const viaJob = await JOBS.readTemplate({ path });
      expect(seen(viaJob.template)).toEqual(seen(direct));

      // كلّ صورةٍ مرّةً باسمها، وبايتاتها ملفٌّ من الحزمة يعطي الاسم نفسه.
      const media = Object.entries(unzipSync(readFileSync(path))).filter(([k]) => k.startsWith('word/media/'));
      expect(viaJob.images.map((i) => i.path).sort()).toEqual([...named].sort());
      expect(viaJob.images.length).toBeGreaterThan(0);
      for (const image of viaJob.images) {
        const from = media.find(([, b]) => Buffer.from(b).equals(Buffer.from(image.bytes)));
        expect(from).toBeDefined();
        expect(letterheadImagePath(from![1], from![0].slice(from![0].lastIndexOf('.')))).toBe(image.path);
      }
      // وكلّ شعارٍ في النموذج له صورةٌ تكتبها الرئيسة.
      const used = new Set(JSON.stringify(viaJob.template).match(/letterheads\/[0-9a-f]{32}\.[a-z0-9]+/g) ?? []);
      expect(used.size).toBeGreaterThan(0);
      for (const at of used) expect(viaJob.images.some((i) => i.path === at)).toBe(true);
    });

    it.each([
      ['ملف .doc', 'قديم.doc', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
      ['حزمةٌ تالفة', 'تالف.docx', strToU8('ليس حزمة Word')]
    ])('%s ← إخفاقٌ برسالة النداء المباشر نفسها', async (_label, name, bytes) => {
      const path = join(dir, name);
      writeFileSync(path, bytes);
      const message = await importTemplateFile(path).then(() => null, (e: unknown) => (e instanceof Error ? e.message : String(e)));
      expect(message).toBeTruthy();
      expect(await answer({ id: 4, job: 'readTemplate', input: { path } })).toEqual({ type: 'failure', id: 4, message });
    });
  });
});
