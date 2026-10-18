/**
 * خلايا Excel قطعًا: المقاسات وورقة البيانات ونصّ الخليّة ومعادلاتها ومحاذاتها، واعتماد خانات ورقة البيانات — نُقل من `excelDoc.ts` (D83).
 */
import { type Inline, type Align, type Doc, type DocField, type Marks, run, makeField, fieldRef, type Block } from '@shared/doc';
import ExcelJS from 'exceljs';
import { cellText as cellValueText } from './cellText';
import { fixZeroPeriods, APPLY_THRESHOLD } from './blanks';

/** خلايا مدموجة أو خليّةٌ واحدة: أرقام الصفوف والأعمدة من ١، والحدّان داخلان. */
export type Range = { top: number; left: number; bottom: number; right: number };

/** خليّةٌ في صفّها كما تُرسم: مداها، ونصّها قطعًا بتنسيقها. */
export type Seg = {
  range: Range;
  inlines: Inline[];
  text: string;
  align: Align;
  /** حجم الخطّ بالبكسل. */
  px: number;
  bold: boolean;
  /** حدودٌ على ضلعين فأكثر — من جدول. */
  boxed: boolean;
};

export type Row = { r: number; height: number; segs: Seg[] };

export type ExcelSheetDoc = { name: string; doc: Doc; notes: string[] };

export type ExcelBook = {
  sheets: ExcelSheetDoc[];
  /** ورقة البيانات التي تملأ الكتب — لا تُستورد نموذجًا. */
  dataSheet: string | null;
  /** خانات ورقة البيانات: مفتاحها واسمها وقيمتها فيها. */
  dataFields: { key: string; label: string; sample: string }[];
  /** أوراقٌ لم تُستورد وسببها. */
  skipped: { name: string; reason: string }[];
};

// ── المقاسات ─────────────────────────────────────────────────────────

/** عرض عمود Excel (بالأحرف) بكسلًا — كما يحسبه Excel بخطّه الافتراضي. */
export const colPx = (width: number | undefined) => Math.max(0, Math.trunc(((256 * (width ?? 8.43) + Math.trunc(128 / 7)) / 256) * 7));

/** ارتفاع الصفّ بالنقاط بكسلًا. */
export const ptPx = (pt: number) => (pt * 96) / 72;

export const EMU_PX = 9525;

export function parseRange(ref: string): Range | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(ref.trim().replace(/^.*!/, '').replace(/'/g, ''));
  if (!m) return null;
  const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const a = { r: Number(m[2]), c: col(m[1]!) };
  const b = m[3] ? { r: Number(m[4]), c: col(m[3]) } : a;
  return { top: Math.min(a.r, b.r), left: Math.min(a.c, b.c), bottom: Math.max(a.r, b.r), right: Math.max(a.c, b.c) };
}

export const inside = (outer: Range, r: number, c: number) => r >= outer.top && r <= outer.bottom && c >= outer.left && c <= outer.right;

// ── ورقة البيانات ────────────────────────────────────────────────────

export const REF = /(?:'([^']+)'|([^\s'!=&(),+\-*/]+))!\$?([A-Z]{1,3})\$?(\d+)/g;

/** الورقة التي تشير إليها معادلات الأوراق الأخرى أكثر — ثلاث مرّاتٍ فأكثر. */
export function dataSheetOf(book: ExcelJS.Workbook): string | null {
  const counts = new Map<string, number>();
  for (const ws of book.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value as { formula?: string } | null;
        if (!v || typeof v !== 'object' || typeof v.formula !== 'string') return;
        for (const m of v.formula.matchAll(REF)) {
          const name = m[1] ?? m[2]!;
          if (name !== ws.name) counts.set(name, (counts.get(name) ?? 0) + 1);
        }
      })
    );
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 3 && book.getWorksheet(best[0]) ? best[0] : null;
}

const PREPOSITIONS = new Set(['في', 'من', 'على', 'الى', 'إلى', 'عن', 'لدى', 'مع', 'ل']);

/** اسم الخانة من عنوان بيانها: «المديرية العامة للتربية في محافظة» ← «المحافظة». */
export function fieldNameOf(label: string): string {
  const words = label.replace(/[:：]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  let picked = words;
  if (words.length > 3) {
    const at = words.map((w, i) => (PREPOSITIONS.has(w) ? i : -1)).filter((i) => i >= 0 && i < words.length - 1).pop();
    picked = at === undefined ? words.slice(-3) : words.slice(at + 1);
    if (picked.length > 3) picked = picked.slice(-3);
  }
  const name = picked.join(' ');
  if (!name) return 'خانة';
  return picked.length === 1 && !name.startsWith('ال') && /^[ء-ي]/.test(name) ? `ال${name}` : name;
}

/** نصّ الخليّة كما يُرى — والدمج يُقرأ من خليّته الأولى. (قارئٌ واحد مع القوائم: `cellText.ts`.) */
function cellText(cell: ExcelJS.Cell): string {
  return cellValueText(cell).replace(/\s+$/g, '');
}

/**
 * خانات ورقة البيانات: لكلّ خليّةٍ تشير إليها المعادلات اسمٌ من عنوانها — أقرب خليّةٍ قبلها في صفّها نصُّها
 * ليس قيمةً هي الأخرى («العام الدراسي | 2025 / | 2026»: الاثنتان من عنوانٍ واحد).
 */
export function dataFieldsOf(data: ExcelJS.Worksheet, refs: Set<string>): Map<string, { key: string; label: string; sample: string }> {
  const merges = (data.model.merges ?? []).map(parseRange).filter((m): m is Range => m !== null);
  const masterAt = (r: number, c: number) => {
    const m = merges.find((x) => inside(x, r, c));
    return m ? data.getCell(m.top, m.left) : data.getCell(r, c);
  };
  const out = new Map<string, { key: string; label: string; sample: string }>();
  const used = new Map<string, number>();
  for (const address of [...refs].sort()) {
    const at = parseRange(address);
    if (!at) continue;
    let label = '';
    for (let c = at.left - 1; c >= 1 && !label; c--) {
      const cell = masterAt(at.top, c);
      const text = cellText(cell).trim();
      if (!text || refs.has(cell.address)) continue;
      label = text;
    }
    const name = fieldNameOf(label || address);
    const n = (used.get(name) ?? 0) + 1;
    used.set(name, n);
    // عنوانٌ واحد لخليّتين («العام الدراسي: 2025 / | 2026»): الثانية برقمها.
    const shown = n === 1 ? name : `${name} ${n}`;
    out.set(address, { key: shown.replace(/\s+/g, '_'), label: shown, sample: cellText(masterAt(at.top, at.left)).trim() });
  }
  return out;
}

// ── نصّ الخليّة قطعًا ─────────────────────────────────────────────────

/**
 * مسافاتٌ طويلة فراغٌ يُملأ — نقاطٌ بطوله. إلا ما جاور «/» من تاريخٍ يُكتب باليد، وما بعد رقم بندٍ («1-     ورقة
 * تبليغ»): ذلك تنسيقٌ لا فراغ. وكذلك ما جاور فراغًا منقوطًا («...... ⎵⎵⎵ ختم المدرسة»: يُبعد الختم عن الفراغ)، وما
 * بين كلامٍ وقوسه («(( واقع حال ⎵⎵⎵ ))»: عنوانٌ في قوسين) — فهو باقٍ كما رُسم.
 */
export function gapsToDots(text: string, prior = '', next = ''): string {
  // و`prior` و`next` نصّ الخليّة قبل المقطع وبعده: «[٩ نقطة]...... | [١٦ نقطة]⎵⎵⎵⎵⎵ بعنوان» مسافةٌ بجوار نقاطٍ في مقطعٍ
  // آخر — وكانت تصير فراغًا ثانيًا باسم الأوّل فيُطبع الاسم مرّتين.
  return text.replace(/ {5,}/g, (gap, at: number, all: string) => {
    // والجيران بلا مسافاتهم: «( ⎵ | [مقطع] ⎵⎵⎵⎵⎵ | ⎵ )» قوسٌ فارغٌ يُملأ ولو فصلت مسافةٌ بينه وبين الفراغ.
    const before = (prior + all.slice(0, at)).trimEnd();
    const after = (all.slice(at + gap.length) + next).trimStart();
    if (before.endsWith('/') || after.startsWith('/')) return '   ';
    if (/^\s*[\d٠-٩]+\s*[-.)–]\s*$/.test(before)) return '  ';
    if (/[.…_]{3,}$/.test(before) || /^[.…_]{3,}/.test(after)) return gap;
    if ((after.startsWith(')') && !before.endsWith('(')) || (before.endsWith('(') && after !== '' && !after.startsWith(')'))) return gap;
    return ` ${'.'.repeat(Math.min(Math.max(gap.length, 6), 40))} `;
  });
}

/** «0» يُكتب بدل النقطة في لوحة المفاتيح العربية («مع التقدير0») — يُصحّح كما في قارئ Word. */
function fixZeros(text: string, notes: Set<string>): string {
  let out = text;
  for (let guard = 0; guard < 20; guard++) {
    const fix = fixZeroPeriods(out).find((s) => s.confidence >= APPLY_THRESHOLD);
    if (!fix) break;
    out = fix.value.replace(/\s+\.(\s|$)/, '.$1');
    notes.add('«0» كُتب بدل النقطة فصُحّح «.»');
  }
  return out;
}

export type Ctx = {
  ws: ExcelJS.Worksheet;
  data: string | null;
  fields: Map<string, { key: string; label: string; sample: string }>;
  /** قيم ورقة البيانات نصوصًا تُعرف إن كُتبت في الكتب بلا معادلة — الأطول أوّلًا. */
  literals: { address: string; re: RegExp }[];
  used: Map<string, DocField>;
  notes: Set<string>;
};

/**
 * قيمةٌ من ورقة البيانات مكتوبةٌ في الكتاب بلا معادلة — اسم المدير في توقيعٍ كُتب باليد، و«لتربية القادسية» — خانتُها:
 * وإلا بقي اسم مدير مدرسةٍ ومحافظتُها في كتب كلّ مدرسة. والقيمة كلمةٌ تامّة (لا جزءُ كلمةٍ أطول)، بخمسة أحرفٍ فأكثر،
 * ولا رقمًا (العام يُكتب في التواريخ أيضًا).
 */
export function literalsOf(fields: Map<string, { sample: string }>): Ctx['literals'] {
  const AR = 'ء-يـ';
  return [...fields]
    .filter(([, f]) => (f.sample.match(/[ء-ي]/g) ?? []).length >= 5)
    .sort((a, b) => b[1].sample.length - a[1].sample.length)
    .map(([address, f]) => {
      // المدّ والمسافات المكرّرة لا تمنع المطابقة: «سالم  حسن» و«سالــم» هما هما.
      const body = [...f.sample.trim()].map((ch) => (/\s/.test(ch) ? '\\s+' : `${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}ـ*`)).join('');
      return { address, re: new RegExp(`(?<![${AR}])${body}(?![${AR}])`) };
    });
}

/** النصّ قطعًا، وما فيه من قيم ورقة البيانات خاناتُها. */
function literalInlines(ctx: Ctx, text: string, marks: Marks | undefined): Inline[] {
  for (const l of ctx.literals) {
    const m = l.re.exec(text);
    if (!m) continue;
    const field = fieldInline(ctx, l.address);
    if (!field) continue;
    ctx.notes.add('قيمةٌ من ورقة البيانات مكتوبةٌ بلا معادلة صارت خانتها');
    return [...literalInlines(ctx, text.slice(0, m.index), marks), field, ...literalInlines(ctx, text.slice(m.index + m[0].length), marks)];
  }
  return text ? [run(text, marks)] : [];
}

function marksOf(font: Partial<ExcelJS.Font> | undefined, basePx: number): Marks | undefined {
  const marks: Marks = {};
  if (font?.bold) marks.bold = true;
  if (font?.italic) marks.italic = true;
  if (font?.underline && font.underline !== 'none') marks.underline = true;
  const px = font?.size ? Math.round(ptPx(font.size) * 10) / 10 : basePx;
  if (Math.abs(px - basePx) > 0.5) marks.size = px;
  return Object.keys(marks).length ? marks : undefined;
}

/** مرجعٌ إلى ورقة البيانات خانةً — والخانة تُعرَّف مرّةً في الوثيقة. */
function fieldInline(ctx: Ctx, address: string): Inline | null {
  const f = ctx.fields.get(address);
  if (!f) return null;
  if (!ctx.used.has(f.key)) ctx.used.set(f.key, makeField({ key: f.key, label: f.label, width: Math.max(8, f.sample.length) }));
  return fieldRef(f.key);
}

/** قطع المعادلة إن كانت وصلًا لنصوصٍ ومراجع إلى ورقة البيانات («"مدرسة "&'الرئسية '!I4») — وإلا لا شيء. */
function formulaInlines(ctx: Ctx, formula: string, marks: Marks | undefined): Inline[] | null {
  const parts: string[] = [];
  let buf = '';
  let quoted = false;
  for (const ch of formula.replace(/^=/, '')) {
    if (ch === '"') quoted = !quoted;
    if (ch === '&' && !quoted) {
      parts.push(buf.trim());
      buf = '';
    } else buf += ch;
  }
  parts.push(buf.trim());
  const out: Inline[] = [];
  for (const p of parts) {
    const lit = /^"((?:[^"]|"")*)"$/.exec(p);
    if (lit) {
      if (lit[1]) out.push(run(gapsToDots(lit[1].replace(/""/g, '"')), marks));
      continue;
    }
    const ref = /^(?:'([^']+)'|([^\s'!]+))!\$?([A-Z]{1,3})\$?(\d+)$/.exec(p);
    if (!ref || (ref[1] ?? ref[2]) !== ctx.data) return null;
    const field = fieldInline(ctx, `${ref[3]}${ref[4]}`);
    if (!field) return null;
    out.push(field);
  }
  return out;
}

export function cellInlines(ctx: Ctx, cell: ExcelJS.Cell, basePx: number): Inline[] {
  const v = cell.value as unknown;
  const marks = marksOf(cell.font, basePx);
  if (v && typeof v === 'object' && 'formula' in (v as object)) {
    const formula = String((v as { formula: string }).formula);
    const own = ctx.data ? formulaInlines(ctx, formula, marks) : null;
    if (own) return own;
    // صفرٌ من معادلةٍ إلى خليّةٍ فارغة: Excel يخفيه، ولا يُكتب في الكتاب.
    if (cellText(cell).trim() === '0') return [];
    ctx.notes.add('معادلاتٌ كُتبت نتيجتها كما حُسبت في Excel');
  }
  if (v && typeof v === 'object' && 'richText' in (v as object)) {
    const runs = ((v as { richText: { text: string; font?: Partial<ExcelJS.Font> }[] }).richText ?? []).filter((r) => r.text).map((r) => ({ ...r }));
    // مسافات أوّل الخليّة وآخرها إزاحةٌ لا فراغ — ولو كانت مقاطع وحدها: «⎵⎵⎵ | ⎵⎵ جمهورية العراق» تبدأ بالكلمة،
    // وكانت المسافات في المقطع الثاني تصير نقاطًا وخانة.
    for (let i = 0; i < runs.length; i++) {
      runs[i]!.text = runs[i]!.text.replace(/^\s+/, '');
      if (runs[i]!.text) break;
    }
    for (let i = runs.length - 1; i >= 0; i--) {
      runs[i]!.text = runs[i]!.text.replace(/\s+$/, '');
      if (runs[i]!.text) break;
    }
    const out: Inline[] = [];
    runs.forEach((r, i) => {
      const prior = runs.slice(0, i).map((x) => x.text).join('');
      const next = runs.slice(i + 1).map((x) => x.text).join('');
      if (r.text) out.push(...literalInlines(ctx, gapsToDots(fixZeros(r.text, ctx.notes), prior, next), marksOf({ ...cell.font, ...r.font }, basePx)));
    });
    return out;
  }
  const text = cellText(cell).trim();
  return text ? literalInlines(ctx, gapsToDots(fixZeros(text, ctx.notes)), marks) : [];
}

// ── المحاذاة ─────────────────────────────────────────────────────────

export function alignOf(h: string | undefined, text: string): Align {
  switch (h) {
    case 'center':
    case 'centerContinuous':
      return 'center';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'justify':
    case 'distributed':
      return 'justify';
    default:
      // «عام»: النصّ العربي يبدأ يمينًا، والرقم وحده يمينًا كذلك في الورقة العربية.
      return /[A-Za-z]/.test(text) && !/[ء-ي]/.test(text) ? 'left' : 'right';
  }
}

/** مراجع خانةٍ إلى أخرى في الوثيقة كلّها: المتن والأعمدة والجداول والمجموعات. */
function retarget(blocks: Block[], from: string, to: string): Block[] {
  const fix = (list: Inline[]) => list.map((i) => (i.kind === 'field' && i.ref === from ? { ...i, ref: to } : i));
  return blocks.map((b): Block => {
    switch (b.kind) {
      case 'paragraph':
        return { ...b, inlines: fix(b.inlines) };
      case 'table':
        return { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map((p) => ({ ...p, inlines: fix(p.inlines) })) })) })) };
      case 'columns':
        return { ...b, columns: b.columns.map((col) => retarget(col, from, to)) };
      case 'group':
        return { ...b, blocks: retarget(b.blocks, from, to) };
      default:
        return b;
    }
  });
}

/**
 * فراغٌ باسم خانةٍ من ورقة البيانات هو هي: «المديرية العامة لتربية ......» المحافظةُ نفسها — تُكتب مرّةً كما تكتبها
 * ورقة البيانات، لا فراغٌ ثانٍ بجانب خانتها. إلا اسمًا لخليّتين («العام الدراسي» و«العام الدراسي 2»): لا يُدرى أيّهما.
 */
export function adoptDataFields(doc: Doc, dataFields: ExcelBook['dataFields']): { doc: Doc; adopted: { key: string; label: string }[] } {
  const single = new Map(dataFields.filter((f) => !dataFields.some((g) => g !== f && g.label.startsWith(`${f.label} `))).map((f) => [f.label, f]));
  let out = doc;
  const adopted: { key: string; label: string }[] = [];
  for (const f of doc.fields) {
    const data = single.get(f.label);
    if (!data || f.key === data.key || f.fillMode !== 'hand') continue;
    const has = out.fields.some((x) => x.key === data.key);
    out = {
      ...out,
      blocks: retarget(out.blocks, f.key, data.key),
      fields: out.fields.flatMap((x) => (x.key !== f.key ? [x] : has ? [] : [makeField({ key: data.key, label: data.label, width: Math.max(8, data.sample.length) })]))
    };
    if (!has) adopted.push({ key: data.key, label: data.label });
  }
  return { doc: out, adopted };
}
