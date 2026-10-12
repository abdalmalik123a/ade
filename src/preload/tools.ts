/**
 * الجسر — باب الأدوات: الإخراج والطباعة الكبيرة، والملفّات الواصلة ومحرّر PDF، والصور والكاميرا والتصاميم والملفّات (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import { ipcRenderer, webUtils } from 'electron';
import type { DiwanApi, ToolApis } from '@shared/api';
import { invoke } from './invoke';

export const toolsApi: ToolApis = {
  output: {
    print: (payload: {
      sheetHtml: string;
      printer: string | null;
      copies: number;
      silent: boolean;
      page?: { w: number; h: number };
      duplex?: boolean;
    }) => invoke('output:print', payload),
    printCalibration: (printer: string | null) => invoke('output:printCalibration', printer),
    savePdf: (payload: { sheetHtml: string; suggestedName: string; page?: { w: number; h: number } }) =>
      invoke('output:savePdf', payload),
    savePng300: (payload: { sheetHtml: string; suggestedName: string; page?: { w: number; h: number } }) =>
      invoke('output:savePng300', payload),
    saveImage: (payload: Parameters<DiwanApi['output']['saveImage']>[0]) => invoke('output:saveImage', payload),
    saveDocx: (payload: Parameters<DiwanApi['output']['saveDocx']>[0]) => invoke('output:saveDocx', payload),
    printJob: (payload: { label: string; pages: string[]; printer: string | null; page: { w: number; h: number }; duplex: boolean }) =>
      invoke('output:printJob', payload),
    pendingJobs: () => invoke('output:pendingJobs'),
    resumeJob: (id: string, from: number) => invoke('output:resumeJob', id, from),
    discardJob: (id: string) => invoke('output:discardJob', id),
    onPrintProgress: (listener: (p: { id: string; sent: number; total: number }) => void) => {
      const handler = (_e: unknown, p: { id: string; sent: number; total: number }) => listener(p);
      ipcRenderer.on('print:progress', handler);
      return () => ipcRenderer.removeListener('print:progress', handler);
    }
  },
  inbox: {
    list: () => invoke('inbox:list'),
    // مسار الملفّ المُفلَت يُعرف هنا وحده (`webUtils`) — والواجهة لا تراه.
    adopt: (files: File[]) => invoke('inbox:adopt', files.map((f) => webUtils.getPathForFile(f)).filter(Boolean)),
    openPdf: (ids: string[]) => invoke('inbox:openPdf', ids),
    importWord: (id: string) => invoke('inbox:importWord', id),
    toPhotos: (id: string) => invoke('inbox:toPhotos', id)
  },
  pdf: {
    open: () => invoke('pdf:open'),
    scan: () => invoke('pdf:scan'),
    build: (plan: unknown) => invoke('pdf:build', plan),
    assemble: (pages: unknown) => invoke('pdf:assemble', pages),
    shrinkImages: (bytes: Uint8Array, step: { scale: number; quality: number }) => invoke('pdf:shrinkImages', bytes, step),
    save: (bytes: Uint8Array, name: string) => invoke('pdf:save', bytes, name),
    saveMany: (items: unknown) => invoke('pdf:saveMany', items),
    saveImages: (images: unknown) => invoke('pdf:saveImages', images),
    pickLogo: () => invoke('pdf:pickLogo'),
    logos: () => invoke('pdf:logos'),
    close: (ids: string[]) => invoke('pdf:close', ids)
  },
  photos: {
    modelReady: () => invoke('photos:modelReady'),
    clipboardImage: () => invoke('photos:clipboardImage'),
    cutout: (input: { pixels: Uint8Array; width: number; height: number }) => invoke('photos:cutout', input),
    cutoutObject: (input: { pixels: Uint8Array; width: number; height: number }) => invoke('photos:cutoutObject', input),
    presets: () => invoke('photos:presets'),
    savePreset: (preset: unknown) => invoke('photos:savePreset', preset),
    deletePreset: (id: string) => invoke('photos:deletePreset', id),
    suits: () => invoke('photos:suits'),
    importSuit: () => invoke('photos:importSuit'),
    deleteSuit: (id: string) => invoke('photos:deleteSuit', id)
  },
  camera: {
    store: (dataUrl: string) => invoke('camera:store', dataUrl),
    watchFolder: () => invoke('camera:watchFolder'),
    unwatch: () => invoke('camera:unwatch'),
    onShot: (listener: (shot: { dataUrl: string; file: string }) => void) => {
      const handler = (_e: unknown, shot: { dataUrl: string; file: string }) => listener(shot);
      ipcRenderer.on('camera:shot', handler);
      return () => ipcRenderer.removeListener('camera:shot', handler);
    }
  },
  designs: {
    import: (fallback: { w: number; h: number } | null) => invoke('designs:import', fallback)
  },
  files: {
    discardTransient: (paths: string[]) => invoke('files:discardTransient', paths),
    pickImage: (bucket: string) => invoke('files:pickImage', bucket),
    storeImage: (bytes: Uint8Array) => invoke('files:storeImage', bytes),
    storeImageUrl: (url: string) => invoke('files:storeImageUrl', url),
    pickBackground: (bucket: string) => invoke('files:pickBackground', bucket),
    pickImageFolder: (bucket: string) => invoke('files:pickImageFolder', bucket),
    readSheet: (what?: 'imsakiya') => invoke('files:readSheet', what),
    saveAs: (payload: {
      data: Uint8Array;
      suggestedName: string;
      filterName: string;
      ext: string;
    }) => invoke('files:saveAs', payload)
  }
};
