/**
 * صورة الورقة ← كتاب (هـ٨) — على قراءةٍ حقيقية مسجّلة.
 *
 * `fixtures/paper-letter.json` قراءة القارئ المحلي (tesseract، العربية) لكتابٍ رسمه
 * محرّك الطباعة في التطبيق بدقّة ٣٠٠: ترويسةٌ بعمودين فوق خطٍّ فاصل، وموضوع، ومتنٌ
 * بسطرين، وجدول ٣×٣، و«مع التقدير»، وتوقيعٌ يسارًا تحت ختمٍ أزرق — بعد محو الختم
 * والخطوط (`paperRules`). وفيها ما يخطئ فيه القارئ فعلًا: «العدد: ٤٥٦» قُرئت «6 5 6».
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paperDoc, planPaper, type PaperRead } from '../src/shared/paperDoc';
import { docText, walkBlocks, type ColumnsBlock, type ParagraphBlock, type TableBlock } from '../src/shared/doc';

const read = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'paper-letter.json'), 'utf8')) as PaperRead;
const plan = planPaper(read);
const text = (id: string) => plan.pieces.find((p) => p.id === id)?.text ?? '';
const paraText = (b: ParagraphBlock) => b.inlines.map((i) => (i.kind === 'run' ? i.text : i.kind === 'field' ? `{${i.ref}}` : '')).join('');

describe('الخطّة من المواضع', () => {
  it('الترويسة عمودان فوق الخطّ الفاصل، و«العدد» و«التاريخ» حقلان', () => {
    const head = plan.items[0]!;
    expect(head.kind).toBe('head');
    if (head.kind !== 'head') return;
    expect(head.columns).toHaveLength(2);
    expect(head.columns[0]!.map(text)).toEqual(['جمهورية العراق', 'وزارة التربية', 'المديرية العامة لتربية بغداد']);
    expect(head.columns[1]!.map(text)[0]).toMatch(/^العدد:/);
    expect(plan.pieces.filter((p) => p.field).map((p) => p.field!.key)).toEqual(['العدد', 'التاريخ']);
    expect(plan.notes).toContain('الترويسة: ما فوق الخطّ الفاصل');
  });

  it('الموضوع وسطٌ وعنوانٌ للنموذج، والكلمات لا تلتصق', () => {
    const subject = plan.items.find((i) => i.kind === 'para' && i.subject);
    expect(subject).toMatchObject({ align: 'center' });
    expect(plan.title).toBe('تأييد استمرار بالدوام');
  });

  it('سطرا المتن فقرةٌ واحدة، و«إلى /» فقرةٌ وحدها', () => {
    const paras = plan.items.filter((i) => i.kind === 'para');
    const texts = paras.map((p) => (p.kind === 'para' ? p.ids.map(text).join(' ') : ''));
    const body = paras[texts.findIndex((t) => t.startsWith('تؤيد'))]!;
    expect(body).toMatchObject({ align: 'justify' });
    expect(body.kind === 'para' && body.ids).toHaveLength(2);
    expect(texts).toContain('إلى / مديرية الأحوال المدنية');
    expect(paras.find((p) => p.kind === 'para' && text(p.ids[0]!) === 'مع التقدير')).toMatchObject({ align: 'center' });
    expect(paras.find((p) => p.kind === 'para' && text(p.ids[0]!).includes('مدير المدرسة'))).toMatchObject({ align: 'left' });
  });

  it('الجدول ٣×٣ من خطوطه، من اليمين، وكلُّ كلمةٍ في خانتها', () => {
    const table = plan.items.find((i) => i.kind === 'table');
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') return;
    const cells = table.rows.map((r) => r.map(text));
    expect(cells[0]).toEqual(['الاسم', 'الصف', 'الشعبة']);
    expect(cells[1]!.slice(0, 2)).toEqual(['أحمد كريم جاسم', 'الخامس']);
    expect(cells[2]).toEqual(['سالم محمود علي', 'السادس', 'ب']);
    expect(table.widths[0]).toBeGreaterThan(table.widths[2]!);
    expect(plan.notes).toContain('جدولٌ 3×3 من خطوطه');
  });

  it('وما قرأه القارئ ضعيفًا يُراجَع، والختم يُقال إنه لم يُنقل', () => {
    // «أ» في الخانة قُرئت «j» — تُعرض للمراجعة لا تُصحَّح صامتًا.
    const weakCell = plan.review.find((r) => r.id === 't0r1c2');
    expect(weakCell?.reasons).toContain('weak');
    expect(plan.notes[0]).toContain('ختمٌ أو توقيعٌ ملوّن');
    // أثرٌ بلا كلمات تحت التوقيع يُسقط ويُعرض.
    expect(plan.pieces.filter((p) => !p.keep).every((p) => plan.review.some((r) => r.id === p.id && r.reasons.includes('dropped')))).toBe(true);
  });
});

describe('الكتاب من الخطّة', () => {
  const doc = paperDoc(plan);

  it('أعمدة الترويسة، وحقلا العدد والتاريخ بلا أرقام الكتاب القديم', () => {
    const head = doc.blocks[0] as ColumnsBlock;
    expect(head.kind).toBe('columns');
    const left = head.columns[1]!.map((b) => paraText(b as ParagraphBlock));
    expect(left).toEqual(['العدد: {العدد}', 'التاريخ: {التاريخ}']);
    expect(doc.fields.map((f) => [f.key, f.type])).toEqual([
      ['العدد', 'text'],
      ['التاريخ', 'date']
    ]);
    expect(docText(doc, {})).not.toMatch(/76\/4\/17|6 5 6/);
  });

  it('الموضوع بخطٍّ عريض، والجدول بعناوينه، ولا ختم', () => {
    const subject = walkBlocks(doc.blocks).find((b) => b.kind === 'paragraph' && paraText(b).startsWith('م /')) as ParagraphBlock;
    expect(subject.inlines[0]).toMatchObject({ marks: { bold: true } });
    const table = doc.blocks.find((b) => b.kind === 'table') as TableBlock;
    expect(table.rows).toHaveLength(3);
    expect(table.header).toBe(true);
    expect(docText(doc, {})).not.toContain('ختم');
  });

  it('وما صحّحه الموظف يُكتب، وما أعاده يُنقل', () => {
    const edited = paperDoc(plan, { texts: { t0r1c2: 'أ' } });
    const table = edited.blocks.find((b) => b.kind === 'table') as TableBlock;
    expect(paraText(table.rows[1]!.cells[2]!.blocks[0]!)).toBe('أ');
    const dropped = plan.pieces.find((p) => !p.keep);
    if (dropped) {
      expect(docText(paperDoc(plan, { keep: { [dropped.id]: true } }), {})).toContain(dropped.text);
    }
  });
});

describe('الترويسة بالسياق — بلا خطٍّ فاصل', () => {
  it('الأسطر الأولى التي تشبه الرأس ترويسة', () => {
    const plan2 = planPaper({ ...read, dividers: [] });
    expect(plan2.items[0]!.kind).toBe('head');
    expect(plan2.notes).toContain('الترويسة: الأسطر الأولى بسياقها');
  });

  it('و«العدد:» يبقى حقلًا ولو ضعُفت كلماته كلّها — ولا يُراجَع رقمُه', () => {
    const weak = structuredClone(read);
    const line = weak.lines.find((l) => l.words.some((w) => w.text.startsWith('العدد')))!;
    for (const w of line.words) w.conf = 35;
    const p = planPaper(weak);
    const number = p.pieces.find((x) => x.text.startsWith('العدد'))!;
    expect(number).toMatchObject({ keep: true, field: { key: 'العدد' } });
    expect(p.review.some((r) => r.id === number.id)).toBe(false);
  });

  it('والأرقام في المتن تُراجَع كلُّها', () => {
    const line = (y: number, text: string) => ({
      conf: 90,
      box: { x0: 200, y0: y, x1: 2200, y1: y + 60 },
      words: text.split(' ').map((t, i, all) => {
        const x1 = 2200 - (i * 2000) / all.length;
        return { text: t, conf: 90, box: { x0: x1 - 1500 / all.length, y0: y, x1, y1: y + 60 } };
      })
    });
    const p = planPaper({ width: 2480, height: 3508, tables: [], dividers: [], marks: [], lines: [line(900, 'بمبلغ قدره 250000 دينار عراقي فقط لا غير والمستحق في موعده المحدد')] });
    expect(p.review[0]?.reasons).toContain('digits');
    expect(p.notes.some((n) => n.includes('راجعها بالصورة'))).toBe(true);
  });
});
