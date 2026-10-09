/**
 * جسور المكتبتين (DESIGNS.md ٣٫٧): «خطوط ديوان» (٠٫٧) و«مكتبة العناصر» (٠٫٨) — أنواعهما في ملفّيهما، فلا يكبر `api.ts`.
 */
import type { FontsApi } from './fonts';
import type { ElementsApi } from './design/elements';

export type LibraryApis = { fonts: FontsApi; elements: ElementsApi };
