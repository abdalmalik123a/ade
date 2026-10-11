/**
 * المعرض كلّه بفحص ما قبل الطباعة (محادثة «التصاميم»، البند ١٢): كلّ تصميمٍ جاهز — بكلّ نمطٍ، وبشعار الجهة وبغيره — لا
 * يقترب شيءٌ منه من خطّ القصّ قبل أن يمسّه الموظف. كانت «هويّة طالب» نفسها تُطلق تحذيرين («{المدرسة}» على ١٫٩ ملم
 * و«{العنوان}» على ٠٫٥ ملم)، فيعتاد الموظف تجاهل التحذيرات — وما يُتجاهل لا يحمي.
 */
import { describe, expect, it } from 'vitest';
import { KINDS, PALETTES, STYLES, buildDesign, sampleValues } from '../src/shared/design/kit';
import { designPreflight } from '../src/shared/preflight';

const brand = { name: 'مدرسة النور الابتدائية', logo: 'letterheads/logo.png' };

describe('المعرض كلّه بلا تحذير قصّ', () => {
  it('كلّ نوعٍ بكلّ نمط — بالشعار وبغيره', () => {
    const near: string[] = [];
    for (const kind of KINDS) {
      for (const style of STYLES) {
        for (const b of [undefined, brand]) {
          const canvas = buildDesign({ kind: kind.key, style: style.key, palette: PALETTES[0]!, brand: b });
          for (const issue of designPreflight(canvas, [sampleValues(b)])) {
            if (issue.text.includes('خطّ القصّ')) near.push(`${kind.key}/${style.key}${b ? '+شعار' : ''}: ${issue.text}`);
          }
        }
      }
    }
    expect([...new Set(near)]).toEqual([]);
  });
});
