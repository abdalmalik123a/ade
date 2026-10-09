/**
 * تعقيم الرسمة المتّجهة قبل مكتبة العناصر (DESIGNS.md ٠٫٨): لا شيفرة ولا روابط خارجية — بقائمة سماح، والرسم يبقى.
 */
import { describe, expect, it } from 'vitest';
import { BUILTIN_CLIPARTS } from '../src/shared/clipart';
import { cleanSvg } from '../src/shared/design/svgClean';

const reject = (svg: string) => {
  try {
    cleanSvg(svg);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
};

describe('تعقيم SVG', () => {
  it('الشيفرة تسقط بما فيها: script وforeignObject وخصائص on…', () => {
    const { svg } = cleanSvg(
      `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><rect width="5" height="5" onclick="x()" fill="red"/>` +
        `<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://x"/></div></foreignObject></svg>`
    );
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5" fill="red"/></svg>');
  });

  it('والروابط إلى خارج الملفّ تسقط، وما في داخله والصورة المضمَّنة تبقى', () => {
    const { svg } = cleanSvg(
      `<svg viewBox="0 0 10 10" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="g"/></defs>` +
        `<use xlink:href="#g"/><use href="https://evil/x.svg#a"/><a href="javascript:alert(1)"><rect/></a>` +
        `<image href="file:///C:/Windows/win.ini"/><image href="data:image/png;base64,iVBORw0KGgo="/>` +
        `<rect fill="url(https://evil/p)"/><rect fill="url(#g)"/><rect style="fill:url(http://x);stroke:red"/><rect style="stroke:red;behavior:url(x.htc)"/></svg>`
    );
    expect(svg).toContain('<use xlink:href="#g"/>');
    expect(svg).toContain('<use/>');
    expect(svg).not.toMatch(/evil|javascript|win\.ini|\.htc/);
    expect(svg).toContain('<image href="data:image/png;base64,iVBORw0KGgo="/>');
    expect(svg).toContain('<rect fill="url(#g)"/>');
    expect(svg).toContain('<rect style="fill:none;stroke:red"/>');
    // ونمطٌ فيه ما يشغّل شيفرة (behavior) يسقط كلّه.
    expect(svg.endsWith('<rect style="fill:none;stroke:red"/><rect/></svg>')).toBe(true);
    expect(svg.startsWith('<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('وDOCTYPE بكياناته يسقط — فلا يتمدّد شيء — وطبقات Inkscape وIllustrator الخاصّة كذلك', () => {
    const lol = `<!DOCTYPE svg [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>`;
    const { svg } = cleanSvg(
      `<?xml version="1.0"?>${lol}<!-- تعليق --><svg width="20" height="10" xmlns:sodipodi="x"><sodipodi:namedview><rect/></sodipodi:namedview>` +
        `<text x="1">&b; سلام &amp; أهلًا</text></svg>`
    );
    expect(svg).toBe('<svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg" width="20" height="10"><text x="1"> سلام &amp; أهلًا</text></svg>');
  });

  it('و@import وurl() الخارجية في <style> تسقط، وأصناف Illustrator تبقى', () => {
    const { svg } = cleanSvg(
      `<svg viewBox="0 0 10 10"><style>@import url(https://x/a.css);.st0{fill:#C9A45C;background:url(http://x)}</style><path class="st0" d="M0 0L10 10"/></svg>`
    );
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.st0{fill:#C9A45C;background:none}</style><path class="st0" d="M0 0L10 10"/></svg>');
  });

  it('المقاس من viewBox، أو من العرض والارتفاع — وما بلا مقاسٍ أو ليس SVG يُرفض بسببه', () => {
    expect(cleanSvg('<svg viewBox="0 0 120 80.5"/>')).toMatchObject({ width: 120, height: 80.5 });
    expect(cleanSvg('<svg width="64px" height="32"/>')).toMatchObject({ width: 64, height: 32 });
    expect(reject('<svg/>')).toContain('بلا مقاس');
    expect(reject('<html><body>x</body></html>')).toContain('ليس رسمةً متّجهة');
    expect(reject('مجرّد نصّ')).toContain('ليس رسمةً متّجهة');
    expect(reject('x'.repeat(5 * 1024 * 1024 + 1))).toContain('أكبر من ٥');
  });

  it('ورسومات ديوان المدمجة تمرّ كما رُسمت (لا تفقد عنصرًا)', () => {
    for (const item of BUILTIN_CLIPARTS) {
      const { svg } = cleanSvg(item.svg);
      const tags = (s: string) => (s.match(/<[A-Za-z][\w:-]*/g) ?? []).length;
      expect(tags(svg), item.id).toBe(tags(item.svg.replace(/<!--[\s\S]*?-->/g, '')));
    }
  });
});
