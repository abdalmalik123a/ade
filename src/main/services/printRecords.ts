/**
 * قيود طباعة الكتاب الصادر: الإصدار الأوّل ونسخه وإعادة طبعه — نُقل من `documents.ts` (D81).
 */
import type { Database } from 'better-sqlite3';
import { prepareDocuments } from './documents';

/** كتابٌ مُبطَل لا يُعاد طبعه ولا يُخرَج PDF: ورقته لو خرجت لم يعرف حاملُها أنها باطلة. */
export function assertNotVoid(db: Database, id: number): void {
  prepareDocuments(db);
  const row = db.prepare('SELECT serial, status FROM documents WHERE id = ?').get(id) as
    | { serial: string; status: string }
    | undefined;
  if (row?.status === 'void') throw new Error(`الكتاب ${row.serial} مُبطَل — لا يُعاد طبعه`);
}

/**
 * الطباعة تُقيَّد حين تتمّ فعلًا (الموجة ٢): الأولى «إصدار أول» بنسخها، وما بعدها إعادةٌ طبق الأصل. وكانت الأولى تُقيَّد
 * مع الإصدار — فكتابٌ حُفظ بلا طباعة أو فشلت طباعته كان يُعدّ في «السجلّ» نسخًا مطبوعة.
 */
export function recordPrint(
  db: Database,
  id: number,
  opts: { copies: number; printer: string | null; operator: string | null }
): void {
  if (db.prepare('SELECT 1 FROM document_prints WHERE document_id = ? LIMIT 1').get(id)) return recordReprint(db, id, opts);
  assertNotVoid(db, id);
  db.prepare(
    `INSERT INTO document_prints (document_id, copies, printer, reason, operator)
     VALUES (?, ?, ?, 'إصدار أول', ?)`
  ).run(id, Math.max(1, opts.copies), opts.printer, opts.operator);
}

/**
 * نسخةٌ أخرى من الطبعة نفسها (د٣): ثلاث نسخٍ عند الشبّاك طبعةٌ واحدة بثلاث نسخ — لا «إصدار أول» ثم إعادتان.
 * والنسخ تُرسل ورقةً ورقة في مهمّةٍ مسجّلة، فكلّ نسخةٍ خرجت فعلًا تزيد عدد آخر طبعةٍ للكتاب: فإن انقطعت
 * الكهرباء بعد الثانية قال السجلّ «نسختان»، وأكمل الاستئناف.
 */
export function addPrintedCopy(db: Database, id: number): void {
  const last = db.prepare('SELECT id FROM document_prints WHERE document_id = ? ORDER BY id DESC LIMIT 1').get(id) as { id: number } | undefined;
  if (!last) throw new Error('لا طبعة لهذا الكتاب تُزاد نسخها');
  db.prepare('UPDATE document_prints SET copies = copies + 1 WHERE id = ?').run(last.id);
}

/** إعادة الطباعة تُقيَّد ولا تُنشئ رقمًا جديدًا — الكتاب واحد ونسخه تُعدّ. */
export function recordReprint(
  db: Database,
  id: number,
  opts: { copies: number; printer: string | null; operator: string | null }
): void {
  assertNotVoid(db, id);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO document_prints (document_id, copies, printer, reason, operator)
       VALUES (?, ?, ?, 'إعادة طباعة طبق الأصل', ?)`
    ).run(id, Math.max(1, opts.copies), opts.printer, opts.operator);
    db.prepare(
      `INSERT INTO audit_log (entity, entity_id, action, detail, operator)
       VALUES ('document', ?, 'reprint', ?, ?)`
    ).run(id, `${opts.copies} نسخة`, opts.operator);
  })();
}
