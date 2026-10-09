/**
 * طبقات Photoshop — تُقرأ لتصير عناصر تُحرَّر، وتُمحى من الخلفية فلا تتكرّر.
 *
 * الصورة المسطَّحة في آخر الملف (`psd.ts`) هي الخلفية الصادقة: فيها المؤثّرات
 * والظلال التي لا نرسمها. لكنّ فيها أيضًا كلَّ نصٍّ وصورةٍ ورمز — فإن رُفعت هذه
 * عناصرَ فوقها ظهر كلٌّ منها مرّتين: المطبوعُ في الخلفية، والمحرَّرُ فوقه.
 *
 * فالخلفية تُؤخذ مسطَّحةً كما هي، **إلا مواضعَ ما صار عنصرًا**: تُعاد تلك وحدها
 * من الطبقات التي تحتها. ويُقاس الصدق على حلقةٍ حولها: إن خالف تركيبُنا صورةَ
 * Photoshop هناك (مؤثّرٌ لا نرسمه) مُلئ الموضع ممّا حوله بدل أن يُلصق فيه لونٌ
 * خاطئ.
 *
 * والبنية (Adobe Photoshop File Formats): سجلّاتُ الطبقات من القاع إلى القمّة،
 * ثم بياناتُ قنوات كلٍّ منها بالترتيب نفسه، وكلُّ قناةٍ بضغطها.
 *
 * (DESIGNS.md ٠٫٩: كان هذا كلّه هنا في ١١٢٠ سطرًا؛ وهو اليوم مدخلٌ ثابت يعيد التصدير من `design/psd*` — الأنواع، والنصّ،
 * والسجلّات، والبكسلات، والمحو، وما يصير عنصرًا — فلم يتغيّر مستوردٌ واحد.)
 */
export type { Rect, PsdText, PsdLayer, PsdDoc } from './design/psdTypes';
export { readTextLayer } from './design/psdText';
export { parsePsdLayers } from './design/psdRecords';
export { decodeChannel, colorChannels, layerPixels, compositeRect } from './design/psdPixels';
export { eraseLayers } from './design/psdErase';
export type { PsdBackground } from './design/psdErase';
export { psdItems } from './design/psdItems';
export type { PsdItem } from './design/psdItems';
