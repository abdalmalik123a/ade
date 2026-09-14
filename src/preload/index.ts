import { contextBridge, ipcRenderer } from 'electron';
import type { DiwanApi, OfficeSettings } from '@shared/api';

/** الجسر الوحيد بين الواجهة والنظام. لا Node في الواجهة إطلاقًا. */
const api: DiwanApi = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<OfficeSettings>) => ipcRenderer.invoke('settings:set', patch)
  },
  counts: {
    sidebar: () => ipcRenderer.invoke('counts:sidebar')
  },
  printers: {
    list: () => ipcRenderer.invoke('printers:list')
  }
};

contextBridge.exposeInMainWorld('diwan', api);
