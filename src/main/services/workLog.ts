/**
 * ما خرج من المكتب كلّ يوم — للملخّص الأسبوعي في «التنبيهات» (الموجة ٢، بموافقة المالك ٧ تشرين الأول).
 *
 * أوراقٌ طُبعت وملفّاتٌ حُفظت: أعدادٌ وحدها، لا اسمٌ ولا محتوى. تقيّدها بوّابة الإنتاج (`ipc/gate.ts`) بعد أن يتمّ العمل —
 * فهي ترى كلّ طباعةٍ وكلّ ملفٍّ يخرج، من الكتب والصور ونسخ الهويات والتصاميم والدفعات وأدوات PDF. والسجلّ لا يكفي: يعرف
 * الكتب وحدها، و«إصدار أول» فيه يُقيَّد مع الكتاب ولو حُفظ بلا طباعة. فالورقة تُعدّ حين تُرسل إلى الطابعة فعلًا،
 * وما أُلغي أو فشل لا شيء.
 */
import type { Database } from 'better-sqlite3';

export type Work = { sheets: number; files: number };

const NONE: Work = { sheets: 0, files: 0 };
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const copiesOf = (v: unknown) => Math.max(1, count((v as { copies?: unknown } | undefined)?.copies));

/** ما خرج من نداء قناة إنتاج — من وسائطها ونتيجتها كما تُرجعها. */
export function workOf(channel: string, args: unknown[], out: unknown): Work {
  const o = (out && typeof out === 'object' ? out : {}) as Record<string, unknown>;
  switch (channel) {
    // الكتاب يُطبع مع إصداره بنسخه — و«احفظ بلا طباعة» زبونٌ يُعدّ في السجلّ لا ورقة.
    case 'documents:issue':
      return o['printed'] === 'ok' ? { sheets: copiesOf(args[0]), files: 0 } : NONE;
    case 'documents:reprint':
      return { sheets: count(o['printed']) * Math.max(1, count(args[1])), files: 0 };
    // الدفعات ورقةً ورقة: ما أُرسل منها ولو انقطعت بعده.
    case 'documents:printIssued':
    case 'output:printJob':
      return { sheets: count(o['sent']), files: 0 };
    // والاستئناف من حيث انقطعت: ما أُرسل بعدها.
    case 'output:resumeJob':
      return { sheets: Math.max(0, count(o['sent']) - count(args[1])), files: 0 };
    case 'output:print':
      return o['ok'] === true ? { sheets: copiesOf(args[0]), files: 0 } : NONE;
    case 'attachments:print':
      return out === true ? { sheets: 1, files: 0 } : NONE;
    case 'documents:exportPdf':
    case 'output:savePdf':
    case 'output:savePng300':
    case 'output:saveDocx':
    case 'pdf:save':
      return typeof out === 'string' && out ? { sheets: 0, files: 1 } : NONE;
    case 'pdf:saveMany':
    case 'pdf:saveImages':
      return { sheets: 0, files: Array.isArray(o['files']) ? o['files'].length : 0 };
    default:
      return NONE;
  }
}

/** يُضاف إلى عدّاد اليوم. */
export function recordWork(db: Database, day: string, work: Work): void {
  const add = db.prepare('INSERT INTO work_days (day, kind, n) VALUES (?, ?, ?) ON CONFLICT(day, kind) DO UPDATE SET n = n + excluded.n');
  if (work.sheets > 0) add.run(day, 'sheets', work.sheets);
  if (work.files > 0) add.run(day, 'files', work.files);
}

/** ما خرج في الأيّام من `from` حتى ما قبل `to` (YYYY-MM-DD). */
export function workBetween(db: Database, from: string, to: string): Work {
  const rows = db.prepare('SELECT kind, SUM(n) AS n FROM work_days WHERE day >= ? AND day < ? GROUP BY kind').all(from, to) as {
    kind: string;
    n: number;
  }[];
  const of = (kind: string) => rows.find((r) => r.kind === kind)?.n ?? 0;
  return { sheets: of('sheets'), files: of('files') };
}
