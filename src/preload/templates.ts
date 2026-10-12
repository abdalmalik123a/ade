/**
 * الجسر — باب النماذج: الترويسات والكليشات والنسخ والأختام والنماذج والتعلّم والمسودّات وبنك الأسئلة (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import type { TemplateApis, Seal } from '@shared/api';
import type { Letterhead, LetterheadLayout } from '@shared/letterhead';
import type { TemplateInput } from '@shared/template';
import { invoke } from './invoke';

export const templatesApi: TemplateApis = {
  letterheads: {
    list: (opts?: { query?: string; category?: string | null; favoritesOnly?: boolean }) =>
      invoke('letterheads:list', opts ?? {}),
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
    save: (input) => invoke('clips:save', input),
    delete: (id: number) => invoke('clips:delete', id),
    touch: (id: number) => invoke('clips:touch', id),
    repeated: (paragraphs) => invoke('clips:repeated', paragraphs)
  },
  revisions: {
    list: (kind, id) => invoke('revisions:list', kind, id),
    get: (kind, id, revision) => invoke('revisions:get', kind, id, revision)
  },
  seals: {
    list: (): Promise<Seal[]> => invoke('seals:list'),
    add: (input: { name: string; kind: string; imagePath: string | null }) =>
      invoke('seals:add', input),
    delete: (id: number) => invoke('seals:delete', id)
  },
  templates: {
    list: (category?: string | null, issuing?: string) =>
      invoke('templates:list', category ?? null, issuing ?? 'registered'),
    get: (id: number) => invoke('templates:get', id),
    categories: (issuing?: 'registered' | 'print-only') => invoke('templates:categories', issuing),
    stats: () => invoke('templates:stats'),
    save: (input: TemplateInput & { doc?: unknown }) => invoke('templates:save', input),
    duplicate: (id: number) => invoke('templates:duplicate', id),
    usage: (id: number) => invoke('templates:usage', id),
    delete: (id: number) => invoke('templates:delete', id),
    doc: (id: number) => invoke('templates:doc', id),
    importFile: () => invoke('templates:importFile'),
    pickPaper: () => invoke('templates:pickPaper'),
    readPaper: (png: Uint8Array, dpi: number | null) => invoke('templates:readPaper', png, dpi),
    planFolder: () => invoke('templates:planFolder'),
    planExcel: () => invoke('templates:planExcel'),
    saveCensus: () => invoke('templates:saveCensus'),
    applyImport: (plan: unknown, choices: unknown) =>
      invoke('templates:applyImport', plan, choices),
    export: (id: number) => invoke('templates:export', id)
  },
  learning: {
    stats: () => invoke('learning:stats'),
    suggest: (kind, input) => invoke('learning:suggest', kind, input),
    record: (c) => invoke('learning:record', c),
    category: (title) => invoke('learning:category', title),
    setBatchMap: (templateId, map) => invoke('templates:setBatchMap', templateId, map)
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
  bank: {
    save: (input: unknown) => invoke('bank:save', input),
    list: (filter?: unknown) => invoke('bank:list', filter ?? {}),
    used: (id: number) => invoke('bank:used', id),
    delete: (id: number) => invoke('bank:delete', id)
  }
};
