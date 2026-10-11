/**
 * ما يُفتح فوق المحرّر: معاينة الأوراق بخياراتها قبل الطباعة وPDF، واختيار أصحاب الدفعة من سجلّ الزبائن، وحقول طبقات
 * Photoshop المقترحة، وحسم جنس الأسماء غير المعروفة.
 */
import { fieldRef } from '@shared/doc';
import { rowFromCitizen, rowsToTsv } from '@shared/citizenFields';
import SheetsPreview from '../SheetsPreview';
import PrintOptions from '../PrintOptions';
import LayerFieldsReview from '../LayerFieldsReview';
import CitizenMultiPicker from '../../components/CitizenMultiPicker';
import GenderReview from '../../components/GenderReview';
import type { DesignEditor } from './useDesignEditor';
import { count } from '@shared/arabic';

export default function DesignModals({ ed }: { ed: DesignEditor }) {
  const { doc, imageKeys, say, canvas, unsureBatch } = ed;
  return (
    <>
      {ed.sheetsOpen && (
        <SheetsPreview
          busy={ed.busy}
          cards={ed.items.length}
          duplex={Boolean(ed.effectiveBackDoc)}
          issues={ed.issues}
          options={
            <>
              <PrintOptions
                columns={ed.batchColumns}
                groupCol={ed.groupCol}
                imp={ed.imp}
                pickText={ed.pickText}
                picked={ed.picked}
                startSlot={ed.startSlot}
                total={ed.cards.length}
                onGroupCol={ed.setGroupCol}
                onPickText={ed.setPickText}
                onStartSlot={ed.setStartSlot}
              />
              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface cursor-pointer" title="للـPDF وحده — الطباعة بلا علامة">
                <input checked={ed.previewMark} className="w-3.5 h-3.5 accent-secondary" data-act="preview-watermark" type="checkbox" onChange={(e) => ed.setPreviewMark(e.target.checked)} />
                PDF معاينةٍ للزبون: «معاينة — ليست للطباعة»
              </label>
            </>
          }
          pages={ed.pages}
          sheet={ed.imp.sheet}
          onClose={() => ed.setSheetsOpen(false)}
          onPdf={() => (unsureBatch.length ? ed.setGenderReview('pdf') : void ed.savePdf())}
          onPrint={() => (unsureBatch.length ? ed.setGenderReview('print') : void ed.print())}
        />
      )}

      {ed.registryOpen && (
        <CitizenMultiPicker
          confirmLabel="اجعلهم قائمة الدفعة"
          title="هويّات الموظفين من الزبائن — اختر أصحابها"
          onClose={() => ed.setRegistryOpen(false)}
          onPick={(ids) => {
            ed.setRegistryOpen(false);
            void (async () => {
              const records = await window.diwan.citizens.records(ids);
              // بياناتهم من ملفّاتهم بمعنى كلّ حقل، والنصّ يمرّ بقراءة الدفعة نفسها (والربط اليدوي).
              const textFields = doc.fields.filter((f) => !imageKeys.includes(f.key));
              const rows = records.map((r) => rowFromCitizen(r, textFields));
              const keys = textFields.map((f) => f.key).filter((k) => rows.some((r) => r[k]));
              ed.setBatchSeed(rowsToTsv(keys, rows));
              // وصورهم من ملفّاتهم إن كانت — وإلا فالاستوديو يلتقطها بالدور.
              ed.setBatchPhotos(records.filter((r) => r.photoPath).map((r) => ({ name: r.fullName, src: r.photoPath! })));
              ed.setBatchKey((k) => k + 1);
              const noPhoto = records.filter((r) => !r.photoPath).length;
              say(`${count(records.length, 'موظف')} من الزبائن${noPhoto && imageKeys.length ? ` — ${noPhoto} بلا صورة: التقطها في الاستوديو` : ''}`);
            })();
          }}
        />
      )}

      {ed.layerReview && (
        <LayerFieldsReview
          suggestions={ed.layerReview}
          onClose={() => ed.setLayerReview(null)}
          onApply={(chosen) => {
            ed.setLayerReview(null);
            const byId = new Map(chosen.map((c) => [c.elementId, c]));
            ed.apply({
              ...canvas,
              elements: canvas.elements.map((el) => (el.kind === 'text' && byId.has(el.id) ? { ...el, inlines: [fieldRef(byId.get(el.id)!.key)] } : el))
            });
            // النصّ النموذجيّ قيمةٌ للمعاينة: يُرى القالب كما كان، والحقل يُملأ لكلّ بطاقة.
            ed.setValues((v) => ({ ...Object.fromEntries(chosen.map((c) => [c.key, c.sample])), ...v }));
            say(`صارت ${chosen.length} طبقةً حقولًا تُملأ لكلّ بطاقة`);
          }}
        />
      )}

      {ed.genderReview && (
        <GenderReview
          learned={ed.learned}
          names={unsureBatch}
          onCancel={() => ed.setGenderReview(null)}
          onDone={(decisions) => {
            ed.remember(Object.entries(decisions).map(([name, gender]) => ({ name, gender })));
            ed.setGenderDecisions((prev) => ({ ...prev, ...decisions }));
            ed.setAfterReview(ed.genderReview);
            ed.setGenderReview(null);
          }}
        />
      )}
    </>
  );
}
