import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importTemplateFile } from '../src/main/services/import';
import type { LetterheadBlock, LetterheadLayout } from '../src/shared/letterhead';

/**
 * ملفات Word حقيقية من مكاتب — لا مستندات مصنوعة بمكتبة `docx`.
 *
 * المصنوع يخرج نظيفًا مرتّبًا، وملف المكتب ليس كذلك: ترويسة في المتن، وأعمدة
 * بالمسافات، وتمديد، وصفرٌ بدل النقطة. فهذه الطبقة تثبّت ناتج الاستيراد على
 * ورقة حقيقية، فأي تغيير في الكاشف يُظهر أثره حيث يقع فعلًا.
 *
 * وصف كل ملف في `tests/fixtures/README.md`.
 */

const DIR = join(__dirname, 'fixtures');
const files = readdirSync(DIR).filter((f) => f.endsWith('.docx'));

/** يجمع الصور المستخرجة ليُتحقَّق منها، ويعيد مسارًا كما يفعل المخزن الحقيقي. */
function imageCollector() {
  const saved: { bytes: number; ext: string }[] = [];
  const save = (bytes: Uint8Array, ext: string): string => {
    saved.push({ bytes: bytes.length, ext });
    return `logos/fixture-${saved.length}${ext}`;
  };
  return { saved, save };
}

const text = (blocks: LetterheadBlock[]) =>
  blocks.filter((b) => b.kind === 'text').map((b) => b.value);

const section = (layout: LetterheadLayout, i: number) => layout.sections[i]!.blocks;

describe('كل ملف مرجعي يُستورد بلا سقوط', () => {
  it('المجلد ليس فارغًا — وإلا فالطبقة كلها وهم', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const name of files) {
    it(`${name}: يخرج بترويسة ومتن`, async () => {
      const store = imageCollector();
      const res = await importTemplateFile(join(DIR, name), store.save);

      expect(res.body.trim()).not.toBe('');
      expect(res.letterhead).not.toBeNull();
      expect(res.title.trim()).not.toBe('');
      // الاستيراد لا يصمت أبدًا: يقول ما استخرجه وما تركه.
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  }
});

describe('school-warning.docx — ترويسة كُتبت في المتن بعمودين من مسافات', () => {
  const load = async () => {
    const store = imageCollector();
    const res = await importTemplateFile(join(DIR, 'school-warning.docx'), store.save);
    return { res, store };
  };

  it('يفصل الترويسة عن المتن رغم غياب ترويسة Word في الملف', async () => {
    const { res } = await load();
    const layout = res.letterhead!;

    expect(layout.columns).toBe(2);
    expect(text(section(layout, 0))).toEqual([
      'ادارة',
      'مدرسة الصحوة الابتدائية',
      'للبنيـــــــن'
    ]);
  });

  it('يضع العدد والتاريخ في العمود الأيسر — حيث كتبهما الموظف', async () => {
    const { res } = await load();
    expect(text(section(res.letterhead!, 1))).toEqual(['العدد:', 'التاريخ: / / 20']);
  });

  it('ينقل الشعار إلى المخزن ويتركه في الترويسة لا في المتن', async () => {
    const { res, store } = await load();

    expect(store.saved).toEqual([{ bytes: 279, ext: '.gif' }]);
    const images = res.letterhead!.sections.flatMap((s) => s.blocks).filter((b) => b.kind === 'image');
    expect(images).toHaveLength(1);
    expect(res.body).not.toContain('logos/');
  });

  it('يبدأ المتن من «الى /» وينتهي بالتوقيع', async () => {
    const { res } = await load();
    const lines = res.body.split('\n').filter((l) => l.trim());

    expect(lines[0]).toMatch(/^الى \/ ولي امر التلميذ/);
    expect(lines.at(-1)).toBe('مدير المدرسة');
    // ما دخل الترويسة لا يتكرّر في المتن.
    expect(res.body).not.toContain('مدرسة الصحوة الابتدائية');
    expect(res.body).not.toContain('العدد:');
  });

  it('يستنتج الموضوع من سطر «م/» ولا يتركه في المتن', async () => {
    const { res } = await load();
    expect(res.subjectLine).toBe('انـــــــــذار');
    expect(res.body).not.toContain('م/');
  });

  it('يحفظ فراغات الورقة كما كتبها المكتب — فهي متغيّراتها', async () => {
    const { res } = await load();

    // فراغات المتن: خمسة منقّطات وقوس واحد.
    expect(res.body.match(/\.{3,}/g)).toHaveLength(5);
    expect(res.body).toMatch(/\(\s*\)/);
    // وفراغ التاريخ في الترويسة لا في المتن — موضعه الطبيعي مع العدد.
    expect(text(section(res.letterhead!, 1)).join(' ')).toContain('/ / 20');
    // ولا وسم واحد بصيغتنا — ولهذا لا يكفي الاستيراد الحرفي.
    expect(res.body).not.toMatch(/\{[^}]+\}/);
  });
});

/**
 * ما لم يُبنَ بعد — كل سطر منها عيبٌ رآه هذا الملف.
 * يُحوَّل إلى اختبار حقيقي يوم تُبنى قاعدته (م٢ في الأساس).
 */
describe('محرّك الفراغات والتنظيف — م٢', () => {
  it.todo('«العدد:» و«التاريخ:» يصيران حقلَي السجل لا سطرين نصّيين ميّتين');
  it.todo('التمديد يُحذف: «انـــــــــذار» ← «انذار»، وإلا لم يجدها من يبحث');
  it.todo('«0» بعد حرف عربي تصير نقطة: «وانذاره0» ← «وانذاره.»');
  it.todo('الفقرات الفارغة المتتالية تصير مسافة رأسية واحدة لا خمس فقرات');
  it.todo('«( )» و«.....» و«/ / 20» تصير حقولًا بأنواعها وبعرض ما كُتب');
  it.todo('اسم الحقل يُستنتج مما قبله: «للتلميذ ( )» ← اسم التلميذ');
});
