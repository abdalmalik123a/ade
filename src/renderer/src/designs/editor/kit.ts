/**
 * ما يشترك فيه محرّر التصاميم: أصناف الأزرار، وأسماء العناصر، ومقابض المقاس، وهندسة اللوحة على الشاشة.
 * (نُقلت من `DesignsScreen.tsx` حين قُسّم — DESIGNS.md ٠٫٣ — بلا تغيير.)
 */
import type { CSSProperties } from 'react';
import { tokenInlines, type Inline } from '@shared/doc';
import { SCREEN_DPI, canvasPx, mmToPx, type Box, type Canvas, type CanvasElement } from '@shared/canvas';
import type { Edge } from '@shared/canvasEdit';
import { pathPreset } from '@shared/design/pathPresets';

export const DESIGN_CATEGORY = 'تصاميم';
export const NUM =
  'w-20 h-8 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';
export const ICON =
  'w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors flex items-center justify-center';
export const TOOL =
  'w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors disabled:opacity-40';

/** خطوةُ السهم نسبةً، ومع Shift عشرة أضعافها. */
export const NUDGE = 0.002;

/** ما يجري سحبه الآن: تحريكٌ أو مقبض. */
export type Drag =
  | { kind: 'move'; ids: string[]; from: { x: number; y: number }; boxes: Map<string, Box> }
  | { kind: 'resize'; id: string; edge: Edge; from: { x: number; y: number }; box: Box }
  /** التدوير من مقبضه (١٫٦): حول مركز العنصر على الشاشة. */
  | { kind: 'rotate'; id: string; center: { x: number; y: number }; start: { x: number; y: number }; r0: number }
  /** مستطيل التحديد بالفأرة (١٫٦) — من نقطة البدء نِسَبًا، ومع Ctrl يُضاف إلى المحدَّد. */
  | { kind: 'marquee'; from: { x: number; y: number }; add: string[] };

export const textOf = (inlines?: Inline[]): string =>
  Array.isArray(inlines)
    ? inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : ' ')).join('')
    : '';

export function toHexColor(color: string | undefined): string {
  if (!color) return '#111111';
  const c = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return '#111111';
}

/** `{اسم}` عقدةَ حقل — والمُرمِّز واحدٌ مع الترحيل والاستيراد (`shared/doc.ts`). */
export const inlinesOf = tokenInlines;

export const kindName = (el: CanvasElement): string => {
  if (el.name) return el.name;
  switch (el.kind) {
    case 'text':
      return textOf(el.inlines).trim() || 'نصّ';
    case 'image':
      return el.ref ? `صورة {${el.ref}}` : 'صورة';
    case 'barcode':
      return `${el.symbology === 'qr' ? 'QR' : el.symbology === 'seal' ? 'نقش أمان' : 'باركود'} ${el.ref ? `{${el.ref}}` : el.value}`;
    case 'shape':
      return 'شكل';
    case 'table':
      return 'جدول';
    case 'path':
      return pathPreset(el.preset)?.label ?? 'شكل حرّ';
  }
};

/** مقابض تغيير المقاس الثمانية حول العنصر المحدَّد. */
export const EDGES: { edge: Edge; style: CSSProperties; cursor: string }[] = [
  { edge: 'nw', style: { top: -4, left: -4 }, cursor: 'nwse-resize' },
  { edge: 'ne', style: { top: -4, right: -4 }, cursor: 'nesw-resize' },
  { edge: 'sw', style: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
  { edge: 'se', style: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
  { edge: 'n', style: { top: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
  { edge: 's', style: { bottom: -4, left: '50%', marginLeft: -4 }, cursor: 'ns-resize' },
  { edge: 'w', style: { left: -4, top: '50%', marginTop: -4 }, cursor: 'ew-resize' },
  { edge: 'e', style: { right: -4, top: '50%', marginTop: -4 }, cursor: 'ew-resize' }
];

/** اللوحة على الشاشة بالبكسل: الورقة بنزفها، والتصميم بلا نزف، والنزف نفسه. */
export function screenGeometry(canvas: Canvas) {
  return {
    page: canvasPx(canvas, SCREEN_DPI),
    pxW: mmToPx(canvas.size.w, SCREEN_DPI),
    pxH: mmToPx(canvas.size.h, SCREEN_DPI),
    offset: mmToPx(canvas.bleed, SCREEN_DPI)
  };
}
