/**
 * نوافذ الشبّاك (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `ServiceScreen` كما هي: الزبون من السجلّ، والمدرسة، وأسماء الدمج من الزبائن،
 * والجنس قبل طباعة الدفعة، ورسالة واتساب تتوزّع على الحقول، وورقة المستمسكات.
 */
import type { Dispatch, SetStateAction } from 'react';
import { CitizenPicker, SchoolPicker } from '../ServicePickers';
import CitizenMultiPicker from '../../components/CitizenMultiPicker';
import { count } from '@shared/arabic';
import GenderReview from '../../components/GenderReview';
import WhatsAppPasteDialog from '../WhatsAppPasteDialog';
import { valuesFromMessage } from '@shared/whatsappParser';
import IdSheetDialog from '../../components/IdSheetDialog';
import type { Attachment } from '@shared/api';
import type { Client } from '@shared/orders';
import type { Toast, ToastAction } from '../../kit/useToast';
import type { LearnedGenders, Gender } from '@shared/gender';
import type { DocField } from '@shared/doc';

type Props = {
  picker: boolean;
  setPicker: Dispatch<SetStateAction<boolean>>;
  applyCitizen: (id: number) => Promise<void>;
  schoolPicker: boolean;
  schools: Client[];
  setSchoolPicker: Dispatch<SetStateAction<boolean>>;
  fillFromSchool: (school: Client, base?: Record<string, string>, filled?: Record<string, string>) => void;
  schoolOn: boolean;
  mergePicker: boolean;
  setMergePicker: Dispatch<SetStateAction<boolean>>;
  rows: string[];
  setNames: Dispatch<SetStateAction<string>>;
  say: (text: string, tone?: Toast['tone'], action?: ToastAction, opts?: { sticky?: boolean; }) => void;
  genderReview: { names: string[]; print: boolean; } | null;
  learned: LearnedGenders;
  setGenderReview: Dispatch<SetStateAction<{ names: string[]; print: boolean; } | null>>;
  remember: (answers: { name: string; gender: Gender; }[]) => void;
  issueMerged: (print: boolean, decided?: Record<string, Gender>) => Promise<void>;
  pasteOpen: boolean;
  setPasteOpen: Dispatch<SetStateAction<boolean>>;
  fields: DocField[];
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  idSheet: { name: string; attachments: Attachment[]; } | null;
  setIdSheet: Dispatch<SetStateAction<{ name: string; attachments: Attachment[]; } | null>>;
};

export default function CounterDialogs({ picker, setPicker, applyCitizen, schoolPicker, schools, setSchoolPicker, fillFromSchool, schoolOn, mergePicker, setMergePicker, rows, setNames, say, genderReview, learned, setGenderReview, remember, issueMerged, pasteOpen, setPasteOpen, fields, values, setValues, idSheet, setIdSheet }: Props) {
  return (
    <>
      {picker && <CitizenPicker onClose={() => setPicker(false)} onPick={(id) => void applyCitizen(id)} />}
      {schoolPicker && <SchoolPicker schools={schools} onClose={() => setSchoolPicker(false)} onPick={(s) => fillFromSchool(s)} />}
      {schoolOn && (
        <datalist id="diwan-schools">
          {schools.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      )}

      {mergePicker && (
        <CitizenMultiPicker
          confirmLabel="أضفهم إلى القائمة"
          title="قائمة الدمج من الزبائن — ورقةٌ لكلّ اسم"
          onClose={() => setMergePicker(false)}
          onPick={(ids) => {
            setMergePicker(false);
            void window.diwan.citizens.records(ids).then((records) => {
              const have = new Set(rows);
              const added = records.map((r) => r.fullName.trim()).filter((n) => n && !have.has(n));
              setNames((prev) => [prev.trim(), ...added].filter(Boolean).join('\n'));
              say(`أُضيف من الزبائن ${count(added.length, 'اسم')}`);
            });
          }}
        />
      )}

      {genderReview && (
        <GenderReview
          learned={learned}
          names={genderReview.names}
          onCancel={() => setGenderReview(null)}
          onDone={(decisions) => {
            const print = genderReview.print;
            setGenderReview(null);
            remember(Object.entries(decisions).map(([name, gender]) => ({ name, gender })));
            void issueMerged(print, decisions);
          }}
        />
      )}

      <WhatsAppPasteDialog
        isOpen={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={(extracted) => {
          const filled = valuesFromMessage(fields, extracted, values);
          const n = Object.keys(filled).length;
          setValues((prev) => ({ ...prev, ...filled }));
          setPasteOpen(false);
          say(n ? `مُلئ من الرسالة ${count(n, 'حقل')} — راجعها قبل الطباعة` : 'لم يطابق شيءٌ من الرسالة حقول هذه الأوراق', n ? 'ok' : 'warn');
        }}
      />

      {idSheet && <IdSheetDialog citizenName={idSheet.name} attachments={idSheet.attachments} onClose={() => setIdSheet(null)} />}
    </>
  );
}
