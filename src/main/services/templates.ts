import type { Database } from 'better-sqlite3';
import type { TemplateSummary, TemplateStats } from '@shared/api';

/** منطق مكتبة النماذج. دوالّ نقيّة تأخذ الاتصال وسيطًا فتُختبر بلا Electron. */

export function listTemplates(db: Database, category?: string | null): TemplateSummary[] {
  const where = category ? 'WHERE t.is_active = 1 AND t.category = ?' : 'WHERE t.is_active = 1';
  const rows = db
    .prepare(
      `SELECT t.id, t.code, t.title, t.subtitle, t.category, t.subject_line AS subjectLine,
              t.body_html AS bodyHtml, t.print_count AS printCount,
              (SELECT COUNT(*) FROM documents d
                WHERE d.template_id = t.id
                  AND strftime('%Y-%m', d.issued_at) = strftime('%Y-%m','now','localtime')
              ) AS issuedThisMonth
       FROM templates t ${where}
       ORDER BY t.print_count DESC, t.title`
    )
    .all(...(category ? [category] : [])) as Omit<TemplateSummary, 'variables'>[];

  const vars = db.prepare(
    'SELECT token FROM template_variables WHERE template_id = ? ORDER BY sort_order, id'
  );
  return rows.map((r) => ({
    ...r,
    variables: (vars.all(r.id) as { token: string }[]).map((v) => v.token)
  }));
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

export function deleteTemplate(db: Database, id: number): void {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}
