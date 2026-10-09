import { app } from 'electron';

/**
 * عنوان خادم الواجهة في نسخة التطوير (و١) — ولا يُقرأ `ELECTRON_RENDERER_URL` في البرنامج المحزوم أبدًا: متغيّر
 * بيئةٍ يضعه أيّ برنامجٍ على الجهاز كان يجعل البرنامج المثبَّت يحمّل نافذته ونافذة الإخراج وبطاقة التعبئة من عنوانٍ
 * غريب بصلاحيات واجهته كلّها. والقراءة هنا وحدها (`tests/devUrl.test.ts`).
 */
export function rendererDevUrl(): string | undefined {
  if (app.isPackaged) return undefined;
  return process.env['ELECTRON_RENDERER_URL'] || undefined;
}
