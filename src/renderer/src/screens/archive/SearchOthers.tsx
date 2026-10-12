/**
 * البحث الشامل: ما ليس كتابًا — المواطنون والنماذج ونصّ المستمسكات (تقسيم الأرشيف بعد ١٫٧٫٠) — منقولٌ من `ArchiveScreen` كما هو.
 */
import { HitList, HitButton } from '../ArchiveHits';
import type { SearchHits } from '@shared/api';

type Props = {
  hits: SearchHits | null;
  onOpenCitizen: ((citizenId: number) => void) | undefined;
  onOpenTemplate: ((templateId: number) => void) | undefined;
};

export default function SearchOthers({ hits, onOpenCitizen, onOpenTemplate }: Props) {
  return (
    <section className="grid md:grid-cols-3 gap-space-sm" data-search-others="">
      <HitList title="المواطنون" icon="badge" empty="لا مواطن">
        {hits!.citizens.map((c) => (
          <HitButton key={c.id} act="open-citizen" onClick={() => onOpenCitizen?.(c.id)} title={c.fullName} sub={c.nationalId ?? c.jobTitle ?? ''} />
        ))}
      </HitList>
      <HitList title="النماذج" icon="description" empty="لا نموذج">
        {hits!.templates.map((t) => (
          <HitButton key={t.id} act="open-template" onClick={() => onOpenTemplate?.(t.id)} title={t.title} sub={t.category ?? ''} />
        ))}
      </HitList>
      <HitList title="نصّ المستمسكات" icon="id_card" empty="لا مستمسك">
        {hits!.attachments.map((a) => (
          <HitButton key={a.id} act="open-attachment" onClick={() => onOpenCitizen?.(a.citizenId)} title={`${a.docType} — ${a.citizenName}`} sub={a.snippet} />
        ))}
      </HitList>
    </section>
  );
}
