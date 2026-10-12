/**
 * لوح المحرّر — ٤ «قبل الطبع» (تقسيمه بعد ١٫٧٫٠): ما يمنع وما ينبّه وما يُعلم، ولكلٍّ زرّه — والتدقيق الإملائي.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Doc } from '@shared/doc';
import { GENDER_KEY } from '@shared/gender';
import { fixDocSpelling, type SpellIssue } from '@shared/spelling';
import type { letterChecks } from '@shared/letterDraft';
import SpellingPanel from '../../components/SpellingPanel';
import { section, title } from './panelUi';

type Props = {
  checks: ReturnType<typeof letterChecks>;
  ownerHints: string[];
  takeOwner: (name: string) => void;
  setSpellOpen: Dispatch<SetStateAction<boolean>>;
  setGenderByHand: Dispatch<SetStateAction<boolean>>;
  setValue: (key: string, value: string) => void;
  spellOpen: boolean;
  spelling: SpellIssue[];
  setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
};

export default function ChecksSection({
  checks,
  ownerHints,
  takeOwner,
  setSpellOpen,
  setGenderByHand,
  setValue,
  spellOpen,
  spelling,
  setDoc
}: Props) {
  return (
    <section className={section} data-checks="">
      {title('fact_check', 'قبل الطبع')}
      <ul className="flex flex-col gap-1">
        {checks.map((c, i) => (
          <li
            key={i}
            className={`flex items-start gap-1 font-label-sm text-label-sm ${
              c.level === 'block' ? 'text-error' : c.level === 'warn' ? 'text-on-surface' : 'text-on-surface-variant'
            }`}
            data-check={c.level}
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">
              {c.level === 'block' ? 'block' : c.level === 'warn' ? 'warning' : 'info'}
            </span>
            <span className="flex-1">{c.text}</span>
            {c.act === 'owner' && ownerHints[0] && (
              <button className="text-secondary font-semibold hover:underline" data-act="owner-from-letter" type="button" onClick={() => takeOwner(ownerHints[0]!)}>
                «{ownerHints[0]}»
              </button>
            )}
            {c.act === 'spelling' && (
              <button className="text-secondary font-semibold hover:underline" type="button" onClick={() => setSpellOpen(true)}>
                راجعه
              </button>
            )}
            {c.act === 'gender' &&
              (['ذكر', 'أنثى'] as const).map((g) => (
                <button
                  key={g}
                  className="text-secondary font-semibold hover:underline"
                  data-gender-choose={g}
                  type="button"
                  onClick={() => {
                    setGenderByHand(true);
                    setValue(GENDER_KEY, g);
                  }}
                >
                  {g}
                </button>
              ))}
          </li>
        ))}
      </ul>
      {spellOpen && spelling.length > 0 && (
        <SpellingPanel
          issues={spelling}
          note="اقتراحاتٌ على نصّ الكتاب — اختر ما تريد، والحقول لا تُمسّ"
          onFix={(chosen) => {
            setDoc((d) => fixDocSpelling(d, chosen));
            setSpellOpen(false);
          }}
        />
      )}
    </section>
  );
}
