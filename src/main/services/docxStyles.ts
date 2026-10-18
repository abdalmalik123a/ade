/**
 * قارئ Word — الأنماط ووراثتها والترقيم ومقاس الصفحة وسياق القراءة (`Ctx`) — نُقل من `docxDoc.ts` (D79).
 */
import { type XNode, toggle, kid, val, num, kidsOf, parseXml, find } from './docxXml';
import { wordColor } from '@shared/docPmMarks';
import { toIndic } from '@shared/arabic';
import { type PageSize, PAGE_MM, type PageSetup } from '@shared/doc';

/** ملف يُنقل من حزمة Word إلى مخزن التطبيق فيعيد مساره النسبي. */
export type SaveImage = (bytes: Uint8Array, extension: string) => string | null;

// ── الأنماط: ما لم يُكتب على المقطع يُرث من نمطه ثم من افتراض المستند ──

/** والشطب وأعلى السطر واللون (البند ٣): `''` صريحٌ يُلغي ما ورثه المقطع من نمطه — «على السطر» و«تلقائي». */
export type RProps = {
  b?: boolean; bCs?: boolean; i?: boolean; iCs?: boolean; u?: boolean; sz?: number; szCs?: number; rtl?: boolean;
  strike?: boolean; script?: 'sup' | 'sub' | ''; color?: string;
};

export type PProps = {
  jc?: string;
  bidi?: boolean;
  after?: number;
  before?: number;
  line?: number;
  lineRule?: string;
  firstLine?: number;
  hanging?: number;
  start?: number;
  tabs?: number[];
  numId?: string;
  ilvl?: number;
  /** حدٌّ سفليّ للفقرة: الخطّ الفاصل الذي يرسمه Word تحت أسطر الرأس («___» ثم Enter). */
  ruleBelow?: boolean;
};

export function readR(rpr: XNode | undefined): RProps {
  if (!rpr) return {};
  const o: RProps = {};
  const set = <K extends keyof RProps>(key: K, v: RProps[K] | undefined) => {
    if (v !== undefined) o[key] = v;
  };
  set('b', toggle(kid(rpr, 'w:b')));
  set('bCs', toggle(kid(rpr, 'w:bCs')));
  set('i', toggle(kid(rpr, 'w:i')));
  set('iCs', toggle(kid(rpr, 'w:iCs')));
  set('rtl', toggle(kid(rpr, 'w:rtl')));
  const u = kid(rpr, 'w:u');
  if (u) o.u = (val(u) ?? 'single') !== 'none';
  set('sz', num(val(kid(rpr, 'w:sz'))));
  set('szCs', num(val(kid(rpr, 'w:szCs'))));
  // والشطب المزدوج يُنقل شطبًا واحدًا — والورقة لا ترسم غيره.
  const strike = toggle(kid(rpr, 'w:strike')) ?? toggle(kid(rpr, 'w:dstrike'));
  set('strike', strike);
  const va = val(kid(rpr, 'w:vertAlign'));
  if (va) o.script = va === 'superscript' ? 'sup' : va === 'subscript' ? 'sub' : '';
  const color = kid(rpr, 'w:color');
  if (color) o.color = wordColor(val(color)) ?? '';
  return o;
}

export function readP(ppr: XNode | undefined): PProps {
  if (!ppr) return {};
  const o: PProps = {};
  const jc = val(kid(ppr, 'w:jc'));
  if (jc) o.jc = jc;
  const bidi = toggle(kid(ppr, 'w:bidi'));
  if (bidi !== undefined) o.bidi = bidi;
  const sp = kid(ppr, 'w:spacing');
  if (sp) {
    const after = num(sp.attrs['w:after']);
    const before = num(sp.attrs['w:before']);
    const line = num(sp.attrs['w:line']);
    if (after !== undefined) o.after = after;
    if (before !== undefined) o.before = before;
    if (line !== undefined) o.line = line;
    if (sp.attrs['w:lineRule']) o.lineRule = sp.attrs['w:lineRule'];
  }
  const ind = kid(ppr, 'w:ind');
  if (ind) {
    const first = num(ind.attrs['w:firstLine']);
    const hanging = num(ind.attrs['w:hanging']);
    const start = num(ind.attrs['w:start']);
    if (first !== undefined) o.firstLine = first;
    if (hanging !== undefined) o.hanging = hanging;
    if (start !== undefined) o.start = start;
  }
  const tabs = kidsOf(kid(ppr, 'w:tabs'), 'w:tab')
    .filter((t) => val(t) !== 'clear')
    .map((t) => num(t.attrs['w:pos']))
    .filter((p): p is number => typeof p === 'number' && p > 0);
  if (tabs.length) o.tabs = tabs;
  const bottom = kid(kid(ppr, 'w:pBdr'), 'w:bottom');
  if (bottom) o.ruleBelow = !['nil', 'none'].includes(val(bottom) ?? 'none');
  const numPr = kid(ppr, 'w:numPr');
  if (numPr) {
    const id = val(kid(numPr, 'w:numId'));
    if (id && id !== '0') {
      o.numId = id;
      o.ilvl = num(val(kid(numPr, 'w:ilvl'))) ?? 0;
    }
  }
  return o;
}

export type Style = { basedOn?: string; r: RProps; p: PProps; node: XNode };

export type Styles = {
  r: RProps;
  p: PProps;
  byId: Map<string, Style>;
  defaultPara?: string;
};

export function readStyles(xml: string | undefined): Styles {
  const out: Styles = { r: {}, p: {}, byId: new Map() };
  if (!xml) return out;
  const root = parseXml(xml);
  const styles = find(root, 'w:styles');
  const defaults = kid(styles, 'w:docDefaults');
  out.r = readR(kid(kid(defaults, 'w:rPrDefault'), 'w:rPr'));
  out.p = readP(kid(kid(defaults, 'w:pPrDefault'), 'w:pPr'));
  for (const s of kidsOf(styles, 'w:style')) {
    const id = s.attrs['w:styleId'];
    if (!id) continue;
    out.byId.set(id, {
      basedOn: val(kid(s, 'w:basedOn')),
      r: readR(kid(s, 'w:rPr')),
      p: readP(kid(s, 'w:pPr')),
      node: s
    });
    if (s.attrs['w:type'] === 'paragraph' && ['1', 'true', 'on'].includes(s.attrs['w:default'] ?? '')) {
      out.defaultPara = id;
    }
  }
  return out;
}

/** سلسلة `basedOn` من الأبعد إلى الأقرب — والأقرب يغلب. */
export function chain(styles: Styles, id: string | undefined): Style[] {
  const out: Style[] = [];
  const seen = new Set<string>();
  for (let at = id; at && !seen.has(at) && out.length < 20; ) {
    seen.add(at);
    const s = styles.byId.get(at);
    if (!s) break;
    out.unshift(s);
    at = s.basedOn;
  }
  return out;
}

// ── الترقيم: ما يرسمه Word رقمًا لا نصًّا يُكتب هنا نصًّا ────────────

export const AR_ALPHA = [...'أبتثجحخدذرزسشصضطظعغفقكلمنهوي'];

export const AR_ABJAD = [...'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ'];

export function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case 'bullet':
      return '•';
    case 'arabicAlpha':
      return AR_ALPHA[(n - 1) % AR_ALPHA.length]!;
    case 'arabicAbjad':
      return AR_ABJAD[(n - 1) % AR_ABJAD.length]!;
    case 'lowerLetter':
      return String.fromCharCode(96 + (((n - 1) % 26) + 1));
    case 'upperLetter':
      return String.fromCharCode(64 + (((n - 1) % 26) + 1));
    case 'hindiNumbers':
    case 'arabicAbjadNumbers':
      return toIndic(n);
    default:
      return String(n);
  }
}

export type Numbering = (numId: string, ilvl: number) => string | null;

export function readNumbering(xml: string | undefined, notes: Set<string>): Numbering {
  if (!xml) return () => null;
  const root = find(parseXml(xml), 'w:numbering');
  const abstracts = new Map<string, XNode>();
  for (const a of kidsOf(root, 'w:abstractNum')) abstracts.set(a.attrs['w:abstractNumId'] ?? '', a);
  const nums = new Map<string, string>();
  for (const n of kidsOf(root, 'w:num')) {
    nums.set(n.attrs['w:numId'] ?? '', val(kid(n, 'w:abstractNumId')) ?? '');
  }
  const counters = new Map<string, number[]>();

  return (numId, ilvl) => {
    const abs = abstracts.get(nums.get(numId) ?? '');
    const lvl = kidsOf(abs, 'w:lvl').find((l) => num(l.attrs['w:ilvl']) === ilvl);
    if (!lvl) return null;
    const fmt = val(kid(lvl, 'w:numFmt')) ?? 'decimal';
    const text = val(kid(lvl, 'w:lvlText')) ?? '%1.';
    const start = num(val(kid(lvl, 'w:start'))) ?? 1;

    const levels = counters.get(numId) ?? [];
    levels[ilvl] = (levels[ilvl] ?? start - 1) + 1;
    levels.length = ilvl + 1; // الأعمق يبدأ من جديد تحت كل عنصرٍ أعلى
    counters.set(numId, levels);

    if (!['decimal', 'bullet', 'arabicAlpha', 'arabicAbjad', 'lowerLetter', 'upperLetter', 'hindiNumbers', 'arabicAbjadNumbers'].includes(fmt)) {
      notes.add(`ترقيم Word بنمط «${fmt}» قُرئ أرقامًا عادية — راجعه`);
    }
    if (fmt === 'bullet') return '•';
    return text.replace(/%(\d)/g, (_, l: string) => formatNumber(levels[Number(l) - 1] ?? 1, fmt));
  };
}

export const twToMm = (tw: number) => Math.round((tw / 1440) * 25.4 * 10) / 10;

export type Ctx = {
  styles: Styles;
  numbering: Numbering;
  notes: Set<string>;
  rels: Map<string, string>;
  files: Record<string, Uint8Array>;
  saveImage?: SaveImage;
  defaultTab: number;
  contentWidthTw: number;
  contentWidthPx: number;
};

/** خصائص الفقرة بعد الوراثة: افتراض المستند ← نمطها ← ما كُتب عليها. */
export function paraProps(p: XNode, ctx: Ctx): { pp: PProps; styleR: RProps; markR: RProps } {
  const ppr = kid(p, 'w:pPr');
  const styleId = val(kid(ppr, 'w:pStyle')) ?? ctx.styles.defaultPara;
  const styles = chain(ctx.styles, styleId);
  const pp: PProps = Object.assign({}, ctx.styles.p, ...styles.map((s) => s.p), readP(ppr));
  const styleR: RProps = Object.assign({}, ctx.styles.r, ...styles.map((s) => s.r));
  const markR: RProps = { ...styleR, ...readR(kid(ppr, 'w:rPr')) };
  return { pp, styleR, markR };
}

// ── الصفحة ───────────────────────────────────────────────────────────

/**
 * مقاس الورقة من أبعاد Word (بالتويب): أقرب المقاسات المعروفة، بتفاوت ٤٥٠ تويبًا (نحو ٨ ملم) في الجهتين —
 * فالفولسكاب بعرض ٢١٠ أو ٢١٦ (Word يسمّيه Folio ٨٫٥×١٣) يُقرأ فولسكاب. وخارج ذلك: القاعدة القديمة
 * (قصيرُه A5، وطويلُه ٣٣ سم فولسكاب) وإلا A4.
 */
export const TWIPS_PER_MM = 1440 / 25.4;

export function sizeOfTwips(w: number, h: number): PageSize {
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  let best: PageSize | null = null;
  let bestGap = Infinity;
  for (const [size, mm] of Object.entries(PAGE_MM) as [PageSize, { w: number; h: number }][]) {
    const dShort = Math.abs(short - mm.w * TWIPS_PER_MM);
    const dLong = Math.abs(long - mm.h * TWIPS_PER_MM);
    if (dShort > 450 || dLong > 450) continue;
    if (dShort + dLong < bestGap) {
      best = size;
      bestGap = dShort + dLong;
    }
  }
  if (best) return best;
  return Math.abs(short - 8391) < 300 ? 'A5' : Math.abs(long - 18720) < 400 ? 'FS' : 'A4';
}

export function pageSetupFrom(sect: XNode | undefined): { setup: PageSetup; widthTw: number } {
  const pgSz = kid(sect, 'w:pgSz');
  const mar = kid(sect, 'w:pgMar');
  const w = num(pgSz?.attrs['w:w']) ?? 11906;
  const h = num(pgSz?.attrs['w:h']) ?? 16838;
  const m = (key: string, def: number) => num(mar?.attrs[key]) ?? def;
  const margins = {
    top: twToMm(m('w:top', 1134)),
    right: twToMm(m('w:right', 1134)),
    bottom: twToMm(m('w:bottom', 1134)),
    left: twToMm(m('w:left', 1134))
  };
  return {
    setup: {
      // والفولسكاب بطوله ٣٣ سم (١٨٧٠٩) — ومنه ما كُتب ١٣ إنشًا (١٨٧٢٠)، فيُقرأ فولسكاب ٢١٠×٣٣٠.
      size: sizeOfTwips(w, h),
      orientation: w > h ? 'landscape' : 'portrait',
      margins,
      // الرأس أسطرٌ في أعلى الورقة هنا (كما يُصنع في Word) — فلا ترويسة تُطبع فوقه.
      letterheadMode: 'lines',
      repeatLetterhead: false,
      pageNumbers: false,
      numerals: 'arabic',
      watermark: null
    },
    widthTw: w - m('w:left', 1134) - m('w:right', 1134)
  };
}
