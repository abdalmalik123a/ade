import { contextBridge, ipcRenderer, webFrame } from 'electron';
import type { DiwanApi, OfficeSettings, Seal } from '@shared/api';
import type { Letterhead, LetterheadLayout } from '@shared/letterhead';
import type { TemplateInput } from '@shared/template';
import type { CitizenInput, IssueInput, TransactionInput } from '@shared/api';

/** الجسر الوحيد بين الواجهة والنظام. لا Node في الواجهة إطلاقًا. */
const invoke = ipcRenderer.invoke.bind(ipcRenderer);

const api: DiwanApi = {
  settings: {
    get: () => invoke('settings:get'),
    set: (patch: Partial<OfficeSettings>) => invoke('settings:set', patch)
  },
  ui: {
    setZoom: (factor: number) => webFrame.setZoomFactor(Math.min(1.5, Math.max(0.8, factor || 1)))
  },
  counts: {
    sidebar: () => invoke('counts:sidebar')
  },
  clients: {
    list: (query?: string) => invoke('clients:list', query ?? ''),
    get: (id: number) => invoke('clients:get', id),
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
  archive: {
    stats: () => invoke('archive:stats'),
    today: () => invoke('archive:today')
  },
  letterheads: {
    list: (opts?: { query?: string; category?: string | null; favoritesOnly?: boolean }) =>
      invoke('letterheads:list', opts ?? {}),
    get: (id: number) => invoke('letterheads:get', id),
    categories: (): Promise<string[]> => invoke('letterheads:categories'),
    save: (input: {
      id: number | null;
      name: string;
      authorityId: number | null;
      layout: LetterheadLayout;
      category?: string | null;
    }): Promise<Letterhead> => invoke('letterheads:save', input),
    duplicate: (id: number, name?: string): Promise<Letterhead | null> =>
      invoke('letterheads:duplicate', id, name),
    favorite: (id: number, on: boolean) => invoke('letterheads:favorite', id, on),
    setDefault: (id: number) => invoke('letterheads:setDefault', id),
    delete: (id: number) => invoke('letterheads:delete', id)
  },
  clips: {
    list: (query?: string) => invoke('clips:list', query ?? ''),
    save: (input: { id: number | null; title: string; body: string; category?: string | null }) =>
      invoke('clips:save', input),
    delete: (id: number) => invoke('clips:delete', id),
    touch: (id: number) => invoke('clips:touch', id)
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
    get: (id: number) => invoke('citizens:get', id),
    save: (input: CitizenInput) => invoke('citizens:save', input),
    usage: (id: number) => invoke('citizens:usage', id),
    delete: (id: number) => invoke('citizens:delete', id),
    exportExcel: (id: number) => invoke('citizens:exportExcel', id)
  },
  attachments: {
    importFile: (citizenId: number, docType: string) =>
      invoke('attachments:importFile', citizenId, docType),
    scan: (citizenId: number, docType: string, dpi: number) =>
      invoke('attachments:scan', citizenId, docType, dpi),
    rename: (id: number, docType: string) => invoke('attachments:rename', id, docType),
    ocr: (id: number) => invoke('attachments:ocr', id),
    print: (id: number) => invoke('attachments:print', id),
    copyToClipboard: (id: number) => invoke('attachments:copy', id),
    exportZip: (citizenId: number) => invoke('attachments:exportZip', citizenId),
    delete: (id: number) => invoke('attachments:delete', id)
  },
  scanner: {
    list: () => invoke('scanner:list'),
    ocrAvailable: () => invoke('scanner:ocrAvailable')
  },
  documents: {
    peekSerial: (prefix: string, year: number) => invoke('documents:peekSerial', prefix, year),
    issue: (input: IssueInput, print: boolean) => invoke('documents:issue', input, print),
    issueTransaction: (input: TransactionInput, print: boolean) =>
      invoke('documents:issueTransaction', input, print),
    issueBatch: (inputs: TransactionInput[], print: boolean) =>
      invoke('documents:issueBatch', inputs, print),
    get: (id: number) => invoke('documents:get', id),
    list: (opts?: { from?: string | null; to?: string | null; query?: string; limit?: number }) =>
      invoke('documents:list', opts ?? {}),
    stats: (opts?: { from?: string | null; to?: string | null }) =>
      invoke('documents:stats', opts ?? {}),
    reprint: (ids: number[], copies: number) => invoke('documents:reprint', ids, copies),
    exportPdf: (id: number) => invoke('documents:exportPdf', id),
    exportReport: (opts: {
      from?: string | null;
      to?: string | null;
      query?: string;
      title?: string;
    }) =>
      invoke('documents:exportReport', opts),
    backup: () => invoke('documents:backup')
  },
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
    saveDocx: (payload: { sheetHtml: string; suggestedName: string; title: string }) =>
      invoke('output:saveDocx', payload)
  },
  templates: {
    list: (category?: string | null, issuing?: string) =>
      invoke('templates:list', category ?? null, issuing ?? 'registered'),
    get: (id: number) => invoke('templates:get', id),
    categories: () => invoke('templates:categories'),
    stats: () => invoke('templates:stats'),
    save: (input: TemplateInput & { doc?: unknown }) => invoke('templates:save', input),
    duplicate: (id: number) => invoke('templates:duplicate', id),
    usage: (id: number) => invoke('templates:usage', id),
    delete: (id: number) => invoke('templates:delete', id),
    doc: (id: number) => invoke('templates:doc', id),
    importFile: () => invoke('templates:importFile'),
    planFolder: () => invoke('templates:planFolder'),
    applyImport: (plan: unknown, choices: unknown) =>
      invoke('templates:applyImport', plan, choices),
    export: (id: number) => invoke('templates:export', id),
    exportLibrary: () => invoke('templates:exportLibrary'),
    restoreLibrary: () => invoke('templates:restoreLibrary'),
    backup: () => invoke('templates:backup')
  },
  learning: {
    stats: () => invoke('learning:stats')
  },
  drafts: {
    list: () => invoke('drafts:list'),
    save: (input: {
      id: number | null;
      templateId: number | null;
      citizenId: number | null;
      title: string;
      values: Record<string, string>;
      bodyHtml: string;
    }) => invoke('drafts:save', input),
    delete: (id: number) => invoke('drafts:delete', id)
  },
  designs: {
    import: (fallback: { w: number; h: number } | null) => invoke('designs:import', fallback)
  },
  files: {
    pickImage: (bucket: string) => invoke('files:pickImage', bucket),
    pickBackground: (bucket: string) => invoke('files:pickBackground', bucket),
    pickImageFolder: (bucket: string) => invoke('files:pickImageFolder', bucket),
    readSheet: () => invoke('files:readSheet'),
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
