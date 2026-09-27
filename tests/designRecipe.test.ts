import { describe, expect, it } from 'vitest';
import {
  callGeminiAi,
  colorsFromText,
  recolorRecipe,
  extractJsonFromText,
  generateAiPrompt,
  generateOfflineRecipe,
  parseDesignRecipe,
  recipeToCanvas
} from '../src/shared/designRecipe';

describe('وصفة التصميم وكود الذكاء الاصطناعي', () => {
  it('يستخرج كود JSON النقي حتى لو كان محاطًا بكتلة ماركداون', () => {
    const raw = 'إليك الكود المطلوب:\n```json\n{"title": "شهادة"}\n```\nبالتوفيق!';
    expect(extractJsonFromText(raw)).toBe('{"title": "شهادة"}');
  });

  it('يفحص كود الوصفة ويستخرج الأبعاد والعناصر', () => {
    const json = JSON.stringify({
      title: 'شهادة تفوق',
      size: { w: 297, h: 210 },
      bleed: 0,
      background: { color: '#0d1b2a', borderColor: '#c5a059', borderWidth: 4 },
      elements: [
        {
          type: 'text',
          text: 'شهادة تقدير',
          x: 0.1,
          y: 0.1,
          w: 0.8,
          h: 0.15,
          size: 32,
          color: '#c5a059',
          bold: true,
          font: 'Amiri'
        },
        {
          type: 'text',
          text: 'للطالب {اسم الطالب}',
          x: 0.2,
          y: 0.4,
          w: 0.6,
          h: 0.1,
          size: 20
        },
        {
          type: 'qr',
          value: 'CERT-2026-99',
          x: 0.8,
          y: 0.8,
          w: 0.15,
          h: 0.15
        }
      ]
    });

    const { recipe, error } = parseDesignRecipe(json);
    expect(error).toBeUndefined();
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe('شهادة تفوق');
    expect(recipe!.size).toEqual({ w: 297, h: 210 });
    expect(recipe!.elements).toHaveLength(3);
  });

  it('يحوّل الوصفة إلى لوحة Canvas كاملة الطبقات قابلة للتعديل', () => {
    const { recipe } = parseDesignRecipe(`{
      "title": "هوية موظف",
      "size": { "w": 85.6, "h": 54 },
      "bleed": 3,
      "elements": [
        { "type": "text", "text": "جمهورية العراق", "x": 0.1, "y": 0.05, "w": 0.8, "h": 0.1 },
        { "type": "text", "text": "{اسم الموظف}", "x": 0.1, "y": 0.4, "w": 0.8, "h": 0.15 },
        { "type": "barcode", "value": "EMP-1024", "x": 0.1, "y": 0.75, "w": 0.8, "h": 0.18 }
      ]
    }`);

    const canvas = recipeToCanvas(recipe!);
    expect(canvas.size).toEqual({ w: 85.6, h: 54 });
    expect(canvas.bleed).toBe(3);
    expect(canvas.elements).toHaveLength(3);

    // التحقق من أن {اسم الموظف} تحوّل إلى عقدة حقل
    const nameEl = canvas.elements[1]!;
    expect(nameEl.kind).toBe('text');
    if (nameEl.kind === 'text') {
      expect(nameEl.inlines.some((node) => node.kind === 'field' && node.ref === 'اسم الموظف')).toBe(true);
    }

    // التحقق من عنصر الباركود
    const barcodeEl = canvas.elements[2]!;
    expect(barcodeEl.kind).toBe('barcode');
  });

  it('يدعم إدراج رسمة القرآن الكريم والشخصيات الكارتونية والمتجهات SVG', () => {
    const { recipe } = parseDesignRecipe(`{
      "title": "شهادة حفظ القرآن",
      "size": { "w": 297, "h": 210 },
      "elements": [
        { "type": "clipart", "clipart": "quran", "x": 0.4, "y": 0.05, "w": 0.2, "h": 0.2 },
        { "type": "clipart", "clipart": "cartoon_star", "x": 0.8, "y": 0.1, "w": 0.15, "h": 0.15 },
        { "type": "svg", "svg": "<svg><circle cx='50' cy='50' r='40'/></svg>", "x": 0.1, "y": 0.1, "w": 0.15, "h": 0.15 },
        { "type": "image", "text": "مصحف شريف", "x": 0.2, "y": 0.2, "w": 0.1, "h": 0.1 }
      ]
    }`);

    expect(recipe).not.toBeNull();
    const canvas = recipeToCanvas(recipe!);
    expect(canvas.elements).toHaveLength(4);

    // القرآن الكريم
    const quranEl = canvas.elements[0]!;
    expect(quranEl.kind).toBe('image');
    if (quranEl.kind === 'image') {
      expect(quranEl.src).toContain('data:image/svg+xml');
      expect(decodeURIComponent(quranEl.src)).toContain('<svg');
    }

    // النجمة الكارتونية
    const starEl = canvas.elements[1]!;
    expect(starEl.kind).toBe('image');
    if (starEl.kind === 'image') {
      expect(starEl.src).toContain('data:image/svg+xml');
    }

    // كود SVG مخصص
    const svgEl = canvas.elements[2]!;
    expect(svgEl.kind).toBe('image');
    if (svgEl.kind === 'image') {
      expect(svgEl.src).toContain('data:image/svg+xml');
      expect(decodeURIComponent(svgEl.src)).toContain('circle');
    }

    // استدلال ذكي من كلمة مصحف
    const inferredEl = canvas.elements[3]!;
    expect(inferredEl.kind).toBe('image');
    if (inferredEl.kind === 'image') {
      expect(inferredEl.src).toContain('data:image/svg+xml');
    }
  });

  it('يولّد توجيه الذكاء الاصطناعي مع القواعد الدقيقة', () => {
    const prompt = generateAiPrompt('شهادة شكر فاخرة لمعلم في يوم المعلم');
    expect(prompt).toContain('المواصفات المطلوبة للتصميم:');
    expect(prompt).toContain('شهادة شكر فاخرة لمعلم في يوم المعلم');
    expect(prompt).toContain('Amiri');
    expect(prompt).toContain('quran');
    expect(prompt).toContain('cartoon_boy');
  });

  it('يولّد وصفات وتصاميم أوفلاين متقنة بدون نت', () => {
    // 1. شهادة قرآن
    const quranRecipe = generateOfflineRecipe('شهادة حفظ جزء عم للقرآن الكريم');
    expect(quranRecipe.title).toContain('القرآن');
    expect(quranRecipe.elements.some((e: any) => e.clipart === 'quran')).toBe(true);

    // 2. هوية موظف
    const idRecipe = generateOfflineRecipe('هوية موظف لشركة هندسية');
    expect(idRecipe.size).toEqual({ w: 54, h: 85.6 });
    expect(idRecipe.elements.some((e: any) => e.ref === 'صورة الموظف')).toBe(true);

    // 3. أطفال
    const kidRecipe = generateOfflineRecipe('شهادة تفوق للأطفال في الروضة');
    expect(kidRecipe.elements.some((e: any) => e.clipart === 'cartoon_star')).toBe(true);
  });
});


describe('Gemini: التوجيه هنا، والاتصال والمفتاح في العملية الرئيسية', () => {
  it('يرسل التوجيه عبر الناقل ويفكّ جوابه وصفةً', async () => {
    const recipe = generateOfflineRecipe('شهادة تفوق');
    const out = await callGeminiAi('شهادة تفوق', async (prompt) => {
      expect(prompt).toContain('شهادة تفوق');
      return { text: JSON.stringify(recipe) };
    });
    expect(out.recipe?.title).toBe(recipe.title);
  });

  it('ويعيد سبب التعذّر كما قاله الخادم', async () => {
    const out = await callGeminiAi('x', async () => ({ text: null, error: 'لا مفتاح Gemini محفوظ' }));
    expect(out).toEqual({ recipe: null, error: 'لا مفتاح Gemini محفوظ' });
  });
});

describe('الألوان لصاحب الطلب أو للنموذج — لا للبرنامج', () => {
  /** كان التوجيه يكتب الكحلي والذهبي قاعدةً ومثالًا، فينسخهما النموذج في كل تصميم. */
  it('التوجيه لا يفرض لونًا، ويلتزم بما اختاره صاحب الطلب', () => {
    const free = generateAiPrompt('شهادة تفوق');
    expect(free).toContain('اختر لوحةً تناسب موضوع الطلب');
    expect(free).not.toContain('"color": "#0d1b2a", "borderColor": "#c5a059"');
    expect(generateAiPrompt('شهادة', undefined, { primary: '#1f7a4a' })).toContain('اللون الرئيسي #1f7a4a');
  });

  it('يقرأ الألوان من نصّ الطلب بترتيب ذكرها — والكلمة كاملةً', () => {
    expect(colorsFromText('شهادة بألوان خضراء وذهبية')).toEqual({ primary: '#1f7a4a', accent: '#c5a059' });
    expect(colorsFromText('ثانوية الرشيد للبنين')).toEqual({ primary: undefined, accent: undefined });
    expect(colorsFromText('بالأزرق')).toMatchObject({ primary: '#1f5fbf' });
  });

  it('وإعادة التلوين تبدّل الطيف وتبقي الدرجة: الخلفية الداكنة تبقى داكنة', () => {
    const recipe = {
      title: 't',
      size: { w: 297, h: 210 },
      background: { color: '#091e2b', borderColor: '#d4af37' },
      elements: [
        { type: 'text' as const, text: 'x', x: 0, y: 0, w: 1, h: 1, color: '#ffffff' },
        { type: 'text' as const, text: 'y', x: 0, y: 0, w: 1, h: 1, color: '#e0c068' }
      ]
    };
    const out = recolorRecipe(recipe, { primary: '#1f7a4a' });
    const bg = out.background!.color!;
    // أخضر داكن: الأخضر غالب، والإضاءة كما كانت.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(b!);
    expect(Math.max(r!, g!, b!)).toBeLessThan(80);
    // الأبيض لا يُمسّ، والذهبيّ (الطيف الثاني) باقٍ إذ لم يُختر إبراز.
    expect(out.elements[0]!.color).toBe('#ffffff');
    expect(out.background!.borderColor).toBe('#d4af37');
  });
});

describe('السطر الجديد في النصّ', () => {
  it('«\n» في الوصفة فاصلُ سطرٍ لا حرفان يُطبعان', () => {
    const canvas = recipeToCanvas({
      title: 't',
      size: { w: 297, h: 210 },
      elements: [{ type: 'text', text: 'مدير المدرسة\n{اسم المدير}', x: 0, y: 0, w: 1, h: 1 }]
    });
    const el = canvas.elements[0]!;
    expect(el.kind === 'text' && el.inlines.map((n) => n.kind)).toEqual(['run', 'break', 'field']);
  });
});
