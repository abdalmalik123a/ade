/**
 * تحرير شجرة الأسئلة (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: تعديل السؤال، وفروعه، وحذفه، وترتيبه، وحفظه في البنك،
 * وسؤالٌ جديد، والرمز حيث المؤشّر.
 */
import { useCallback, useState } from 'react';
import type { ListItem } from '@shared/doc';
import { mapTree, moveIn } from '../papersTree';
import { newQuestion } from '@shared/examPaper';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

export function usePaperTree(
  ctx: {
    setItems: Dispatch<SetStateAction<ListItem[]>>;
    head: Record<string, string>;
    say: (text: string, tone?: 'ok' | 'warn') => void;
    focused: MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  }
) {
  const { setItems, head, say, focused } = ctx;

  const patchItem = useCallback((id: string, patch: Partial<ListItem>) => {
    setItems((prev) => mapTree(prev, id, (it) => ({ ...it, ...patch })));
  }, []);

  const branch = useCallback((id: string) => {
    setItems((prev) =>
      mapTree(prev, id, (it) => ({
        ...it,
        items: [...(it.items ?? []), newQuestion()]
      }))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = mapTree(prev, id, () => null);
      // لا تبقى ورقةٌ بلا سؤال — وإلا اختفى المؤلِّف ولا سبيل إلى إعادته.
      return next.length ? next : [newQuestion()];
    });
  }, []);

  const move = useCallback((id: string, step: -1 | 1) => {
    setItems((prev) => moveIn(prev, id, step));
  }, []);

  /** بنك الأسئلة: يُحفظ السؤال بمادة الورقة وصفّها، ويُدرج منه بنسخةٍ جديدة. */
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTick, setBankTick] = useState(0);
  const saveToBank = useCallback(
    (item: ListItem) => {
      void window.diwan.bank
        .save({ item, subject: head['المادة'] || null, grade: head['الصف'] || null })
        .then(() => {
          setBankTick((t) => t + 1);
          say(`حُفظ في بنك الأسئلة${head['المادة'] ? ` — ${head['المادة']}` : ''}`);
        })
        .catch((e: unknown) => say(e instanceof Error ? e.message : 'تعذّر الحفظ في البنك', 'warn'));
    },
    [head, say]
  );

  const addQuestion = useCallback(() => {
    const fresh = newQuestion();
    setItems((prev) => [...prev, fresh]);
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-question-text="${fresh.id}"]`)?.focus();
    }, 0);
  }, []);

  /** الرمز يُدرج عند المؤشّر في آخر خانةٍ لمسها المدرّس — لا في آخر السطر. */
  const insertSymbol = useCallback(
    (sym: string) => {
      const el = focused.current;
      if (!el) {
        say('المس خانة السؤال أولًا ثم اختر الرمز', 'warn');
        return;
      }
      const at = el.selectionStart ?? el.value.length;
      const to = el.selectionEnd ?? at;
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(el, el.value.slice(0, at) + sym + el.value.slice(to));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
      el.selectionStart = el.selectionEnd = at + sym.length;
    },
    [say]
  );

  return { patchItem, branch, remove, move, saveToBank, addQuestion, setBankOpen, bankOpen, bankTick, insertSymbol };
}
