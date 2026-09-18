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
  type ParagraphBlock
} from './doc';

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type MissingMode = 'token' | 'blank' | 'hide';

export type RenderOptions = {
  /**
   * ما يُرسم مكان حقل لم يُملأ:
   * `token` وسمٌ ظاهر يُنبّه الموظف، و`blank` فراغٌ للطباعة، و`hide` لا شيء.
   */
  missing?: MissingMode;
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

const MARKERS: Record<string, (i: number) => string> = {
  bullet: () => '•',
  number: (i) => `${i + 1}.`,
  arabicLetter: (i) => `${'أبجدهوزحطي'[i] ?? String(i + 1)})`,
  ordinal: (i) => `${['أولًا', 'ثانيًا', 'ثالثًا', 'رابعًا', 'خامسًا'][i] ?? i + 1}:`
};

function paragraphHtml(
  block: ParagraphBlock,
  inner: string,
  opts: Required<RenderOptions>
): string {
  if (opts.paragraphs === 'lines') return inner;
  const style = [
    `text-align:${block.align}`,
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

    case 'list': {
      const marker = MARKERS[block.style] ?? MARKERS.bullet!;
      const items = block.items
        .map((it, i) => `<li><span class="ms-1">${marker(i)}</span> ${ins(it.inlines)}</li>`)
        .join('');
      return `<ul${dir} style="list-style:none;padding:0;margin:0">${items}</ul>`;
    }

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
              return `<${tag}${span} style="border:1px solid currentColor;padding:2px 4px;vertical-align:top">${body}</${tag}>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      // الجدول يُقسم بصفوفه لا وسط الخليّة، ويعيد صفّ عناوينه في الصفحة التالية.
      return `<table${dir} style="width:100%;border-collapse:collapse;page-break-inside:auto"><colgroup>${cols}</colgroup>${rows}</table>`;
    }

    case 'image': {
      const justify =
        block.align === 'center' ? 'center' : block.align === 'left' ? 'flex-start' : 'flex-end';
      const src = block.src ? `diwan://store/${escapeHtml(block.src)}` : '';
      return `<div style="display:flex;justify-content:${justify}"><img alt="" src="${src}" style="width:${block.width}px"/></div>`;
    }

    case 'spacer':
      return `<div style="height:${block.height}px"></div>`;

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
export function renderDocHtml(
  doc: Doc,
  values: Record<string, string> = {},
  options: RenderOptions = {}
): string {
  const opts: Required<RenderOptions> = {
    missing: options.missing ?? 'token',
    paragraphs: options.paragraphs ?? 'lines'
  };
  const fields = new Map(doc.fields.map((f) => [f.key, f]));
  const parts = doc.blocks.map((b) => renderBlock(b, values, fields, opts));
  return opts.paragraphs === 'lines' ? parts.join('<br/>') : parts.join('');
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
