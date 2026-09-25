import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { docxToDoc } from '../src/main/services/docxDoc';
import { emptyDoc, fieldRef, paragraph, run, type Block, type Doc } from '../src/shared/doc';
import { isLayoutEmpty, layoutText, normalizeLayout } from '../src/shared/letterhead';
import { findSheetHead, splitSheetHead } from '../src/shared/sheetHead';

const fixture = () =>
  docxToDoc(
    unzipSync(new Uint8Array(readFileSync('tests/fixtures/warning-letter.docx'))),
    () => 'letterheads/hr.gif'
  ).doc;

const withBlocks = (blocks: Block[]): Doc => ({ ...emptyDoc(), blocks });
const cols = (a: string, b: string): Block => ({
  id: `c-${a}`,
  kind: 'columns',
  columns: [[paragraph([run(a)])], [paragraph([run(b)])]]
});

describe('رأس الورقة ترويسةً', () => {
  it('رأس كتاب الإنذار: حتى الخطّ الفاصل، وما تحته متن', () => {
    const doc = fixture();
    const count = findSheetHead(doc);
    expect(doc.blocks[count - 1]).toMatchObject({ kind: 'image', height: 10 });
    const split = splitSheetHead(doc)!;
    expect(split.name).toBe('ادارة مدرسة الصحوة الابتدائية للبنين');
    expect(split.doc.blocks).toEqual(doc.blocks.slice(count));
    expect(split.doc.pageSetup.letterheadMode).toBe('print');
  });

  it('الكتل تنتقل كما هي — فلا يتزحزح سطرٌ عن موضعه', () => {
    const doc = fixture();
    const split = splitSheetHead(doc)!;
    const layout = normalizeLayout(JSON.parse(JSON.stringify(split.layout)));
    expect(layout.sheet).toEqual(doc.blocks.slice(0, findSheetHead(doc)));
    expect(layout.divider).toBe(false);
    expect(isLayoutEmpty(layout)).toBe(false);
    expect(layoutText(layout)).toContain('مدرسة الصحوة الابتدائية');
  });

  it('بلا خطٍّ فاصل: الصفوف وما يليها حتى أول سطرٍ فارغ', () => {
    const doc = withBlocks([
      cols('ادارة', 'العدد:'),
      cols('مدرسة النور', 'التاريخ:'),
      paragraph([run('للبنات')]),
      paragraph([]),
      paragraph([run('الى / ولي الامر')])
    ]);
    expect(findSheetHead(doc)).toBe(3);
  });

  it('ورقةٌ بلا رأسٍ معروف الحدّ لا يُقترح فصلها', () => {
    expect(findSheetHead(withBlocks([paragraph([run('نص')]), paragraph([run('نص آخر')])]))).toBe(0);
    expect(splitSheetHead(withBlocks([paragraph([run('نص')])]))).toBeNull();
  });

  it('رأسٌ فيه متغيّر لا يُفصل — الترويسة لا تُملأ', () => {
    const doc = withBlocks([cols('ادارة', 'العدد:'), paragraph([run('الاسم: '), fieldRef('الاسم')])]);
    expect(findSheetHead(doc)).toBe(0);
  });

  it('الترويسة المبنيّة أقسامًا تبقى كما هي', () => {
    const layout = normalizeLayout({ sections: [{ id: 'a', blocks: [], weight: 1 }], columns: 1 });
    expect(layout.sheet).toBeUndefined();
  });
});
