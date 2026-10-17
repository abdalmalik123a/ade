// @vitest-environment jsdom
/**
 * ورقة الكتاب (`LetterSheet`) كما تُرسم: «كرّر الترويسة» يلفّها رأسَ جدولٍ تعيده الطابعة في كلّ صفحة (`data-repeat-head`)، وبدونه لا جدول؛
 * و«رقّم الصفحات» يكتب في `<style>` الورقة «صفحة ن من م» بعدّادي الطابعة — والطباعة نفسها يفحصها سيناريو `pagedLetter`.
 */
import { describe, expect, it } from 'vitest';
import LetterSheet from '../../src/renderer/src/components/LetterSheet';
import { emptyDoc, paragraph, run, type Doc, type PageSetup } from '@shared/doc';
import { normalizeLayout } from '@shared/letterhead';
import { mount } from './mount';

const HEAD = 'مدرسة النور الابتدائية';
// كما تُقرأ الترويسة من القاعدة قبل أن تُرسم (`normalizeLayout`).
const layout = normalizeLayout({
  sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'text', value: HEAD, align: 'center', size: 14, bold: true }] }]
});

function doc(setup: Partial<PageSetup>): Doc {
  const d = emptyDoc();
  d.pageSetup = { ...d.pageSetup, ...setup };
  d.blocks = [paragraph([run('نؤيد لكم أنّ السيدة زينب علي حسن موظفةٌ في دائرتنا.')])];
  return d;
}

describe('LetterSheet — تكرار الترويسة وترقيم الصفحات', () => {
  it('«كرّر الترويسة» مع ترويسة: الترويسة في `thead` داخل `[data-repeat-head]`، والمتن في `tbody`', () => {
    const host = mount(<LetterSheet doc={doc({ repeatLetterhead: true })} layout={layout} values={{}} />);
    const table = host.querySelector('[data-repeat-head]');
    expect(table?.querySelector('thead [data-letterhead]')?.textContent).toContain(HEAD);
    expect(table?.querySelector('tbody [data-body]')?.textContent).toContain('زينب علي حسن');
  });

  it('وبدونه لا جدول — والترويسة فوق المتن كما هي', () => {
    const host = mount(<LetterSheet doc={doc({ repeatLetterhead: false })} layout={layout} values={{}} />);
    expect(host.querySelector('[data-repeat-head]')).toBeNull();
    expect(host.querySelector('[data-letterhead]')?.textContent).toContain(HEAD);
  });

  it('«رقّم الصفحات»: في `<style>` الورقة «صفحة » و`counter(pages)` — وبدونه لا', () => {
    const style = (on: boolean) =>
      mount(<LetterSheet doc={doc({ pageNumbers: on })} layout={null} values={{}} />).querySelector('style')?.textContent ?? '';
    expect(style(true)).toContain('صفحة ');
    expect(style(true)).toContain('counter(pages');
    expect(style(false)).not.toContain('counter(pages');
  });
});
