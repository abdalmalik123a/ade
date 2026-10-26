/**
 * «احفظ في ملفّه» في «ورقة المستمسكات» (S47، D200): كلّ وجهٍ له صورةٌ يُحفظ مستمسكًا في ملفّ الشخص باسم نوعه ووجهه
 * («البطاقة الوطنية الموحّدة — الظهر»، ووجهٌ واحدٌ باسمه وحده كـ«عدّة بطاقاتٍ بمسحةٍ واحدة») — فيُقرأ ظهر الوطنية أو صفحة الجواز
 * (MRZ) من ملفّه بزرّه القائم. وما جاء من ملفّه أصلًا لا يُحفظ ثانيةً.
 */
import { faceLabel, type Face, type SheetDoc } from '@shared/idDocSheet';
import { storeDataUrl } from './imageOps';

/** الوجوه التي لها صورةٌ ليست في ملفّه بعد. */
export function facesToSave(doc: SheetDoc, inFile: Set<string>): Face[] {
  const faces: Face[] = doc.faces === 2 ? ['front', 'back'] : ['front'];
  return faces.filter((f) => {
    const src = f === 'front' ? doc.front : doc.back;
    return Boolean(src) && !inFile.has(src!);
  });
}

/** يحفظ الوجوه ويعيد مساراتها كما صارت في الصور المحفوظة (فلا تُحفظ مرّتين). */
export async function saveDocToFile(citizenId: number, doc: SheetDoc, inFile: Set<string>): Promise<string[]> {
  const done: string[] = [];
  for (const face of facesToSave(doc, inFile)) {
    const src = (face === 'front' ? doc.front : doc.back)!;
    await window.diwan.attachments.addFromDataUrl(citizenId, faceLabel(doc, face), await storeDataUrl(src));
    done.push(src);
  }
  return done;
}
