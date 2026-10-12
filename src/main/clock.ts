/**
 * الوقت — وتحت المِقْود من ملفٍّ يغيّره السيناريو وهو يعمل («بعد أسبوعين»)، في غير المثبّت وحده. يقرؤه التفعيل
 * والتنبيهات وعدّاد ما خرج من المكتب: فساعةٌ واحدة للثلاثة.
 */
import { readFileSync } from 'node:fs';
import { app } from 'electron';

export function now(): Date {
  const file = __DIWAN_TEST_DOORS__ && !app.isPackaged ? process.env['DIWAN_TEST_NOW_FILE'] : undefined;
  if (file) {
    try {
      const t = new Date(readFileSync(file, 'utf8').trim());
      if (!Number.isNaN(t.getTime())) return t;
    } catch {
      // لا ملف: الوقت الحقيقي.
    }
  }
  return new Date();
}
