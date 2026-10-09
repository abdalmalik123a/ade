/**
 * مسودّة التصميم (DESIGNS.md ٣٫٨ و٠٫٦) — في جدول المسودّات نفسه الذي يحفظ فيه محرّر الكتب: فتظهر في «قيد العمل»
 * وتُستأنف منه، وتنتقل في النسخة الاحتياطية — ولا آليةَ موازية.
 *
 * والتصميم كلّه في مفتاحٍ واحد `__design` (كما يحفظ المحرّر ورقته في `__doc`): الوثيقة بوجهها وظهرها وعنوانها وربط
 * أعمدة دفعتها، وما مُلئ من حقولها. فمسودّةٌ فيها `__design` تصميمٌ يُفتح في التصاميم، وما سواها كتابٌ يُفتح في المحرّر.
 */
import { normalizeDoc, type Doc } from '../doc';

export const DESIGN_DRAFT_KEY = '__design';

export type DesignDraft = { doc: Doc; values: Record<string, string> };

/** ما يُكتب في `values` المسودّة. */
export function designDraftValues(draft: DesignDraft): Record<string, string> {
  return { [DESIGN_DRAFT_KEY]: JSON.stringify({ doc: draft.doc, values: draft.values }) };
}

function parse(valuesJson: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(valuesJson) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** أهي مسودّة تصميم؟ — بلا قراءة التصميم نفسه، فتُفرز القائمة سريعًا. */
export function isDesignDraft(valuesJson: string): boolean {
  return typeof parse(valuesJson)?.[DESIGN_DRAFT_KEY] === 'string';
}

/**
 * يقرأ مسودّة التصميم ويقوّمها كما يُقرأ التصميم المحفوظ (بالترحيل) — أو عدمٌ إن لم تكن مسودّة تصميم أو تلفت.
 * والقيم نصوصٌ وحدها: ما سواها يسقط.
 */
export function readDesignDraft(valuesJson: string): DesignDraft | null {
  const raw = parse(valuesJson)?.[DESIGN_DRAFT_KEY];
  if (typeof raw !== 'string') return null;
  const inner = parse(raw);
  if (!inner) return null;
  const doc = normalizeDoc(inner.doc);
  if (doc.kind !== 'canvas' || !doc.canvas) return null;
  const values: Record<string, string> = {};
  const rawValues = inner.values;
  if (rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)) {
    for (const [k, v] of Object.entries(rawValues as Record<string, unknown>)) if (typeof v === 'string') values[k] = v;
  }
  return { doc, values };
}

/**
 * بصمة التصميم لمقارنة «تغيّر أم لا» — اللوحة والظهر والعنوان. لا معرّف الوثيقة (يُولَّد مع كلّ رسم)، ولا قيم الحقول
 * (الملء ليس التصميم)، ولا ربط أعمدة الدفعة: يُحفظ في التصميم المحفوظ لحظةَ يُختار (هـ٥)، فلا يُعدّ تعديلًا لم يُحفظ —
 * وفي المسودّة يُكتب مع غيره.
 */
export function designKey(doc: Doc): string {
  return JSON.stringify([doc.canvas ?? null, doc.backCanvas ?? null, doc.meta.title ?? '']);
}
