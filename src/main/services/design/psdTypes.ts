/**
 * طبقات Photoshop — الأنواع والقراءة الصغيرة المشتركة: المستطيل، والطبقة بقنواتها ونصّها، والملفّ (DESIGNS.md ٠٫٩).
 */

export type Rect = { top: number; left: number; bottom: number; right: number };

export type Channel = { id: number; offset: number; length: number };

export type PsdText = {
  value: string;
  /** حجم الخطّ ببكسلات الملف — بعد تحويل الطبقة، لا الرقم الخام في EngineData. */
  sizePx: number;
  color: string;
  align: 'left' | 'right' | 'center';
  bold: boolean;
  italic: boolean;
  /** «كلّها كبيرة» في Photoshop: الكلمة تُكتب صغيرةً وتُرسم كبيرة. */
  caps: boolean;
  /** تباعد الحروف بوحدة em (Tracking ÷ ١٠٠٠). */
  tracking: number;
  font: string | null;
  /** ارتفاع السطر نسبةً من الخطّ — من Leading، و١٫٢ إن كان تلقائيًّا. */
  lineHeight: number;
  /** صندوقُ النصّ الملتفّ بإحداثيات الورقة — ولا صندوق للنصّ النقطيّ. */
  box?: Rect;
};

export type PsdLayer = {
  index: number;
  name: string;
  rect: Rect;
  channels: Channel[];
  blend: string;
  /** شفافية الطبقة مضروبةً في التعبئة وفي شفافية مجموعاتها — ٠..١. */
  opacity: number;
  clipping: boolean;
  /** مخفيّةٌ بنفسها أو بإحدى مجموعاتها. */
  hidden: boolean;
  mask: (Rect & { defaultColor: number }) | null;
  /** ١ و٢ رأسُ مجموعة، و٣ ذيلُها — وما سواها طبقةٌ ترسم. */
  divider: number;
  /** أسماء المجموعات من الأعلى إلى الطبقة. */
  groups: string[];
  text?: PsdText;
};

export type PsdDoc = {
  width: number;
  height: number;
  depth: number;
  colorMode: number;
  layers: PsdLayer[];
};

export const toBuffer = (bytes: Uint8Array): Buffer =>
  Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export const width = (r: Rect) => r.right - r.left;
export const height = (r: Rect) => r.bottom - r.top;

export function readRect(buf: Buffer, at: number): Rect {
  return {
    top: buf.readInt32BE(at),
    left: buf.readInt32BE(at + 4),
    bottom: buf.readInt32BE(at + 8),
    right: buf.readInt32BE(at + 12)
  };
}

export function utf16be(bytes: Buffer): string {
  const copy = Buffer.from(bytes);
  if (copy.length % 2) return '';
  copy.swap16();
  return copy.toString('utf16le');
}
