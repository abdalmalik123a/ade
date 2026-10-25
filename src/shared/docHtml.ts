/**
 * رسم الوثيقة علاماتٍ — محرّك واحد للمعاينة والطباعة معًا.
 *
 * ما يراه الموظف على الشاشة هو ما يخرج من الطابعة لأنه الكود نفسه؛ ووجود
 * نسختين من الرسم يعني ورقتين مختلفتين لكتاب واحد.
 */
import {
  walkBlocks,
  keepTogetherFrom,
  pageMm,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type ListItem,
  type ListStyle,
  type Numerals,
  type ParagraphBlock,
  type TableBlock
} from './doc';
import { GENDER_KEY, isChoiceKey, pickChoice, resolveChoices } from './gender';
import { toIndic } from './arabic';
import { escapeHtml } from './html';
import { imageBlockHtml } from './docHtmlImage';
import { marksHtml } from './docPmMarks';
import { footerBandMm, type LetterheadFooter } from './letterhead';

export type MissingMode = 'token' | 'blank' | 'hide';

export type RenderOptions = {
  /** الإجابة النموذجية: تُخفى في ورقة الطالب وتظهر في ورقة المصحّح. */
  answers?: 'hide' | 'show';
  /**
   * ما يُرسم مكان حقل لم يُملأ:
   * `token` وسمٌ ظاهر يُنبّه الموظف، و`blank` فراغٌ للطباعة، و`hide` لا شيء.
   */
  missing?: MissingMode;
  /** أرقام الترقيم: عربية (1) أو هندية (١). وأصلُها ما في ضبط الورقة. */
  numerals?: Numerals;
  /**
   * الفقرات أسطرًا مفصولة بـ`<br/>` أم كتلًا مستقلّة.
   *
   * المتن القديم أسطر لا فقرات، وسطره الفارغ له معنى — خمس فقرات فارغة هي
   * فراغ التوقيع. فلو صارت كتلًا انهار الفراغ وتغيّر شكل ما بناه المكتب.
   * والمحرّر الجديد (م٥) يرسم كتلًا.
   */
  paragraphs?: 'lines' | 'blocks';
};

/** الحقل المملوء يُظلَّل: أن يرى الموظفُ ما مُلئ وما بقي فارغًا قبل الطباعة. */
const FILLED_CLASS = 'fv font-bold text-black underline underline-offset-4 decoration-1';

/**
 * الطباعة على استمارةٍ مطبوعةٍ مسبقًا: الورقة كلّها مخفيّةٌ **ولها مكانها**، والقيم
 * المملوءة (`fv`) وحدها ظاهرة — فتقع كلُّ قيمةٍ في فراغها المنقّط على الاستمارة
 * الحكومية كما وقعت في المعاينة. `visibility` لا `display`: المخفيّ يحفظ موضعه،
 * فلا ينزاح سطرٌ. وإزاحة الطابعة (المعايرة) تُطبَّق بعدها كما في كل طباعة.
 */
export function valuesOnlySheet(sheetHtml: string): string {
  return (
    '<style>.values-only,.values-only *{visibility:hidden!important}' +
    '.values-only .fv,.values-only .fv *{visibility:visible!important;text-decoration:none!important}</style>' +
    `<div class="values-only">${sheetHtml}</div>`
  );
}
const TOKEN_CLASS = 'px-1 rounded bg-surface-container-high text-secondary font-mono';

/** فراغٌ بطول ما كُتب — لا ينكمش فتتشوّه الورقة. */
function blank(field: DocField | undefined): string {
  const width = field?.width ?? 14;
  return `<span style="display:inline-block;min-width:${width}ch;border-bottom:1px dotted currentColor">&nbsp;</span>`;
}

function renderInlines(
  inlines: Inline[],
  values: Record<string, string>,
  fields: Map<string, DocField>,
  opts: Required<RenderOptions>
): string {
  return inlines
    .map((node) => {
      if (node.kind === 'break') return '<br/>';

      if (node.kind === 'run') {
        // «{الطالب|الطالبة}» مكتوبًا نصًّا يُحلّ بجنس صاحب الورقة.
        let out = escapeHtml(resolveChoices(node.text, values[GENDER_KEY]));
        // وتنسيقه بعلاماته — كلّ علامةٍ ومخطّطها ورسمها في `docPmMarks.ts`.
        return marksHtml(node.marks, out);
      }

      // والوسم نفسه عقدةَ حقل: ليس فراغًا يُملأ بل خيارٌ يُحلّ.
      if (isChoiceKey(node.ref)) return escapeHtml(pickChoice(node.ref, values[GENDER_KEY]));
      const field = fields.get(node.ref);
      const value = values[node.ref];
      if (value) return `<span class="${FILLED_CLASS}">${escapeHtml(value)}</span>`;

      // حقل اليد يخرج فراغًا بطوله ولو بقيت بقيّة الحقول فارغة أو مملوءة —
      // ولا يُحذف ما كتبه الموظف بيده إن كتب: القيمة أعلاه تسبقه.
      if (field?.fillMode === 'hand') return blank(field);
      if (opts.missing === 'hide') return '';
      if (opts.missing === 'blank') return blank(field);
      return `<span class="${TOKEN_CLASS}">{${escapeHtml(node.ref)}}</span>`;
    })
    .join('');
}

const AR_LETTERS = [...'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ'];
const ORDINALS = [
  'أولًا',
  'ثانيًا',
  'ثالثًا',
  'رابعًا',
  'خامسًا',
  'سادسًا',
  'سابعًا',
  'ثامنًا',
  'تاسعًا',
  'عاشرًا'
];

/**
 * علامة الترقيم تُحسب عند الرسم لا تُكتب.
 *
 * فحذف سؤال يعيد ترقيم ما بعده وحده — وهذا ما يكسر ورقة Word في كل تعديل.
 */
export function marker(style: ListStyle, index: number, numerals: Numerals): string {
  const n = index + 1;
  const num = numerals === 'indic' ? toIndic(n) : String(n);
  switch (style) {
    case 'bullet':
      return '•';
    case 'number':
      return `${num}-`;
    case 'question':
      return `س${num}:`;
    case 'arabicLetter':
      return `${AR_LETTERS[index] ?? num})`;
    case 'ordinal':
      return `${ORDINALS[index] ?? num}:`;
    case 'latinNumber':
      return `${n}-`;
    case 'latinLetter':
      return `${String.fromCharCode(97 + (index % 26))})`;
  }
}

function paragraphHtml(
  block: ParagraphBlock,
  inner: string,
  opts: Required<RenderOptions>
): string {
  if (opts.paragraphs === 'lines') return inner;
  const style = [
    `text-align:${block.align}`,
    // المسافات تُحفظ: «(          )» فراغُ كتابةٍ باليد، ولو ضُغط لاختفى.
    'white-space:pre-wrap',
    block.size ? `font-size:${block.size}px` : '',
    block.lineHeight ? `line-height:${block.lineHeight}` : '',
    block.indent ? `text-indent:${block.indent}mm` : '',
    block.spaceBefore ? `margin-top:${block.spaceBefore}px` : '',
    block.spaceAfter ? `margin-bottom:${block.spaceAfter}px` : ''
  ]
    .filter(Boolean)
    .join(';');
  const dir = block.dir ? ` dir="${block.dir}"` : '';
  return `<p${dir} style="${style}">${inner || '&nbsp;'}</p>`;
}

function renderBlock(
  block: Block,
  values: Record<string, string>,
  fields: Map<string, DocField>,
  opts: Required<RenderOptions>
): string {
  const ins = (list: Inline[]) => renderInlines(list, values, fields, opts);
  const dir = block.dir ? ` dir="${block.dir}"` : '';

  switch (block.kind) {
    case 'paragraph':
      return paragraphHtml(block, ins(block.inlines), opts);

    case 'list':
      return renderItems(block.items, block.styles, 0, values, fields, opts, dir);

    case 'table': {
      const cols = block.columns
        .map((w) => `<col style="width:${(w * 100) / (block.columns.reduce((a, b) => a + b, 0) || 1)}%"/>`)
        .join('');
      const row = (r: TableBlock['rows'][number], tag: 'th' | 'td', isH = false) => {
        const cells = r.cells
          .map((c) => {
            const span = (c.colSpan && c.colSpan > 1 ? ` colspan="${c.colSpan}"` : '') + (c.rowSpan && c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : '');
            const body = c.blocks.map((p) => paragraphHtml(p, ins(p.inlines), { ...opts, paragraphs: 'blocks' })).join('');
            const border = block.borders === false ? 'border:none' : 'border:1px solid currentColor';
            const bg = isH && block.headerShading ? ';background-color:#f1f5f9' : '';
            return `<${tag}${span} style="${border};padding:2px 4px;vertical-align:${c.vAlign || 'top'}${bg}">${body}</${tag}>`;
          })
          .join('');
        return `<tr style="break-inside:avoid">${cells}</tr>`;
      };
      const [first, ...rest] = block.rows;
      const head = block.header && first ? `<thead>${row(first, 'th', true)}</thead>` : '';
      const body = (head ? rest : block.rows).map((r, i) => row(r, 'td', !head && i === 0)).join('');
      return `<table${dir} style="width:100%;border-collapse:collapse;break-inside:avoid;page-break-inside:avoid"><colgroup>${cols}</colgroup>${head}<tbody>${body}</tbody></table>`;
    }

    case 'image':
      // والصورة الثابتة وحقل الصورة (S38) في `docHtmlImage.ts`.
      return imageBlockHtml(block, values);

    case 'spacer':
      // مساحة الإجابة: سطورٌ منقّطة يكتب عليها الطالب.
      return block.lines
        ? `<div style="height:${block.height}px;break-inside:avoid;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,currentColor 27px,currentColor 28px);opacity:.45"></div>`
        : `<div style="height:${block.height}px;break-inside:avoid"></div>`;

    case 'columns': {
      // عمودان لا يتدفّقان: كل عمود كتلُه، ولا ينسكب شيء إلى صفحة تالية.
      const cols = block.columns
        .map(
          (col, i) =>
            `<div style="flex:${block.widths?.[i] ?? 1} 1 0;min-width:0">${col
              .map((b) => renderBlock(b, values, fields, opts))
              .join('')}</div>`
        )
        .join('');
      return `<div${dir} style="display:flex;gap:${block.gap ?? 16}px;align-items:flex-start;break-inside:avoid;page-break-inside:avoid">${cols}</div>`;
    }

    case 'pageBreak':
      return `<div style="break-after:page;page-break-after:always"></div>`;

    case 'rule':
      // لا يبدأ صفحةً وحده: يبقى مع الأسطر التي فوقه.
      return `<div data-rule="" style="border-top:1.5px solid currentColor;margin:6px 0;break-before:avoid"></div>`;

    case 'group': {
      // الظهور والتكرار يقرّرهما الحقل: «المرفقات» تُلغى إن فرغت، و`repeat` يكرّر كتله لكلّ سطرٍ غير فارغ.
      if (block.mode === 'repeat') {
        const rows = (values[block.on] ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        return rows.map((v) => block.blocks.map((b) => renderBlock(b, { ...values, [block.on]: v }, fields, opts)).join('')).join('');
      }
      if (block.mode === 'conditional' && !values[block.on]?.trim()) return '';
      return block.blocks.map((b) => renderBlock(b, values, fields, opts)).join('');
    }
  }
}

/**
 * يرسم الوثيقة بقيمها.
 *
 * والحقل الفارغ يبقى ظاهرًا افتراضًا ليُنبّه الموظف قبل الطباعة — لا يُخفى ولا
 * يُخترع له محتوى.
 */
/**
 * عناصر الترقيم بفروعها.
 *
 * والدرجة تُكتب يمين السؤال كما تُكتب في ورقة المدرسة، و«أجب عن ن» تُعلن فوق
 * فروعه — فيقرأها الطالب حيث يتوقّعها.
 */
function renderItems(
  items: ListItem[],
  styles: ListStyle[],
  depth: number,
  values: Record<string, string>,
  fields: Map<string, DocField>,
  opts: Required<RenderOptions>,
  dir: string
): string {
  const style = styles[Math.min(depth, styles.length - 1)] ?? 'bullet';
  const numerals: Numerals = opts.numerals;

  const body = items
    .map((it, i) => {
      const head = marker(style, i, numerals);
      const score =
        typeof it.score === 'number'
          ? `<span style="float:left;font-weight:700">(${
              numerals === 'indic' ? toIndic(it.score) : it.score
            } درجة)</span>`
          : '';
      const pick =
        it.pick && it.items?.length
          ? `<div style="font-weight:700">أجب عن ${
              numerals === 'indic' ? toIndic(it.pick) : it.pick
            } فقط:</div>`
          : '';
      const answer =
        opts.answers === 'show' && it.answer?.length
          ? `<div style="color:#b00;font-weight:700">الإجابة: ${renderInlines(it.answer, values, fields, opts)}</div>`
          : '';
      const kids = it.items?.length
        ? renderItems(it.items, styles, depth + 1, values, fields, opts, dir)
        : '';
      const imgStyle = `display:inline-block;max-width:100%;${it.image?.width ? `width:${it.image.width}px;` : 'max-height:160px;'}${it.image?.height ? `height:${it.image.height}px;` : ''}object-fit:contain`;
      const imgSrc = it.image?.path ? `diwan://store/${escapeHtml(it.image.path)}` : '';
      const imageHtml = imgSrc ? `<div data-question-image="" style="text-align:center;margin:6px 0;break-inside:avoid"><img alt="" src="${imgSrc}" style="${imgStyle}"/></div>` : '';

      return (
        `<div style="margin:2px 0">` +
        `${score}<span style="font-weight:700">${escapeHtml(head)}</span> ` +
        `${renderInlines(it.inlines, values, fields, opts)}` +
        `${imageHtml}${pick}${answer}${kids}</div>`
      );
    })
    .join('');

  const pad = depth === 0 ? 0 : 18;
  // `data-flow`: أسطرٌ تقسمها الطابعة لا كتلةٌ تنزل كاملة — به يعدّ `pageFlow.ts` الصفحات.
  return `<div${dir} data-flow="lines" style="padding-inline-start:${pad}px">${body}</div>`;
}

export function renderDocHtml(
  doc: Doc,
  values: Record<string, string> = {},
  options: RenderOptions = {}
): string {
  const opts: Required<RenderOptions> = {
    missing: options.missing ?? 'token',
    paragraphs: options.paragraphs ?? 'lines',
    answers: options.answers ?? 'hide',
    numerals: options.numerals ?? doc.pageSetup.numerals
  };
  const fields = new Map(doc.fields.map((f) => [f.key, f]));
  const parts = doc.blocks.map((b) => renderBlock(b, values, fields, opts));
  if (opts.paragraphs === 'lines') return parts.join('<br/>');
  // الخاتمة وآخر فقرةٍ قبلها كتلةٌ لا تُشطر: التوقيع لا يبدأ صفحةً وحده (`keepTogetherFrom`).
  const keep = keepTogetherFrom(doc.blocks);
  if (keep < 0) return parts.join('');
  return parts.slice(0, keep).join('') + `<div data-keep="" style="break-inside:avoid">${parts.slice(keep).join('')}</div>`;
}

/**
 * العلامة المائية طبقةً خلف المتن.
 *
 * تُوضع داخل ورقةٍ `position:relative; isolation:isolate` فيكون `z-index:-1`
 * خلف النصّ وفوق بياض الورقة — لا فوق المتن فتحجبه. والنمط كلّه مضمَّن في
 * العلامة لأن نافذة الطباعة ترث العلامات لا الأصناف وحدها.
 */
export function watermarkHtml(doc: Doc): string {
  const wm = doc.pageSetup.watermark;
  if (!wm) return '';
  const box =
    'position:absolute;inset:0;z-index:-1;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none';
  if (wm.kind === 'text') {
    const opacity = wm.opacity ?? 0.1;
    return (
      `<div data-watermark="" style="${box}">` +
      `<span style="font-size:110px;font-weight:700;transform:rotate(-30deg);opacity:${opacity};white-space:nowrap;color:#000">` +
      `${escapeHtml(wm.text)}</span></div>`
    );
  }
  const opacity = wm.opacity ?? 0.07;
  return (
    `<div data-watermark="" style="${box}">` +
    `<img alt="" src="diwan://store/${escapeHtml(wm.src)}" style="width:60%;opacity:${opacity}"/></div>`
  );
}

/**
 * قواعد الطباعة الخاصّة بهذه الورقة: هوامش كل صفحة، والترقيم إن طُلب.
 *
 * `@page` في الورقة نفسها يغلب `margin:0` العامّ في نافذة الطباعة لأنه بعده؛ والحشو
 * الأعلى والأسفل يُنزع في الطباعة وحدها — فالمعاينة على الشاشة كما هي.
 */
export function pageCss(doc: Doc, letterhead?: { footer?: Pick<LetterheadFooter, 'show' | 'text' | 'size'> } | null): string {
  const m = doc.pageSetup.margins;
  const indic = doc.pageSetup.numerals === 'indic' ? ', arabic-indic' : '';
  const numbers = doc.pageSetup.pageNumbers;
  const bottom = numbers ? Math.max(m.bottom, 14) : m.bottom;
  // التذييل في شريطٍ محجوز أسفل كلّ صفحة بحشوٍ يتكرّر فيها (D136) — كان فوق آخر سطرين، وفي هامش `@page` يقصّه Chromium (جُرّب).
  const band = footerBandMm(letterhead?.footer, pageMm(doc.pageSetup).w - m.left - m.right);
  const foot = band ? `[data-letter-sheet]{padding-bottom:${band}mm!important;-webkit-box-decoration-break:clone;box-decoration-break:clone}` +
    `[data-letterhead-footer]{position:fixed;bottom:0;left:${m.left}mm;right:${m.right}mm}` : '';
  const box = numbers
    ? `@bottom-center{content:"صفحة " counter(page${indic}) " من " counter(pages${indic});` +
      `font-family:'Noto Naskh Arabic','Amiri',serif;font-size:10pt;color:#333;direction:rtl}`
    : '';
  return (
    `@page{margin:${m.top}mm 0 ${bottom}mm 0;${box}}` +
    `@media print{.print-root{min-height:0!important}` +
    `[data-letter-sheet]{padding-top:0!important;padding-bottom:0!important;min-height:0!important}${foot}}`
  );
}

/** الحقول الإلزامية التي لم تُملأ — لا يصدر كتاب وفيها فارغ. */
export function missingRequired(doc: Doc, values: Record<string, string>): DocField[] {
  const used = new Set<string>();
  for (const b of walkBlocks(doc.blocks)) {
    if (b.kind === 'paragraph') for (const i of b.inlines) if (i.kind === 'field') used.add(i.ref);
  }
  return doc.fields.filter(
    (f) => f.required && f.fillMode !== 'hand' && !values[f.key]?.trim() && used.has(f.key)
  );
}
