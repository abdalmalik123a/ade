import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { issueBatch, issueDocument, issueTransaction, prepareDocuments, verifyArchive } from '../src/main/services/documents';
import type { IssueInput, SheetStyle, TransactionInput } from '../src/shared/api';

/**
 * أنماط الورقة مع كلّ كتاب (خطة Production، ١٫٣): تُحفظ مرّةً لكلّ بصمة ويُشار إليها من
 * الكتاب — فيُعاد طبعه يومًا بما رُسم به لا بأنماط يومه. ولا تمسّ البصمة ولا السلسلة.
 */

const STYLE: SheetStyle = {
  css: '.a4-sheet{width:794px}\n@font-face{font-family:x;src:url(./assets/x.woff2)}',
  bodyClass: 'bg-surface font-body-md'
};

function db() {
  const d = freshDb();
  prepareDocuments(d);
  return d;
}

const one = (patch: Partial<IssueInput> = {}): IssueInput => ({
  sheetHtml: '<div class="a4-sheet"><p>نؤيد أن السيد أحمد يعمل لدينا.</p></div>',
  templateId: null, citizenId: null, authorityId: null, citizenName: 'أحمد عبد الله', nationalId: null,
  docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
  gregorianDate: '2 تشرين الأول 2026', hijriDate: null, operator: null, printer: null,
  serialPrefix: 'م', serialYear: 2026, letterheadId: null, ...patch
});

const tx = (name: string, sheets: number, style: SheetStyle | null): TransactionInput => ({
  citizenId: null, citizenName: name, nationalId: null, operator: null, printer: null,
  serialPrefix: 'م', serialYear: 2026, gregorianDate: '2 تشرين الأول 2026', hijriDate: null, style,
  sheets: Array.from({ length: sheets }, (_, i) => {
    const { sheetHtml, templateId, letterheadId, authorityId, docType, destination, purpose, values, copies, copyKind, fee } = one({
      sheetHtml: `<div class="a4-sheet"><p>ورقة ${i + 1} لـ${name}</p></div>`
    });
    return { sheetHtml, templateId, letterheadId, authorityId, docType, destination, purpose, values, copies, copyKind, fee };
  })
});

const styleOf = (d: ReturnType<typeof db>, id: number) =>
  (d.prepare('SELECT style_hash AS h FROM documents WHERE id = ?').get(id) as { h: string | null }).h;
const styles = (d: ReturnType<typeof db>) =>
  d.prepare('SELECT hash, css, body_class AS bodyClass FROM sheet_styles').all() as { hash: string; css: string; bodyClass: string | null }[];

describe('أنماط الورقة مع الكتاب', () => {
  it('الكتاب يُشير إلى أنماطه، والأنماط تُحفظ كما رُسم بها', () => {
    const d = db();
    const doc = issueDocument(d, one({ style: STYLE }));
    const [row] = styles(d);
    expect(styleOf(d, doc.id)).toBe(row!.hash);
    expect(row!.css).toBe(STYLE.css);
    expect(row!.bodyClass).toBe(STYLE.bodyClass);
  });

  it('مرّةً لكلّ بصمة: كتبٌ ومعاملاتٌ ودفعةٌ بالأنماط نفسها صفٌّ واحد', () => {
    const d = db();
    issueDocument(d, one({ style: STYLE }));
    const t = issueTransaction(d, tx('زينب علي', 3, STYLE));
    const batch = issueBatch(d, [tx('حسن', 2, STYLE), tx('مريم', 1, STYLE)]);
    expect(styles(d)).toHaveLength(1);
    for (const doc of [...t.documents, ...batch.flatMap((b) => b.documents)]) expect(styleOf(d, doc.id)).toBe(styles(d)[0]!.hash);
  });

  it('أنماطٌ تغيّرت (إصدارٌ أحدث) صفٌّ جديد، والقديم يبقى لكتبه', () => {
    const d = db();
    const before = issueDocument(d, one({ style: STYLE }));
    const after = issueDocument(d, one({ style: { ...STYLE, css: STYLE.css + '\n.x{}' } }));
    expect(styles(d)).toHaveLength(2);
    expect(styleOf(d, before.id)).not.toBe(styleOf(d, after.id));
  });

  it('بلا أنماطٍ ملتقطة (نمط التطوير) يصدر الكتاب كما كان', () => {
    const d = db();
    const doc = issueDocument(d, one());
    expect(styleOf(d, doc.id)).toBeNull();
    expect(styles(d)).toHaveLength(0);
  });

  it('الأنماط لا تمسّ البصمة ولا السلسلة: الأرشيف سليم', () => {
    const d = db();
    issueDocument(d, one({ style: STYLE }));
    issueDocument(d, one());
    issueTransaction(d, tx('علي', 2, STYLE));
    const check = verifyArchive(d);
    expect(check.checked).toBe(4);
    expect(check.problems).toEqual([]);
  });

  it('قاعدةٌ قائمة بلا العمود والجدول تُرحَّل', () => {
    const d = freshDb();
    prepareDocuments(d);
    d.exec('ALTER TABLE documents DROP COLUMN style_hash; DROP TABLE sheet_styles;');
    prepareDocuments(d);
    const doc = issueDocument(d, one({ style: STYLE }));
    expect(styleOf(d, doc.id)).toBe(styles(d)[0]!.hash);
  });
});
