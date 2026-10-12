/**
 * ما يشترك فيه محرّر الكتاب وأجزاؤه (تقسيمه بعد ١٫٧٫٠) — منقولٌ منه كما هو.
 */
import { type Doc, emptyDoc, paragraph } from '@shared/doc';

/** كتابٌ جديد: سطرٌ فارغ واحد — والبرنامج لا يزرع متنًا (المبدأ ١). */
export function blankLetter(): Doc {
  const doc = emptyDoc();
  doc.blocks = [paragraph([])];
  return doc;
}
