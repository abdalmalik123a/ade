/**
 * ورقة المستمسكات كما يعمل المكتب (S47، ر180–ر182): نموذجٌ واحد لـ«استنساخ هوية» و«الورقة المجمّعة» معًا.
 *
 * المستمسك نوعٌ بمقاسه (`idDocTypes.json`، جدول المالك في `docs/sections/scan.md` §٦) ووجهٌ أو وجهٌ وظهر، وترتيبهما
 * جنبًا أو فوق، وعدد نسخه. والورقة تُرصف وحدها: كلّ نسخةٍ وحدةٌ بوجهيها، أسطرًا من اليمين كالقراءة، والسطر في وسط
 * الورقة والأسطر في وسطها رأسيًّا (كما كانت `idSheet.ts`)، وما لا يسعه الباقي ورقةٌ تالية. ووحدةٌ لا تسعها الورقة
 * بترتيبها تُجرَّب بالآخر، ثم يُفصل وجهاها، ثم يُصغَّر الوجه ليسعها — لا يُقصّ. والخانة الفارغة لها موضعها فتُرى وتُنقر.
 *
 * والصورة **تُحتوى** في خانتها (`contain`) فلا يُقصّ طرفها بصمت — كان القديم يقصّ (`cover`).
 */
import TYPES from './idDocTypes.json';
import { cardFilterCss, type IdColorFilter } from './idCardDuplex';
import { normalizeFold } from './arabic';
import { escapeHtml } from './html';
import { tiledWatermark, type WatermarkOptions } from './watermark';

export const A4 = { w: 210, h: 297 };
const MARGIN = 10;
const GAP = 6;

export type IdDocType = { key: string; label: string; w: number; h: number; faces: 1 | 2; words: string[]; note: string };
export type Face = 'front' | 'back';
export type Arrange = 'side' | 'over';

export type SheetDoc = {
  id: string;
  typeKey: string;
  label: string;
  /** المقاس بالملّم: الأفقيّ أوّلًا كما في جدول المالك. */
  w: number;
  h: number;
  faces: 1 | 2;
  front: string | null;
  back: string | null;
  /** الظهر بجانب الوجه أم تحته. */
  arrange: Arrange;
  copies: number;
};

/** موضع وجهٍ على ورقة: `doc` رقم المستمسك في القائمة، و`scale` < ١ لما صُغِّر ليسع الورقة. */
export type DocPlacement = { doc: number; face: Face; copy: number; page: number; x: number; y: number; w: number; h: number; scale: number };

export function docTypes(): IdDocType[] {
  return TYPES as IdDocType[];
}

export function docType(key: string): IdDocType {
  const all = docTypes();
  return all.find((t) => t.key === key) ?? all.find((t) => t.key === 'other')!;
}

let seq = 0;

export function newDoc(typeKey: string, patch: Partial<SheetDoc> = {}): SheetDoc {
  const t = docType(typeKey);
  return {
    id: `doc-${Date.now().toString(36)}-${++seq}`,
    typeKey: t.key,
    label: t.label,
    w: t.w,
    h: t.h,
    faces: t.faces,
    front: null,
    back: null,
    arrange: 'side',
    copies: 1,
    ...patch
  };
}

/** «استنساخ هوية» يبدأ بالوطنية وحدها، و«المستمسكات على ورقة» بالوطنية والسكن (كافتراض الورقة القديمة). */
export function startDocs(start: 'id-copy' | 'id-sheet'): SheetDoc[] {
  return start === 'id-copy' ? [newDoc('national')] : [newDoc('national'), newDoc('residence')];
}

const has = (s: string, word: string) => normalizeFold(s).includes(normalizeFold(word));

/** نوع مستمسكٍ محفوظ من اسمه: أوّل نوعٍ في الجدول تقع إحدى كلماته فيه. */
export function typeOfName(name: string): string | null {
  return docTypes().find((t) => t.words.some((w) => has(name, w)))?.key ?? null;
}

/**
 * مستمسكات الشخص في وجوهها الفارغة: «البطاقة الوطنية — الظهر» لظهر الوطنية، وما لم يُعرف ظهره يُعدّ وجهًا،
 * ولا يُستعمل محفوظٌ مرّتين. وما لم يُوجد يبقى فارغًا — ولا يُضاف مستمسكٌ لم يُطلب.
 */
export function fillDocs(docs: SheetDoc[], attachments: { docType: string; filePath: string }[]): SheetDoc[] {
  const used = new Set<string>();
  const pick = (typeKey: string, face: Face) => {
    const hit = attachments.find(
      (a) => !used.has(a.filePath) && typeOfName(a.docType) === typeKey && (has(a.docType, 'الظهر') ? 'back' : 'front') === face
    );
    if (hit) used.add(hit.filePath);
    return hit?.filePath ?? null;
  };
  return docs.map((d) => {
    const front = d.front ?? pick(d.typeKey, 'front');
    const back = d.faces === 2 ? (d.back ?? pick(d.typeKey, 'back')) : d.back;
    return { ...d, front, back };
  });
}

type Item = { face: Face; dx: number; dy: number; w: number; h: number; scale: number };
type Unit = { doc: number; copy: number; w: number; h: number; items: Item[] };

const usable = (margin: number) => ({ w: A4.w - 2 * margin, h: A4.h - 2 * margin });

/** وجهٌ وحده — يُصغَّر إن جاوز الورقة بهوامشها. */
function single(doc: number, copy: number, face: Face, w: number, h: number, room: { w: number; h: number }): Unit {
  const k = Math.min(1, room.w / w, room.h / h);
  return { doc, copy, w: w * k, h: h * k, items: [{ face, dx: 0, dy: 0, w: w * k, h: h * k, scale: k }] };
}

/** وحدات المستمسك: بوجهيه بترتيبه، أو بالآخر، أو وجهان منفصلان. */
function unitsOf(d: SheetDoc, doc: number, copy: number, duplex: boolean, gap: number, room: { w: number; h: number }): Unit[] {
  if (d.faces === 1 || duplex) return [single(doc, copy, 'front', d.w, d.h, room)];
  const fits = (a: Arrange) => (a === 'side' ? 2 * d.w + gap <= room.w && d.h <= room.h : d.w <= room.w && 2 * d.h + gap <= room.h);
  const arrange = fits(d.arrange) ? d.arrange : fits(d.arrange === 'side' ? 'over' : 'side') ? (d.arrange === 'side' ? 'over' : 'side') : null;
  if (!arrange) return [single(doc, copy, 'front', d.w, d.h, room), single(doc, copy, 'back', d.w, d.h, room)];
  // جنبًا: الوجه يمينًا كالقراءة، والظهر يساره.
  if (arrange === 'side')
    return [
      {
        doc,
        copy,
        w: 2 * d.w + gap,
        h: d.h,
        items: [
          { face: 'front', dx: d.w + gap, dy: 0, w: d.w, h: d.h, scale: 1 },
          { face: 'back', dx: 0, dy: 0, w: d.w, h: d.h, scale: 1 }
        ]
      }
    ];
  return [
    {
      doc,
      copy,
      w: d.w,
      h: 2 * d.h + gap,
      items: [
        { face: 'front', dx: 0, dy: 0, w: d.w, h: d.h, scale: 1 },
        { face: 'back', dx: 0, dy: d.h + gap, w: d.w, h: d.h, scale: 1 }
      ]
    }
  ];
}

type Row = { units: Unit[]; width: number; height: number };

/**
 * يرصف المستمسكات على أوراق A4. و`duplex` («على وجهي الورقة»): الوجوه وحدها تُرصف، وظهر كلّ وجهٍ في الورقة التالية
 * في موضعه **معكوسًا أفقيًّا** فيقع خلفه حين تُقلب الورقة على حافّتها الطويلة.
 */
export function layoutDocs(docs: SheetDoc[], opts: { duplex?: boolean; margin?: number; gap?: number } = {}): DocPlacement[] {
  const margin = opts.margin ?? MARGIN;
  const gap = opts.gap ?? GAP;
  const duplex = opts.duplex === true;
  const room = usable(margin);
  const pages: Row[][] = [[]];
  const height = (rows: Row[]) => rows.reduce((n, r) => n + r.height, 0) + Math.max(0, rows.length - 1) * gap;

  docs.forEach((d, doc) => {
    for (let copy = 0; copy < Math.max(1, Math.floor(d.copies)); copy++) {
      for (const unit of unitsOf(d, doc, copy, duplex, gap, room)) {
        const page = pages[pages.length - 1]!;
        const row = page.at(-1);
        // في السطر القائم إن اتّسع عرضه، ولم يُطِل الصفحة فوق طاقتها.
        if (row && row.width + gap + unit.w <= room.w + 1e-9 && height(page) - row.height + Math.max(row.height, unit.h) <= room.h + 1e-9) {
          row.units.push(unit);
          row.width += gap + unit.w;
          row.height = Math.max(row.height, unit.h);
          continue;
        }
        const fresh: Row = { units: [unit], width: unit.w, height: unit.h };
        if (page.length && height(page) + gap + unit.h > room.h + 1e-9) pages.push([fresh]);
        else page.push(fresh);
      }
    }
  });

  const out: DocPlacement[] = [];
  const twoSided = duplex && docs.some((d) => d.faces === 2);
  pages.forEach((page, p) => {
    const front = twoSided ? 2 * p : p;
    let y = margin + (room.h - height(page)) / 2;
    for (const row of page) {
      let right = A4.w - (A4.w - row.width) / 2;
      for (const unit of row.units) {
        const left = right - unit.w;
        const top = y + (row.height - unit.h) / 2;
        for (const it of unit.items) {
          const at = { doc: unit.doc, copy: unit.copy, x: left + it.dx, y: top + it.dy, w: it.w, h: it.h, scale: it.scale };
          out.push({ ...at, face: it.face, page: front });
          if (twoSided && docs[unit.doc]!.faces === 2) out.push({ ...at, face: 'back', page: front + 1, x: A4.w - at.x - at.w });
        }
        right -= unit.w + gap;
      }
      y += row.height + gap;
    }
  });
  return out;
}

/** عدد الأوراق: من المواضع، ومع «على وجهي الورقة» ورقةٌ للظهور بعد كلّ ورقة وجوه. */
export function pageCount(docs: SheetDoc[], placements: DocPlacement[], duplex = false): number {
  const last = placements.length ? Math.max(...placements.map((p) => p.page)) + 1 : 0;
  return duplex && docs.some((d) => d.faces === 2) && last % 2 === 1 ? last + 1 : last;
}

export type DocSheetOptions = {
  resolveUrl: (src: string) => string;
  colorFilter?: IdColorFilter;
  brightness?: number;
  contrast?: number;
  cutMarks?: boolean;
  labels?: boolean;
  watermark?: WatermarkOptions | null;
  /** حوافّ مدوّرة وظلّ: اختياريّان مطفآن (CHAIN م٨). */
  rounded?: boolean;
  shadow?: boolean;
  duplex?: boolean;
};

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

/** اسم الوجه تحت المستمسك: «البطاقة الوطنية — الظهر»، ووجهٌ واحدٌ باسمه وحده. */
export function faceLabel(d: SheetDoc, face: Face): string {
  return d.faces === 2 ? `${d.label} — ${face === 'front' ? 'الوجه' : 'الظهر'}` : d.label;
}

/** أوراق الطباعة كما تُرى في الشاشة: المواضع نفسها، والفارغ لا يُرسم — ولا أوراق بلا صورةٍ واحدة. */
export function docSheetHtml(docs: SheetDoc[], opts: DocSheetOptions): string[] {
  if (!docs.some((d) => d.front || (d.faces === 2 && d.back))) return [];
  const placements = layoutDocs(docs, { duplex: opts.duplex });
  const filter = cardFilterCss(opts.colorFilter ?? 'color', opts.brightness ?? 1, opts.contrast ?? 1);
  const html: string[] = [];
  for (let p = 0; p < pageCount(docs, placements, opts.duplex); p++) {
    let body = '';
    placements.forEach((pl, i) => {
      if (pl.page !== p) return;
      const d = docs[pl.doc]!;
      const src = pl.face === 'front' ? d.front : d.back;
      if (!src) return;
      const edge =
        (opts.cutMarks !== false ? 'outline:0.15mm solid #bbb;' : '') +
        (opts.rounded ? 'border-radius:3mm;' : '') +
        (opts.shadow ? 'box-shadow:0 0.6mm 1.6mm rgba(0,0,0,0.35);' : '');
      body +=
        `<div data-sheet-card="${i}" data-doc="${escapeHtml(d.id)}" data-face="${pl.face}" style="position:absolute;left:${mm(pl.x)};top:${mm(pl.y)};width:${mm(pl.w)};height:${mm(pl.h)};overflow:hidden;background:#fff;${edge}">` +
        `<img alt="" src="${escapeHtml(opts.resolveUrl(src))}" style="width:100%;height:100%;object-fit:contain;display:block;filter:${filter}"/>` +
        (opts.watermark ? tiledWatermark(opts.watermark) : '') +
        '</div>' +
        (opts.labels
          ? `<div style="position:absolute;left:${mm(pl.x)};top:${mm(pl.y + pl.h + 0.8)};width:${mm(pl.w)};text-align:center;font-size:2.4mm;color:#666;font-family:sans-serif">${escapeHtml(faceLabel(d, pl.face))}</div>`
          : '');
    });
    html.push(
      `<div class="print-page" style="position:relative;width:${mm(A4.w)};height:${mm(A4.h)};overflow:hidden;background:#fff;page-break-after:always">${body}</div>`
    );
  }
  return html;
}
