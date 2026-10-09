/**
 * طبقات Photoshop — ما يصير عنصرًا: النصّ أسطرًا، والشكل، والصورة (DESIGNS.md ٠٫٩).
 */
import { height, width, type PsdDoc, type PsdLayer, type PsdText, type Rect } from './psdTypes';
import { drawable, layerPixels } from './psdPixels';
import { clipBase } from './psdErase';

// ── ما يصير عنصرًا ──────────────────────────────────────────────────

export type PsdItem =
  | {
      kind: 'text';
      layer: number;
      /** اسم الطبقة في Photoshop — منه يُقترح الحقل (هـ٤). */
      name: string;
      rect: Rect;
      text: string;
      style: PsdText;
      /** سطرٌ واحد: يصغر ليسع بدل أن يُقصّ. */
      single: boolean;
    }
  | { kind: 'photo'; layer: number; rect: Rect; round: boolean }
  | { kind: 'barcode'; layer: number; rect: Rect };

/** شرائط الحبر في عدّادٍ: [بداية، نهاية) لكلّ شريط، والفجوات الصغيرة تُلحَم. */
function bands(counts: number[], minGap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i]! > 0;
    if (on) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > minGap || i === counts.length) {
        out.push([start, i - gap + 1]);
        start = -1;
        gap = 0;
      }
    }
  }
  return out;
}

/**
 * يقسم طبقة النصّ أسطرًا — وسطرَ الجدولة قطعًا — بمواضعها من بكسلاتها.
 *
 * «Code:⇥⇥789456123» سطرٌ واحد في Photoshop، ومواضع الجدولة لا نرسمها: فيُقسم
 * عند أوسع فجوةٍ في حبره، ويصير عنوانٌ وقيمةٌ كلٌّ في موضعه — والقيمة تتحرّر
 * وحدها.
 */
function textPieces(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer, style: PsdText): PsdItem[] {
  const text = style.caps ? style.value.toUpperCase() : style.value;
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const rect = layer.rect;
  const piece = (r: Rect, t: string, single: boolean): PsdItem => ({
    kind: 'text',
    layer: layer.index,
    name: layer.name,
    rect: r,
    text: t.replace(/\t+/g, ' ').trim(),
    style,
    single
  });

  // النصّ الملتفّ في صندوقه عنصرٌ واحدٌ بصندوقه: أسطره يصنعها العرض لا فواصله.
  if (style.box) return [piece(style.box, lines.join('\n'), false)];
  const px = layerPixels(bytes, doc, layer);
  if (!px) return [piece(rect, lines.join('\n'), false)];
  const w = width(rect);
  const h = height(rect);
  const ink = (i: number) => px.alpha[i]! > 64;
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (ink(y * w + x)) n++;
    rows.push(n);
  }
  const found = bands(rows, Math.max(1, Math.round(style.sizePx * 0.12)));
  // سطرٌ واحد في شرائط كثيرة: نصٌّ يلتفّ في صندوقه — يبقى عنصرًا واحدًا بصندوقه.
  if (lines.length === 1 && found.length > 1) return [piece(rect, lines[0]!, false)];
  // أسطرٌ لا تطابق شرائطها: تُقسم بالتساوي ولا يُخترع لها موضع.
  const spans =
    found.length === lines.length
      ? found
      : lines.map((_, i): [number, number] => [Math.round((i * h) / lines.length), Math.round(((i + 1) * h) / lines.length)]);

  const out: PsdItem[] = [];
  lines.forEach((line, i) => {
    const [t, b] = spans[i]!;
    const cols: number[] = new Array(w).fill(0);
    for (let y = t; y < b; y++) for (let x = 0; x < w; x++) if (ink(y * w + x)) cols[x]++;
    const words = bands(cols, Math.max(1, Math.round(style.sizePx * 0.35)));
    const lineRect: Rect = {
      top: rect.top + t,
      bottom: rect.top + b,
      left: rect.left + (words[0]?.[0] ?? 0),
      right: rect.left + (words[words.length - 1]?.[1] ?? w)
    };
    const parts = line
      .split(/\t+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2 || words.length < parts.length) {
      out.push(piece(lineRect, line, true));
      return;
    }
    // أوسعُ الفجوات بعدد القطع ناقصًا واحدة، مرتّبةً من اليسار.
    const cuts = words
      .slice(1)
      .map((seg, k) => ({ at: k + 1, size: seg[0] - words[k]![1] }))
      .sort((a, z) => z.size - a.size)
      .slice(0, parts.length - 1)
      .map((g) => g.at)
      .sort((a, z) => a - z);
    const edges = [0, ...cuts, words.length];
    // العربية تُقرأ من اليمين: أوّل قطعةٍ منطقيًّا هي أقصى اليمين.
    const ordered = /[؀-ۿ]/.test(line) ? [...parts].reverse() : parts;
    ordered.forEach((part, k) => {
      const from = words[edges[k]!]!;
      const to = words[edges[k + 1]! - 1]!;
      out.push(piece({ ...lineRect, left: rect.left + from[0], right: rect.left + to[1] }, part, true));
    });
  });
  return out;
}

/** دائرةٌ؟ مربّعةُ الإطار، ومساحتها ربعُ باي منه تقريبًا. */
function isRound(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): boolean {
  const w = width(layer.rect);
  const h = height(layer.rect);
  if (!w || !h || Math.abs(w - h) / Math.max(w, h) > 0.06) return false;
  if (/^(ellipse|circle|دائرة)/i.test(layer.name)) return true;
  const px = layerPixels(bytes, doc, layer);
  if (!px) return false;
  let on = 0;
  for (const a of px.alpha) if (a > 128) on++;
  const ratio = on / (w * h);
  return ratio > 0.74 && ratio < 0.83;
}

const SHAPE_NAME = /^(rectangle|rounded rectangle|shape|ellipse|circle|vector|polygon|line)\b/;

/**
 * ما يصير عنصرًا يُحرَّر: كلّ نصٍّ ظاهر، وصورةُ الشخص، والرمز.
 *
 * والصورة والرمز يُعرفان بأسماء طبقاتهم ومجموعاتهم — كما تسمّيها قوالب السوق
 * («Replace Image»، «Employee Image»، «QR Code») — فإن لم يُسمَّيا بقيا من
 * الخلفية ولم يُخمَّن مكانهما. وفي مجموعة الصورة تُقدَّم الطبقة المسمّاة، ثم
 * المقصوصة في إطارها، ولا يُؤخذ شكلٌ زخرفيّ صورةً.
 */
export function psdItems(bytes: Uint8Array, doc: PsdDoc): PsdItem[] {
  const items: PsdItem[] = [];
  const codes = new Set<string>();
  const photos = new Map<string, { layer: PsdLayer; rank: number }>();

  for (const layer of doc.layers) {
    if (!drawable(layer)) continue;
    if (layer.text) {
      items.push(...textPieces(bytes, doc, layer, layer.text));
      continue;
    }
    const name = layer.name.toLowerCase();
    const path = layer.groups.map((g) => g.toLowerCase()).join(' > ');
    const shape = SHAPE_NAME.test(name);

    if (/qr|barcode|bar code|باركود/.test(name) || (/qr|bar code|barcode/.test(path) && !shape)) {
      if (codes.has(path)) continue;
      codes.add(path);
      items.push({ kind: 'barcode', layer: layer.index, rect: layer.rect });
      continue;
    }
    if (/background|bg shape|top shape|(^| )bg( |$)/.test(path)) continue;
    const named = /replace (your )?(image|photo)|employee image|your photo|^photo$|^image$|صورة/.test(name);
    const inGroup = /employee image|photo|avatar|صورة/.test(path);
    const rank = named ? 3 : inGroup && layer.clipping ? 2 : inGroup && !shape ? 1 : 0;
    if (!rank) continue;
    const key = path || name;
    if ((photos.get(key)?.rank ?? 0) < rank) photos.set(key, { layer, rank });
  }

  for (const { layer } of photos.values()) {
    // المقصوصة تأخذ شكلَ قاعدتها: الصورة في دائرةٍ تُطبع في الدائرة.
    const frame = clipBase(doc, layer) ?? layer;
    items.push({
      kind: 'photo',
      layer: layer.index,
      rect: frame.rect,
      round: frame !== layer && isRound(bytes, doc, frame)
    });
  }
  return items.sort((a, z) => a.layer - z.layer);
}
