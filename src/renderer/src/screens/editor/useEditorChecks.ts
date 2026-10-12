/**
 * «قبل الطبع» في المحرّر (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو: الإملاء، وما يمنع وما ينبّه وما يُعلم.
 */
import { useMemo } from 'react';
import { docSpelling } from '@shared/spelling';
import { letterChecks, type Registry } from '@shared/letterDraft';
import { asksLetterNumber, type LetterheadLayout } from '@shared/letterhead';
import { guessGender } from '@shared/gender';
import type { Doc } from '@shared/doc';
import type { LearnedGenders } from '@shared/gender';

export function useEditorChecks(
  ctx: {
    doc: Doc;
    effective: Record<string, string>;
    ownerName: string;
    headLayout: LetterheadLayout | null;
    registry: Registry;
    measure: { headRatio: number | null; pages: number | null; };
    needsGender: boolean;
    genderByHand: boolean;
    learned: LearnedGenders;
  }
) {
  const { doc, effective, ownerName, headLayout, registry, measure, needsGender, genderByHand, learned } = ctx;

  const spelling = useMemo(() => docSpelling(doc), [doc]);
  const checks = useMemo(
    () =>
      letterChecks({
        doc,
        values: effective,
        owner: ownerName,
        spelling: spelling.length,
        registryPrinted: asksLetterNumber(headLayout),
        number: registry.number,
        headRatio: measure.headRatio,
        pages: measure.pages,
        genderUnsure: needsGender && !genderByHand && ownerName && guessGender(ownerName, learned)?.sure === false
          ? ownerName.trim().split(/\s+/)[0] ?? ownerName
          : null
      }),
    [doc, effective, ownerName, spelling.length, headLayout, registry.number, measure, needsGender, genderByHand, learned]
  );
  const blocked = checks.some((c) => c.level === 'block');

  return { checks, spelling, blocked };
}
