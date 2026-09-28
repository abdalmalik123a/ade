/**
 * الكتاب الصادر إلى Word بتنسيقه (تعميق الموجود ٩).
 *
 * كان يُصدَّر من علامات ورقته نصًّا مسطَّحًا. فالآن من وثيقته بقيمها (`fillDoc`) وترويسته:
 * ما يملأ الورقة يملأ Word بالمنطق نفسه، والجداول والأعمدة والمحاذاة والعريض باقية.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { docToDocx } from '../src/main/services/docDocx';
import { importTemplateFile } from '../src/main/services/import';
import { emptyDoc, fieldRef, makeField, newUuid, paragraph, run, type Block, type Doc, type Inline } from '../src/shared/doc';
import { fillDoc } from '../src/shared/docFill';
import { renderDocHtml } from '../src/shared/docHtml';
import { emptyLayout, resolveLayout, type LetterheadLayout } from '../src/shared/letterhead';

const letter = (): Doc => {
  const d = emptyDoc();
  d.fields = [makeField({ key: 'الاسم' }), makeField({ key: 'المرفقات' }), makeField({ key: 'الجهة', width: 20 }), makeField({ key: 'التوقيع', fillMode: 'hand' })];
  d.blocks = [
    paragraph([run('م / تأييد')], { align: 'center' }),
    paragraph([run('نؤيد أن {السيد|السيدة} '), fieldRef('الاسم'), run(' '), fieldRef('يعمل|تعمل'), run(' لدينا، والكتاب إلى '), fieldRef('الجهة'), run('.')], { align: 'justify' }),
    {
      id: newUuid(),
      kind: 'table',
      columns: [2, 1],
      header: true,
      rows: [
        { id: newUuid(), cells: [{ id: newUuid(), blocks: [paragraph([run('الاسم')])] }, { id: newUuid(), blocks: [paragraph([run('العنوان الوظيفي')])] }] },
        { id: newUuid(), cells: [{ id: newUuid(), blocks: [paragraph([fieldRef('الاسم')])] }, { id: newUuid(), blocks: [paragraph([run('مدرس')])] }] }
      ]
    },
    { id: newUuid(), kind: 'group', mode: 'conditional', on: 'المرفقات', blocks: [paragraph([run('المرفقات: '), fieldRef('المرفقات')])] },
    paragraph([run('التوقيع: '), fieldRef('التوقيع')], { align: 'left' })
  ];
  return d;
};

const VALUES = { الاسم: 'سارة علي حسين', الجنس: 'أنثى' };

/** نصّ الوثيقة الممتلئة كما يُقرأ — وما بقي حقلًا يُكتب «_». */
function textOf(blocks: Block[]): string {
  const ins = (list: Inline[]) => list.map((n) => (n.kind === 'run' ? n.text : n.kind === 'field' ? '_' : ' ')).join('');
  return blocks
    .map((b) => {
      if (b.kind === 'paragraph') return ins(b.inlines);
      if (b.kind === 'table') return b.rows.map((r) => r.cells.map((c) => c.blocks.map((p) => ins(p.inlines)).join(' ')).join(' ')).join(' ');
      if (b.kind === 'group') return textOf(b.blocks);
      return '';
    })
    .join(' ');
}
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('الوثيقة بقيمها — كما تملأ الورقة', () => {
  it('القيمة نصٌّ عريضٌ مسطَّر، والخيار بجنس صاحب الكتاب، والمشروطة الفارغة تسقط', () => {
    const filled = fillDoc(letter(), VALUES);
    const body = filled.blocks[1]!;
    expect(body.kind === 'paragraph' && body.inlines.find((n) => n.kind === 'run' && n.text === 'سارة علي حسين')).toMatchObject({ marks: { bold: true, underline: true } });
    const text = textOf(filled.blocks);
    expect(text).toContain('نؤيد أن السيدة سارة علي حسين تعمل لدينا');
    expect(text).not.toContain('المرفقات');
    // والجهة والتوقيع لم يُملآ: يبقيان حقلين — فراغًا يرسمه Word.
    expect(filled.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.inlines : [])).filter((n) => n.kind === 'field').map((n) => n.kind === 'field' && n.ref)).toEqual(['الجهة', 'التوقيع']);
  });

  it('والمشروطة بحقلها المملوء تظهر في مكانها', () => {
    const filled = fillDoc(letter(), { ...VALUES, المرفقات: 'صورة البطاقة' });
    expect(textOf(filled.blocks)).toContain('المرفقات: صورة البطاقة');
    expect(filled.blocks.some((b) => b.kind === 'group')).toBe(false);
  });

  it('ونصّها نصّ الورقة المطبوعة نفسه — المنطق واحد', () => {
    const values = { ...VALUES, المرفقات: 'صورة البطاقة', الجهة: 'مديرية التربية', التوقيع: 'م. أحمد' };
    const printed = renderDocHtml(letter(), values, { missing: 'blank', paragraphs: 'blocks' })
      .replace(/<\/?(span|strong|u)\b[^>]*>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');
    expect(squash(textOf(fillDoc(letter(), values).blocks))).toBe(squash(printed));
  });
});

describe('Word بتنسيقه وترويسته', () => {
  const head = (patch: Partial<LetterheadLayout> = {}): LetterheadLayout => {
    const layout = emptyLayout();
    layout.columns = 2;
    layout.sections[0].blocks = [{ id: 'a', kind: 'text', value: 'جمهورية العراق', align: 'right', size: 18, bold: true }];
    layout.sections[1].blocks = [{ id: 'b', kind: 'field', value: 'إلى / {الجهة}', align: 'left', size: 14, bold: false }];
    layout.registry = { show: true, mode: 'printed' };
    layout.divider = true;
    return { ...layout, ...patch };
  };
  const files = async (d: Doc, layout: LetterheadLayout, registry = { number: '45', date: '2026/9/28' }) =>
    unzipSync(new Uint8Array(await docToDocx(fillDoc(d, VALUES), { title: 'تأييد', blanks: true, head: { layout: resolveLayout(layout, (t) => t.replace('{الجهة}', 'مديرية التربية')), registry } })));

  it('القيم عريضةً مسطَّرة، والفارغ فراغٌ منقّط لا وسم، والجدول جدول', async () => {
    const x = strFromU8((await files(letter(), head()))['word/document.xml']!);
    expect(x).toContain('سارة علي حسين');
    expect(x).toMatch(/<w:b\/>.*<w:u w:val="single"\/>.*سارة علي حسين/s);
    expect(x).toContain('<w:u w:val="dotted"/>');
    expect(x).not.toMatch(/\{[^}]*\}/);
    expect(x).not.toContain('highlight');
    expect(x).toContain('<w:tblHeader/>');
  });

  it('والترويسة أعمدةً بلا حدود، وحقلها محلول، والعدد والتاريخ بقيمتيهما، والفاصل تحتها', async () => {
    const x = strFromU8((await files(letter(), head()))['word/document.xml']!);
    expect(x.indexOf('جمهورية العراق')).toBeLessThan(x.indexOf('م / تأييد'));
    expect(x).toContain('إلى / مديرية التربية');
    expect(x).toContain('العدد: ');
    expect(x).toContain('45');
    expect(x).toContain('2026/9/28');
    expect(x.match(/<w:tbl>/g)?.length).toBe(2); // أعمدة الترويسة + الجدول
  });

  it('والعدد والتاريخ «يدويًّا» فراغان منقّطان يكتبهما موظّف الاستلام', async () => {
    const x = strFromU8((await files(letter(), head({ registry: { show: true, mode: 'manual' } })))['word/document.xml']!);
    expect(x).toContain('العدد: ');
    expect(x).not.toContain('2026/9/28');
  });

  it('والترويسة المتكرّرة رأسُ صفحة Word — لا في المتن', async () => {
    const d = letter();
    d.pageSetup = { ...d.pageSetup, repeatLetterhead: true };
    const all = await files(d, head());
    const header = Object.keys(all).find((k) => /^word\/header\d*\.xml$/.test(k));
    expect(header).toBeDefined();
    expect(strFromU8(all[header!]!)).toContain('جمهورية العراق');
    expect(strFromU8(all['word/document.xml']!)).not.toContain('جمهورية العراق');
  });

  it('ويُفتح بمستورد ديوان نفسه: الجدول جدول، والقيمة في موضعها', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-issued-'));
    const file = join(dir, 'كتاب.docx');
    writeFileSync(file, await docToDocx(fillDoc(letter(), VALUES), { title: 'تأييد', blanks: true }));
    const back = await importTemplateFile(file, () => '');
    expect(back.doc?.blocks.some((b) => b.kind === 'table')).toBe(true);
    expect(JSON.stringify(back.doc?.blocks)).toContain('سارة علي حسين');
    rmSync(dir, { recursive: true, force: true });
  });
});
