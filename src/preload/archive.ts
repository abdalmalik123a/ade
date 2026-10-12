/**
 * الجسر — باب الصادر: مؤشّرات الأرشيف، والكتاب وإصداره ومعاملته وطباعته، وسجلّ التدقيق (تقسيم الجسر بعد ١٫٧٫٠،
 * على أبواب `@shared/api`): منقولٌ من `index.ts` كما هو، وهو يجمع الأبواب.
 */
import type { ArchiveApis, IssueInput, TransactionInput } from '@shared/api';
import { invoke } from './invoke';

export const archiveApi: ArchiveApis = {
  archive: {
    stats: () => invoke('archive:stats')
  },
  audit: {
    list: (opts) => invoke('audit:list', opts ?? {})
  },
  documents: {
    issue: (input: IssueInput, print: boolean) => invoke('documents:issue', input, print),
    issueTransaction: (input: TransactionInput) => invoke('documents:issueTransaction', input),
    issueBatch: (inputs: TransactionInput[]) => invoke('documents:issueBatch', inputs),
    printIssued: (req) => invoke('documents:printIssued', req),
    linkCitizen: (transactionId: number, citizenId: number) => invoke('documents:linkCitizen', transactionId, citizenId),
    repeatSource: (id: number) => invoke('documents:repeatSource', id),
    get: (id: number) => invoke('documents:get', id),
    list: (opts?: { from?: string | null; to?: string | null; query?: string; limit?: number }) =>
      invoke('documents:list', opts ?? {}),
    stats: (opts?: { from?: string | null; to?: string | null }) =>
      invoke('documents:stats', opts ?? {}),
    reprint: (ids: number[], copies: number, printer: string | null) => invoke('documents:reprint', ids, copies, printer),
    void: (id, reason, operator) => invoke('documents:void', id, reason, operator),
    verify: () => invoke('documents:verify'),
    exportPdf: (id: number) => invoke('documents:exportPdf', id),
    exportReport: (opts: {
      from?: string | null;
      to?: string | null;
      query?: string;
      title?: string;
    }) =>
      invoke('documents:exportReport', opts)
  }
};
