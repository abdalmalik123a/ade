/**
 * مكتبة القاط لصورة المعاملة — المدمج منها، وما يستورده المكتب.
 *
 * المدمج من مكتبة المالك (قوالب القاط التي يستعملها المكتب: طبقات ملف Photoshop، وصورٌ على خلفيةٍ
 * بيضاء) جُهّز بـ`tools/prepare-suits.py`: شفّاف الخلفية والعنق، ومقصوصٌ إلى الصدر. **والنظاميّ بلا
 * رتبةٍ ولا شارةٍ ولا علمٍ ولا اسم جهة** (قرار المالك) — وما فيه شيءٌ من ذلك تُرك، ولا يُسمّى باسم جهة.
 *
 * والمستورد PNG شفّاف يضيفه صاحب المكتب؛ ومكان العنق في كليهما يُقرأ من شفافيّة الصورة
 * نفسها (`suitAnchor` في `portraitMask.ts`) — فلا يُضبط يدويًّا لكلّ قاط.
 */

export type SuitCategory = 'suit' | 'shirt' | 'uniform' | 'custom';

export const SUIT_CATEGORIES: { key: SuitCategory; label: string }[] = [
  { key: 'suit', label: 'قاط' },
  { key: 'shirt', label: 'قميص' },
  { key: 'uniform', label: 'نظامي بلا شارات' },
  { key: 'custom', label: 'قاط المكتب' }
];

export type BuiltinSuit = { id: string; name: string; category: Exclude<SuitCategory, 'custom'>; file: string };

export const BUILTIN_SUITS: BuiltinSuit[] = [
  { id: 'suit-gray-bowtie', name: 'قاطٌ رمادي بربطة فراشة', category: 'suit', file: 'suit-gray-bowtie.webp' },
  { id: 'suit-navy-dark-tie', name: 'قاطٌ كحلي بربطةٍ داكنة', category: 'suit', file: 'suit-navy-dark-tie.webp' },
  { id: 'suit-black-pink-tie', name: 'قاطٌ أسود بربطةٍ مخطّطة ومنديل', category: 'suit', file: 'suit-black-pink-tie.webp' },
  { id: 'suit-brown-gold-tie', name: 'سترةٌ بنّية بربطةٍ ذهبية', category: 'suit', file: 'suit-brown-gold-tie.webp' },
  { id: 'suit-black-red-stripe', name: 'قاطٌ أسود بربطةٍ حمراء مخطّطة', category: 'suit', file: 'suit-black-red-stripe.webp' },
  { id: 'suit-black-bw-stripe', name: 'قاطٌ أسود بربطةٍ مخطّطة بالأبيض', category: 'suit', file: 'suit-black-bw-stripe.webp' },
  { id: 'suit-navy', name: 'قاطٌ كحلي', category: 'suit', file: 'suit-navy.webp' },
  { id: 'suit-vest-brown-tie', name: 'قاطٌ مقلّم بصديريٍّ وربطةٍ بنّية', category: 'suit', file: 'suit-vest-brown-tie.webp' },
  { id: 'suit-vest-red-tie', name: 'قاطٌ مقلّم بصديريٍّ وربطةٍ حمراء', category: 'suit', file: 'suit-vest-red-tie.webp' },
  { id: 'suit-charcoal-silver-tie', name: 'قاطٌ فحمي بربطةٍ فضّية', category: 'suit', file: 'suit-charcoal-silver-tie.webp' },
  { id: 'suit-pinstripe-red-tie', name: 'قاطٌ مقلّم بربطةٍ حمراء', category: 'suit', file: 'suit-pinstripe-red-tie.webp' },
  { id: 'suit-pinstripe-gold-tie', name: 'قاطٌ مقلّم بربطةٍ صفراء', category: 'suit', file: 'suit-pinstripe-gold-tie.webp' },
  { id: 'suit-black-blue-shirt', name: 'قاطٌ أسود بقميصٍ أزرق', category: 'suit', file: 'suit-black-blue-shirt.webp' },
  { id: 'suit-navy-gray-tie', name: 'قاطٌ كحلي بربطةٍ رمادية', category: 'suit', file: 'suit-navy-gray-tie.webp' },
  { id: 'shirt-white', name: 'قميصٌ أبيض', category: 'shirt', file: 'shirt-white.webp' },
  { id: 'shirt-black', name: 'قميصٌ أسود', category: 'shirt', file: 'shirt-black.webp' },
  { id: 'uniform-desert-collar', name: 'مرقّطٌ صحراويّ بياقة', category: 'uniform', file: 'uniform-desert-collar.webp' },
  { id: 'uniform-dark-camo', name: 'مرقّطٌ رماديّ داكن', category: 'uniform', file: 'uniform-dark-camo.webp' },
  { id: 'uniform-desert-stand', name: 'مرقّطٌ صحراويّ بياقةٍ واقفة', category: 'uniform', file: 'uniform-desert-stand.webp' },
  { id: 'uniform-urban-camo', name: 'مرقّطٌ أزرق رماديّ', category: 'uniform', file: 'uniform-urban-camo.webp' },
  { id: 'uniform-navy-camo', name: 'مرقّطٌ كحليّ', category: 'uniform', file: 'uniform-navy-camo.webp' },
  { id: 'uniform-multicam-dark', name: 'مرقّطٌ متعدّد داكن', category: 'uniform', file: 'uniform-multicam-dark.webp' },
  { id: 'uniform-black-tactical', name: 'تكتيكيٌّ أسود', category: 'uniform', file: 'uniform-black-tactical.webp' },
  { id: 'uniform-black-stand', name: 'تكتيكيٌّ أسود بياقةٍ واقفة', category: 'uniform', file: 'uniform-black-stand.webp' },
  { id: 'uniform-woodland-shirt', name: 'مرقّطٌ غابيّ بياقة', category: 'uniform', file: 'uniform-woodland-shirt.webp' },
  { id: 'uniform-multicam', name: 'مرقّطٌ متعدّد', category: 'uniform', file: 'uniform-multicam.webp' },
  { id: 'uniform-digital-woodland', name: 'مرقّطٌ رقميّ غابيّ', category: 'uniform', file: 'uniform-digital-woodland.webp' },
  { id: 'uniform-desert-three', name: 'صحراويٌّ ثلاثيّ', category: 'uniform', file: 'uniform-desert-three.webp' },
  { id: 'uniform-woodland-open', name: 'مرقّطٌ غابيّ مفتوح', category: 'uniform', file: 'uniform-woodland-open.webp' },
  { id: 'uniform-sand-stand', name: 'مرقّطٌ رمليّ بياقةٍ واقفة', category: 'uniform', file: 'uniform-sand-stand.webp' },
  { id: 'uniform-woodland-green', name: 'مرقّطٌ غابيّ أخضر', category: 'uniform', file: 'uniform-woodland-green.webp' }
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
