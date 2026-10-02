import { describe, expect, it } from 'vitest';
import { PRINT_ROLES, describeRole, normalizePrintRoles, planPrint } from '../src/shared/printRoles';
import { escapeHtml } from '../src/shared/docHtml';
import { inlineBarcodes } from '../src/shared/imposition';
import { htmlToText } from '../src/main/services/documents';

/**
 * أدوار الطابعات (خطة Production، ٢٫١): طابعةٌ واحدة تطبع مباشرة، واثنتان يُسأل بينهما، والنافذة
 * أو غياب الطابعة نافذةٌ واحدة للمهمّة. وما لم يُحفظ يأخذ الطابعة الافتراضية القديمة.
 */
describe('أدوار الطابعات', () => {
  it('الأدوار الخمسة بأسمائها', () => {
    expect(PRINT_ROLES.map((r) => r.key)).toEqual(['documents', 'papers', 'photos', 'designs', 'copies']);
  });

  it('قبل الحفظ: كلّ دورٍ على الطابعة الافتراضية القديمة بلا نافذة — يطبع كما كان', () => {
    const roles = normalizePrintRoles(undefined, 'Canon MF3010');
    for (const { key } of PRINT_ROLES) expect(roles[key]).toEqual({ normal: 'Canon MF3010', color: null, dialog: false });
    expect(planPrint(roles.documents)).toEqual({ kind: 'direct', printer: 'Canon MF3010' });
  });

  it('بلا طابعةٍ افتراضية: نافذة البرنامج عند كلّ طباعة', () => {
    const roles = normalizePrintRoles(null, null);
    expect(planPrint(roles.photos)).toEqual({ kind: 'dialog', normal: null, color: null });
  });

  it('المحفوظ يُحترم: طابعتان يُسأل بينهما، والنافذة تُطلب ولو بطابعة', () => {
    const roles = normalizePrintRoles(
      {
        papers: { normal: 'HP Laser', color: 'Epson L3250', dialog: false },
        designs: { normal: 'Epson L3250', color: null, dialog: true }
      },
      'Canon MF3010'
    );
    expect(planPrint(roles.papers)).toEqual({ kind: 'choose-color', normal: 'HP Laser', color: 'Epson L3250' });
    expect(planPrint(roles.designs)).toEqual({ kind: 'dialog', normal: 'Epson L3250', color: null });
    // وما لم يُحفظ من الأدوار يبقى على الافتراضية.
    expect(roles.documents.normal).toBe('Canon MF3010');
  });

  it('«ملوّن» وحده يصير العادي، والطابعة نفسها في الاثنين واحدة', () => {
    const roles = normalizePrintRoles(
      { photos: { normal: null, color: 'Epson L3250' }, copies: { normal: 'HP', color: 'HP', dialog: 'yes' } },
      null
    );
    expect(roles.photos).toEqual({ normal: 'Epson L3250', color: null, dialog: false });
    expect(roles.copies).toEqual({ normal: 'HP', color: null, dialog: false });
  });

  it('ما فسد من المحفوظ لا يُسقط الإعدادات', () => {
    const roles = normalizePrintRoles({ documents: 'x', papers: { normal: 5, color: '' } }, 'Canon');
    expect(roles.documents.normal).toBe('Canon');
    expect(roles.papers).toEqual({ normal: null, color: null, dialog: false });
  });

  it('«الطباعة إلى:» تقول ما سيحدث — واسمٌ واحد حين تطبع مباشرة', () => {
    expect(describeRole({ normal: 'HP', color: null, dialog: false })).toBe('HP');
    expect(describeRole({ normal: 'HP', color: 'Epson', dialog: false })).toContain('HP أو Epson');
    expect(describeRole({ normal: 'HP', color: null, dialog: true })).toBeNull();
    expect(describeRole({ normal: null, color: null, dialog: false })).toBeNull();
  });
});

describe('escapeHtml (٢٫٥)', () => {
  it('علامة التنصيص لا تقطع الخاصّية، والنصّ المستخرج لا يتغيّر', () => {
    const name = 'a" onerror="x.png';
    expect(escapeHtml(name)).toBe('a&quot; onerror=&quot;x.png');
    expect(`<img src="${escapeHtml(name)}"/>`).not.toMatch(/" onerror="/);
    expect(htmlToText(`<p>${escapeHtml('قال: "نعم" & <لا>')}</p>`)).toBe('قال: "نعم" & <لا>');
  });

  it('وباركودٌ قيمته فيها علامة تنصيص يُرسم — كان يُقطع فيخرج موضعه فارغًا', () => {
    const value = 'رقم "١٢" A&B';
    const html = inlineBarcodes(`<div data-barcode="qr" data-value="${escapeHtml(value)}" style="left:0"></div>`);
    expect(html).toContain('<svg');
    expect(html).toBe(inlineBarcodes(`<div data-barcode="qr" data-value="رقم &quot;١٢&quot; A&amp;B" style="left:0"></div>`));
  });
});
