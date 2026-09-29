/**
 * مكتبة القاط لصورة المعاملة — المدمج منها، وما يستورده المكتب.
 *
 * المدمج صورٌ مولَّدة (لا أشخاص حقيقيّون) جُهّزت بـ`tools/prepare-suits.py`: مقصوصة الرأس
 * والخلفية، ومرمَّمة الياقة، ومقصوصةٌ إلى الصدر. **والبدلات النظامية بلا رتبةٍ ولا شارةٍ ولا
 * وسامٍ ولا أجنحة** (قرار المالك) — ولا تُسمّى باسم جهةٍ بعينها.
 *
 * والمستورد PNG شفّاف يضيفه صاحب المكتب؛ ومكان العنق في كليهما يُقرأ من شفافيّة الصورة
 * نفسها (`suitAnchor` في `portraitMask.ts`) — فلا يُضبط يدويًّا لكلّ قاط.
 */

export type SuitCategory = 'tie' | 'open' | 'women' | 'uniform' | 'custom';

export const SUIT_CATEGORIES: { key: SuitCategory; label: string }[] = [
  { key: 'tie', label: 'قاطٌ بربطة' },
  { key: 'open', label: 'بلا ربطة' },
  { key: 'women', label: 'نسائي' },
  { key: 'uniform', label: 'نظامي بلا شارات' },
  { key: 'custom', label: 'قاط المكتب' }
];

export type BuiltinSuit = { id: string; name: string; category: Exclude<SuitCategory, 'custom'>; file: string };

export const BUILTIN_SUITS: BuiltinSuit[] = [
  { id: 'suit-black-tie', name: 'قاطٌ أسود بربطةٍ عنابية', category: 'tie', file: 'suit-black-tie.webp' },
  { id: 'suit-navy-tie', name: 'قاطٌ كحلي بربطةٍ زرقاء', category: 'tie', file: 'suit-navy-tie.webp' },
  { id: 'suit-gray-tie', name: 'قاطٌ رصاصي بربطةٍ كحلية', category: 'tie', file: 'suit-gray-tie.webp' },
  { id: 'suit-black-open', name: 'قاطٌ أسود بلا ربطة', category: 'open', file: 'suit-black-open.webp' },
  { id: 'women-black-jacket', name: 'سترةٌ سوداء بقميصٍ أبيض', category: 'women', file: 'women-black-jacket.webp' },
  { id: 'uniform-mandarin-dark', name: 'سترةٌ داكنة بياقةٍ صينية', category: 'uniform', file: 'uniform-mandarin-dark.webp' },
  { id: 'uniform-black-shirt', name: 'قميصٌ أسود بكتّافاتٍ بلا شارات', category: 'uniform', file: 'uniform-black-shirt.webp' }
];

/** قاطٌ استورده المكتب — في المخزن (`suits/`)، وقائمته في الإعدادات. */
export type CustomSuit = { id: string; name: string; path: string; createdAt: string };

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
