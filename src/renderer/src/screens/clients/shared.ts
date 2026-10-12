/**
 * ما تشترك فيه شاشة الجهات وأجزاؤها: أنواع الجهات، ولون الشعار، ومسودّة ملفّ الجهة (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من
 * `ClientsScreen` كما هو.
 */
import { dominantColor } from '@shared/design/kit';

export const KINDS = ['مدرسة', 'روضة', 'إعدادية', 'ثانوية', 'دائرة', 'مديرية', 'شركة', 'جامعة', 'مركز'];

export async function logoColor(path: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `diwan://store/${path}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 64, 64);
  return dominantColor(ctx.getImageData(0, 0, 64, 64).data);
}

export type Draft = {
  name: string;
  kind: string;
  phone: string;
  address: string;
  color: string;
  notes: string;
  schoolGender: string;
  governorate: string;
  principal: string;
  font: string;
};

export const EMPTY: Draft = { name: '', kind: '', phone: '', address: '', color: '', notes: '', schoolGender: '', governorate: '', principal: '', font: '' };
