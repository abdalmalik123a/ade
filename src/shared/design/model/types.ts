/**
 * اللوحة — الوثيقة المصمَّمة: أنواعها.
 *
 * الشهادة والهوية والملصق والدعوة ليست وثائق متدفّقة. نموذج الكتل يتدفّق: الفقرة تدفع التي تحتها، والصفحة تمتدّ.
 * واللوحة عكسه: مقاسٌ ثابت وصفحةٌ واحدة وعناصرُ بمواضعها لا تدفع شيئًا، وخلفيةٌ تملأ الورقة.
 *
 * وثلاث قواعد تمنع الهشاشة التي تصيب هذا الصنف من البرامج:
 *
 * ١. **المقاس بالملّم لا بالبكسل** — البكسل مشتقٌّ منه بالدقّة المطلوبة. فالورقة نفسها تُعاين على الشاشة بـ٩٦
 *    وتُطبع بـ٣٠٠، ولا يتغيّر شيء.
 * ٢. **المواضع نِسَب (٠..١) لا بكسلات** — فتغيير المقاس لا يزيح حقلًا، وهو أكثر ما يكسر التصاميم المستوردة.
 * ٣. **الحقل هو هو** — عقدةُ `field` نفسها التي في الكتاب. فالدمج يعمل بلا تغيير: ثلاثون هويةً بثلاثين اسمًا
 *    بضغطة، ولا شاشةَ إدخالٍ جديدة.
 *
 * (DESIGNS.md ٠٫٤: كان هذا كلّه في `shared/canvas.ts`، وهو اليوم مدخلٌ ثابت يعيد التصدير من هنا.)
 */
import type { Align, Dir, Inline, Uuid } from '../../doc';
import type { ImageShape } from '../shapes';
import type { Dash, Gradient, Paint } from '../paint';

/** ملّمٌ — وهو وحدة القياس الوحيدة في اللوحة. */
export type Mm = number;

export type CanvasSize = { w: Mm; h: Mm };

/** صندوقٌ نِسَبًا من قياس التصميم (بلا النزف) — لا بكسلات. */
export type Box = { x: number; y: number; w: number; h: number };

export type ElementBase = {
  id: Uuid;
  box: Box;
  /** بالدرجات، حول مركز الصندوق. */
  rotate?: number;
  /** ترتيب الطبقة: الأكبر أمام. */
  z: number;
  dir?: Dir;
  /** المقفل لا يُحرَّك ولا يُحرَّر — وبه تُحمى الزخرفة من السحب بالخطأ. */
  locked?: boolean;
  /** اسمٌ يُرى في قائمة الطبقات. */
  name?: string;
  /** الشفافية ٠..١ (DESIGNS.md ١٫٣) — وغيابها ١. */
  opacity?: number;
  /** مجموعته (DESIGNS.md ١٫٦): عناصرُ بمعرّفٍ واحد تُحدَّد وتُسحب معًا. */
  group?: string;
  /** مخفيٌّ من «الطبقات»: لا يُرسم ولا يُطبع، ويبقى في التصميم. */
  hidden?: boolean;
};

export type VAlign = 'top' | 'middle' | 'bottom';

/**
 * نصٌّ في صندوق.
 *
 * و`inlines` هي عقد المتن نفسها: `run` و`field` و`break`. فما يُكتب `{اسم الطالب}`
 * في شهادةٍ هو ما يُكتب في كتاب — ويملؤه الشبّاك والدمج بلا أن يعرفا أنها لوحة.
 */
export type TextElement = ElementBase & {
  kind: 'text';
  inlines: Inline[];
  align: Align;
  vAlign: VAlign;
  /** بالنقاط (pt) — لا بكسلات، فالبكسل يتغيّر بالدقّة والنقطة لا تتغيّر. */
  size: number;
  color: string;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  lineHeight?: number;
  /**
   * `shrink`: سطرٌ واحد يصغر خطّه حتى يسع صندوقه ولا يُقصّ.
   *
   * «عبد الرحمن محمد عبد الكريم الجبوري» في هويةٍ صُمّمت على «زينب علي» كانت
   * تُقصّ صامتةً — وفي دفعةٍ من أربعمئة هوية لا يراها أحد حتى يشكو الزبون.
   */
  fit?: 'shrink';
  /** تباعد الكلمات بوحدة em — بعض الخطوط الكوفية مسافتها ثُمن حرف فتلتصق الكلمات. */
  wordSpacing?: number;
  /** تباعد الحروف بوحدة em — كما يكتبه Photoshop في «Tracking» للعناوين المتباعدة. */
  letterSpacing?: number;
  /** النصّ متدرّج اللون (DESIGNS.md ١٫٣) — العنوان الذهبيّ؛ و`color` لونه حيث لا يُرسم التدرّج. */
  gradient?: Gradient;
};

/** إطار الصورة على حدّ شكلها (DESIGNS.md ١٫١): بالملّم، حلقةً أو حلقتين بينهما فسحة. */
export type ImageFrame = { color: string; width: Mm; rings?: 1 | 2; gap?: Mm; dash?: Dash };

/** صورةٌ ثابتة، أو صورةُ حقلٍ من سجل المستمسكات والماسح (`ref`). */
export type ImageElement = ElementBase & {
  kind: 'image';
  src: string;
  ref?: string;
  fit: 'cover' | 'contain';
  radius?: number;
  /** تُقصّ بشكلٍ (`design/shapes.ts`) — وبغيره مستطيلةٌ كما كانت. */
  shape?: ImageShape;
  frame?: ImageFrame;
};

/** الباركود: Code128 للأرقام، وQR لما يُقرأ بالهاتف. */
export type BarcodeElement = ElementBase & {
  kind: 'barcode';
  /**
   * `seal` نقشُ أمانٍ فريد بذرتُه قيمته (`securitySeal.ts`) — و`value` فيه
   * وسومٌ تُملأ: «{اسم الطالب} {الرقم}»، فلكلّ بطاقةٍ نقشها.
   */
  symbology: 'code128' | 'qr' | 'seal';
  value: string;
  ref?: string;
};

export type ShapeElement = ElementBase & {
  kind: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  /** لونٌ أو تدرّج (DESIGNS.md ١٫٣). */
  fill?: Paint;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  dash?: Dash;
};

export type TableCell = {
  text: string;
  field?: string;
  align?: 'right' | 'center' | 'left';
  bold?: boolean;
};

export type TableColumn = {
  title: string;
  widthPercent: number;
  align?: 'right' | 'center' | 'left';
};

export type TableElement = ElementBase & {
  kind: 'table';
  columns: TableColumn[];
  rows: TableCell[][];
  headerBg?: string;
  headerColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  headerFontSize?: number;
  font?: string;
  stripe?: boolean;
  stripeBg?: string;
};

/**
 * الشكل الحرّ (DESIGNS.md ١٫٢): مسارٌ في مربّع ٠..١٠٠ يتمدّد مع صندوقه — موجةٌ وزاويةٌ وشريطٌ وقوسٌ وإطار
 * (`pathPresets.ts`)، بملءٍ أو حدٍّ، ويُقلب أفقيًّا أو رأسيًّا.
 */
export type PathElement = ElementBase & {
  kind: 'path';
  d: string;
  /** من أيّ شكلٍ في المكتبة جاء — للاسم في الطبقات. */
  preset?: string;
  /** لونٌ أو تدرّج (DESIGNS.md ١٫٣). */
  fill?: Paint;
  stroke?: string;
  /** بالملّم — ولا يتمدّد مع الصندوق. */
  strokeWidth?: Mm;
  evenodd?: boolean;
  dash?: Dash;
  flipX?: boolean;
  flipY?: boolean;
};

export type CanvasElement = TextElement | ImageElement | BarcodeElement | ShapeElement | TableElement | PathElement;

export type Background =
  | { kind: 'none' }
  | { kind: 'color'; color: string }
  /** `dpi` دقّةُ الصورة الأصلية — تُحفظ فلا تُطبع خلفيةٌ ضبابية بلا علم. */
  | { kind: 'image'; src: string; dpi?: number }
  /** تدرجات CSS وخلفيات الويب المتطورة. */
  | { kind: 'css'; style: string };

export type Canvas = {
  /** إصدار النموذج (`version.ts`) — وما حُفظ قبله إصداره ١. */
  v?: number;
  size: CanvasSize;
  bleed: Mm;
  cropMarks: boolean;
  background: Background;
  elements: CanvasElement[];
};
