/**
 * الجسر — باب المكتب: الإعدادات والواجهة والعدّادات والزبائن والطلبات والطابعات، والبحث والتنبيهات والمعلّقة والجنس، والنسخ الاحتياطي والتحديث والتفعيل وحزمة المحتوى (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import { ipcRenderer, webFrame } from 'electron';
import type { OfficeApis, OfficeSettings } from '@shared/api';
import { invoke } from './invoke';

export const officeApi: OfficeApis = {
  settings: {
    get: () => invoke('settings:get'),
    set: (patch: Partial<OfficeSettings>) => invoke('settings:set', patch)
  },
  ui: {
    setZoom: (factor: number) => webFrame.setZoomFactor(Math.min(1.5, Math.max(0.8, factor || 1))),
    info: () => invoke('app:info'),
    copyText: (text: string) => invoke('app:copyText', text),
    pasteText: () => invoke('app:pasteText'),
    onError: (listener: (message: string) => void) => {
      const handler = (_e: unknown, message: string) => listener(message);
      ipcRenderer.on('app:error', handler);
      return () => ipcRenderer.removeListener('app:error', handler);
    },
    onClosing: (listener: (info: { backup: boolean }) => void) => {
      const handler = (_e: unknown, info?: { backup?: boolean }) => listener({ backup: Boolean(info?.backup) });
      ipcRenderer.on('app:closing', handler);
      return () => ipcRenderer.removeListener('app:closing', handler);
    },
    closeReady: () => ipcRenderer.send('app:closeReady'),
    requestClose: () => ipcRenderer.send('app:requestClose'),
    setUnsaved: (label: string | null) => ipcRenderer.send('app:unsaved', label)
  },
  counts: {
    sidebar: () => invoke('counts:sidebar')
  },
  clients: {
    list: (query?: string) => invoke('clients:list', query ?? ''),
    save: (input: unknown) => invoke('clients:save', input),
    setLogo: (id: number, imagePath: string) => invoke('clients:setLogo', id, imagePath),
    delete: (id: number) => invoke('clients:delete', id)
  },
  orders: {
    list: (filter?: unknown) => invoke('orders:list', filter ?? {}),
    get: (id: number) => invoke('orders:get', id),
    save: (input: unknown) => invoke('orders:save', input),
    setStatus: (id: number, status: string) => invoke('orders:setStatus', id, status),
    delete: (id: number) => invoke('orders:delete', id)
  },
  printers: {
    list: () => invoke('printers:list')
  },
  search: {
    others: (query) => invoke('search:others', query)
  },
  today: {
    agenda: () => invoke('today:agenda'),
    weekSeen: () => invoke('today:weekSeen')
  },
  service: {
    parked: () => invoke('service:parked'),
    setParked: (list: unknown[]) => invoke('service:setParked', list)
  },
  fillCard: {
    open: (citizenId) => invoke('fillcard:open', citizenId)
  },
  gender: {
    learned: () => invoke('gender:learned'),
    learn: (answers) => invoke('gender:learn', answers)
  },
  backup: {
    create: (password) => invoke('backup:create', password ?? null),
    pick: () => invoke('backup:pick'),
    inspect: (path, password) => invoke('backup:inspect', path, password ?? null),
    restore: (path, password) => invoke('backup:restore', path, password ?? null),
    autoGet: () => invoke('backup:autoGet'),
    autoPickDir: () => invoke('backup:autoPickDir'),
    autoSet: (config) => invoke('backup:autoSet', config),
    autoRun: () => invoke('backup:autoRun'),
    autoAdopt: () => invoke('backup:autoAdopt'),
    mirrorPick: () => invoke('backup:mirrorPick'),
    mirrorInspect: (path, password, snapshot) => invoke('backup:mirrorInspect', path, password ?? null, snapshot ?? null),
    mirrorRestore: (path, password, snapshot) => invoke('backup:mirrorRestore', path, password ?? null, snapshot ?? null)
  },
  update: {
    pick: () => invoke('update:pick'),
    install: (path) => invoke('update:install', path),
    whatsNew: () => invoke('app:whatsNew')
  },
  license: {
    status: () => invoke('license:status'),
    activate: (key) => invoke('license:activate', key)
  },
  content: {
    export: (designs?: number[]) => invoke('content:export', designs),
    import: () => invoke('content:import'),
    bundled: () => invoke('content:bundled'),
    importBundled: (id: string) => invoke('content:importBundled', id)
  }
};
