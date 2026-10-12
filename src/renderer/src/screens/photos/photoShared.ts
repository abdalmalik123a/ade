/**
 * ما تشترك فيه شاشة الصور وأجزاؤها (تقسيمها بعد ١٫٧٫٠) — منقولٌ منها كما هو: ثوابت الإطار والدقّة، وأنواع الخلفية والأداة والقاط
 * الملبوس، وإطار الشاشة بنسبة المقاس.
 */
import type { PhotoBackground } from '@shared/photoPresets';
import type { Size } from '@shared/photoSheet';
import type { BrushMode, SuitTransform } from '@shared/portraitMask';
import type { Suit } from '../../lib/portraitCanvas';
import { toIndic } from '@shared/arabic';

export const pct = (v: number) => toIndic(Math.round(v * 100));
export const FRAME_H = 520;
export const CUSTOM_ID = 'custom';
/** دون هذه الدقّة الفعلية تُطبع الصورة ليّنة — يُنبَّه الموظف ليطلب صورةً أقرب. */
export const LOW_DPI = 300;

export type Bg = PhotoBackground | { kind: 'original' };
/** `color`: «امسح لونًا» (البند ٣٨) — ضغطةٌ على لونٍ تزيله؛ و`repair`: «رمّم» (البند ٤٠) — تحت الذقن وحده. */
export type Tool = 'move' | 'suit' | BrushMode | 'color' | 'repair';
export type Worn = { suit: Suit; at: SuitTransform; base: SuitTransform };

/** الإطار على الشاشة بنسبة المقاس — والعريض يُحدّ عرضه. */
export function frameFor(photo: Size): Size {
  const w = (FRAME_H * photo.w) / photo.h;
  return w <= 600 ? { w, h: FRAME_H } : { w: 600, h: (600 * photo.h) / photo.w };
}

/** صورةٌ فتحها الشبّاك من «الملفّات» — محفوظةً في المخزن، تُفتح مرّةً بمفتاحها. */
export type PhotoIncoming = { key: number; path: string };
