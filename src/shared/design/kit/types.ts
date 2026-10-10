/**
 * أنواع التصاميم وتخطيطها: أدوار النصّ، وخانات النصّ والصورة والجدول، والزخرفة، والتخطيط، ومواصفة النوع.
 *
 * التخطيط **نِسَبٌ من الورقة** والمحور الأفقي من اليسار (كإحداثيات الرسم)، ويُقلب عند بناء العناصر. وهو لا يعرف
 * لونًا ولا خطًّا: يقول «هنا العنوان، وهنا الاسم، وهنا خطّ التوقيع» — والنمط يقرّر كيف يبدو كلٌّ منها.
 */
import type { CanvasSize } from '../model/types';

/** دورُ النصّ: عليه يختار النمط الخطَّ واللون. */
export type Role =
  | 'org'
  | 'headline'
  | 'intro'
  | 'name'
  | 'body'
  | 'meta'
  | 'label'
  | 'accent'
  | 'big'
  | 'onBand'
  | 'onBandSmall';

/** [يسار، أعلى، عرض، ارتفاع] نِسَبًا. */
export type Rect = [number, number, number, number];

export type TextSlot = {
  text: string;
  at: Rect;
  role: Role;
  /** بالنقاط، قبل أن يضربه النمط. */
  size: number;
  align?: 'center' | 'right' | 'left';
  /** سطرٌ يصغر ليسع — للأسماء والجهات. */
  fit?: boolean;
  dir?: 'rtl' | 'ltr';
};

export type ImageSlot = {
  at: Rect;
  /** حقل الصورة (صورة الطالب)، أو شعار الجهة. */
  ref?: string;
  logo?: boolean;
  fit: 'cover' | 'contain';
  radius?: number;
};

export type Decor =
  | { t: 'band'; at: Rect; edge?: 'bottom' | 'top' }
  | { t: 'rule'; x1: number; x2: number; y: number }
  | { t: 'divider'; cx: number; y: number; w: number }
  | { t: 'photo'; at: Rect }
  | { t: 'panel'; at: Rect }
  | { t: 'seal'; cx: number; cy: number; r: number; faint?: boolean }
  | { t: 'medal'; cx: number; cy: number; r: number; rank: number };

export type TableSlot = {
  at: Rect;
  name?: string;
  columns: { title: string; widthPercent: number; align?: 'right' | 'center' | 'left' }[];
  rows: { text: string; field?: string }[][];
  headerBg?: string;
  borderColor?: string;
  fontSize?: number;
  stripe?: boolean;
  /** حدود الجدول (١٫٩): أسطرٌ أفقية للمنيو، أو بلا حدود — وبغيرها كاملة. */
  borders?: 'rows' | 'none';
  /** بلا صفّ عناوين: قائمة الأصناف وأسعارها. */
  hideHeader?: boolean;
};

export type Layout = {
  texts: TextSlot[];
  images: ImageSlot[];
  /**
   * باركود الرقم — في الهويّات والبطاقات وحدها (قرار المالك): يُمسح عند باب
   * المدرسة أو المكتبة. ولا باركود في الكتب ولا الأسئلة ولا المعاملات.
   */
  codes?: { at: Rect; ref: string }[];
  tables?: TableSlot[];
  decor: Decor[];
  /** منطقة النصّ الرئيسية — الزخرفة المتناثرة لا تدخلها. */
  calm: Rect;
};

export type Family = 'sheet' | 'card';
export type Variant = 'centered' | 'asym';

export type KindSpec = {
  key: string;
  title: string;
  group: string;
  size: CanvasSize;
  bleed: number;
  family: Family;
  layout: (v: Variant) => Layout;
  sample: Record<string, string>;
};
