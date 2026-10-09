/**
 * «خطوط ديوان» في الواجهة (DESIGNS.md ٠٫٧): المستورد يُحمَّل عند الإقلاع وتُحقن قواعد `@font-face` له، فتُرسم به الورقة
 * كالمحزوم؛ ومن يعرض قائمة خطوطٍ يأخذها من هنا (`useLibraryFonts`) — قائمةٌ واحدة للبرنامج كلّه.
 * ونافذة الإخراج لا جسر فيها: العملية الرئيسة تحقن القواعد نفسها هناك (`services/render.ts`).
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { MarkType, Node as PmNode } from 'prosemirror-model';
import { fontFaceCss, libraryFonts, type ImportedFace, type LibraryFont } from '@shared/fonts';

let faces: ImportedFace[] = [];
const listeners = new Set<() => void>();

/** يحمّل المستورد ويحقن قواعده — عند الإقلاع وبعد كلّ استيرادٍ أو حذف. */
export async function loadFonts(): Promise<void> {
  try {
    faces = await window.diwan.fonts.list();
  } catch {
    faces = [];
  }
  let style = document.getElementById('diwan-fonts') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'diwan-fonts';
    document.head.appendChild(style);
  }
  style.textContent = fontFaceCss(faces);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** الوجوه المستوردة كما حُمّلت. */
export function useImportedFaces(): ImportedFace[] {
  return useSyncExternalStore(subscribe, () => faces);
}

/** خطوط ورقةٍ في محرّر ProseMirror: عائلات علامة الخطّ أينما وقعت — فيُقال الغائب منها وإن لم يكن تحت المؤشّر. */
export function fontsIn(doc: PmNode, type: MarkType): string[] {
  const out = new Set<string>();
  doc.descendants((node) => {
    for (const mark of node.marks) if (mark.type === type && typeof mark.attrs['family'] === 'string') out.add(mark.attrs['family'] as string);
  });
  return [...out];
}

/** المكتبة كلّها: المحزوم ثم المستورد. */
export function useLibraryFonts(): LibraryFont[] {
  const imported = useImportedFaces();
  return useMemo(() => libraryFonts(imported), [imported]);
}
