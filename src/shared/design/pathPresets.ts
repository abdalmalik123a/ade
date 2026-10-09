/**
 * مكتبة الأشكال الحرّة (DESIGNS.md ١٫٢): موجاتٌ وزوايا مائلة وأشرطة وأقواس أبواب وإطاراتٌ وشارات — مساراتٌ في مربّع
 * ٠..١٠٠ تتمدّد مع صندوقها (`kinds/path.ts`)، فالموجة السفلية تملأ عرض البطاقة أيًّا كان مقاسها.
 *
 * والصندوق الافتراضيّ نِسَبٌ من اللوحة؛ و`square` يُدرج مربّعًا بالملّم (الشارة والختم) لا بالنِّسَب.
 */
import type { Box } from './model/types';
import { shapePath } from './shapes';

export type PathPreset = {
  key: string;
  label: string;
  group: 'موجات' | 'زوايا وأشرطة' | 'أقواس وإطارات' | 'شارات';
  d: string;
  /** الحلقة والإطار: ما بين المسارين فارغ. */
  evenodd?: boolean;
  /** يُرسم حدًّا لا ملئًا (إطار القوس). */
  stroke?: boolean;
  box: Box;
  square?: boolean;
};

/** نجمةٌ بعدد رؤوسها — شارة «جديد» و«خصم». */
function starburst(points: number, inner: number): string {
  const pts = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? 50 * inner : 50;
    const a = (i * Math.PI) / points - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
}

const CIRCLE = (r: number) => `M${50 - r} 50 A${r} ${r} 0 1 1 ${50 + r} 50 A${r} ${r} 0 1 1 ${50 - r} 50 Z`;

export const PATH_PRESETS: PathPreset[] = [
  { key: 'wave-bottom', label: 'موجة سفلية', group: 'موجات', d: 'M0 55 C20 35 35 75 55 55 S85 35 100 50 V100 H0 Z', box: { x: 0, y: 0.8, w: 1, h: 0.2 } },
  { key: 'wave-top', label: 'موجة علوية', group: 'موجات', d: 'M0 0 H100 V45 C80 65 65 25 45 45 S15 65 0 50 Z', box: { x: 0, y: 0, w: 1, h: 0.2 } },
  { key: 'wave-side', label: 'موجة جانبية', group: 'موجات', d: 'M100 0 H45 C65 20 25 35 45 55 S65 85 50 100 H100 Z', box: { x: 0, y: 0, w: 0.18, h: 1 } },
  { key: 'wave-band', label: 'شريط موجي', group: 'موجات', d: 'M0 30 C25 10 50 50 75 30 S100 15 100 15 V70 C75 90 50 50 25 70 S0 85 0 85 Z', box: { x: 0, y: 0.42, w: 1, h: 0.16 } },
  { key: 'corner', label: 'زاوية مائلة', group: 'زوايا وأشرطة', d: 'M100 0 V100 L0 0 Z', box: { x: 0, y: 0, w: 0.28, h: 0.28 }, square: true },
  { key: 'corner-stripes', label: 'زاوية بشريطين', group: 'زوايا وأشرطة', d: 'M45 0 H70 L100 30 V55 Z M80 0 H100 V20 Z', box: { x: 0, y: 0, w: 0.3, h: 0.3 }, square: true },
  { key: 'diagonal-band', label: 'شريط مائل', group: 'زوايا وأشرطة', d: 'M70 0 H100 L30 100 H0 Z', box: { x: 0.55, y: 0, w: 0.3, h: 1 } },
  { key: 'ribbon', label: 'شريط بطرفين', group: 'زوايا وأشرطة', d: 'M0 15 H100 L92 50 L100 85 H0 L8 50 Z', box: { x: 0.2, y: 0.42, w: 0.6, h: 0.14 } },
  { key: 'tag', label: 'شريط بسهم', group: 'زوايا وأشرطة', d: 'M15 0 H100 V100 H15 L0 50 Z', box: { x: 0, y: 0.42, w: 0.45, h: 0.12 } },
  { key: 'arch', label: 'قوس باب', group: 'أقواس وإطارات', d: 'M0 100 V40 A50 40 0 0 1 100 40 V100 Z', box: { x: 0.3, y: 0.12, w: 0.4, h: 0.76 } },
  { key: 'arch-outline', label: 'إطار قوس', group: 'أقواس وإطارات', d: 'M2 100 V40 A48 38 0 0 1 98 40 V100', stroke: true, box: { x: 0.28, y: 0.1, w: 0.44, h: 0.8 } },
  { key: 'frame', label: 'إطار', group: 'أقواس وإطارات', d: 'M0 0 H100 V100 H0 Z M4 4 V96 H96 V4 Z', evenodd: true, box: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 } },
  { key: 'frame-double', label: 'إطار مزدوج', group: 'أقواس وإطارات', d: 'M0 0 H100 V100 H0 Z M2 2 V98 H98 V2 Z M4 4 H96 V96 H4 Z M5 5 V95 H95 V5 Z', evenodd: true, box: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 } },
  { key: 'frame-corners', label: 'زوايا إطار', group: 'أقواس وإطارات', d: 'M0 0 H20 V3 H3 V20 H0 Z M100 0 V20 H97 V3 H80 V0 Z M100 100 H80 V97 H97 V80 H100 Z M0 100 V80 H3 V97 H20 V100 Z', box: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 } },
  { key: 'starburst', label: 'شارة نجمية', group: 'شارات', d: starburst(16, 0.82), box: { x: 0.4, y: 0.35, w: 0.2, h: 0.3 }, square: true },
  { key: 'seal-ring', label: 'ختم دائري', group: 'شارات', d: `${CIRCLE(50)} ${CIRCLE(42)}`, evenodd: true, box: { x: 0.4, y: 0.35, w: 0.2, h: 0.3 }, square: true },
  { key: 'blob', label: 'بقعة', group: 'شارات', d: shapePath('blob', 100, 100), box: { x: 0.35, y: 0.3, w: 0.3, h: 0.4 }, square: true }
];

export function pathPreset(key: string | undefined): PathPreset | undefined {
  return key ? PATH_PRESETS.find((p) => p.key === key) : undefined;
}
