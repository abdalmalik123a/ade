import { contextBridge, ipcRenderer } from 'electron';
import type { DiwanApi, OfficeSettings, Seal } from '@shared/api';
import type { Letterhead, LetterheadLayout } from '@shared/letterhead';

/** الجسر الوحيد بين الواجهة والنظام. لا Node في الواجهة إطلاقًا. */
const invoke = ipcRenderer.invoke.bind(ipcRenderer);

const api: DiwanApi = {
  settings: {
    get: () => invoke('settings:get'),
    set: (patch: Partial<OfficeSettings>) => invoke('settings:set', patch)
  },
  counts: {
    sidebar: () => invoke('counts:sidebar')
  },
  printers: {
    list: () => invoke('printers:list')
  },
  archive: {
    stats: () => invoke('archive:stats'),
    today: () => invoke('archive:today')
  },
  letterheads: {
    list: () => invoke('letterheads:list'),
    get: (id: number) => invoke('letterheads:get', id),
    save: (input: {
      id: number | null;
      name: string;
      authorityId: number | null;
      layout: LetterheadLayout;
    }): Promise<Letterhead> => invoke('letterheads:save', input),
    setDefault: (id: number) => invoke('letterheads:setDefault', id),
    delete: (id: number) => invoke('letterheads:delete', id)
  },
  seals: {
    list: (): Promise<Seal[]> => invoke('seals:list'),
    add: (input: { name: string; kind: string; imagePath: string | null }) =>
      invoke('seals:add', input),
    delete: (id: number) => invoke('seals:delete', id)
  },
  citizens: {
    list: (opts?: { query?: string; category?: string | null; limit?: number }) =>
      invoke('citizens:list', opts ?? {}),
    categories: () => invoke('citizens:categories'),
    stats: () => invoke('citizens:stats'),
    get: (id: number) => invoke('citizens:get', id)
  },
  documents: {
    peekSerial: (prefix: string, year: number) => invoke('documents:peekSerial', prefix, year)
  },
  templates: {
    list: (category?: string | null) => invoke('templates:list', category ?? null),
    categories: () => invoke('templates:categories'),
    stats: () => invoke('templates:stats'),
    delete: (id: number) => invoke('templates:delete', id)
  },
  files: {
    pickImage: (bucket: string) => invoke('files:pickImage', bucket),
    saveAs: (payload: {
      data: Uint8Array;
      suggestedName: string;
      filterName: string;
      ext: string;
    }) => invoke('files:saveAs', payload),
    reveal: (path: string) => invoke('files:reveal', path)
  }
};

contextBridge.exposeInMainWorld('diwan', api);
