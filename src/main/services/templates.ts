import type { Database } from 'better-sqlite3';
import { legacyFieldMeta, type TemplateInput, type TemplateVariable } from '@shared/template';
import { docFromLegacy, normalizeDoc, type Doc, type Issuing } from '@shared/doc';
import type { TemplateSummary, TemplateStats, TemplateDetail, DraftRow } from '@shared/api';

/** منطق مكتبة النماذج والمسودات. دوالّ نقيّة تأخذ الاتصال وسيطًا. */

/** عمود الوثيقة يُضاف عند الحاجة — الترحيل هنا ليعمل على قواعد قائمة. */
export function prepareTemplates(db: Database): void {
  const cols = db.prepare('PRAGMA table_info(templates)').all() as { name: string }[];
  const has = (name: string) => cols.some((c) => c.name === name);
  if (!has('doc_json')) db.exec('ALTER TABLE templates ADD COLUMN doc_json TEXT');
  if (!has('issuing')) {
    db.exec("ALTER TABLE templates ADD COLUMN issuing TEXT NOT NULL DEFAULT 'registered'");
  }
}

/**
 * وثيقة النموذج: المحفوظة كتلًا إن وُجدت، وإلا فالمتن القديم مُرحَّلًا.
 *
 * فما بناه المكتب قبل النواة يُقرأ كتلًا بلا أن يُعاد بناؤه، وما يكتبه
 * الاستيراد الجديد يُقرأ بحقوله وعروضه ومسافاته كما بُني.
 */
export function templateDoc(row: { docJson?: string | null; bodyHtml: string }): Doc {
  if (row.docJson) {
    try {
      return normalizeDoc(JSON.parse(row.docJson));
    } catch {
      // بنية تالفة لا تمنع فتح النموذج — يُقرأ من ظلّه النصّي.
    }
  }
  return docFromLegacy(row.bodyHtml, legacyFieldMeta);
}

const SUMMARY = `t.id, t.code, t.title, t.subtitle, t.category,
  t.subject_line AS subjectLine, t.body_html AS bodyHtml, t.doc_json AS docJson,
  t.issuing, t.letterhead_id AS letterheadId, t.print_count AS printCount`;

const MONTH_COUNT = `(SELECT COUNT(*) FROM documents d
   WHERE d.template_id = t.id
     AND strftime('%Y-%m', d.issued_at) = strftime('%Y-%m','now','localtime')) AS issuedThisMonth`;

function loadVariables(db: Database, templateId: number): TemplateVariable[] {
  return db
    .prepare(
      `SELECT token, COALESCE(label, token) AS label, COALESCE(source,'manual') AS source,
              required FROM template_variables
       WHERE template_id = ? ORDER BY sort_order, id`
    )
    .all(templateId)
    .map((r) => {
      const row = r as { token: string; label: string; source: string; required: number };
      return {
        token: row.token,
        label: row.label,
        source: row.source as TemplateVariable['source'],
        required: row.required === 1
      };
    });
}

/**
 * مكتبة الكتب لا تُري أوراق الأسئلة، والعكس.
 *
 * فالمدرّس لا يبحث عن امتحانه بين التأييدات، وصاحب المكتب لا يقع على ورقة أسئلة
 * وهو يخدم زبونًا. والفصل بالحكم لا بالتصنيف: أتُقيَّد في الصادر أم تُطبع فقط؟
 */
export function listTemplates(
  db: Database,
  category?: string | null,
  issuing: Issuing = 'registered'
): TemplateSummary[] {
  prepareTemplates(db);
  const rows = db
    .prepare(
      `SELECT ${SUMMARY}, ${MONTH_COUNT} FROM templates t
       WHERE t.is_active = 1 AND t.issuing = ? AND (? IS NULL OR t.category = ?)
       ORDER BY t.print_count DESC, t.title`
    )
    .all(issuing, category ?? null, category ?? null) as Omit<TemplateSummary, 'variables'>[];

  return rows.map((r) => ({ ...r, variables: loadVariables(db, r.id).map((v) => v.token) }));
}

export function getTemplate(db: Database, id: number): TemplateDetail | null {
  const row = db
    .prepare(`SELECT ${SUMMARY}, ${MONTH_COUNT} FROM templates t WHERE t.id = ?`)
    .get(id) as Omit<TemplateDetail, 'variables'> | undefined;
  if (!row) return null;
  return { ...row, variables: loadVariables(db, id) };
}

/** التصنيفات تُشتقّ مما أدخله المكتب فعلًا — لا قائمة مبرمَجة. */
export function listCategories(db: Database): { name: string; count: number }[] {
  return db
    .prepare(
      `SELECT category AS name, COUNT(*) AS count FROM templates
       WHERE is_active = 1 AND category IS NOT NULL AND category <> ''
       GROUP BY category ORDER BY count DESC, category`
    )
    .all() as { name: string; count: number }[];
}

export function templateStats(db: Database): TemplateStats {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    activeTemplates: one('SELECT COUNT(*) AS n FROM templates WHERE is_active = 1'),
    drafts: one('SELECT COUNT(*) AS n FROM drafts'),
    issuedThisMonth: one(
      `SELECT COUNT(*) AS n FROM documents
       WHERE strftime('%Y-%m', issued_at) = strftime('%Y-%m','now','localtime')`
    )
  };
}

/** الكود يجب أن يبقى فريدًا — وإلا ضاع تمييز النموذج في الأرشيف. */
export function isCodeTaken(db: Database, code: string, exceptId: number | null): boolean {
  const row = db
    .prepare('SELECT id FROM templates WHERE code = ? AND (? IS NULL OR id <> ?)')
    .get(code, exceptId, exceptId) as { id: number } | undefined;
  return Boolean(row);
}

export function saveTemplate(
  db: Database,
  input: TemplateInput & { doc?: Doc | null }
): TemplateDetail {
  prepareTemplates(db);
  const title = input.title.trim();
  if (!title) throw new Error('عنوان النموذج مطلوب');
  const code = input.code?.trim() || null;
  if (code && isCodeTaken(db, code, input.id)) {
    throw new Error(`الكود «${code}» مستعمل في نموذج آخر`);
  }

  // الوثيقة كتلًا: ما بناه الاستيراد بحقوله وعروضه، أو مُرحَّلةً من المتن.
  const doc = input.doc ?? docFromLegacy(input.bodyHtml, legacyFieldMeta);
  const docJson = JSON.stringify(doc);
  // الحكم من الوثيقة نفسها — فلا يُسأل عنه مرّتين ولا يختلفان.
  const issuing: Issuing = doc.issuing;

  const id = db.transaction(() => {
    let templateId = input.id;
    if (templateId === null) {
      const info = db
        .prepare(
           `INSERT INTO templates (code, title, subtitle, category, letterhead_id,
                                  body_html, doc_json, issuing, subject_line, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          code,
          title,
          input.subtitle?.trim() || null,
          input.category?.trim() || null,
          input.letterheadId,
          input.bodyHtml,
          docJson,
          issuing,
          input.subjectLine?.trim() || null
        );
      templateId = Number(info.lastInsertRowid);
    } else {
      db.prepare(
        `UPDATE templates SET code = ?, title = ?, subtitle = ?, category = ?,
                              letterhead_id = ?, body_html = ?, doc_json = ?, issuing = ?,
                              subject_line = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        code,
        title,
        input.subtitle?.trim() || null,
        input.category?.trim() || null,
        input.letterheadId,
        input.bodyHtml,
        docJson,
        issuing,
        input.subjectLine?.trim() || null,
        templateId
      );
    }

    // المتغيّرات تُستبدل كاملةً: هي مشتقّة من المتن، فلا معنى لدمج جزئي.
    db.prepare('DELETE FROM template_variables WHERE template_id = ?').run(templateId);
    const insert = db.prepare(
      `INSERT INTO template_variables (template_id, token, label, source, required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    input.variables.forEach((v, i) => {
      insert.run(templateId, v.token, v.label, v.source, v.required ? 1 : 0, i);
    });
    return templateId;
  })();

  return getTemplate(db, id)!;
}

export function deleteTemplate(db: Database, id: number): void {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}

/**
 * نسخة مستقلّة من نموذج — «نسخ قالب».
 *
 * الأصل لا يُمسّ: تُنشأ بطاقةٌ جديدة بحقولها ووثيقتها، ليعدّلها المكتب دون أن
 * يفسد ما بُني عليه. والكود يُترك فارغًا — فهو فريدٌ يميّز النموذج في الأرشيف،
 * ولا نسختين تحملانه. كما تُنسخ الترويسة حرفيًّا (`duplicateLetterhead`).
 */
export function duplicateTemplate(db: Database, id: number): TemplateDetail | null {
  const src = getTemplate(db, id);
  if (!src) return null;
  return saveTemplate(db, {
    id: null,
    code: null,
    title: `${src.title} — نسخة`,
    subtitle: src.subtitle,
    category: src.category,
    subjectLine: src.subjectLine,
    bodyHtml: src.bodyHtml,
    letterheadId: src.letterheadId,
    variables: src.variables,
    doc: templateDoc(src)
  });
}

/** كم كتابًا صدر عن هذا النموذج — يُسأل قبل الحذف فلا يُمحى ما له أثر في الأرشيف. */
export function templateUsage(db: Database, id: number): number {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM documents WHERE template_id = ?').get(id) as {
      n: number;
    }
  ).n;
}

// ── المسودات ─────────────────────────────────────────────────────────
export function listDrafts(db: Database): DraftRow[] {
  return db
    .prepare(
      `SELECT d.id, COALESCE(d.title,'') AS title, d.template_id AS templateId,
              t.title AS templateTitle, d.citizen_id AS citizenId,
              c.full_name AS citizenName, d.values_json AS valuesJson,
              d.body_html AS bodyHtml, d.updated_at AS updatedAt
       FROM drafts d
       LEFT JOIN templates t ON t.id = d.template_id
       LEFT JOIN citizens c ON c.id = d.citizen_id
       ORDER BY d.updated_at DESC`
    )
    .all() as DraftRow[];
}

export function saveDraft(
  db: Database,
  input: {
    id: number | null;
    templateId: number | null;
    citizenId: number | null;
    title: string;
    values: Record<string, string>;
    bodyHtml: string;
  }
): number {
  const json = JSON.stringify(input.values);
  if (input.id === null) {
    const info = db
      .prepare(
        `INSERT INTO drafts (template_id, citizen_id, title, values_json, body_html)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.templateId, input.citizenId, input.title, json, input.bodyHtml);
    return Number(info.lastInsertRowid);
  }
  db.prepare(
    `UPDATE drafts SET template_id = ?, citizen_id = ?, title = ?, values_json = ?,
                       body_html = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(input.templateId, input.citizenId, input.title, json, input.bodyHtml, input.id);
  return input.id;
}

export function deleteDraft(db: Database, id: number): void {
  db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
}
