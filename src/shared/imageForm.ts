/**
 * الاستمارة المصوّرة (خطّة الترقية، المرحلة ٤ — قرار ن١٨): صورة الدائرة كما هي، والخانات فوقها.
 *
 * الدوائر تنشر استماراتها صورًا («تأييد تخرّج»، «معلومات»، «استمارة الهويات») ويأتي الناس لملئها.
 * فتُقرأ الصورة مرّةً: صناديقها (`formBoxes.ts`) وكلماتها بمواضعها (القارئ المحلي)، ومنهما الخانات:
 *
 * - **صندوقٌ فارغ** خانة، واسمها من العنوان بجانبه (يمينه) أو فوقه — «رقم الهوية» في الخانة
 *   المجاورة، و«الدرجة رقمًا» في رأس العمود ومعها رقم الصفّ.
 * - **مربّعٌ صغير** اختيارٌ يُعلَّم ✓، واسمه الكلمة بجانبه («أعزب»).
 * - **مربّع الصورة** صورة الزبون من أداة الصور.
 * - **وفي السطر**: النقاط «.......»، والقوسان «(      )»، والتاريخ «/ / 202»، والفراغ بعد «العدد :»
 *   — واسمها من الكلام قبلها (`blanks.ts`).
 *
 * و«رقمًا» و«كتابةً» زوجان بالاسم (`tafqeet.ts`): يُكتب الرقم فتُكتب الكلمات. والمجموع يُجمع وحده.
 * وما لم يُكتشف يُرسم باليد في المصمّم — اقتراحٌ لا قرار.
 */
import { suggestFieldName, keyFromLabel } from './blanks';
import type { Box } from './paperRules';
import type { OcrLine, OcrWord } from './paperDoc';
export { imageFormDoc, formValues } from './imageFormDoc';

export type SlotKind = 'text' | 'date' | 'check' | 'photo';

export type FormSlot = {
  key: string;
  label: string;
  kind: SlotKind;
  /** بالبكسل في الصورة. */
  box: Box;
  /** من أين جاء: صندوقٌ أو سطر — يُعرض ليراجعه الموظف. */
  from: 'box' | 'line';
  /** خانةٌ في عمود جدول: اسم العمود ورقم الصفّ — فيُسمّى العمود مرّةً وتتبعه خاناته. */
  column?: string;
  /** هويّة العمود (موضع رأسه) — فعمودان باسمٍ واحد في جدولين لا يُخلطان. */
  columnId?: string;
  row?: string;
  /** «المجموع»: مفاتيح ما يُجمع. */
  sumOf?: string[];
};

const LETTER = /[ء-يa-zA-Z0-9٠-٩]/;
/** عنوانٌ يُقرأ: كلمةٌ عربيّة بحرفين فأكثر — وما سواه قراءةٌ ضائعة (خطٌّ ممدود، أو رموز). */
const READABLE = /[ء-ي]{2,}/;
const DOTS = /^[.…ـ_·]{3,}$/;
const PAREN = /^[()]|[()]$/;
const clean = (s: string) =>
  s
    .replace(/[:：/\\()|]+/g, ' ')
    .replace(/[.…ـ_·]{2,}/g, ' ')
    .split(/\s+/)
    // تنوينٌ أو حركةٌ وحدها كلمةً («ً» من «كتابةً» تقرأ منفصلة) ليست من الاسم.
    .filter((t) => /[\p{L}\p{N}]/u.test(t.replace(/\u0640/g, '')))
    .join(' ')
    .trim();
const height = (b: Box) => b.y1 - b.y0;
const width = (b: Box) => b.x1 - b.x0;
const vOverlap = (a: Box, b: Box) => Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const hOverlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
const centerIn = (w: Box, b: Box, pad = 1) => {
  const cx = (w.x0 + w.x1) / 2;
  const cy = (w.y0 + w.y1) / 2;
  return cx > b.x0 - pad && cx < b.x1 + pad && cy > b.y0 - pad && cy < b.y1 + pad;
};
const contains = (outer: Box, inner: Box, pad = 2) =>
  inner.x0 >= outer.x0 - pad && inner.x1 <= outer.x1 + pad && inner.y0 >= outer.y0 - pad && inner.y1 <= outer.y1 + pad;
const union = (bs: Box[]): Box => ({ x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) });

/** كلمات السطر بترتيب القراءة: من اليمين إلى اليسار. */
const rtl = (ws: OcrWord[]) => [...ws].sort((a, b) => b.box.x1 - a.box.x1);

/**
 * اسم الفراغ من الكلام قبله — وما بعد «بأن» و«أنّ» اسم صاحب العلاقة («نؤيد لكم بأن (……)»).
 */
function nameFrom(before: string): string {
  // القوس الملاصق للفراغ يُقرأ أحيانًا رقمًا («(» ← «١») — حرفٌ وحده في آخر الكلام ليس من الاسم.
  const t = before.trim().replace(/(^|\s+)[0-9٠-٩|[\]{}()]$/, '').trim();
  if (/(^|\s)(بأن|بان|بأنّ|أن|ان|أنّ)$/.test(t)) return 'الاسم';
  const v = suggestFieldName(t).value;
  return v === 'حقل' ? 'خانة' : v;
}

type Cell = { box: Box; words: OcrWord[]; text: string; ink: number };

/** «رقمًا» و«كتابةً» كما يُقرآن («كتابمٌ») باسمٍ واحد — فيقترن الزوج. */
const gradeTag = (t: string) => (/رقم/.test(t) ? 'رقما' : 'كتابة');

/**
 * خاناتٌ فيها حبرٌ ولم يقع فيها شيءٌ ممّا قرأه القارئ: تُقرأ وحدها مقصوصة. القارئ على الصفحة كلّها
 * يُسقط الكلمة الكبيرة وحدها في خانةٍ عالية («المجموع» بجانب صفّ المجموع) فتُحسب الخانة فارغة.
 */
export function unreadCells(boxes: Box[], inks: number[], lines: OcrLine[], max = 24): Box[] {
  const words = lines.flatMap((l) => l.words);
  // حرفٌ واحد ليس قراءة: «|» أو «١» كثيرًا ما يكون ما بقي من الكلمة الكبيرة.
  const read = (box: Box) => words.filter((w) => centerIn(w.box, box)).reduce((n, w) => n + (w.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0), 0) >= 2;
  return boxes
    .map((box, i) => ({ box, ink: inks[i] ?? 0 }))
    .filter(({ box, ink }) => ink > 0.01 && !read(box))
    .sort((a, b) => b.ink - a.ink)
    .slice(0, max)
    .map(({ box }) => box);
}

/**
 * قراءة الخانة وحدها (`got` بمواضع المقصوصة، وهي عند `dx`,`dy` من الصفحة) مكانَ ما قُرئ فيها
 * من الصفحة كلّها — إن قرأت حرفين فأكثر، وإلا تبقى الأولى.
 */
export function withCellRead(lines: OcrLine[], box: Box, got: OcrLine[], dx: number, dy: number): OcrLine[] {
  const letters = got.flatMap((l) => l.words).reduce((n, w) => n + (w.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0), 0);
  if (letters < 2) return lines;
  const at = (b: Box): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });
  const kept = lines.map((l) => ({ ...l, words: l.words.filter((w) => !centerIn(w.box, box)) })).filter((l) => l.words.length);
  return [...kept, ...got.map((l) => ({ ...l, box: at(l.box), words: l.words.map((w) => ({ ...w, box: at(w.box) })) }))];
}

/**
 * الخانات من الصورة: صناديقها، وخطوط نقاطها (`findLeaders`)، وأسطر القارئ. `inks` نسبة الحبر في
 * كلّ صندوق (اختياريّ) — تُفرّق الخانة الفارغة عن خانةٍ فيها كتابةٌ لم يقرأها القارئ.
 */
export function planImageForm(input: { width: number; height: number; boxes: Box[]; lines: OcrLine[]; inks?: number[]; leaders?: Box[] }): FormSlot[] {
  const { width: W, height: H } = input;
  // علامات الاتّجاه الخفيّة التي يضعها القارئ حول الأرقام لا تُرى — ولا تبقى في اسم الخانة.
  const lines = input.lines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w, text: w.text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '') })) }));
  const words = lines.flatMap((l) => l.words).filter((w) => w.text.trim());

  // ١) الصناديق: ما وقع داخل كلمةٍ واحدة فتحةُ حرفٍ لا صندوق.
  const cells: Cell[] = input.boxes
    .map((box, i) => ({ box, ink: input.inks?.[i] ?? 0 }))
    .filter(({ box }) => !words.some((w) => contains(w.box, box, 3) && width(w.box) < W * 0.25))
    .map(({ box, ink }) => {
      const inside = words.filter((w) => centerIn(w.box, box));
      return { box, ink, words: inside, text: clean(rtl(inside).map((w) => w.text).join(' ')) };
    });
  const isLabel = (c: Cell) => /[ء-يa-zA-Z]/.test(c.text);
  const labels = cells.filter(isLabel);
  const row = (o: Box, b: Box) => vOverlap(o, b) >= Math.min(height(o), height(b)) * 0.5;

  const slots: FormSlot[] = [];
  const used: Box[] = [];

  // ٢) مربّع الصورة: صندوقٌ كبير فيه «صورة».
  for (const c of cells) {
    if (/صور[ةه]/.test(c.text) && height(c.box) > H * 0.06) {
      slots.push({ key: '', label: 'الصورة', kind: 'photo', box: c.box, from: 'box' });
      used.push(c.box);
    }
  }

  /** رأس العمود فوق الصندوق — ورأسه إن كان للرأس رأس («الدرجة» فوق «رقمًا»). */
  const above = (o: Box): Cell | undefined => {
    // صعودًا في العمود خانةً خانة: والفجوة بين خانتين نهايةُ الجدول — فعمودٌ لم يُكشف رأسه لا يأخذ
    // اسمه من صندوق رأس الصفحة فوقه («إدارة مدرسة … التاريخ» اسمًا لعمود الدرجة).
    const gap = Math.max(12, H * 0.012);
    let top = o.y0;
    for (const c of cells
      .filter((c) => c.box.y1 <= o.y0 + 4 && hOverlap(c.box, o) >= Math.min(width(c.box), width(o)) * 0.6 && (isLabel(c) || c.words.length === 0))
      .sort((p, q) => q.box.y1 - p.box.y1)) {
      if (top - c.box.y1 > gap) return undefined;
      if (isLabel(c) || c.ink > 0.02) return c;
      top = Math.min(top, c.box.y0);
    }
    return undefined;
  };
  const columnOf = (b: Box): { name: string; id: string } | null => {
    const head = above(b);
    if (!head) return null;
    const id = `${Math.round(head.box.x0)}:${Math.round(head.box.y0)}`;
    const name = columnName(head);
    return name ? { name, id } : null;
  };
  const columnName = (head: Cell): string | null => {
    const parent = above(head.box);
    const stacked = parent && head.box.y0 - parent.box.y1 < height(head.box) * 1.5 && width(parent.box) > width(head.box) * 1.3;
    const parentName = stacked ? (READABLE.test(parent!.text) ? parent!.text : 'الدرجة') : '';
    if (/^(رقم|كتاب)/.test(head.text)) return `${parentName || 'الدرجة'} ${gradeTag(head.text)}`;
    if (READABLE.test(head.text)) return [parentName, head.text].filter(Boolean).join(' ');
    // رأسٌ لم يُقرأ تحت رأسٍ يجمع عمودين: «رقمًا» يمينًا و«كتابةً» يسارًا — كما تُرسم جداول الدرجات.
    if (stacked) {
      const siblings = cells.filter((c) => Math.abs(c.box.y0 - head.box.y0) < height(head.box) * 0.5 && contains(parent!.box, { ...c.box, y0: parent!.box.y0, y1: parent!.box.y1 }, 6));
      if (siblings.length === 2) {
        const rightmost = siblings.sort((p, q) => q.box.x1 - p.box.x1)[0]!;
        return `${parentName} ${rightmost === head ? 'رقما' : 'كتابة'}`;
      }
      return parentName;
    }
    return 'عمود';
  };

  /** العنوان بجانب الصندوق: خانةٌ فيها نصّ يمينه، أو كلماتٌ يمينه في صفّه. */
  const sideLabel = (b: Box, check: boolean): string | null => {
    const right = labels.filter((c) => row(c.box, b) && c.box.x0 >= b.x1 - 4 && c.box.x0 - b.x1 < W * 0.05).sort((p, q) => p.box.x0 - q.box.x0)[0];
    if (right && !check && READABLE.test(right.text)) return right.text;
    const near = words
      // عنوانٌ فيه حرف — والرقم وحده رقمُ صفّ («ت») لا اسم.
      .filter((w) => vOverlap(w.box, b) >= Math.min(height(w.box), height(b)) * 0.4 && READABLE.test(w.text))
      .map((w) => ({ w, gap: w.box.x0 >= b.x1 - 2 ? w.box.x0 - b.x1 : b.x0 - w.box.x1, side: w.box.x0 >= b.x1 - 2 ? 'right' : 'left' }))
      .filter((n) => n.gap >= -2 && n.gap < (check ? W * 0.06 : W * 0.3) && (check || n.side === 'right'))
      .sort((p, q) => p.gap - q.gap);
    if (!near[0]) return null;
    if (check) return clean(near[0].w.text);
    // تُمدّ الكلمة إلى ما يليها يمينًا حتى فجوةٍ واسعة أو نقطتين: «رقم الهوية».
    const run = [near[0].w];
    for (;;) {
      const last = run[run.length - 1]!;
      const next = words
        .filter((w) => vOverlap(w.box, last.box) > height(last.box) * 0.4 && w.box.x0 >= last.box.x1 - 2 && w.box.x0 - last.box.x1 < W * 0.025)
        .sort((p, q) => p.box.x0 - q.box.x0)[0];
      if (!next || run.includes(next) || /[:：]$/.test(last.text)) break;
      run.push(next);
    }
    return clean(rtl(run).map((w) => w.text).join(' '));
  };

  // ٣) الصناديق الفارغة: خانات — والصغير المربّع اختيار، وما في جدولٍ خانةُ عمودٍ وصفّ.
  for (const c of cells) {
    if (used.some((u) => contains(u, c.box))) continue;
    const joined = c.words.map((w) => w.text).join('');
    const dateLike = (joined.match(/\//g)?.length ?? 0) >= 2;
    // فيه حرفٌ أو رقم: عنوانٌ أو رقم صفّ — ليس فارغًا (إلا التاريخ «/ / 19»).
    if (LETTER.test(c.text) && !dateLike) continue;
    if (!c.words.length && c.ink > 0.06) continue;
    const ratio = width(c.box) / height(c.box);
    const check = width(c.box) < W * 0.035 && height(c.box) < H * 0.03 && ratio > 0.6 && ratio < 1.6;
    if (check) {
      slots.push({ key: '', label: sideLabel(c.box, true) ?? 'اختيار', kind: 'check', box: c.box, from: 'box' });
      used.push(c.box);
      continue;
    }
    let side = sideLabel(c.box, false);
    // صفّ «المجموع» تحت رأسين: «رقمًا» و«كتابةً» فوق خانتيه مباشرة — فهما «المجموع رقمًا» و«المجموع كتابةً».
    const top = labels.find((o) => o.box.y1 <= c.box.y0 + 4 && c.box.y0 - o.box.y1 < height(c.box) * 0.6 && hOverlap(o.box, c.box) >= width(c.box) * 0.6);
    if (side && top && /رقم|كتاب/.test(top.text)) side = `${side} ${gradeTag(top.text)}`;
    const column = side ? null : columnOf(c.box);
    // رقم الصفّ من أقرب خانة «ت» يمينه — في جدوله لا في الجدول المجاور.
    const num = column
      ? cells.filter((o) => row(o.box, c.box) && /^[0-9٠-٩]{1,2}$/.test(o.text) && o.box.x0 >= c.box.x1 - 4).sort((p, q) => p.box.x0 - q.box.x0)[0]?.text
      : undefined;
    const label = side ?? (column ? [column.name, num].filter(Boolean).join(' ') : 'خانة');
    slots.push({ key: '', label, kind: dateLike ? 'date' : 'text', box: c.box, from: 'box', ...(column ? { column: column.name, columnId: column.id, row: num ?? '' } : {}) });
    used.push(c.box);
  }

  for (const s of slots) {
    if (s.from !== 'box' || s.column !== undefined || s.label !== 'خانة') continue;
    const twin = slots.find((o) => o.column !== undefined && /رقم(ًا|ا)$/.test(o.column) && row(o.box, s.box) && o.box.x0 >= s.box.x1 - 4 && o.box.x0 - s.box.x1 < W * 0.01);
    if (!twin) continue;
    s.column = twin.column!.replace(/رقم(ًا|ا)$/, 'كتابة');
    s.columnId = `${twin.columnId}:كتابة`;
    s.row = twin.row;
    s.label = [s.column, twin.row].filter(Boolean).join(' ');
  }

  const free = (b: Box) => !used.some((u) => vOverlap(u, b) > height(b) * 0.4 && hOverlap(u, b) > Math.min(width(b), width(u)) * 0.5);
  const add = (box: Box, kind: SlotKind, label: string) => {
    if (!free(box) || width(box) < W * 0.02) return;
    slots.push({ key: '', label, kind, box, from: 'line' });
    used.push(box);
  };
  /** الكلام قبل الموضع في سطره — يمينه، بترتيب القراءة. */
  const before = (b: Box) =>
    clean(
      rtl(words.filter((w) => vOverlap(w.box, b) > Math.min(height(w.box), height(b)) * 0.3 && w.box.x0 >= b.x1 - 2))
        .map((w) => w.text)
        .join(' ')
    );

  // ٤) خطوط النقاط من البكسلات — والقارئ كثيرًا ما يُسقطها.
  for (const lead of input.leaders ?? []) {
    if (used.some((u) => contains(u, lead, 4))) continue;
    add(lead, 'text', nameFrom(before(lead)));
  }

  // ٥) في السطر: ما فات من النقاط، والقوسان، والتاريخ، والشرطة بين سنتين، والفراغ بعد النقطتين.
  for (const line of lines) {
    const ws = rtl(line.words.filter((w) => w.text.trim()));
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      const t = w.text.trim();
      // التاريخ: «/ / 202» — شرطتان وما بينهما وما بعدهما من أرقام.
      if (/\//.test(t) && ws.slice(i, i + 4).filter((x) => x.text.includes('/')).length >= 2) {
        const group = [w];
        for (let j = i + 1; j < ws.length && j <= i + 4 && /^[/\d٠-٩\s]*$/.test(ws[j]!.text.trim()); j++) group.push(ws[j]!);
        add(union(group.map((g) => g.box)), 'date', 'التاريخ');
        i += group.length - 1;
        continue;
      }
      if (DOTS.test(t)) {
        add(w.box, 'text', nameFrom(before(w.box)));
        continue;
      }
      // القوسان — منفردين أو ملتصقين بكلمة («الامتحاني(» و«)وكانت»): ما بينهما فراغٌ إن خلا من الكلام.
      if (PAREN.test(t)) {
        const at = (x: OcrWord) => (/^[()]/.test(x.text.trim()) ? x.box.x1 : /[()]$/.test(x.text.trim()) ? x.box.x0 : (x.box.x0 + x.box.x1) / 2);
        const j = ws.findIndex((x, k) => k > i && PAREN.test(x.text.trim()));
        if (j > i) {
          const x1 = /^[()]$/.test(t) ? w.box.x0 : at(w);
          const close = ws[j]!;
          const x0 = /^[()]$/.test(close.text.trim()) ? close.box.x1 : at(close);
          const inner = ws.slice(i + 1, j).filter((x) => READABLE.test(x.text));
          if (x1 - x0 > W * 0.04 && !inner.length) {
            const box = { x0, y0: Math.min(w.box.y0, close.box.y0), x1, y1: Math.max(w.box.y1, close.box.y1) };
            const lead = /^[()]$/.test(t) ? before(w.box) : `${before(w.box)} ${t}`;
            add(box, 'text', nameFrom(clean(lead)));
            i = j;
          }
        }
        continue;
      }
      // «للسنة الدراسية    -    »: شرطةٌ منفردة بفراغين عريضين — العام الدراسي.
      if (/^[-–]$/.test(t)) {
        const prev = ws[i - 1];
        const next = ws[i + 1];
        const right = prev ? prev.box.x0 : w.box.x1 + W * 0.08;
        const left = next ? next.box.x1 : w.box.x0 - W * 0.08;
        if (right - w.box.x1 > W * 0.04 && w.box.x0 - left > W * 0.04) {
          add({ x0: left + 4, y0: w.box.y0 - height(w.box), x1: right - 4, y1: w.box.y1 + height(w.box) * 0.3 }, 'text', prev && /سن[ةه]|عام/.test(before(w.box)) ? 'السنة الدراسية' : nameFrom(before(w.box)));
        }
        continue;
      }
      // «العدد :» وفراغٌ بعده — لعنوانٍ قصير لا لآخر جملة («وقد حاز على الدرجات ادناه :»).
      if (/[:：]$/.test(t) || (t === ':' && i > 0)) {
        const head = ws.slice(0, i + 1).filter((x) => READABLE.test(x.text));
        if (head.length > 3) continue;
        const next = ws[i + 1];
        const gapEnd = next ? next.box.x1 : Math.max(0, w.box.x0 - W * 0.22);
        if (w.box.x0 - gapEnd > W * 0.06) {
          const box = { x0: Math.max(gapEnd + 4, w.box.x0 - W * 0.22), y0: w.box.y0, x1: w.box.x0 - 4, y1: w.box.y1 };
          add(box, 'text', clean(head.map((x) => x.text).join(' ')) || nameFrom(before(w.box)));
        }
      }
    }
  }

  return assignKeys(slots);
}

/**
 * المفاتيح من الأسماء: فريدة، و«رقمًا/كتابةً» زوجان بالأصل نفسه (`tafqeet.ts`)، و«المجموع» يجمع
 * الأرقام. ويُعاد بعد أن يصحّح الموظف الأسماء — فيتبع المفتاحُ الاسمَ الذي اختاره.
 */
export function assignKeys(slots: FormSlot[]): FormSlot[] {
  const taken = new Map<string, number>();
  const out = slots.map((s) => {
    let label = (s.column ? [s.column, s.row].filter(Boolean).join(' ') : s.label).replace(/\s+/g, ' ').trim() || 'خانة';
    // بلا `\b`: حدود الكلمة في تعابير JavaScript للاتينية وحدها.
    const digits = /رقم[اًا]+|رقماً/.test(label);
    const words = /كتاب[ةه]/.test(label);
    let key: string;
    if (digits || words) {
      // والتنوين بعد الكلمة معها: «كتابةً» تُمحى كلّها لا يبقى «ً» في المفتاح.
      const base = keyFromLabel(label.replace(/رقم[اًا]+|رقماً|كتاب[ةه][\u064B-\u0652]*/g, ' ').replace(/\s+/g, ' ').trim() || 'الدرجة');
      key = `${base}_${digits ? 'رقما' : 'كتابة'}`;
      label = `${base.replace(/_/g, ' ')} ${digits ? 'رقمًا' : 'كتابةً'}`;
    } else key = keyFromLabel(label);
    const n = (taken.get(key) ?? 0) + 1;
    taken.set(key, n);
    if (n > 1) {
      key = `${key}_${n}`;
      label = `${label} (${n})`;
    }
    return { ...s, key, label, sumOf: undefined as string[] | undefined };
  });
  const digitsKeys = out.filter((s) => s.key.endsWith('_رقما') && !s.key.startsWith('المجموع')).map((s) => s.key);
  for (const s of out) if (s.key.startsWith('المجموع') && s.key.endsWith('_رقما') && digitsKeys.length) s.sumOf = digitsKeys;
  return out.map(({ sumOf, ...s }) => (sumOf ? { ...s, sumOf } : s));
}

