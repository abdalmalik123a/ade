/**
 * تسطيح Photoshop لخلفية التصميم المستورد — منقولةٌ كما هي من `ipc/designs.ts` (D56) فتجري في العامل المستقلّ، وفي الرئيسة طريقًا قديمًا بديلًا.
 */
import { PRINT_DPI } from '@shared/canvas';
import { readPsd } from '../psd';
import { writePng } from '../png';

/**
 * يأخذ صورة Photoshop المسطَّحة كما هي في الملف.
 *
 * ولا تُعاد الطبقات تركيبًا: PSD يحمل الصورة المسطَّحة في آخره، وهي بالضبط ما
 * نريد. وجُرِّبت `@webtoon/psd` فأعادت رماديًّا من ملفٍ بلا طبقات — كرّرت القناة
 * الأولى في الثلاث — فأُسقطت وقُرئ الملف عندنا (§`services/psd.ts`).
 */
export function flattenPsd(bytes: Uint8Array): { png: Uint8Array | null; warnings: string[] } {
  const read = readPsd(bytes);
  if (!read?.rgba) return { png: null, warnings: read?.warnings ?? ['تعذّرت قراءة الملف'] };
  return {
    png: writePng(read.rgba, read.width, read.height, read.dpi ?? PRINT_DPI),
    warnings: read.warnings
  };
}
