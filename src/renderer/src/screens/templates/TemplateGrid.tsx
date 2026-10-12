/**
 * بطاقات النماذج في المكتبة (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { TemplateCard } from './TemplateCard';
import type { TemplateSummary } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';

type Props = {
  visible: TemplateSummary[];
  letterheads: Letterhead[];
  onOpenInEditor: ((templateId: number) => void) | undefined;
  openDesigner: (id: number | null) => Promise<void>;
  duplicateTemplate: (id: number, title: string) => Promise<void>;
  setZoomed: Dispatch<SetStateAction<TemplateSummary | null>>;
  exportOne: (id: number) => Promise<void>;
  removeTemplate: (id: number, title: string) => Promise<void>;
};

export default function TemplateGrid({ visible, letterheads, onOpenInEditor, openDesigner, duplicateTemplate, setZoomed, exportOne, removeTemplate }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
      {visible.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          letterheads={letterheads}
          onOpen={() => onOpenInEditor?.(t.id)}
          onEdit={() => void openDesigner(t.id)}
          onDuplicate={() => void duplicateTemplate(t.id, t.title)}
          onZoom={() => setZoomed(t)}
          onExport={() => void exportOne(t.id)}
          onDelete={() => void removeTemplate(t.id, t.title)}
        />
      ))}
    </div>
  );
}
