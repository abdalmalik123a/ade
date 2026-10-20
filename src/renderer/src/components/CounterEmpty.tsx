/**
 * الشبّاك بلا نموذجٍ يطابق (محادثة «الشبّاك واليوم الأوّل»، البند ٧، S16): مكتبٌ جديد مكتبته فارغة، أو بحثٌ لا يجد — فلا يبقى
 * سطرٌ بلا زرّ («المكتبة فارغة — استورد من «المكتبة»»): يُكتب الكتاب على ورقةٍ فارغة، أو تُستورد نماذج المكتب.
 * «اكتبه على ورقة فارغة» يفتح المحرّر بورقة بيضاء دون تقييده بكلمة البحث نوعًا للكتاب (S16).
 */
export default function CounterEmpty({ empty, onBlank, onImport }: { empty: boolean; onBlank: () => void; onImport: () => void }) {
  return (
    <div className="py-space-lg flex flex-col items-center gap-space-sm text-center" data-counter-empty={empty ? 'library' : 'search'}>
      <p className="font-body-md text-body-md text-on-surface-variant">
        {empty
          ? 'لا نماذج في المكتبة بعد — اكتب الكتاب على ورقةٍ فارغة، أو استورد ملفّات Word التي يعمل بها المكتب'
          : 'لا نموذج بهذا الاسم في المكتبة — اكتبه على ورقةٍ فارغة، أو استورده'}
      </p>
      <div className="flex flex-wrap justify-center gap-space-sm">
        <button
          className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5"
          data-act="counter-blank"
          type="button"
          onClick={onBlank}
        >
          <span className="material-symbols-outlined text-[18px]">edit_document</span>
          اكتبه على ورقة فارغة
        </button>
        <button
          className="h-10 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold flex items-center gap-1.5"
          data-act="counter-import"
          type="button"
          onClick={onImport}
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">upload_file</span>
          استورد نماذج
        </button>
      </div>
    </div>
  );
}
