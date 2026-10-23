/**
 * ما كُتب في المحرّر ولم يُرسل بعد (D143): D122 يؤجّل إرسال الوثيقة ٢٥٠ م.ث أثناء الكتابة (`scheduleEmit` في `usePmEditor.ts`)
 * ولا يستعجله إلا ترك التركيز — وCtrl+S والحفظ عند المغادرة والإغلاق لا تتركه، فكان المحفوظ بلا آخر تعديل
 * (`bookEditor`: أوزان الأعمدة بعد السحب حُفظت [1,1,1]). فكلّ محرّرٍ مفتوح يسجّل هنا استعجاله، و`flushEditors()` الطريق الواحد
 * لمن يقرأ الوثيقة من خارجه (`latestDoc` في `useEditorDocument.ts`) — والكتابة نفسها تبقى مؤجَّلة.
 */
type Editor = {
  /** يرسل ما عنده الآن. */
  flush: () => void;
  /** أعنده ما لم يُرسل بعد؟ */
  pending: () => boolean;
};

const editors = new Set<Editor>();

/** يُسجَّل المحرّر، ويعود ما يلغي تسجيله (حين يُفكّ). */
export function registerEditor(editor: Editor): () => void {
  editors.add(editor);
  return () => {
    editors.delete(editor);
  };
}

/** كلّ محرّرٍ مفتوح يرسل ما عنده الآن — فيصل إلى الوثيقة قبل أن تُقرأ. */
export function flushEditors(): void {
  for (const editor of [...editors]) editor.flush();
}

/**
 * أعند محرّرٍ مفتوح كتابةٌ لم تُرسل؟ — فالحفظ التلقائي ينتظرها ولا يستعجلها: الاستعجال في وسط الكتابة يحوّل الوثيقة كلّها في حرفٍ واحد
 * (أبطأ حرفٍ في وثيقة ١٣٣ صفحة صار ٢٢٩ م.ث بعد ٦١ — `measure.mjs`)، والمحرّر يرسلها بعد ٢٥٠ م.ث فيُعاد موعد الحفظ.
 */
export function editorsPending(): boolean {
  return [...editors].some((editor) => editor.pending());
}
