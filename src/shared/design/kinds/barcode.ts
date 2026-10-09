/**
 * الباركود: Code128 للأرقام، وQR لما يُقرأ بالهاتف، ونقش الأمان بذرتُه قيم صاحبه. والرسم الفعلي يُحقن عند العرض —
 * فالرسّام رسّامٌ لا مُرمِّز؛ وهنا موضعه وقيمته فلا يُنسى مكانه.
 */
import { newUuid } from '../../doc';
import { escapeHtml } from '../../html';
import type { BarcodeElement, Box } from '../model/types';
import { boxStyle } from '../render/box';
import type { KindSpec } from './types';

export function barcodeElement(patch: Partial<BarcodeElement> & { box: Box }): BarcodeElement {
  return { id: newUuid(), kind: 'barcode', symbology: 'code128', value: '', z: 1, ...patch };
}

export const BARCODE_KIND: KindSpec<BarcodeElement> = {
  kind: 'barcode',
  normalize: (raw, b) => ({
    id: b.id,
    kind: 'barcode',
    name: b.name,
    box: b.box,
    z: b.z,
    locked: b.locked,
    rotate: b.rotate,
    dir: b.dir,
    symbology: raw.symbology === 'qr' ? 'qr' : raw.symbology === 'seal' ? 'seal' : 'code128',
    value: typeof raw.value === 'string' ? raw.value : '',
    ref: typeof raw.ref === 'string' ? raw.ref : undefined
  }),
  render(el, { canvas, values, opts }) {
    // النقش بذرتُه قيمُ صاحبه: وسومُ `value` تُملأ، فلكلّ بطاقةٍ نقشها.
    const value =
      el.symbology === 'seal'
        ? [el.ref ? (values[el.ref] ?? '') : '', el.value.replace(/\{([^{}]+)\}/g, (_m, k: string) => values[k.trim()] ?? '')].join(' ').trim()
        : (el.ref && values[el.ref]) || el.value;
    return `<div data-barcode="${escapeHtml(el.symbology)}" data-value="${escapeHtml(value)}" style="${boxStyle(el, canvas, opts.dpi)}"></div>`;
  },
  keys: (el) => (el.ref ? [el.ref] : [])
};
