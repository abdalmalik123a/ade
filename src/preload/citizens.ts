/**
 * الجسر — باب المواطنين: ملفّ المواطن ومستمسكاته والماسح (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import type { CitizenApis, CitizenInput } from '@shared/api';
import { invoke } from './invoke';

export const citizensApi: CitizenApis = {
  citizens: {
    list: (opts?: { query?: string; category?: string | null; limit?: number }) =>
      invoke('citizens:list', opts ?? {}),
    categories: () => invoke('citizens:categories'),
    stats: () => invoke('citizens:stats'),
    get: (id: number) => invoke('citizens:get', id),
    records: (ids: number[]) => invoke('citizens:records', ids),
    save: (input: CitizenInput) => invoke('citizens:save', input),
    usage: (id: number) => invoke('citizens:usage', id),
    delete: (id: number) => invoke('citizens:delete', id),
    exportExcel: (id: number) => invoke('citizens:exportExcel', id),
    importPlan: (rows: unknown[], opts: unknown) => invoke('citizens:importPlan', rows, opts),
    import: (rows: unknown[], opts: unknown) => invoke('citizens:import', rows, opts),
    importMap: () => invoke('citizens:importMap'),
    setImportMap: (map: unknown) => invoke('citizens:setImportMap', map)
  },
  attachments: {
    importFile: (citizenId: number, docType: string) =>
      invoke('attachments:importFile', citizenId, docType),
    scan: (citizenId: number, docType: string, dpi: number) =>
      invoke('attachments:scan', citizenId, docType, dpi),
    addFromDataUrl: (citizenId: number, docType: string, dataUrl: string) =>
      invoke('attachments:addFromDataUrl', citizenId, docType, dataUrl),
    rename: (id: number, docType: string) => invoke('attachments:rename', id, docType),
    ocr: (id: number) => invoke('attachments:ocr', id),
    readMrz: (id: number) => invoke('attachments:readMrz', id),
    print: (id: number, printer: string | null) => invoke('attachments:print', id, printer),
    copyToClipboard: (id: number) => invoke('attachments:copy', id),
    exportZip: (citizenId: number) => invoke('attachments:exportZip', citizenId),
    delete: (id: number) => invoke('attachments:delete', id)
  },
  scanner: {
    list: () => invoke('scanner:list'),
    scanImage: (dpi: number) => invoke('scanner:scanImage', dpi),
    ocrAvailable: () => invoke('scanner:ocrAvailable')
  }
};
