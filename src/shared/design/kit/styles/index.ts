/**
 * الأنماط الخمسة — لغاتٌ بصرية لا ألوان. نمطٌ في ملفّ (DESIGNS.md ٣٫٢).
 */
import type { Style } from './helpers';
import { official } from './official';
import { islamic } from './islamic';
import { modern } from './modern';
import { luxury } from './luxury';
import { kids } from './kids';

export const STYLES: Style[] = [official, islamic, modern, luxury, kids];

export const styleOf = (key: string): Style => STYLES.find((s) => s.key === key) ?? official;

export { FONT, onColor, type Style, type StyleCtx, type Type } from './helpers';
