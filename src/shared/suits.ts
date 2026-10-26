/**
 * مكتبة القاط لصورة المعاملة — المدمج منها، وما يستورده المكتب.
 *
 * المدمج من مكتبة المالك (قوالب القاط التي يستعملها المكتب: طبقات ملف Photoshop، وصورٌ على خلفيةٍ
 * بيضاء) جُهّز بـ`tools/prepare-suits.py`: شفّاف الخلفية والعنق، ومقصوصٌ إلى الصدر. **والنظاميّ بلا
 * رتبةٍ ولا شارةٍ ولا علمٍ ولا اسم جهة** (قرار المالك) — وما فيه شيءٌ من ذلك تُرك، ولا يُسمّى باسم جهة.
 *
 * والمستورد صورة قاطٍ يضيفها صاحب المكتب: PNG شفّافة، أو صورةٌ على خلفيةٍ بيضاء تُحضَّر وحدها (`suitMatte.ts`، S39)؛
 * ومكان العنق في كليهما يُقرأ من شفافيّة الصورة نفسها (`suitAnchor` في `portraitMask.ts`) — فلا يُضبط يدويًّا لكلّ قاط.
 */

export type SuitCategory = 'suit' | 'shirt' | 'custom';

export const SUIT_CATEGORIES: { key: SuitCategory; label: string }[] = [
  { key: 'suit', label: 'قاط' },
  { key: 'shirt', label: 'قميص' },
  { key: 'custom', label: 'قاط المكتب' }
];

export type BuiltinSuit = { id: string; name: string; category: Exclude<SuitCategory, 'custom'>; file: string };

/**
 * البدلات والقمصان المدمجة: مفرّغة بالكامل لعدم ثبوت مصادر وتراخيص تجارية موثّقة
 * للصور السابقة (القرار B من البند ٢). يعتمد البرنامج على استيراد قاط المكتب المخصّص (`custom`).
 */
export const BUILTIN_SUITS: BuiltinSuit[] = [];

/** قاطٌ استورده المكتب — في المخزن (`suits/`)، وقائمته في الإعدادات. */
/** `pack`: عنوان الحزمة المختومة التي جاء منها (S48، D205). */
export type CustomSuit = { id: string; name: string; path: string; createdAt: string; pack?: string };

/** ما يعيده «استورد حزمة قاط» (D205): عنوانها ونوعها، وما أُضيف، وما كان في القاط قبلُ فتُخطّي. */
export type SealedSuitsImport = { title: string; kind: 'first' | 'buyer'; added: CustomSuit[]; skipped: number };

/** ما يعيده «استورد قاطًا»: PNG شفّافة أُضيفت، أو صورةٌ تُحضَّر في الواجهة ثم تُضاف (`photos:addSuit`)، أو قاط ملفّ Photoshop كلّها (D204). */
export type SuitImport = { suit: CustomSuit } | { suits: CustomSuit[] } | { prepare: { name: string; bytes: Uint8Array } };

export function parseCustomSuits(json: string | null | undefined): CustomSuit[] {
  try {
    const list = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(list)
      ? (list as CustomSuit[]).filter((s) => s && typeof s.id === 'string' && typeof s.path === 'string' && /^suits\/[^/\\]+$/.test(s.path))
      : [];
  } catch {
    return [];
  }
}

/**
 * أهي PNG شفّافة؟ — نوع اللون ٤ أو ٦ (بقناة شفافية)، أو كتلة `tRNS`. وقاطٌ بلا شفافية
 * يغطّي الصورة كلّها مستطيلًا، فيُرفض بسببه لا يُستورد.
 */
export function pngTransparency(bytes: Uint8Array): 'ok' | 'not-png' | 'opaque' {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || sig.some((b, i) => bytes[i] !== b)) return 'not-png';
  const colorType = bytes[25]!;
  if (colorType === 4 || colorType === 6) return 'ok';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let p = 8; p + 8 <= bytes.length; ) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    if (type === 'tRNS') return 'ok';
    if (type === 'IDAT' || type === 'IEND') break;
    p += 12 + len;
  }
  return 'opaque';
}
