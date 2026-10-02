/**
 * صورة المعاملة — القنوات: فصل الشخص عن خلفيّته بالنموذج المحلّي، وقوالب المكتب، وقاطه.
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
import { cutout } from '../services/portrait';
import { removeStoreFile } from '../services/scanner';
import { unreferenced } from '../services/storeRefs';
import { importFile, pickOpenPath } from './files';
import { parsePresets, validatePreset, type PhotoPreset } from '@shared/photoPresets';
import { parseCustomSuits, pngTransparency, type CustomSuit } from '@shared/suits';

const MODEL = 'modnet-portrait-q8.onnx';

export function portraitModelPath(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'models', MODEL),
    join(app.getAppPath(), 'resources', 'models', MODEL),
    join(app.getAppPath(), '..', 'resources', 'models', MODEL)
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[1]!;
}

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

  /** الشخص مفصولًا عن خلفيّته: القناع، وألوان الحافّة بلا هالة. */
  ipcMain.handle('photos:cutout', async (_e, input: { pixels: Uint8Array; width: number; height: number }) => {
    const path = portraitModelPath();
    if (!existsSync(path)) throw new Error('نموذج إزالة الخلفية غير مثبّت مع البرنامج');
    if (input.pixels.length !== input.width * input.height * 4) throw new Error('صورةٌ ناقصة');
    return cutout(path, input.pixels, input.width, input.height);
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

  /** «استورد قاطًا»: PNG شفّافة وحدها — والمعتمة يُقال سببها ولا تُستورد. */
  ipcMain.handle('photos:importSuit', async (e): Promise<CustomSuit | null> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const source = await pickOpenPath(win, { title: 'اختر صورة قاطٍ شفّافة', buttonLabel: 'أضف', filterName: 'PNG شفّافة', extensions: ['png'] });
    if (!source) return null;
    const kind = pngTransparency(new Uint8Array(await readFile(source)));
    if (kind === 'not-png') throw new Error('الملف ليس PNG — القاط صورة PNG بخلفيةٍ شفّافة');
    if (kind === 'opaque') throw new Error('الصورة بلا شفافية: خلفيّتها ستغطّي الصورة كلّها — احفظها PNG شفّافة الخلفية والعنق');
    const path = await importFile(source, 'suits');
    const name = source.split(/[\\/]/).pop()!.replace(/\.png$/i, '');
    const suit: CustomSuit = { id: `custom-${Date.now().toString(36)}`, name, path, createdAt: new Date().toISOString() };
    writeSetting('photoSuits', [...parseCustomSuits(readSetting('photoSuits')), suit]);
    return suit;
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
}
