/**
 * بنك الأسئلة — سؤالٌ يُكتب مرّةً ويُدرج في كل ورقةٍ بعدها.
 *
 * المدرّس يعيد أسئلته من سنةٍ إلى سنة، ومن نموذجٍ إلى آخر. فيُحفظ السؤال كما
 * هو — بفروعه ودرجاته وإجابته النموذجية — ويُعرض له بنكُ مادّته وصفّه أوّلًا،
 * ويُدرج بضغطة. والبحث متساهلٌ مع الهمزة كسائر البحث في البرنامج.
 *
 * والسؤال نفسه لا يُكرَّر: حفظُ نصٍّ موجودٍ في المادة نفسها يحدّث القائم.
 */
import type Database from 'better-sqlite3';
import type { Inline, ListItem } from '@shared/doc';
import { normalizeFold } from '@shared/arabic';
import type { BankQuestion } from '@shared/api';

const inlineText = (list: Inline[] | undefined) =>
  (list ?? []).map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : ' ')).join('');

/** نصّ السؤال وفروعه مجرّدًا — سطرٌ لكلٍّ منها. */
export function questionText(item: ListItem): string {
  const lines: string[] = [];
  const walk = (it: ListItem, depth: number) => {
    const t = inlineText(it.inlines).trim();
    if (t) lines.push(`${'  '.repeat(depth)}${t}`);
    for (const child of it.items ?? []) walk(child, depth + 1);
  };
  walk(item, 0);
  return lines.join('\n');
}

/** مجموع درجة السؤال: درجته إن ذُكرت، وإلا مجموع فروعه. */
function scoreOf(item: ListItem): number | null {
  if (typeof item.score === 'number') return item.score;
  const kids = (item.items ?? []).map(scoreOf).filter((s): s is number => s !== null);
  return kids.length ? kids.reduce((a, b) => a + b, 0) : null;
}

type Row = {
  id: number;
  subject: string | null;
  grade: string | null;
  item_json: string;
  text: string;
  score: number | null;
  use_count: number;
  created_at: string;
};

const toQuestion = (r: Row): BankQuestion => ({
  id: r.id,
  subject: r.subject,
  grade: r.grade,
  item: JSON.parse(r.item_json) as ListItem,
  text: r.text,
  score: r.score,
  useCount: r.use_count,
  createdAt: r.created_at
});

export function saveQuestion(
  db: Database.Database,
  input: { item: ListItem; subject?: string | null; grade?: string | null }
): BankQuestion {
  const text = questionText(input.item);
  if (!text.trim()) throw new Error('السؤال فارغ — اكتبه أولًا ثم احفظه في البنك');
  const subject = input.subject?.trim() || null;
  const grade = input.grade?.trim() || null;
  const fold = normalizeFold(text);
  const existing = db
    .prepare("SELECT id FROM question_bank WHERE search_fold = ? AND IFNULL(subject, '') = IFNULL(?, '')")
    .get(fold, subject) as { id: number } | undefined;
  const json = JSON.stringify(input.item);
  if (existing) {
    db.prepare('UPDATE question_bank SET item_json = ?, text = ?, grade = ?, score = ? WHERE id = ?').run(
      json,
      text,
      grade,
      scoreOf(input.item),
      existing.id
    );
    return getQuestion(db, existing.id)!;
  }
  const info = db
    .prepare('INSERT INTO question_bank (subject, grade, item_json, text, search_fold, score) VALUES (?, ?, ?, ?, ?, ?)')
    .run(subject, grade, json, text, fold, scoreOf(input.item));
  return getQuestion(db, Number(info.lastInsertRowid))!;
}

export function getQuestion(db: Database.Database, id: number): BankQuestion | null {
  const row = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(id) as Row | undefined;
  return row ? toQuestion(row) : null;
}

/**
 * أسئلة البنك: ما طابق البحث في مادّته وصفّه، والأكثر استعمالًا فالأحدث أوّلًا.
 * والمادة والصفّ مرشِّحان لا شرطان: ما لم يُذكر لا يُقيَّد به.
 */
export function listQuestions(
  db: Database.Database,
  filter: { query?: string; subject?: string | null; grade?: string | null; limit?: number } = {}
): BankQuestion[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.subject?.trim()) {
    where.push('subject = ?');
    args.push(filter.subject.trim());
  }
  if (filter.grade?.trim()) {
    where.push('grade = ?');
    args.push(filter.grade.trim());
  }
  const q = filter.query?.trim();
  if (q) {
    where.push('search_fold LIKE ?');
    args.push(`%${normalizeFold(q)}%`);
  }
  const rows = db
    .prepare(
      `SELECT * FROM question_bank ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY use_count DESC, created_at DESC, id DESC LIMIT ?`
    )
    .all(...args, filter.limit ?? 200) as Row[];
  return rows.map(toQuestion);
}

export function markQuestionUsed(db: Database.Database, id: number): void {
  db.prepare("UPDATE question_bank SET use_count = use_count + 1, used_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteQuestion(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM question_bank WHERE id = ?').run(id);
}
