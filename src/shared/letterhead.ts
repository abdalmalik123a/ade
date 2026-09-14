/**
 * الترويسة حرّة البنية.
 *
 * لا حقول ثابتة: صاحب المكتب يركّب الترويسة من كتل ويرتّبها، لأن كل جهة
 * تكتب رأس كتابها بطريقتها — وزارة غير مديرية غير محكمة غير مصرف.
 * البنية تُخزَّن JSON في letterheads.layout_json.
 */

export type BlockKind = 'text' | 'image' | 'divider' | 'field' | 'spacer';
export type Align = 'right' | 'center' | 'left';

export type LetterheadBlock = {
  id: string;
  kind: BlockKind;
  /** نص السطر، أو مسار الصورة داخل المخزن، أو اسم الحقل التلقائي. */
  value: string;
  align: Align;
  size: number;
  bold: boolean;
  /** عرض الصورة بالبكسل (الارتفاع تبعًا للنسبة). */
  width?: number;
  /** مسافة رأسية بعد الكتلة بالبكسل. */
  gap?: number;
};

export type LetterheadLayout = {
  /** الهوامش بالمليمتر — التصميم يحدّد 20mm قياسيًا. */
  margins: { top: number; right: number; bottom: number; left: number };
  blocks: LetterheadBlock[];
};

export type Letterhead = {
  id: number;
  name: string;
  authorityId: number | null;
  layout: LetterheadLayout;
  isDefault: boolean;
};

export const DEFAULT_MARGINS = { top: 20, right: 20, bottom: 20, left: 20 };

export function emptyLayout(): LetterheadLayout {
  return { margins: { ...DEFAULT_MARGINS }, blocks: [] };
}

/**
 * الحقول التلقائية التي يجوز وضعها في الترويسة.
 * هذه أسماء يعرفها المحرّك ويملؤها عند الإصدار — وليست بيانات مبرمَجة.
 */
export const HEADER_FIELDS = [
  { token: '{رقم_الصادر}', label: 'رقم الصادر' },
  { token: '{التاريخ_الميلادي}', label: 'التاريخ الميلادي' },
  { token: '{التاريخ_الهجري}', label: 'التاريخ الهجري' },
  { token: '{الجهة}', label: 'اسم الجهة' },
  { token: '{القسم}', label: 'القسم أو الإدارة' },
  { token: '{التشكيل}', label: 'التشكيل المباشر' }
] as const;

/** ملّم → بكسل عند 96 نقطة/إنش، وهو المقياس الذي تفترضه معاينة A4 (794px = 210mm). */
export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}
