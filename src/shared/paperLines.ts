/**
 * أنواع قراءة الورقة الممسوحة وهندسة السطور وقطعها وتنظيف الكلمات — نُقل من `paperDoc.ts` (D91).
 */
import type { Box, TableGrid } from './paperRules';

export type OcrWord = { text: string; conf: number; box: Box };

export type OcrLine = { conf: number; box: Box; words: OcrWord[] };

export type PaperRead = {
  width: number;
  height: number;
  lines: OcrLine[];
  tables: TableGrid[];
  dividers: Box[];
  /** ما مُحي قبل القراءة من ختمٍ وتوقيعٍ ملوّن. */
  marks: Box[];
};

/** قطعةٌ من الورقة تُراجَع وتُحرَّر: سطرٌ أو جزؤه، أو خانة جدول. */
export type Piece = {
  id: string;
  text: string;
  box: Box;
  /** أضعف كلمةٍ فيها (٠..١٠٠). */
  conf: number;
  /** كلماتٌ ضعيفة تُعلَّم في المراجعة. */
  weak: string[];
  /** يُنقل إلى الكتاب؟ — وما أُسقط يُعرض فيُعاد. */
  keep: boolean;
  /** «العدد:» و«التاريخ:» في الترويسة: تصير حقلًا لا نصًّا. */
  field?: { label: string; key: string };
};

const LETTERS = /[A-Za-zء-ي]/g;

export const cx = (b: Box) => (b.x0 + b.x1) / 2;

export const cy = (b: Box) => (b.y0 + b.y1) / 2;

export const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1))
});

export const inside = (b: Box, area: Box, pad = 0) =>
  cx(b) >= area.x0 - pad && cx(b) <= area.x1 + pad && cy(b) >= area.y0 - pad && cy(b) <= area.y1 + pad;

export const overlap = (a: Box, b: Box) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0)) : 0;
};

export function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** علامات الاتجاه الخفيّة (LRM وRLM والتضمين والعزل) — تُبنى من أرقامها لتُقرأ في المصدر. */
const BIDI = new RegExp(
  `[${String.fromCharCode(0x200e, 0x200f)}${String.fromCharCode(0x202a)}-${String.fromCharCode(0x202e)}${String.fromCharCode(0x2066)}-${String.fromCharCode(0x2069)}]`,
  'g'
);

/** نصُّ كلماتٍ بترتيب القارئ — والكلمات منفصلةٌ عنده وإن ألصقها نصُّه. */
const joinWords = (words: OcrWord[]) =>
  words
    // علامات الاتجاه الخفيّة يضعها القارئ حول الكلمات — لا تُرى وتُفسد البحث والمقارنة.
    .map((w) => w.text.replace(BIDI, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([،؛:.؟!)])/g, '$1')
    .replace(/([(])\s+/g, '$1');

/**
 * كلمةٌ تُراجَع: ثقتها ضعيفة، أو حرفٌ لاتينيٌّ أو حرفان وسط العربية — «أ» في خانةٍ
 * صغيرة قُرئت «j» بثقة ٨٢٪، والثقة وحدها لا تكشفها.
 */
function suspicious(w: OcrWord): boolean {
  return w.conf < 65 || /^[A-Za-z]{1,2}$/.test(w.text.replace(BIDI, '').trim());
}

export function piece(id: string, words: OcrWord[]): Piece {
  return {
    id,
    text: joinWords(words),
    box: union(words.map((w) => w.box)),
    conf: Math.round(Math.min(...words.map((w) => w.conf))),
    weak: words.filter(suspicious).map((w) => w.text.replace(BIDI, '').trim()).filter(Boolean),
    keep: true
  };
}

/** يقسم السطر حيث يتّسع الفراغ بين كلمتين — ما على الجانبين قطعتان. */
export function splitLine(line: OcrLine, gap: number): OcrWord[][] {
  const out: OcrWord[][] = [];
  let cur: OcrWord[] = [];
  for (const w of line.words) {
    if (!w.text.trim()) continue;
    const prev = cur[cur.length - 1];
    if (prev && Math.max(prev.box.x0 - w.box.x1, w.box.x0 - prev.box.x1) > gap) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * أيُشبه نصًّا؟ — التوقيع بالحبر الأسود يُقرأ رموزًا ضعيفة بلا كلمات.
 *
 * ويكفي النصَّ كلمةٌ واحدة قويّة: سطرٌ فيه كلمةٌ ضعيفة (رقمٌ هنديّ لم يُعرف) سطرٌ
 * يُراجَع لا أثرٌ يُسقط — وإلا سقط «العدد:» كلّه لأن رقمه قُرئ ضعيفًا.
 */
export function looksLikeText(words: OcrWord[]): boolean {
  return words.some((w) => {
    const letters = (w.text.match(LETTERS) ?? []).length;
    return (letters >= 2 && w.conf >= 60) || (letters >= 1 && w.conf >= 85);
  });
}
