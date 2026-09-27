/**
 * فاحص ما قبل الطباعة — ما يُقال للمكتب قبل أن تخرج أربعمئة بطاقة.
 *
 * ما يُعرف من التصميم وقيمه يُحسب هنا خالصًا ويُختبر بالأرقام: خلفيةٌ دقّتها
 * دون ١٥٠ نقطة/إنش، وعنصرٌ يلامس خطّ القصّ، وبطاقاتٌ بلا اسمٍ أو بلا صورة.
 * وما لا يُعرف إلا بعد الرسم (اسمٌ صغُر كثيرًا، نصٌّ فاض عن صندوقه، دقّة صورة
 * الطالب الفعلية) تقيسه المعاينة بالخطّ الحقيقي وتضمّه إلى القائمة.
 *
 * والفاحص **يُنبّه ولا يمنع**: المكتب أعلم بورقه، والطباعة قراره.
 */
import type { Canvas, CanvasElement } from './canvas';

export type PreflightIssue = {
  /** `warn` يُفسد الورقة غالبًا، و`info` يُحسن أن يُعرف. */
  level: 'warn' | 'info';
  text: string;
};

/** دون هذه الدقّة تخرج الصورة ضبابيّةً على الورق. */
export const MIN_PRINT_DPI = 150;
/** المنطقة الآمنة داخل خطّ القصّ: المقصلة تنحرف ملّمًا أو اثنين. */
export const SAFE_MM = 3;

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

function labelOf(el: CanvasElement): string {
  if (el.name) return el.name;
  if (el.kind === 'text') {
    const text = el.inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? `{${n.ref}}` : ' ')).join('').trim();
    return text.length > 24 ? `${text.slice(0, 24)}…` : text || 'نصّ';
  }
  if (el.kind === 'image') return el.ref ? `صورة {${el.ref}}` : 'صورة';
  if (el.kind === 'barcode') return el.symbology === 'qr' ? 'رمز QR' : 'باركود';
  return 'عنصر';
}

/** الحقول التي يطلبها التصميم: ما في نصوصه، وصوره، ورموزه. */
function refsOf(canvas: Canvas): { text: string[]; image: string[] } {
  const text = new Set<string>();
  const image = new Set<string>();
  for (const el of canvas.elements) {
    if (el.kind === 'text') for (const n of el.inlines) if (n.kind === 'field') text.add(n.ref);
    if ((el.kind === 'image' || el.kind === 'barcode') && el.ref) (el.kind === 'image' ? image : text).add(el.ref);
  }
  return { text: [...text], image: [...image] };
}

/** فحص التصميم وقيمه — كلّ بطاقةٍ صفٌّ من القيم. */
export function designPreflight(canvas: Canvas, cards: Record<string, string>[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const bg = canvas.background;
  if (bg.kind === 'image' && bg.dpi && bg.dpi < MIN_PRINT_DPI) {
    issues.push({
      level: 'warn',
      text: `الخلفية بدقّة ${toIndic(Math.round(bg.dpi))} نقطة/إنش — تخرج ضبابية؛ صدّرها ٣٠٠ من برنامجها`
    });
  }

  // القرب من خطّ القصّ: لما يُقصّ وحده (له نزف) — والشهادة ورقةٌ بمقاسها لا تُقصّ.
  if (canvas.bleed > 0) {
    const { w, h } = canvas.size;
    for (const el of canvas.elements) {
      if (el.kind === 'shape' || el.kind === 'svg' || el.kind === 'html') continue;
      // ما يغطّي معظم البطاقة خلفيةٌ مقصودةٌ أن تمتدّ إلى الحافّة.
      if (el.box.w * el.box.h > 0.8) continue;
      const gap = Math.min(el.box.x * w, (1 - el.box.x - el.box.w) * w, el.box.y * h, (1 - el.box.y - el.box.h) * h);
      if (gap < SAFE_MM) {
        issues.push({
          level: 'warn',
          text: `«${labelOf(el)}» على ${toIndic(Math.max(0, Math.round(gap * 10) / 10))} ملم من خطّ القصّ — المقصلة قد تأكله (الآمن ${toIndic(SAFE_MM)} ملم)`
        });
      }
    }
  }

  if (cards.length) {
    const { text, image } = refsOf(canvas);
    for (const ref of text) {
      const empty = cards.filter((c) => !c[ref]?.trim()).length;
      if (empty) {
        issues.push({
          level: empty === cards.length ? 'warn' : 'info',
          text: `${toIndic(empty)} من ${toIndic(cards.length)} ${cards.length === 1 ? 'بطاقة' : 'بطاقات'} بلا «${ref}»`
        });
      }
    }
    for (const ref of image) {
      const empty = cards.filter((c) => !c[ref]?.trim()).length;
      if (empty) issues.push({ level: 'warn', text: `${toIndic(empty)} بطاقة بلا صورة في «${ref}»` });
    }
  }
  return issues;
}

/**
 * دقّة الصورة في موضعها: بكسلاتها على عرض صندوقها بالإنش.
 * صورة طالبٍ ٢٤٠ بكسلًا في صندوقٍ عرضه ٢٥ ملم = ٢٤٤ نقطة/إنش؛ و٩٠ بكسلًا = ٩١.
 */
export function placedDpi(pixelWidth: number, boxMm: number): number {
  return boxMm > 0 ? pixelWidth / (boxMm / 25.4) : Infinity;
}

/** صور البطاقات التي تُطبع بدقّةٍ أدنى من الحدّ — تُجمع بعنصرها: «٣ صور طلاب دون ١٥٠». */
export function lowResIssues(found: { label: string; dpi: number }[]): PreflightIssue[] {
  const byLabel = new Map<string, number[]>();
  for (const f of found) if (f.dpi < MIN_PRINT_DPI) byLabel.set(f.label, [...(byLabel.get(f.label) ?? []), f.dpi]);
  return [...byLabel].map(([label, list]) => ({
    level: 'warn' as const,
    text: `${toIndic(list.length)} ${list.length === 1 ? 'صورة' : 'صور'} في «${label}» دون ${toIndic(MIN_PRINT_DPI)} نقطة/إنش (أدناها ${toIndic(Math.round(Math.min(...list)))}) — تخرج ضبابية`
  }));
}
