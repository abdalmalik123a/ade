/** إعدادات الإدراج تستخدم مصانع العناصر نفسها التي تستعملها لوحة الإضافة. */
import { textElement, imageElement, shapeElement, barcodeElement, tableElement, type Box } from '@shared/canvas';
import type { DesignTool } from '@shared/design/toolPlacement';
import { inlinesOf } from './kit';
export const DESIGN_TOOLS: { id: DesignTool; label: string; icon: string; title: string }[] = [
  { id: 'select', label: 'تحديد', icon: 'near_me', title: 'أداة التحديد والتحريك' },
  { id: 'text', label: 'نص', icon: 'title', title: 'إضافة نص مباشر' },
  { id: 'field', label: 'حقل', icon: 'data_object', title: 'إضافة حقل متغير {الاسم}' },
  { id: 'image', label: 'صورة', icon: 'image', title: 'إطار صورة حقل' },
  { id: 'shape', label: 'شكل', icon: 'crop_square', title: 'مستطيل / شكل هندسي' },
  { id: 'barcode', label: 'رمز', icon: 'qr_code_2', title: 'باركود / QR' },
  { id: 'table', label: 'جدول', icon: 'table_chart', title: 'جدول بيانات' }
];
export type ToolDefaults = { text: string; field: string; size: number; fill: string; symbology: 'qr' | 'code128' };
export const TOOL_DEFAULTS: ToolDefaults = { text: 'نص جديد', field: 'الاسم', size: 16, fill: '#e2e8f0', symbology: 'code128' };
export function elementForTool(tool: Exclude<DesignTool, 'select'>, box: Box, d: ToolDefaults) {
  switch (tool) {
    case 'text': case 'field': return textElement({ box, inlines: inlinesOf(tool === 'text' ? d.text : `{${d.field || 'الاسم'}}`), size: d.size });
    case 'image': return imageElement({ box, ref: 'صورة' });
    case 'shape': return shapeElement({ box, fill: d.fill, stroke: '#475569', strokeWidth: 1 });
    case 'barcode': return barcodeElement({ box, ref: 'الرقم', symbology: d.symbology });
    case 'table': return tableElement({ box });
  }
}
