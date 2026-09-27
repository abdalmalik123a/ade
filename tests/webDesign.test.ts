import { describe, expect, it } from 'vitest';
import {
  cleanHtmlInput,
  extractCssProp,
  generateWebAiPrompt,
  parseArtboardBackground,
  parseArtboardSize,
  parseArtboardTitle,
  parseDimension,
  parseWebDesign
} from '@shared/webDesign';

describe('webDesign', () => {
  it('cleans markdown code fences', () => {
    const raw = '```html\n<div class="artboard">مرحبا</div>\n```';
    expect(cleanHtmlInput(raw)).toBe('<div class="artboard">مرحبا</div>');
  });

  it('extracts CSS properties from inline style', () => {
    const style = 'width: 297mm; height: 210mm; background: linear-gradient(to right, red, blue); color: #fff;';
    expect(extractCssProp(style, 'width')).toBe('297mm');
    expect(extractCssProp(style, 'height')).toBe('210mm');
    expect(extractCssProp(style, 'color')).toBe('#fff');
    expect(extractCssProp(style, 'background')).toBe('linear-gradient(to right, red, blue)');
  });

  it('parses dimensions in percentages, mm, and px', () => {
    expect(parseDimension('50%', 200)).toBe(0.5);
    expect(parseDimension('100mm', 200)).toBe(0.5);
    expect(parseDimension('10cm', 200)).toBe(0.5);
    expect(parseDimension(null, 200)).toBeNull();
  });

  it('parses artboard size and background', () => {
    const html = `
      <div class="diwan-artboard" style="width: 297mm; height: 210mm; background: linear-gradient(135deg, #0f172a, #1e293b);" data-title="شهادة تقدير">
      </div>
    `;
    const size = parseArtboardSize(html);
    expect(size.w).toBe(297);
    expect(size.h).toBe(210);

    const bg = parseArtboardBackground(html);
    expect(bg.kind).toBe('css');
    if (bg.kind === 'css') {
      expect(bg.style).toContain('linear-gradient');
    }

    const title = parseArtboardTitle(html);
    expect(title).toBe('شهادة تقدير');
  });

  it('parses HTML with data-layer into Canvas elements', () => {
    const html = `
      <div class="diwan-artboard" style="width: 297mm; height: 210mm; background: #0f172a;" data-title="شهادة حفظ القرآن الكريم">
        <!-- طبقة الإطار -->
        <div data-layer="إطار وزخرفة أندلسية" style="position: absolute; top: 0; right: 0; width: 100%; height: 100%;">
          <svg viewBox="0 0 1000 700" width="100%" height="100%">
            <rect width="1000" height="700" stroke="#f59e0b" stroke-width="10" fill="none" />
          </svg>
        </div>

        <!-- طبقة العنوان -->
        <h1 data-layer="العنوان الرئيسي" style="position: absolute; top: 15%; right: 10%; width: 80%; text-align: center; color: #f59e0b; font-size: 32pt; font-family: 'Amiri'; font-weight: bold;">
          شهادة حفظ القرآن الكريم
        </h1>

        <!-- طبقة رسمة المصحف -->
        <div data-layer="المصحف الشريف" style="position: absolute; top: 35%; right: 40%; width: 20%; height: 25%;">
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            <path d="M10 10 H90 V90 H10 Z" fill="#e2b340" />
          </svg>
        </div>

        <!-- طبقة اسم الطالب -->
        <div data-layer="اسم الطالب المتفوق" style="position: absolute; top: 65%; right: 10%; width: 80%; text-align: center; color: #ffffff; font-size: 24pt; font-family: 'Cairo';">
          أحمد عبد الله الحسني
        </div>
      </div>
    `;

    const { canvas, title } = parseWebDesign(html);
    expect(title).toBe('شهادة حفظ القرآن الكريم');
    expect(canvas.elements.length).toBe(4);

    // التحقق من الطبقة الأولى (SVG)
    const layer1 = canvas.elements[0]!;
    expect(layer1.kind).toBe('svg');
    expect(layer1.name).toBe('إطار وزخرفة أندلسية');

    // التحقق من طبقة العنوان (نص مع استخراج الحجم واللون والخط)
    const layer2 = canvas.elements[1]!;
    expect(layer2.kind).toBe('text');
    expect(layer2.name).toBe('العنوان الرئيسي');
    if (layer2.kind === 'text') {
      expect(layer2.size).toBe(32);
      expect(layer2.color).toBe('#f59e0b');
      expect(layer2.font).toBe('Amiri');
      expect(layer2.bold).toBe(true);
    }

    // التحقق من طبقة المصحف (SVG)
    const layer3 = canvas.elements[2]!;
    expect(layer3.kind).toBe('svg');
    expect(layer3.name).toBe('المصحف الشريف');

    // التحقق من طبقة اسم الطالب (نص)
    const layer4 = canvas.elements[3]!;
    expect(layer4.kind).toBe('text');
    expect(layer4.name).toBe('اسم الطالب المتفوق');
  });

  it('auto-detects layers from raw HTML without data-layer tags', () => {
    const raw = `
      <div style="width: 297mm; height: 210mm; background: #111;">
        <h1 style="color: #fff; font-size: 28pt;">عنوان بدون وسم طبقة</h1>
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="gold" /></svg>
        <p style="color: #ccc; font-size: 14pt;">فقرة توضيحية إضافية</p>
      </div>
    `;
    const { canvas } = parseWebDesign(raw);
    expect(canvas.elements.length).toBe(3);
    expect(canvas.elements[0]!.kind).toBe('text');
    expect(canvas.elements[1]!.kind).toBe('svg');
    expect(canvas.elements[2]!.kind).toBe('text');
  });

  it('preserves full AI web designs with CSS stylesheets and SVG defs at 100% fidelity', () => {
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <title>شهادة حفظ القرآن الكريم الفاخرة</title>
        <style>
          .certificate-container {
            width: 1122px;
            height: 793px;
            background: radial-gradient(circle, #0d1b2a, #050b14);
            border: 3px solid #c5a059;
          }
          .main-title {
            color: #c5a059;
            font-size: 48px;
          }
          .awardee-name {
            font-size: 36px;
            color: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <h1 class="main-title">شَهَادَةُ حِفْظِ القُرْآنِ الكَرِيم</h1>
          <svg viewBox="0 0 200 200">
            <defs>
              <linearGradient id="goldGrad"><stop offset="0%" stop-color="#fff" /><stop offset="100%" stop-color="#c5a059" /></linearGradient>
            </defs>
            <rect width="200" height="200" fill="url(#goldGrad)" />
          </svg>
          <div class="awardee-name">أحمد عبد الله الحسني</div>
        </div>
      </body>
      </html>
    `;

    const { canvas, title } = parseWebDesign(fullHtml);
    expect(title).toBe('شهادة حفظ القرآن الكريم الفاخرة');
    expect(canvas.size.w).toBe(297);
    expect(canvas.size.h).toBe(210);
    expect(canvas.elements.length).toBe(1);

    const master = canvas.elements[0]!;
    expect(master.kind).toBe('html');
    expect(master.box).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    if (master.kind === 'html') {
      expect(master.html).toContain('.certificate-container');
      expect(master.html).toContain('linearGradient id="goldGrad"');
      expect(master.html).toContain('أحمد عبد الله الحسني');
    }
  });

  it('generates a comprehensive AI prompt', () => {
    const prompt = generateWebAiPrompt('شهادة تكريم');
    expect(prompt).toContain('HTML5 + CSS3 + Inline SVG');
    expect(prompt).toContain('data-layer=');
    expect(prompt).toContain('diwan-artboard');
  });
});
