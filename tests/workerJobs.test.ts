/**
 * أعمال العامل المستقلّ بلا Electron (A03، D54): جدوله يُنادى مباشرةً بالنموذجين الحقيقيّين، والنتيجة **مطابقةٌ بايتًا ببايت** لنداء
 * الخدمة نفسها في العملية الرئيسة (`objectCutout`، و`cutout` مع `detectFace`) — فنقل «أزل الخلفية» إلى العامل لا يغيّر ما يعود.
 * و`answer` يردّ بالمعرّف، وما رماه العمل إخفاقٌ برسالته كما هي. ويُتخطّى ما غاب نموذجه.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { answer, JOBS } from '../src/main/worker/index';
import { objectCutout } from '../src/main/services/objectCutout';
import { closePortrait, cutout, detectFace } from '../src/main/services/portrait';
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
});
