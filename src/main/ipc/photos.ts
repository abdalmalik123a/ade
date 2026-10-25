/**
 * صورة المعاملة — القنوات: فصل الشخص عن خلفيّته بالنموذج المحلّي (ووجهه وذقنه بنموذج الوجه)، وقوالب المكتب، وقاطه.
 *
 * النموذج في `resources/models` كبيانات القارئ الضوئي: في المثبّت خارج الحزمة (`extraResources`)،
 * وفي التطوير من المستودع. والصورة تأتي بكسلاتٍ من الواجهة وتعود قناعًا — لا ملفّ يُكتب ولا شبكة.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, clipboard, ipcMain } from 'electron';
import { getDb, storeDir } from '../db';
import { workerHost } from '../services/workerHost';
import { removeStoreFile } from '../services/scanner';
import { unreferenced } from '../services/storeRefs';
import { importFile, pickOpenPath, pickSavePath } from './files';
import { getCitizen, saveCitizen, addAttachment } from '../services/citizens';
import { parsePresets, validatePreset, type PhotoPreset } from '@shared/photoPresets';
import { parseCustomSuits, pngTransparency, type CustomSuit, type SuitImport } from '@shared/suits';
import type { Guard } from '@shared/bridgeGuards';
import { writePng } from '../services/png';
import { handleChecked } from './checked';

type PreparedSuit = { name: string; rgba: Uint8Array; width: number; height: number };
/**
 * القاط المحضَّر في الواجهة (S39): اسمٌ وبكسلاتٌ بطول العرض×الطول×٤، والبعدان ٤٠٠٠ على الأكثر.
 * والاسم من اسم الملفّ بلا قصّ — فيُقبل أيًّا كان طوله ويقصّه المعالج (D171: كان اسمٌ أطول من ٢٠٠ حرف يُسقط الاستيراد).
 */
const preparedSuit: Guard<PreparedSuit> = (value, name) => {
  const s = value as Partial<PreparedSuit> | null;
  const side = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 4000;
  const shaped =
    typeof value === 'object' && s !== null && typeof s.name === 'string' && side(s.width) && side(s.height) &&
    s.rgba instanceof Uint8Array && s.rgba.length === s.width! * s.height! * 4;
  if (!shaped) throw new Error(`المعامل «${name}» صورة قاطٍ محضَّرة`);
  return value as PreparedSuit;
};

const MODEL = 'modnet-portrait-q8.onnx';
/** نموذج الأشياء (DESIGNS.md ٢٫٣) — للتصاميم؛ والأشخاص لـMODNet. */
const OBJECT_MODEL = 'birefnet-lite-matting-q8.onnx';
/** نموذج الوجه (YuNet): الذقن الحقيقيّ للياقة و«رمّم» ودليل الرأس (إصلاح البند ٣٩). */
const FACE_MODEL = 'face_detection_yunet_2023mar.onnx';
/** نموذج الكتفين (RTMPose-t، S45 D173): نقطتاهما يُلبس بهما القاط بعرضهما وزاويتهما (D174). */
const POSE_MODEL = 'rtmpose-t-body7-256x192.onnx';

function modelPath(file: string): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'models', file),
    join(app.getAppPath(), 'resources', 'models', file),
    join(app.getAppPath(), '..', 'resources', 'models', file)
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[1]!;
}

export const portraitModelPath = (): string => modelPath(MODEL);

const readSetting = (key: string): string | null =>
  (getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;

const writeSetting = (key: string, value: unknown): void => {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, JSON.stringify(value));
};

export function registerPhotoIpc(): void {
  ipcMain.handle('photos:modelReady', () => existsSync(portraitModelPath()));

  /**
   * الشخص مفصولًا عن خلفيّته: القناع، وألوان الحافّة بلا هالة — ووجهه وذقنه إن وُجد. وتعذّر الوجه لا يُفشل الفصل: تبقى
   * المعالم على تقدير القناع كما كانت.
   */
  ipcMain.handle('photos:cutout', async (_e, input: { pixels: Uint8Array; width: number; height: number }) => {
    const path = portraitModelPath();
    if (!existsSync(path)) throw new Error('نموذج إزالة الخلفية غير مثبّت مع البرنامج');
    if (input.pixels.length !== input.width * input.height * 4) throw new Error('صورةٌ ناقصة');
    const facePath = modelPath(FACE_MODEL);
    const posePath = modelPath(POSE_MODEL);
    // في العامل المستقلّ وحده (A03، D54، A18) فلا تتجمّد الرئيسة ولا تُفتح فيها النماذج.
    const job = {
      modelPath: path,
      facePath: existsSync(facePath) ? facePath : null,
      posePath: existsSync(posePath) ? posePath : null,
      pixels: input.pixels,
      width: input.width,
      height: input.height
    };
    return workerHost().run('cutout', job);
  });

  /** الشيء مفصولًا عن خلفيّته (المنتج والكوب والشعار في التصاميم) — بنموذج الأشياء وحده. */
  ipcMain.handle('photos:cutoutObject', async (_e, input: { pixels: Uint8Array; width: number; height: number }) => {
    const path = modelPath(OBJECT_MODEL);
    if (!existsSync(path)) throw new Error('نموذج إزالة خلفية الأشياء غير مثبّت مع البرنامج');
    if (input.pixels.length !== input.width * input.height * 4) throw new Error('صورةٌ ناقصة');
    return workerHost().run('cutoutObject', { modelPath: path, pixels: input.pixels, width: input.width, height: input.height });
  });

  /** صورةٌ في الحافظة (من واتساب الحاسوب أو المتصفّح) تُحفظ في المخزن كأيّ صورةٍ تُفتح. */
  ipcMain.handle('photos:clipboardImage', async (): Promise<string | null> => {
    for (const item of await clipboard.read()) {
      const type = item.types.find((t) => t === 'image/png' || t === 'image/jpeg');
      if (!type) continue;
      const blob = (await item.getType(type)) as Blob;
      const bytes = Buffer.from(await blob.arrayBuffer());
      const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${type === 'image/png' ? 'png' : 'jpg'}`;
      await writeFile(join(storeDir('photos'), name), bytes);
      return `photos/${name}`;
    }
    return null;
  });

  ipcMain.handle('photos:presets', (): PhotoPreset[] => parsePresets(readSetting('photoPresets')));

  ipcMain.handle('photos:savePreset', (_e, preset: PhotoPreset): PhotoPreset[] => {
    const why = validatePreset(preset);
    if (why) throw new Error(why);
    const list = parsePresets(readSetting('photoPresets')).filter((p) => p.id !== preset.id);
    const next = [...list, { ...preset, builtin: false }];
    writeSetting('photoPresets', next);
    return next;
  });

  ipcMain.handle('photos:deletePreset', (_e, id: string): PhotoPreset[] => {
    const next = parsePresets(readSetting('photoPresets')).filter((p) => p.id !== id);
    writeSetting('photoPresets', next);
    return next;
  });

  ipcMain.handle('photos:suits', (): CustomSuit[] => parseCustomSuits(readSetting('photoSuits')));

  const addCustomSuit = (name: string, path: string): CustomSuit => {
    const suit: CustomSuit = { id: `custom-${Date.now().toString(36)}`, name, path, createdAt: new Date().toISOString() };
    writeSetting('photoSuits', [...parseCustomSuits(readSetting('photoSuits')), suit]);
    return suit;
  };

  /**
   * «استورد قاطًا» (S39): PNG شفّافة تُضاف كما هي — وغيرها (JPG وWebP وBMP، وPNG معتمة) تعود بايتاتٍ تُحضَّر في الواجهة
   * (`suitMatte.ts` بعد أن يفكّها Chromium) ثم تُضاف بـ`photos:addSuit`.
   */
  ipcMain.handle('photos:importSuit', async (e): Promise<SuitImport | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const source = await pickOpenPath(win, { title: 'اختر صورة قاط', buttonLabel: 'أضف', filterName: 'صور', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] });
    if (!source) return null;
    const bytes = new Uint8Array(await readFile(source));
    const name = source.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '');
    if (pngTransparency(bytes) !== 'ok') return { prepare: { name, bytes } };
    return { suit: addCustomSuit(name, await importFile(source, 'suits')) };
  });

  /** القاط بعد تحضيره في الواجهة: PNG شفّاف في المخزن باسم بصمته (كـ`storePasted`)، ويُضاف إلى قاط المكتب. */
  handleChecked('photos:addSuit', { suit: preparedSuit }, async ({ suit }): Promise<CustomSuit> => {
    const png = writePng(suit.rgba, suit.width, suit.height);
    const file = `${createHash('sha256').update(png).digest('hex').slice(0, 32)}.png`;
    await writeFile(join(storeDir('suits'), file), png);
    return addCustomSuit(suit.name.trim().slice(0, 80) || 'قاط', `suits/${file}`);
  });

  ipcMain.handle('photos:deleteSuit', async (_e, id: string): Promise<CustomSuit[]> => {
    const list = parseCustomSuits(readSetting('photoSuits'));
    const gone = list.find((s) => s.id === id);
    const next = list.filter((s) => s.id !== id);
    writeSetting('photoSuits', next);
    // قاطٌ استُورد مرّتين ملفٌّ واحد (المخزن باسم البصمة): لا يُحذف ما بقي له مرجع.
    await Promise.all(unreferenced(getDb(), [gone?.path]).map(removeStoreFile));
    return next;
  });

  /** فتح صورة شخصية من القرص بمصادقة بوّابة الترخيص. */
  ipcMain.handle('photos:pickPhoto', async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const source = await pickOpenPath(win, {
      title: 'اختر صورة شخصية',
      buttonLabel: 'إدراج',
      filterName: 'صور',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
    });
    return source ? importFile(source, 'photos') : null;
  });

  /** حفظ صورة ملصوقة عبر الواجهة في المخزن. */
  ipcMain.handle('photos:storePasted', async (_e, dataUrl: string): Promise<string> => {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || !matches[2]) throw new Error('صيغة الصورة غير صالحة');
    const buffer = Buffer.from(matches[2], 'base64');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const ext = matches[1]?.includes('png') ? '.png' : '.jpg';
    const name = `${hash}${ext}`;
    await writeFile(join(storeDir('photos'), name), buffer);
    return `photos/${name}`;
  });

  /** حفظ ورقة المراجعة المؤقتة للطباعة بمصادقة البوّابة. */
  ipcMain.handle('photos:storeReview', async (_e, dataUrl: string): Promise<string> => {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || !matches[2]) throw new Error('صيغة الصورة غير صالحة');
    const buffer = Buffer.from(matches[2], 'base64');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const ext = matches[1]?.includes('png') ? '.png' : '.jpg';
    const name = `${hash}${ext}`;
    await writeFile(join(storeDir('photos'), name), buffer);
    return `photos/${name}`;
  });

  /** حفظ الصورة الشخصية الناتجة في ملف خارجي. */
  ipcMain.handle(
    'photos:saveImage',
    async (
      e,
      payload: { data: Uint8Array; suggestedName: string; filterName: string; ext: string }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const path = await pickSavePath(win, {
        title: 'حفظ الصورة الشخصية',
        defaultName: payload.suggestedName,
        filterName: payload.filterName,
        ext: payload.ext
      });
      if (!path) return null;
      await writeFile(path, Buffer.from(payload.data));
      return path;
    }
  );

  /** حفظ الصورة الشخصية الناتجة للرفع. */
  ipcMain.handle(
    'photos:saveUpload',
    async (
      e,
      payload: { data: Uint8Array; suggestedName: string; filterName: string; ext: string }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win) return null;
      const path = await pickSavePath(win, {
        title: 'حفظ الصورة للرفع',
        defaultName: payload.suggestedName,
        filterName: payload.filterName,
        ext: payload.ext
      });
      if (!path) return null;
      await writeFile(path, Buffer.from(payload.data));
      return path;
    }
  );

  /** حفظ الصورة الشخصية مباشرة في ملف المواطن وسجل مستمسكاته. */
  ipcMain.handle(
    'photos:saveToCitizen',
    async (
      _e,
      payload: { citizenId: number; dataUrl: string; label: string }
    ): Promise<{ photoPath: string; attachmentId: number; fullName: string }> => {
      const matches = payload.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || !matches[2]) throw new Error('صيغة الصورة غير صالحة');
      const buffer = Buffer.from(matches[2], 'base64');
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
      const ext = matches[1]?.includes('png') ? '.png' : '.jpg';
      const name = `${hash}${ext}`;
      await writeFile(join(storeDir('photos'), name), buffer);
      const relative = `photos/${name}`;

      const db = getDb();
      const citizen = getCitizen(db, payload.citizenId);
      if (!citizen) throw new Error('المواطن غير موجود في السجل');

      const { attachments: _attachments, documents: _documents, ...input } = citizen;
      saveCitizen(db, { ...input, photoPath: relative });
      const att = addAttachment(db, {
        citizenId: payload.citizenId,
        docType: payload.label,
        filePath: relative,
        fileFormat: ext.slice(1).toUpperCase(),
        dpi: null,
        sha256: createHash('sha256').update(buffer).digest('hex')
      });
      return { photoPath: relative, attachmentId: att.id, fullName: citizen.fullName };
    }
  );
}
