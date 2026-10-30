/**
 * نسخة متجر مايكروسوفت تتحدّث من المتجر وحده (D242): قناتا «ثبّت تحديثًا» ترفضان قبل أن تفحصا ملفًّا أو تشغّلا مثبّتًا،
 * ونسخة exe كما كانت. والعلامة `process.windowsStore` يضعها Electron في حزمة MSIX.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  app: { getVersion: () => '2.0.0', getPath: () => '' },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {},
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) }
}));

const store = (on: boolean | undefined) => ((process as { windowsStore?: boolean }).windowsStore = on);

describe('التحديث في نسخة المتجر (D242)', () => {
  afterEach(() => store(undefined));

  it('fromStore من process.windowsStore وحده', async () => {
    const { fromStore } = await import('../src/main/ipc/update');
    store(true);
    expect(fromStore()).toBe(true);
    store(undefined);
    expect(fromStore()).toBe(false);
  });

  it('وفي المتجر: «افحصه» و«ثبّت» يرفضان بجملة المتجر قبل أيّ ملفّ', async () => {
    const { registerUpdateIpc } = await import('../src/main/ipc/update');
    registerUpdateIpc();
    store(true);
    await expect(Promise.resolve().then(() => handlers.get('update:pick')!({ sender: {} }))).rejects.toThrow('من المتجر وحده');
    await expect(Promise.resolve().then(() => handlers.get('update:install')!({}, 'x.diwanupdate'))).rejects.toThrow('من المتجر وحده');
    store(undefined);
    // وفي exe: «افحصه» بلا نافذةٍ يعيد null كما كان، لا جملة المتجر.
    await expect(Promise.resolve().then(() => handlers.get('update:pick')!({ sender: {} }))).resolves.toBeNull();
  });
});
