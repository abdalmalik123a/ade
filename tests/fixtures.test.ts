import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importTemplateFile } from '../src/main/services/import';
import { buildBody, EMPTY_LINE_PX } from '../src/main/services/blanks';
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
      // المدّ محذوف — ومن بحث عن «للبنين» وجدها.
      'للبنين'
    ]);
  });

  it('ينتزع العدد والتاريخ من العمود الأيسر إلى حقلَي السجل', async () => {
    const { res } = await load();
    const layout = res.letterhead!;

    // كانا سطرين نصّيين ميّتين، فصارا حقلين يعرف البرنامج أين يطبع فيهما.
    expect(layout.registry).toEqual({ show: true, mode: 'manual' });
    expect(text(section(layout, 1))).toEqual([]);
    expect(layout.columns).toBe(2);
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

  it('يستنتج الموضوع من سطر «م/»، وينظّف مدّه، ولا يتركه في المتن', async () => {
    const { res } = await load();
    // كان «انـــــــــذار» — ومن بحث عن «إنذار» لم يكن يجدها.
    expect(res.subjectLine).toBe('انذار');
    expect(res.body).not.toContain('م/');
  });

  it('يحفظ فراغات المتن كما كتبها المكتب — فهي متغيّراتها', async () => {
    const { res } = await load();

    // خمسة منقّطات وقوس واحد، وتبقى كما هي: تحويلها حقولًا يحكمه الموظف.
    expect(res.body.match(/\.{3,}/g)).toHaveLength(5);
    expect(res.body).toMatch(/\(\s*\)/);
    // ولا وسم واحد بصيغتنا — ولهذا لا يكفي الاستيراد الحرفي.
    expect(res.body).not.toMatch(/\{[^}]+\}/);
  });

  it('ينظّف «0» التي وضعتها لوحة المفاتيح مكان النقطة', async () => {
    const { res } = await load();
    // كان «وانذاره0» و«الدوام 0».
    expect(res.body).toContain('وانذاره.');
    expect(res.body).not.toMatch(/[\u0621-\u064A]0/);
  });
});

/**
 * محرّك الفراغات على الورقة الحقيقية نفسها.
 *
 * الأسطر تخرج من الاستيراد كما كتبها المكتب، فيُبنى منها متن الوثيقة: فراغاتٍ
 * حقولًا، وفقراتٍ فارغة مسافةً، وأسماءً مستنتجة من الكلام قبلها.
 */
describe('محرّك الفراغات على الورقة الحقيقية', () => {
  const build = async () => {
    const store = imageCollector();
    const res = await importTemplateFile(join(DIR, 'school-warning.docx'), store.save);
    return buildBody(res.body.split('\n'));
  };

  it('الفقرات الفارغة المتتالية تصير مسافة رأسية — فراغ التوقيع لا خمس فقرات', async () => {
    const built = await build();
    const spacers = built.blocks.filter((b) => b.kind === 'spacer');

    // خمس فقرات فارغة قبل «مدير المدرسة» صارت مسافةً واحدة بارتفاعها.
    expect(spacers.map((s) => s.height)).toEqual([5 * EMPTY_LINE_PX]);
    // والفقرة الفارغة المنفردة تبقى سطرًا كما كانت — بها يُصنع تباعد المتن.
    expect(built.blocks.filter((b) => b.kind === 'paragraph')).toHaveLength(10);
    expect(built.notes.some((n) => n.includes('فقرات فارغة'))).toBe(true);
  });

  it('«( )» و«.....» تصيران حقولًا بعرض ما كُتب — فلا ينكمش الفراغ', async () => {
    const built = await build();

    expect(built.fields.length).toBeGreaterThanOrEqual(5);
    // الفراغ الطويل يبقى طويلًا، والقصير قصيرًا.
    const widths = built.fields.map((f) => f.width);
    expect(Math.max(...widths)).toBeGreaterThan(20);
    // وكلّها تُطبع فراغًا يملؤه صاحب العلاقة بقلمه.
    expect(built.fields.every((f) => f.fillMode === 'hand')).toBe(true);
  });

  it('اسم الحقل يُستنتج مما قبله: «التلميذ ....» ← اسم التلميذ', async () => {
    const built = await build();
    const labels = built.fields.map((f) => f.label);

    expect(labels).toContain('اسم التلميذ');
    expect(labels).toContain('الصف');
    // والمكرَّر يُميَّز فلا يملأ أحدهما مكان الآخر.
    expect(new Set(built.fields.map((f) => f.key)).size).toBe(built.fields.length);
  });

  it('كل حقل مستنتَج يحمل درجته وسببه — فيراجعه الموظف على بيّنة', async () => {
    const built = await build();

    expect(built.suggestions).toHaveLength(built.fields.length);
    for (const s of built.suggestions) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.reason).toMatch(/\S/);
    }
  });
});
