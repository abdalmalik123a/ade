/**
 * مولّد `tests/fixtures/designs/v<إصدار النموذج>/` — تصاميم كما يحفظها هذا الإصدار (DESIGNS.md ٣٫٥ و٠٫٥).
 *
 * يجري مرّةً حين يتغيّر إصدار النموذج (`CANVAS_VERSION`) — فالتجهيزة ما كتبه ذلك الإصدار فعلًا — ثم تُحفظ ولا تُعاد:
 * كلّ إصدارٍ بعده يفتحها ويرسمها كما رُسمت (`designFixtures.test.ts`). وأسماؤها مختلَقة.
 *
 *   DESIGN_FIXTURES_OUT=1 npx vitest run tests/makeDesignFixtures.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import {
  CANVAS_VERSION,
  barcodeElement,
  canvasDoc,
  emptyCanvas,
  imageElement,
  shapeElement,
  tableElement,
  textElement,
  type Canvas
} from '../src/shared/canvas';
import { fieldRef, reconcileFields, run } from '../src/shared/doc';
import { PALETTES, buildDoc, sampleValues } from '../src/shared/design/kit';
import { imageFormDoc, type FormSlot } from '../src/shared/imageForm';

const DIR = join(__dirname, 'fixtures', 'designs', `v${CANVAS_VERSION}`);
const save = (name: string, data: unknown) => writeFileSync(join(DIR, `${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
/** المعرّفات ثابتة — فالتجهيزة نصٌّ لا يتغيّر بين تشغيلين. */
let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

it.runIf(process.env['DESIGN_FIXTURES_OUT'])('تصاميم إصدار النموذج الحاضر', () => {
  mkdirSync(DIR, { recursive: true });

  // ١ — تصميمٌ جاهز من المعرض، بلوحته ونمطه.
  const kit = buildDoc({ kind: 'student-id', style: 'kids', palette: PALETTES[2]! });
  save('kit-student-id', { doc: kit, values: sampleValues() });

  // ٢ — تصميم مكتبٍ بيده: كلّ نوعٍ وكلّ خاصّية، ووجهٌ وظهر.
  const front: Canvas = { ...emptyCanvas({ w: 148, h: 210 }, 3), background: { kind: 'image', src: 'designs/0123456789abcdef.png', dpi: 300 } };
  front.elements = [
    textElement({ id: id(), box: { x: 0.1, y: 0.05, w: 0.8, h: 0.08 }, inlines: [run('شهادة '), fieldRef('الدورة')], size: 22, bold: true, font: "'Amiri', serif", color: '#7a1e2c', z: 1 }),
    textElement({ id: id(), box: { x: 0.1, y: 0.2, w: 0.8, h: 0.06 }, inlines: [fieldRef('الاسم')], size: 18, fit: 'shrink', letterSpacing: 0.05, wordSpacing: 0.2, align: 'right', vAlign: 'bottom', z: 2 }),
    textElement({ id: id(), box: { x: 0.6, y: 0.3, w: 0.3, h: 0.05 }, inlines: [fieldRef('الرقم')], dir: 'ltr', align: 'left', italic: true, lineHeight: 1.2, z: 3, rotate: 8 }),
    imageElement({ id: id(), box: { x: 0.06, y: 0.35, w: 0.25, h: 0.3 }, ref: 'الصورة', radius: 50, z: 4 }),
    imageElement({ id: id(), box: { x: 0.7, y: 0.85, w: 0.2, h: 0.1 }, src: 'designs/logo.png', fit: 'contain', z: 5, locked: true, name: 'الشعار' }),
    barcodeElement({ id: id(), box: { x: 0.35, y: 0.7, w: 0.3, h: 0.08 }, ref: 'الرقم', z: 6 }),
    barcodeElement({ id: id(), box: { x: 0.05, y: 0.85, w: 0.12, h: 0.1 }, symbology: 'seal', value: '{الاسم} {الرقم}', z: 7 }),
    shapeElement({ id: id(), box: { x: 0.05, y: 0.5, w: 0.9, h: 0.003 }, shape: 'line', stroke: '#c9a45c', strokeWidth: 2, z: 8 }),
    shapeElement({ id: id(), box: { x: 0.4, y: 0.4, w: 0.2, h: 0.12 }, shape: 'ellipse', fill: '#fef3c7', stroke: '#92400e', z: 9 }),
    tableElement({
      id: id(),
      box: { x: 0.08, y: 0.55, w: 0.84, h: 0.12 },
      columns: [
        { title: 'ت', widthPercent: 15, align: 'center' },
        { title: 'المادة', widthPercent: 55, align: 'right' },
        { title: 'الدرجة', widthPercent: 30, align: 'center' }
      ],
      rows: [
        [{ text: '١' }, { text: 'العربية' }, { text: '{درجة العربية}' }],
        [{ text: '٢' }, { text: 'الرياضيات', bold: true }, { text: '', field: 'درجة الرياضيات' }]
      ],
      stripe: true,
      z: 10
    })
  ];
  const back: Canvas = { ...emptyCanvas({ w: 148, h: 210 }, 3), background: { kind: 'color', color: '#f8fafc' } };
  back.elements = [textElement({ id: id(), box: { x: 0.1, y: 0.45, w: 0.8, h: 0.1 }, inlines: [run('ظهر — '), fieldRef('الرقم')], z: 1 })];
  const office = canvasDoc(front, { title: 'شهادة دورة', category: 'تصاميم' });
  office.backCanvas = back;
  office.fields = reconcileFields(office);
  save('office-certificate', {
    doc: office,
    values: { الدورة: 'الحاسوب', الاسم: 'سالم حسن علي', الرقم: '2026-0457', الصورة: 'attachments/abc.jpg', 'درجة العربية': '91', 'درجة الرياضيات': '88' }
  });

  // ٣ — استمارة الشبّاك المصوّرة: تُصدر كتبًا في السجلّ.
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
  const slots: FormSlot[] = [
    { key: 'الاسم', label: 'الاسم الرباعي', kind: 'text', box: box(400, 500, 1700, 580), from: 'line' },
    { key: 'التولد', label: 'تاريخ الولادة', kind: 'date', box: box(400, 650, 1000, 730), from: 'line' },
    { key: 'متزوج', label: 'متزوج', kind: 'check', box: box(1600, 800, 1660, 860), from: 'box' },
    { key: 'صورة', label: 'الصورة', kind: 'photo', box: box(150, 300, 450, 700), from: 'box' }
  ];
  const form = imageFormDoc({ title: 'استمارة', image: 'forms/0123456789abcdef.png', width: 2100, height: 2970, dpi: 250, slots });
  save('counter-form', { doc: form, values: { الاسم: 'سالم حسن علي الربيعي', التولد: '2001-03-14', متزوج: '✓', صورة: 'attachments/abc.jpg' } });
});
