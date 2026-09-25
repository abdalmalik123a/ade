/**
 * رسم الوثيقة علاماتٍ — محرّك واحد للمعاينة والطباعة معًا.
 *
 * ما يراه الموظف على الشاشة هو ما يخرج من الطابعة لأنه الكود نفسه؛ ووجود
 * نسختين من الرسم يعني ورقتين مختلفتين لكتاب واحد.
 */
import {
  walkBlocks,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type ListItem,
  type ListStyle,
  type Numerals,
  type ParagraphBlock
} from './doc';

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
const FILLED_CLASS = 'font-bold text-black underline underline-offset-4 decoration-1';
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
        let out = escapeHtml(node.text);
        const m = node.marks;
        if (!m) return out;
        if (m.size) out = `<span style="font-size:${m.size}px">${out}</span>`;
        if (m.underline) out = `<u>${out}</u>`;
        if (m.bold) out = `<strong>${out}</strong>`;
        return out;
      }

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

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
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

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!);

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
      const rows = block.rows
        .map((row, ri) => {
          const tag = block.header && ri === 0 ? 'th' : 'td';
          const cells = row.cells
            .map((cell) => {
              const span = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
              const body = cell.blocks
                .map((p) => paragraphHtml(p, ins(p.inlines), { ...opts, paragraphs: 'blocks' }))
                .join('');
              const border = block.borders === false ? 'border:none' : 'border:1px solid currentColor';
              return `<${tag}${span} style="${border};padding:2px 4px;vertical-align:top">${body}</${tag}>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      // الجدول يُقسم بصفوفه لا وسط الخليّة، ويعيد صفّ عناوينه في الصفحة التالية.
      return `<table${dir} style="width:100%;border-collapse:collapse;page-break-inside:auto"><colgroup>${cols}</colgroup>${rows}</table>`;
    }

    case 'image': {
      // محاذاةٌ فيزيائية لا منطقية: `flex-start` ينقلب في الورقة العربية فيقع
      // الختمُ المقصود يسارًا في اليمين. و`text-align:left` يسارٌ في كل اتجاه.
      const align = block.align === 'justify' ? 'center' : block.align;
      const src = block.src ? `diwan://store/${escapeHtml(block.src)}` : '';
      const height = block.height ? `height:${block.height}px;` : '';
      return `<div style="text-align:${align}"><img alt="" src="${src}" style="display:inline-block;width:${block.width}px;${height}max-width:100%"/></div>`;
    }

    case 'spacer':
      // مساحة الإجابة: سطورٌ منقّطة يكتب عليها الطالب.
      return block.lines
        ? `<div style="height:${block.height}px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,currentColor 27px,currentColor 28px);opacity:.45"></div>`
        : `<div style="height:${block.height}px"></div>`;

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

    case 'group':
      // الظهور يقرّره الحقل: «المرفقات» تُلغى إن لم توجد، ولا تُترك سطرًا فارغًا.
      if (block.mode === 'conditional' && !values[block.on]?.trim()) return '';
      return block.blocks.map((b) => renderBlock(b, values, fields, opts)).join('');
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

      return (
        `<div style="margin:2px 0">` +
        `${score}<span style="font-weight:700">${escapeHtml(head)}</span> ` +
        `${renderInlines(it.inlines, values, fields, opts)}` +
        `${pick}${answer}${kids}</div>`
      );
    })
    .join('');

  const pad = depth === 0 ? 0 : 18;
  return `<div${dir} style="padding-inline-start:${pad}px">${body}</div>`;
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
  return opts.paragraphs === 'lines' ? parts.join('<br/>') : parts.join('');
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
