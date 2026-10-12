/**
 * ورقة النموذج مصغّرةً بترويسته (تقسيم مكتبة النماذج بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي، وتأخذها البطاقة والمعاينة.
 */
import type { TemplateSummary } from '@shared/api';
import { type Letterhead, mmToPx, normalizeLayout } from '@shared/letterhead';
import LetterheadView from '../../components/LetterheadView';
import { renderBody } from '@shared/template';

/** معاينة الورقة داخل البطاقة — بنسبة A4 كما في التصميم (1 / 1.38). */
export function MiniSheet({
  template,
  letterhead,
  scale
}: {
  template: TemplateSummary;
  letterhead: Letterhead | null;
  scale: number;
}) {
  return (
    <div
      style={{
        paddingTop: mmToPx(letterhead?.layout.margins.top ?? 20) * scale,
        paddingRight: mmToPx(letterhead?.layout.margins.right ?? 20) * scale,
        paddingLeft: mmToPx(letterhead?.layout.margins.left ?? 20) * scale
      }}
    >
      {letterhead && (
        <div style={{ zoom: scale }}>
          <LetterheadView layout={normalizeLayout(letterhead.layout)} />
        </div>
      )}

      {template.subjectLine && (
        <div
          className="mt-3 text-center font-bold underline underline-offset-4 text-on-surface"
          style={{ fontSize: `${13 * scale}px` }}
        >
          م / {template.subjectLine}
        </div>
      )}

      <div
        className="mt-3 text-on-surface"
        style={{ fontSize: `${12.5 * scale}px`, lineHeight: 1.9, textAlign: 'justify' }}
        dangerouslySetInnerHTML={{ __html: renderBody(template.bodyHtml, {}) }}
      />
    </div>
  );
}
