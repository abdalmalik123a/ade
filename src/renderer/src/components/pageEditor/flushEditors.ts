/**
 * ما كُتب في المحرّر ولم يُرسل بعد (D143): D122 يؤجّل إرسال الوثيقة ٢٥٠ م.ث أثناء الكتابة (`scheduleEmit` في `usePmEditor.ts`)
 * ولا يستعجله إلا ترك التركيز — وCtrl+S والحفظ عند المغادرة والإغلاق لا تتركه، فكان المحفوظ بلا آخر تعديل
 * (`bookEditor`: أوزان الأعمدة بعد السحب حُفظت [1,1,1]). فكلّ محرّرٍ مفتوح يسجّل هنا استعجاله، و`flushEditors()` الطريق الواحد
 * لمن يقرأ الوثيقة من خارجه (`latestDoc` في `useEditorDocument.ts`) — والكتابة نفسها تبقى مؤجَّلة.
 */
const editors = new Set<() => void>();

/** يُسجَّل استعجال المحرّر، ويعود ما يلغي تسجيله (حين يُفكّ). */
export function registerEditor(flush: () => void): () => void {
  editors.add(flush);
  return () => {
    editors.delete(flush);
  };
}

/** كلّ محرّرٍ مفتوح يرسل ما عنده الآن — فيصل إلى الوثيقة قبل أن تُقرأ. */
export function flushEditors(): void {
  for (const flush of [...editors]) flush();
}
