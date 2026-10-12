/**
 * «ترويسة هذا الكتاب» — تحريرها في نافذة (تقسيم المحرّر بعد ١٫٧٫٠) — منقولةٌ من `EditorScreen` كما هي.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Modal } from '../EditorDialogs';
import LetterheadDesigner from '../../components/LetterheadDesigner';
import type { LetterheadLayout } from '@shared/letterhead';

type Props = {
  setDesignerOpen: Dispatch<SetStateAction<boolean>>;
  layout: LetterheadLayout;
  setLayout: Dispatch<SetStateAction<LetterheadLayout>>;
  setLayoutDirty: Dispatch<SetStateAction<boolean>>;
  dirty: MutableRefObject<boolean>;
};

export default function HeadDesignerModal({ setDesignerOpen, layout, setLayout, setLayoutDirty, dirty }: Props) {
  return (
    <Modal title="ترويسة هذا الكتاب" onClose={() => setDesignerOpen(false)}>
      <div className="max-h-[70vh] overflow-y-auto">
        <LetterheadDesigner
          layout={layout}
          onChange={(next) => {
            setLayout(next);
            setLayoutDirty(true);
            dirty.current = true;
          }}
          showPageOptions
        />
      </div>
      <div className="flex items-center justify-between pt-space-md">
        <span className="font-label-sm text-label-sm text-on-surface-variant">التعديل يخصّ هذا الكتاب. لإبقائه لكتب أخرى احفظه في المكتبة.</span>
        <button className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold" type="button" onClick={() => setDesignerOpen(false)}>
          تم
        </button>
      </div>
    </Modal>
  );
}
