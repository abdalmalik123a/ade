/**
 * ورقة المستمسكات المجمّعة (خطة Production، المرحلة ٥ — قرار المالك ٢٩ أيلول ٢٠٢٦).
 *
 * المعاملة تطلب «نسخة من المستمسكات»: البطاقة الوطنية وجهًا وظهرًا، وبطاقة السكن وجهًا وظهرًا —
 * كلٌّ بمقاسه الحقيقي ١:١، على ورقة A4 واحدة. كان «صانع الهويات» يصفّ مستمسكًا واحدًا بوجهيه،
 * فتخرج ورقةٌ لكلّ مستمسك.
 *
 * والصفّ أسطرٌ من اليمين كالقراءة: وجه المستمسك بجانب ظهره إن اتّسع لهما السطر، وإلا نزل الظهر إلى
 * سطرٍ يليه. وكلّ سطرٍ في وسط الورقة، والأسطر كلّها في وسطها رأسيًّا — فتُقصّ البطاقات بسهولة. وما لم
 * تتّسع له الورقة يبدأ ورقةً ثانية.
 */
import { STANDARD_CARD_SIZES, cardFilterCss, type IdColorFilter } from './idCardDuplex';
import { normalizeFold } from './arabic';
import { escapeHtml } from './docHtml';
import { tiledWatermark, type WatermarkOptions } from './watermark';

export const A4 = { w: 210, h: 297 };
const MARGIN = 10;
const GAP = 6;

export type SheetSlot = {
  id: string;
  /** يُكتب صغيرًا تحت البطاقة إن طُلب، ويُطابَق به مستمسك المواطن. */
  label: string;
  /** مقاسه من `STANDARD_CARD_SIZES`. */
  sizeKey: string;
  src: string | null;
};

export type SheetPlacement = { slot: number; page: number; x: number; y: number; w: number; h: number };

/** الافتراض: الوطنية والسكن وجهًا وظهرًا. */
export function defaultSlots(): SheetSlot[] {
  return [
    { id: 'nat-front', label: 'البطاقة الوطنية — الوجه', sizeKey: 'id1', src: null },
    { id: 'nat-back', label: 'البطاقة الوطنية — الظهر', sizeKey: 'id1', src: null },
    { id: 'res-front', label: 'بطاقة السكن — الوجه', sizeKey: 'a7', src: null },
    { id: 'res-back', label: 'بطاقة السكن — الظهر', sizeKey: 'a7', src: null }
  ];
}

export function slotSize(sizeKey: string): { w: number; h: number } {
  const s = STANDARD_CARD_SIZES.find((x) => x.key === sizeKey) ?? STANDARD_CARD_SIZES[0]!;
  return { w: s.w, h: s.h };
}

type Row = { items: { index: number; w: number; h: number }[]; width: number; height: number };

/** يصفّ المقاسات أسطرًا من اليمين على صفحات A4 — ولكلّ مقاسٍ موضعه وصفحته. */
export function layoutIdSheet(sizes: { w: number; h: number }[], opts: { margin?: number; gap?: number } = {}): SheetPlacement[] {
  const margin = opts.margin ?? MARGIN;
  const gap = opts.gap ?? GAP;
  const usableW = A4.w - 2 * margin;
  const usableH = A4.h - 2 * margin;
  const pages: Row[][] = [[]];
  const height = (rows: Row[]) => rows.reduce((n, r) => n + r.height, 0) + Math.max(0, rows.length - 1) * gap;

  sizes.forEach((raw, index) => {
    // ما جاوز الورقة يُصغَّر ليسعها — لا يُقصّ.
    const k = Math.min(1, usableW / raw.w, usableH / raw.h);
    const item = { index, w: raw.w * k, h: raw.h * k };
    const page = pages[pages.length - 1]!;
    const row = page.at(-1);
    // في السطر القائم إن اتّسع عرضه، ولم يُطِل الصفحة فوق طاقتها.
    if (row && row.width + gap + item.w <= usableW && height(page) - row.height + Math.max(row.height, item.h) <= usableH) {
      row.items.push(item);
      row.width += gap + item.w;
      row.height = Math.max(row.height, item.h);
      return;
    }
    const fresh: Row = { items: [item], width: item.w, height: item.h };
    if (page.length && height(page) + gap + item.h > usableH) pages.push([fresh]);
    else page.push(fresh);
  });

  const out: SheetPlacement[] = [];
  pages.forEach((page, p) => {
    let y = margin + (usableH - height(page)) / 2;
    for (const row of page) {
      // من اليمين: أوّل المستمسكات في يمين السطر، والسطر في وسط الورقة.
      let right = A4.w - (A4.w - row.width) / 2;
      for (const it of row.items) {
        out.push({ slot: it.index, page: p, x: right - it.w, y: y + (row.height - it.h) / 2, w: it.w, h: it.h });
        right -= it.w + gap;
      }
      y += row.height + gap;
    }
  });
  return out;
}

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

/** أوراق الطباعة: ما له صورةٌ من المستمسكات وحده يُصفّ. */
export function idSheetHtml(
  slots: SheetSlot[],
  opts: {
    resolveUrl: (src: string) => string;
    colorFilter?: IdColorFilter;
    cutMarks?: boolean;
    labels?: boolean;
    watermark?: WatermarkOptions | null;
  }
): string[] {
  const filled = slots.filter((s) => s.src);
  if (!filled.length) return [];
  const placements = layoutIdSheet(filled.map((s) => slotSize(s.sizeKey)));
  const filter = cardFilterCss(opts.colorFilter ?? 'color');
  const pages = Math.max(...placements.map((p) => p.page)) + 1;
  const html: string[] = [];
  for (let p = 0; p < pages; p++) {
    let body = '';
    for (const pl of placements.filter((x) => x.page === p)) {
      const slot = filled[pl.slot]!;
      const outline = opts.cutMarks !== false ? 'outline:0.15mm solid #bbb;border-radius:2mm;' : '';
      body +=
        `<div data-sheet-card="${pl.slot}" style="position:absolute;left:${mm(pl.x)};top:${mm(pl.y)};width:${mm(pl.w)};height:${mm(pl.h)};overflow:hidden;${outline}">` +
        `<img alt="" src="${escapeHtml(opts.resolveUrl(slot.src!))}" style="width:100%;height:100%;object-fit:cover;display:block;filter:${filter}"/>` +
        (opts.watermark ? tiledWatermark(opts.watermark) : '') +
        '</div>' +
        (opts.labels
          ? `<div style="position:absolute;left:${mm(pl.x)};top:${mm(pl.y + pl.h + 0.8)};width:${mm(pl.w)};text-align:center;font-size:2.4mm;color:#666;font-family:sans-serif">${escapeHtml(slot.label)}</div>`
          : '');
    }
    html.push(
      `<div class="print-page" style="position:relative;width:${mm(A4.w)};height:${mm(A4.h)};overflow:hidden;background:#fff;page-break-after:always">${body}</div>`
    );
  }
  return html;
}

/**
 * مستمسكات المواطن في خاناتها: «البطاقة الوطنية — الوجه» تجد ما سُمّي بالوطنية (أو الموحّدة) ووجهه،
 * وبطاقة السكن ما سُمّي بالسكن. وما لم يُعرف وجهه من ظهره يُعدّ وجهًا. وما لم يُوجد يبقى فارغًا.
 */
export function fillFromAttachments(slots: SheetSlot[], attachments: { docType: string; filePath: string }[]): SheetSlot[] {
  const used = new Set<string>();
  const has = (s: string, word: string) => normalizeFold(s).includes(normalizeFold(word));
  const kindOf = (s: string) => (has(s, 'السكن') ? 'res' : has(s, 'الوطنية') || has(s, 'الموحدة') ? 'nat' : null);
  const sideOf = (s: string) => (has(s, 'الظهر') ? 'back' : 'front');
  return slots.map((slot) => {
    if (slot.src) return slot;
    const kind = kindOf(slot.label);
    if (!kind) return slot;
    const side = sideOf(slot.label);
    const hit = attachments.find((a) => !used.has(a.filePath) && kindOf(a.docType) === kind && sideOf(a.docType) === side);
    if (!hit) return slot;
    used.add(hit.filePath);
    return { ...slot, src: hit.filePath };
  });
}
