import { describe, expect, it } from 'vitest';
import { emptyDoc, fieldRef, paragraph, run } from '../src/shared/doc';
import { renderDocHtml, valuesOnlySheet } from '../src/shared/docHtml';

describe('الطباعة على استمارةٍ مطبوعة: القيم وحدها', () => {
  it('القيمة المملوءة معلَّمة، والغلاف يخفي ما سواها ويحفظ موضعه', () => {
    const doc = emptyDoc();
    doc.blocks = [paragraph([run('الاسم: '), fieldRef('الاسم')])];
    const html = renderDocHtml(doc, { الاسم: 'زينب علي' }, { missing: 'blank' });
    expect(html).toMatch(/class="fv [^"]*">زينب علي</);
    const sheet = valuesOnlySheet(html);
    // visibility لا display: المخفيّ يحفظ مكانه فلا ينزاح سطر.
    expect(sheet).toContain('.values-only *{visibility:hidden!important}');
    expect(sheet).toContain('.values-only .fv');
    expect(sheet).not.toContain('display:none');
  });
});
