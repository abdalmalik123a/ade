/**
 * بناء وثيقة الاستمارة المصوّرة وحساب قيم خاناتها عند الطباعة — نُقل من `imageForm.ts` (D90).
 */
import { type Doc, type DocField, makeField } from './doc';
import { emptyCanvas, type Box as CanvasBox, imageElement, textElement, canvasDoc } from './canvas';
import type { Box } from './paperRules';
import { citizenSourceOf } from './citizenFields';
import type { FormSlot } from './imageForm';

/** نقاطٌ في الملّيمتر — الخطّ يُحسب من ارتفاع الخانة. */
const PT_PER_MM = 72 / 25.4;

/**
 * الاستمارة نموذجًا: لوحةٌ بمقاس الورقة، خلفيّتها الصورة، وفوق كلّ خانةٍ صندوقُ حقلها. وحكمها
 * «يُقيَّد» كالكتب — تُطبع لصاحبها وتُحفظ في السجلّ — لا «يُطبع فقط» كالتصاميم.
 */
export function imageFormDoc(input: { title: string; image: string; width: number; height: number; dpi?: number | null; slots: FormSlot[] }): Doc {
  const { width: W, height: H } = input;
  const ratio = H / W;
  // A4 إن قارب نسبته، أو الفولسكاب، وإلا بعرض A4 ونسبته.
  const size = Math.abs(ratio - 297 / 210) < 0.08 ? { w: 210, h: 297 } : Math.abs(ratio - 330 / 210) < 0.06 ? { w: 210, h: 330 } : Math.abs(ratio - 210 / 297) < 0.06 ? { w: 297, h: 210 } : { w: 210, h: Math.round(210 * ratio) };
  const canvas = emptyCanvas(size, 0);
  canvas.background = { kind: 'image', src: input.image, ...(input.dpi ? { dpi: input.dpi } : {}) };
  const toBox = (b: Box): CanvasBox => ({ x: (W - b.x1) / W, y: b.y0 / H, w: (b.x1 - b.x0) / W, h: (b.y1 - b.y0) / H });
  const fields: DocField[] = [];
  for (const s of input.slots) {
    const box = toBox(s.box);
    if (s.kind === 'photo') {
      canvas.elements.push(imageElement({ box, ref: s.key, fit: 'cover', name: s.label }));
    } else {
      const mm = box.h * size.h;
      const pt = Math.max(7, Math.min(14, mm * PT_PER_MM * (s.from === 'box' ? 0.55 : 0.75)));
      canvas.elements.push(
        textElement({
          box,
          name: s.label,
          inlines: [{ kind: 'field', id: `${s.key}-el`, ref: s.key }],
          align: s.kind === 'check' || s.from === 'box' ? 'center' : 'right',
          vAlign: s.from === 'line' ? 'bottom' : 'middle',
          size: Math.round(pt * 2) / 2,
          color: '#000000',
          bold: true,
          fit: 'shrink'
        })
      );
    }
    // مربّع الصورة يُملأ من صورة الزبون في ملفّه («هات الزبون»).
    const source = s.kind === 'photo' ? 'photoPath' : s.kind === 'text' ? citizenSourceOf(s.label) : null;
    fields.push({
      ...makeField({
        key: s.key,
        label: s.label,
        type: s.kind === 'date' ? 'date' : s.kind === 'check' ? 'bool' : 'text',
        width: Math.max(4, Math.round(((s.box.x1 - s.box.x0) / W) * 60)),
        ...(source ? { source } : {}),
        ...(source === 'fullName' ? { role: 'name' as const } : {})
      }),
      ...(s.sumOf ? { sumOf: s.sumOf } : {})
    });
  }
  const doc = canvasDoc(canvas, { title: input.title, form: true });
  doc.issuing = 'registered';
  doc.fields = fields;
  return doc;
}

/**
 * القيم كما تُطبع على الاستمارة: «المجموع» يُجمع من خاناته ما لم يُكتب بيد، والمربّع المعلَّم ✓.
 * ويُطبَّق قبل كتابة الأرقام كلماتٍ (`derivedWords`) — فيُكتب المجموع كلماتٍ أيضًا.
 */
export function formValues(fields: DocField[], values: Record<string, string>): Record<string, string> {
  const out = { ...values };
  const num = (v: string | undefined) => {
    const t = (v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
    return t && /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  };
  for (const f of fields) {
    if (f.sumOf?.length && !values[f.key]?.trim()) {
      const nums = f.sumOf.map((k) => num(values[k])).filter((n): n is number => n !== null);
      if (nums.length) out[f.key] = String(nums.reduce((a, b) => a + b, 0));
    }
    if (f.type === 'bool') {
      const v = values[f.key]?.trim() ?? '';
      out[f.key] = v && !/^(لا|0|no|false)$/i.test(v) ? '✓' : '';
    }
  }
  return out;
}
