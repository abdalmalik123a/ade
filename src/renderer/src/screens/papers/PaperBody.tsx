/**
 * متن ورقة الأسئلة (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PapersScreen` كما هو: ضبط المتن، وشجرة الأسئلة، وبنك الأسئلة، وورقة
 * الإجابة الآلية.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { Numerals, Dir, ListItem } from '@shared/doc';
import { NUM_INPUT, freshCopy } from './shared';
import { QuestionNode } from './QuestionNode';
import QuestionBankPanel from '../../components/QuestionBankPanel';
import { textOf } from '../papersTree';
import OmrPanel from '../../components/OmrPanel';
import type { OmrSpec } from '@shared/omr';

type Props = {
  numerals: Numerals;
  setNumerals: Dispatch<SetStateAction<Numerals>>;
  dir: Dir;
  setDir: Dispatch<SetStateAction<Dir>>;
  pick: number | undefined;
  setPick: Dispatch<SetStateAction<number | undefined>>;
  items: ListItem[];
  answers: boolean;
  patchItem: (id: string, patch: Partial<ListItem>) => void;
  branch: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string, step: -1 | 1) => void;
  saveToBank: (item: ListItem) => void;
  focused: MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  addQuestion: () => void;
  setBankOpen: Dispatch<SetStateAction<boolean>>;
  bankOpen: boolean;
  head: Record<string, string>;
  bankTick: number;
  setItems: Dispatch<SetStateAction<ListItem[]>>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  secondRoundPaper: () => Promise<void>;
  setOmrOpen: Dispatch<SetStateAction<boolean>>;
  omrOpen: boolean;
  omrEpoch: number;
  omr: OmrSpec;
  title: string;
  setOmr: Dispatch<SetStateAction<OmrSpec>>;
};

export default function PaperBody({ numerals, setNumerals, dir, setDir, pick, setPick, items, answers, patchItem, branch, remove, move, saveToBank, focused, addQuestion, setBankOpen, bankOpen, head, bankTick, setItems, say, secondRoundPaper, setOmrOpen, omrOpen, omrEpoch, omr, title, setOmr }: Props) {
  return (
    <div className="space-y-space-sm">
      {/* ضبطُ المتن حيث يُكتب المتن — لا في شريط المعاينة. */}
      <div className="flex items-center gap-space-sm flex-wrap">
        <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">الأسئلة</h2>
        <div className="flex-1" />
        <select
          className="h-8 px-space-sm rounded-field bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm text-on-surface"
          title="أرقام الترقيم"
          value={numerals}
          onChange={(e) => setNumerals(e.target.value as Numerals)}
        >
          <option value="arabic">1 2 3</option>
          <option value="indic">١ ٢ ٣</option>
        </select>
        <select
          className="h-8 px-space-sm rounded-field bg-surface-container-lowest border border-outline-variant font-label-sm text-label-sm text-on-surface"
          title="اتجاه المتن"
          value={dir}
          onChange={(e) => setDir(e.target.value as Dir)}
        >
          <option value="rtl">من اليمين</option>
          <option value="ltr">من اليسار</option>
        </select>
        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
          أجب عن
          <input
            className={NUM_INPUT}
            inputMode="numeric"
            title="أجب عن ن أسئلة فقط"
            value={pick ?? ''}
            placeholder="الكل"
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '');
              setPick(raw === '' ? undefined : Number(raw));
            }}
          />
          أسئلة فقط
        </label>
      </div>

      <div className="space-y-space-sm">
        {items.map((item, i) => (
          <QuestionNode
            key={item.id}
            item={item}
            index={i}
            depth={0}
            dir={dir}
            numerals={numerals}
            answers={answers}
            onPatch={patchItem}
            onBranch={branch}
            onRemove={remove}
            onMove={move}
            onBank={saveToBank}
            onFocusInput={(el) => (focused.current = el)}
          />
        ))}
      </div>

      <button
        className="w-full h-11 btn-act font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5"
        type="button"
        onClick={addQuestion}
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        أضف سؤالًا
      </button>
      <button
        className="w-full h-10 rounded-card bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
        data-act="bank-open"
        type="button"
        onClick={() => setBankOpen((o) => !o)}
      >
        <span className="material-symbols-outlined text-[18px] text-secondary">inventory_2</span>
        {bankOpen ? 'أخفِ بنك الأسئلة' : 'أدرج من بنك الأسئلة'}
      </button>
      {bankOpen && (
        <QuestionBankPanel
          grade={head['الصف'] ?? ''}
          refreshKey={bankTick}
          subject={head['المادة'] ?? ''}
          onClose={() => setBankOpen(false)}
          onInsert={(q) => {
            const fresh = freshCopy(q.item);
            // ورقةٌ فيها سؤالٌ واحد فارغ (البداية): يحلّ المُدرَج محلّه.
            setItems((prev) => (prev.length === 1 && !textOf(prev[0]!.inlines).trim() && !prev[0]!.items?.length ? [fresh] : [...prev, fresh]));
            void window.diwan.bank.used(q.id);
            say('أُدرج السؤال في آخر الورقة');
          }}
        />
      )}
      <button
        className="w-full h-10 rounded-card bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
        data-act="second-round"
        title="ورقةٌ بالبنية نفسها من أسئلة البنك التي لم تُطبع في هذا الدور"
        type="button"
        onClick={() => void secondRoundPaper()}
      >
        <span className="material-symbols-outlined text-[18px] text-secondary">autorenew</span>
        ورقة الدور الثاني من البنك
      </button>
      <button
        className="w-full h-10 rounded-card bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5"
        data-act="omr-open"
        type="button"
        onClick={() => setOmrOpen((o) => !o)}
      >
        <span className="material-symbols-outlined text-[18px] text-secondary">checklist</span>
        {omrOpen ? 'أخفِ تصحيح الدوائر' : 'ورقة إجابة بالدوائر وتصحيحها'}
      </button>
      {omrOpen && (
        <OmrPanel
          key={omrEpoch}
          lines={[head['المدرسة'], head['الدور']].map((l) => l?.trim() ?? '').filter(Boolean)}
          spec={omr}
          title={title}
          onSay={say}
          onSpec={setOmr}
        />
      )}
    </div>
  );
}
