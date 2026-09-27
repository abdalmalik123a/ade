/**
 * تحليل أسئلة ورقة الدوائر، و«الدور الثاني» من البنك (د٩).
 *
 * **تحليل الأسئلة** بعد التصحيح: لكلّ سؤالٍ صعوبته (كم أجاب صوابًا)، وتمييزه (أيفرّق
 * بين المتفوّقين والضعاف — أعلى ٢٧٪ وأدناها بمجموعهم)، وأكثر خطأٍ اختير. والتمييز
 * السالب يُقال بصراحة: المتفوّقون أخطؤوه أكثر من الضعاف — فالأرجح أن **المفتاح خطأ**.
 *
 * **والدور الثاني**: ورقةٌ بالبنية نفسها (عدد الأسئلة ودرجاتها) من أسئلة البنك التي لم
 * تُطبع في الدور الأول، والأقلّ استعمالًا أولًا. وما لم يُوجد له بديلٌ يُقال — لا يُكرَّر
 * سؤالٌ من الدور الأول صامتًا.
 */
import type { ListItem } from './doc';
import { normalizeFold } from './arabic';

export type ItemStat = {
  /** رقم السؤال من ١. */
  q: number;
  /** نسبة من أجاب صوابًا (٠..١) — والفارغ والمتعدّد خطأ. */
  difficulty: number;
  /** تمييزه: نسبة الصواب في الأعلى ناقص نسبته في الأدنى (−١..١). */
  discrimination: number;
  blank: number;
  /** البديل الخاطئ الأكثر اختيارًا ومن اختاره — مشتّتٌ يجذب، أو مفتاحٌ مقلوب. */
  topWrong: { choice: number; share: number } | null;
  flags: ('easy' | 'hard' | 'weak' | 'key?')[];
};

export function itemAnalysis(sheets: { answers: number[] }[], key: number[]): ItemStat[] {
  const n = sheets.length;
  if (!n) return [];
  const score = (s: { answers: number[] }) => key.reduce((acc, k, q) => acc + (k >= 0 && s.answers[q] === k ? 1 : 0), 0);
  const ranked = [...sheets].sort((a, b) => score(b) - score(a));
  const band = Math.max(1, Math.round(n * 0.27));
  const upper = ranked.slice(0, band);
  const lower = ranked.slice(-band);
  const rate = (group: { answers: number[] }[], q: number) => group.filter((s) => s.answers[q] === key[q]).length / group.length;

  const out: ItemStat[] = [];
  key.forEach((k, q) => {
    if (k < 0) return;
    const right = sheets.filter((s) => s.answers[q] === k).length;
    const blank = sheets.filter((s) => (s.answers[q] ?? -1) === -1).length;
    const wrongCounts = new Map<number, number>();
    for (const s of sheets) {
      const a = s.answers[q] ?? -1;
      if (a >= 0 && a !== k) wrongCounts.set(a, (wrongCounts.get(a) ?? 0) + 1);
    }
    const top = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const difficulty = right / n;
    const discrimination = n >= 4 ? rate(upper, q) - rate(lower, q) : 0;
    const flags: ItemStat['flags'] = [];
    if (difficulty > 0.9) flags.push('easy');
    if (difficulty < 0.3) flags.push('hard');
    // والسهل على الجميع أو الصعب على الجميع لا يفرّق بطبعه — فلا يُقال عنه «ضعيف» مرّتين.
    if (n >= 10 && discrimination < 0) flags.push('key?');
    else if (n >= 10 && discrimination < 0.2 && !flags.length) flags.push('weak');
    out.push({
      q: q + 1,
      difficulty: Math.round(difficulty * 100) / 100,
      discrimination: Math.round(discrimination * 100) / 100,
      blank,
      topWrong: top ? { choice: top[0], share: Math.round((top[1] / n) * 100) / 100 } : null,
      flags
    });
  });
  return out;
}

/** سطرٌ يُقال عن السؤال — بلغة المدرّس لا بأرقام الإحصاء. */
export function itemNote(s: ItemStat): string {
  if (s.flags.includes('key?')) return 'المتفوّقون أخطؤوه أكثر من الضعاف — راجع مفتاحه';
  if (s.flags.includes('hard')) return 'صعبٌ على أغلب الطلاب';
  if (s.flags.includes('easy')) return 'سهلٌ على الجميع — لا يفرّق بينهم';
  if (s.flags.includes('weak')) return 'لا يكاد يفرّق بين المتفوّق والضعيف';
  return '';
}

// ── الدور الثاني ─────────────────────────────────────────────────────

const inlineText = (it: ListItem): string =>
  [
    (it.inlines ?? []).map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? n.ref : ' ')).join(''),
    ...(it.items ?? []).map(inlineText)
  ].join(' ');

const keyOf = (it: ListItem) => normalizeFold(inlineText(it)).replace(/\s+/g, ' ').trim();

function scoreOf(item: ListItem): number | null {
  if (typeof item.score === 'number') return item.score;
  const kids = (item.items ?? []).map(scoreOf).filter((s): s is number => s !== null);
  return kids.length ? kids.reduce((a, b) => a + b, 0) : null;
}

export type BankCandidate = { id: number; item: ListItem; score: number | null; useCount: number };

/**
 * لكلّ سؤالٍ في الدور الأول بديلٌ من البنك بدرجته نفسها (وإلا فأقربها)، ليس في الورقة
 * الأولى ولا اختير قبله، والأقلّ استعمالًا أولًا. ويعود بالمختار وبأرقام ما لم يُوجد له.
 */
export function secondRound(first: ListItem[], bank: BankCandidate[]): { picks: BankCandidate[]; missing: number[] } {
  const used = new Set(first.map(keyOf));
  const taken = new Set<number>();
  const picks: BankCandidate[] = [];
  const missing: number[] = [];
  first.forEach((q, i) => {
    const want = scoreOf(q);
    const pool = bank
      .filter((b) => !taken.has(b.id) && !used.has(keyOf(b.item)))
      .sort((a, b) => {
        const da = want === null || a.score === null ? 0 : Math.abs(a.score - want);
        const db = want === null || b.score === null ? 0 : Math.abs(b.score - want);
        return da - db || a.useCount - b.useCount || a.id - b.id;
      });
    const pick = pool[0];
    if (!pick) {
      missing.push(i + 1);
      return;
    }
    taken.add(pick.id);
    picks.push(pick);
  });
  return { picks, missing };
}
