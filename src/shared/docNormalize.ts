/**
 * قراءة الوثيقة المحفوظة بالصيغة الحالية (`normalizeDoc`) ومساعداتها: الصفحة والعلامة المائية والحقل — نُقلت من `doc.ts` كما هي (A11، D77).
 * ولا يعيد `doc.ts` تصديرها: التطبيع يستورد `normalizeCanvas`، و`canvas.ts` يعود إلى `doc.ts` من وراء أنواع العناصر — فبابٌ هناك يعيد دورة الاستيراد (A13).
 */
import { normalizeCanvas } from './canvas';
import { normalizeTree } from './docTree';
import { migrateDoc } from './docVersion';
import { DEFAULT_PAGE, isPageSize, emptyDoc, DOC_SCHEMA, newUuid, reconcileFields, makeField, DEFAULT_FIELD_WIDTH } from './doc';
import type { PageSetup, Watermark, Doc, DocField } from './docTypes';

const isObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function normalizePage(raw: unknown): PageSetup {
  const base: PageSetup = { ...DEFAULT_PAGE, margins: { ...DEFAULT_PAGE.margins } };
  if (!isObj(raw)) return base;
  const v = raw as Partial<PageSetup>;
  return {
    size: isPageSize(v.size) ? v.size : 'A4',
    orientation: v.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: { ...base.margins, ...(isObj(v.margins) ? (v.margins as PageSetup['margins']) : {}) },
    letterheadMode:
      v.letterheadMode === 'reserve' || v.letterheadMode === 'lines' || v.letterheadMode === 'none' ? v.letterheadMode : 'print',
    repeatLetterhead: v.repeatLetterhead === true,
    pageNumbers: v.pageNumbers === true,
    numerals: v.numerals === 'indic' ? 'indic' : 'arabic',
    watermark: normalizeWatermark(v.watermark)
  };
}

/** علامةٌ لا تُفهم تسقط بلا أن تُسقط الورقة، والشفافية تُحصر فلا تحجب المتن. */
function normalizeWatermark(raw: unknown): Watermark | null {
  if (!isObj(raw)) return null;
  const opacity =
    typeof raw.opacity === 'number' ? Math.min(0.3, Math.max(0.03, raw.opacity)) : undefined;
  if (raw.kind === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
    return { kind: 'text', text: raw.text.trim().slice(0, 40), ...(opacity ? { opacity } : {}) };
  }
  if (raw.kind === 'image' && typeof raw.src === 'string' && raw.src) {
    return { kind: 'image', src: raw.src, ...(opacity ? { opacity } : {}) };
  }
  return null;
}

/**
 * يقرأ أي وثيقة محفوظة ويعيدها بالصيغة الحالية.
 *
 * ما لا يُفهم يسقط بلا أن يُسقط الشاشة — فالكتاب الرسمي لا يحتمل التخمين، لكن
 * ورقةً واحدة تالفة لا يجوز أن تمنع المكتب من العمل.
 */
export function normalizeDoc(raw: unknown): Doc {
  if (!isObj(raw)) return emptyDoc();
  // الصيغة تُرحَّل خطوةً خطوة، والأحدث يُقرأ بما يُعرف منه ويبقى رقمه (`docVersion.ts`، D50).
  const migrated = migrateDoc(raw, DOC_SCHEMA);
  const v = migrated.raw as Partial<Doc>;

  const doc: Doc = {
    id: typeof v.id === 'string' && v.id ? v.id : newUuid(),
    schemaVersion: migrated.version,
    kind: v.kind === 'canvas' ? 'canvas' : 'flow',
    issuing: v.issuing === 'print-only' ? 'print-only' : 'registered',
    pageSetup: normalizePage(v.pageSetup),
    // التالف يسقط وحده في أيّ عمق، وما حوله باقٍ (`docTree.ts`، D50).
    blocks: Array.isArray(v.blocks) ? normalizeTree(v.blocks) : [],
    fields: Array.isArray(v.fields) ? v.fields.filter(isObj).map(normalizeField) : [],
    meta: isObj(v.meta) ? (v.meta as Doc['meta']) : {}
  };

  // اللوحة تُقوَّم بقواعدها: ما فسد منها يُردّ إلى حدّه ولا يُسقط الورقة.
  if (doc.kind === 'canvas') {
    doc.canvas = normalizeCanvas(v.canvas);
    if (v.backCanvas) doc.backCanvas = normalizeCanvas(v.backCanvas);
  }

  // الحقول تتبع المتن دائمًا: ما اختفى من النصّ لا يبقى في شاشة الإدخال.
  doc.fields = reconcileFields(doc);
  return doc;
}

/**
 * مصدر الحقل في ملف الزبون بأسماء خاناته (`fullName`) — وكانت وسوم النماذج القديمة («{الاسم}») تُرحَّل
 * بأسماء أعمدة القاعدة (`full_name`)، فلا يملؤها «هات الزبون». يُصحَّح ما حُفظ كذلك عند قراءته.
 */
const LEGACY_SOURCE: Record<string, string> = {
  full_name: 'fullName',
  national_id: 'nationalId',
  job_title: 'jobTitle',
  service_status: 'serviceStatus',
  birth_place: 'birthPlace',
  birth_date: 'birthDate'
};

function normalizeField(raw: Record<string, unknown>): DocField {
  const key = typeof raw.key === 'string' ? raw.key : '';
  return {
    ...makeField({ key }),
    ...raw,
    ...(typeof raw.source === 'string' && LEGACY_SOURCE[raw.source] ? { source: LEGACY_SOURCE[raw.source] } : {}),
    id: typeof raw.id === 'string' && raw.id ? raw.id : newUuid(),
    key,
    width: typeof raw.width === 'number' && raw.width > 0 ? raw.width : DEFAULT_FIELD_WIDTH,
    fillMode: raw.fillMode === 'hand' ? 'hand' : 'printed',
    required: raw.required === true,
    calendar: raw.calendar === 'hijri' || raw.calendar === 'both' || raw.calendar === 'gregorian' ? raw.calendar : undefined
  } as DocField;
}
