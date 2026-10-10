/**
 * الأنماط — لغاتٌ بصرية لا ألوان. نمطٌ في ملفّ (DESIGNS.md ٣٫٢): الخمسة الأولى، والثمانية بمستوى أمثلة المالك (٣٫١).
 */
import type { Style } from './helpers';
import { official } from './official';
import { islamic } from './islamic';
import { modern } from './modern';
import { luxury } from './luxury';
import { kids } from './kids';
import { pastel } from './pastel';
import { blackGold } from './blackGold';
import { watercolor } from './watercolor';
import { lineart } from './lineart';
import { ramadan } from './ramadan';
import { medical } from './medical';
import { corporate } from './corporate';
import { restaurant } from './restaurant';

export const STYLES: Style[] = [official, islamic, modern, luxury, kids, pastel, blackGold, watercolor, lineart, ramadan, medical, corporate, restaurant];

/** الخمسة الأولى — لقطاتها بكلّ نوع منذ ٠٫٢؛ والجديدة بأنواعٍ تمثّلها (`rendererSnapshots`). */
export const FIRST_STYLES = 5;

export const styleOf = (key: string): Style => STYLES.find((s) => s.key === key) ?? official;

export { FONT, onColor, type Style, type StyleCtx, type Type } from './helpers';
