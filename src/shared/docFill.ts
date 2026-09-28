/**
 * الوثيقة بقيمها — كتلًا لا علامات (تعميق الموجود ٩).
 *
 * الكتاب الصادر كان يُصدَّر إلى Word من علامات ورقته نصًّا مسطَّحًا: تضيع الجداول والأعمدة
 * والمحاذاة والعريض. ووثيقته بين يدي المحرّر حين يُصدَّر — فتُملأ هنا بما يملؤها به رسّام
 * الورقة (`renderDocHtml`) نفسه، ثم تُكتب Word بتنسيقها:
 * - **الحقل المملوء نصٌّ عريضٌ مسطَّر** كما يُطبع.
 * - **وخيار الجنس** («{الطالب|الطالبة}» نصًّا أو حقلًا) يُحلّ بجنس صاحب الكتاب.
 * - **والمجموعة المشروطة** تسقط إن فرغ حقلها، ولا تبقى سطرًا فارغًا.
 * - **وما لم يُملأ يبقى حقلًا**: يرسمه Word فراغًا منقّطًا بطوله كما تطبعه الورقة.
 */
import { run, type Block, type Doc, type Inline, type ListItem, type ParagraphBlock } from './doc';
import { GENDER_KEY, isChoiceKey, pickChoice, resolveChoices } from './gender';

export function fillDoc(doc: Doc, values: Record<string, string>): Doc {
  const gender = values[GENDER_KEY];

  const inlines = (list: Inline[]): Inline[] =>
    list.map((n) => {
      if (n.kind === 'break') return n;
      if (n.kind === 'run') return { ...n, text: resolveChoices(n.text, gender) };
      if (isChoiceKey(n.ref)) return run(pickChoice(n.ref, gender));
      const value = values[n.ref];
      return value ? run(value, { bold: true, underline: true }) : n;
    });

  const paragraph = (p: ParagraphBlock): ParagraphBlock => ({ ...p, inlines: inlines(p.inlines) });

  const items = (list: ListItem[]): ListItem[] =>
    list.map((it) => ({ ...it, inlines: inlines(it.inlines), items: it.items ? items(it.items) : undefined }));

  const blocks = (list: Block[]): Block[] =>
    list.flatMap((b): Block[] => {
      switch (b.kind) {
        case 'paragraph':
          return [paragraph(b)];
        case 'list':
          return [{ ...b, items: items(b.items) }];
        case 'table':
          return [{ ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.map(paragraph) })) })) }];
        case 'columns':
          return [{ ...b, columns: b.columns.map(blocks) }];
        case 'group':
          // كما في الورقة: المشروطة تظهر بحقلها، وغيرها كتلها في مكانها.
          if (b.mode === 'conditional' && !values[b.on]?.trim()) return [];
          return blocks(b.blocks);
        default:
          return [b];
      }
    });

  return { ...doc, blocks: blocks(doc.blocks) };
}
