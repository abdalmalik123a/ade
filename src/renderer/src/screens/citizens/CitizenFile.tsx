/**
 * ملفّ الزبون المفتوح (تقسيم شاشة الزبائن بعد ١٫٧٫٠) — منقولٌ من `CitizensScreen` كما هو: رأسه وإجراءاته وخاناته، وفيه خزنة
 * المستمسكات (`AttachmentVault`) وكتبه الصادرة (`CitizenDocuments`). عرضٌ وحده: الحال والدوالّ تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { storeUrl, ALWAYS_SHOWN } from './shared';
import { count } from '@shared/arabic';
import { CITIZEN_FIELDS } from '@shared/citizenSchema';
import AttachmentVault from './AttachmentVault';
import CitizenDocuments from './CitizenDocuments';
import CitizenOrders from './CitizenOrders';
import type { CitizenDetail, Attachment, CitizenSummary } from '@shared/api';

type Props = {
  detail: CitizenDetail | null;
  setForm: Dispatch<SetStateAction<{ open: boolean; initial: CitizenDetail | null; }>>;
  onInsertIntoEditor: ((citizenId: number) => void) | undefined;
  busy: string | null;
  withBusy: <T>(key: string, fn: () => Promise<T>) => Promise<T | null>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  setConfirmDelete: Dispatch<SetStateAction<{ usage: number; } | null>>;
  confirmDelete: { usage: number; } | null;
  removeCitizen: () => Promise<void>;
  field: (v: string | null) => string;
  importAttachment: (docType: string) => Promise<void>;
  setCameraOpen: Dispatch<SetStateAction<boolean>>;
  setMultiOpen: Dispatch<SetStateAction<boolean>>;
  setUploadOpen: Dispatch<SetStateAction<boolean>>;
  setIdDuplexOpen: Dispatch<SetStateAction<boolean>>;
  setIdSheetOpen: Dispatch<SetStateAction<boolean>>;
  scan: (docType: string) => Promise<void>;
  setPreview: Dispatch<SetStateAction<Attachment | null>>;
  setDetail: Dispatch<SetStateAction<CitizenDetail | null>>;
  setDeskewAttachment: Dispatch<SetStateAction<Attachment | null>>;
  ocrReady: boolean;
  runOcr: (a: Attachment) => Promise<void>;
  readBack: (a: Attachment) => Promise<void>;
  reloadDetail: (id: number | null) => Promise<void>;
  reloadList: () => Promise<CitizenSummary[]>;
  onRepeatDocument: ((documentId: number) => void) | undefined;
  reprintDocument: (id: number) => Promise<void>;
};

export default function CitizenFile({ detail, setForm, onInsertIntoEditor, busy, withBusy, say, setConfirmDelete, confirmDelete, removeCitizen, field, importAttachment, setCameraOpen, setMultiOpen, setUploadOpen, setIdDuplexOpen, setIdSheetOpen, scan, setPreview, setDetail, setDeskewAttachment, ocrReady, runOcr, readBack, reloadDetail, reloadList, onRepeatDocument, reprintDocument }: Props) {
  return (
    <section className="surface-panel p-space-md flex flex-col gap-space-md">
      {detail === null ? (
        <div className="py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[44px]">badge</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">
            لم يُفتح أي ملف
          </span>
          <span className="font-label-md text-label-md">
            أضف ملف مواطن أو اختر واحدًا من الدليل
          </span>
          <button
            className="mt-space-sm px-space-lg h-9 btn-act font-label-md text-label-md font-semibold"
            type="button"
            onClick={() => setForm({ open: true, initial: null })}
          >
            + إضافة ملف مواطن
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-16 h-20 rounded-card bg-surface-container-high overflow-hidden flex items-center justify-center">
                {detail.photoPath ? (
                  <img
                    alt=""
                    className="w-full h-full object-cover"
                    src={storeUrl(detail.photoPath)}
                  />
                ) : (
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                    person
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-space-xs">
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  {detail.fullName}
                </h3>
                <div className="flex items-center gap-space-xs flex-wrap">
                  {detail.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-secondary font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      موثّق ومعتمد رسميًا
                    </span>
                  )}
                  {detail.category && (
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant">
                      {detail.category}
                    </span>
                  )}
                  {detail.employeeCode && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                      {detail.employeeCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-space-xs">
              <button
                className="flex items-center gap-space-xs px-space-md h-9 btn-act font-label-md text-label-md font-semibold transition-all"
                type="button"
                onClick={() => onInsertIntoEditor?.(detail.id)}
              >
                <span className="material-symbols-outlined text-[18px]">output</span>
                <span>إدراج في محرر الكتب</span>
              </button>
              <button
                className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md text-label-md transition-colors"
                data-act="fill-card"
                title="بطاقة التعبئة: نافذةٌ صغيرة فوق المتصفّح — الاسم مفرَّقًا والأرقام بصيغها، والنقر ينسخ"
                type="button"
                onClick={() => void window.diwan.fillCard.open(detail.id)}
              >
                <span className="material-symbols-outlined text-[18px]">content_paste</span>
                <span>بطاقة التعبئة</span>
              </button>
              <button
                className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                title="تعديل بيانات المواطن"
                type="button"
                onClick={() => setForm({ open: true, initial: detail })}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors disabled:opacity-40"
                title="تصدير السجل كملف Excel"
                type="button"
                disabled={busy === 'excel'}
                onClick={() =>
                  void withBusy('excel', async () => {
                    const path = await window.diwan.citizens.exportExcel(detail.id);
                    if (path) say('صُدّر سجل المواطن');
                  })
                }
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
              </button>
              <button
                className="w-9 h-9 rounded-btn bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
                title="حذف ملف المواطن"
                type="button"
                onClick={() =>
                  void (async () => {
                    const usage = await window.diwan.citizens.usage(detail.id);
                    setConfirmDelete({ usage });
                  })()
                }
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>

          {confirmDelete && (
            <div className="rounded-card bg-error-container p-space-md flex items-center justify-between gap-space-md">
              <span className="font-label-md text-label-md text-on-error-container">
                {confirmDelete.usage > 0
                  ? `صدر باسم هذا الزبون ${count(confirmDelete.usage, 'كتاب')}. حذف الملف يبقي الكتب في الأرشيف لكن يفكّ ارتباطها. تحذف؟`
                  : 'يُحذف الملف ومستمسكاته نهائيًا. تأكيد؟'}
              </span>
              <div className="flex items-center gap-space-xs shrink-0">
                <button
                  className="px-space-md h-9 rounded-btn bg-error text-on-error font-label-md text-label-md font-semibold"
                  type="button"
                  onClick={() => void removeCitizen()}
                >
                  نعم، احذف
                </button>
                <button
                  className="px-space-md h-9 rounded-btn bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                >
                  تراجع
                </button>
              </div>
            </div>
          )}

          {/* الحقول */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-space-sm">
            {/* الخانات الأساسية دائمًا، وخانات الاستمارات الحكومية حين تُملأ — فلا يمتلئ الملف فراغًا. */}
            {CITIZEN_FIELDS.filter((f) => f.key !== 'fullName')
              .map((f) => [f.label, (detail[f.key] as string | null | undefined) ?? null, f.key] as const)
              .filter(([, value, key]) => value || ALWAYS_SHOWN.has(key))
              .map(([label, value]) => (
              <div
                key={label}
                className="rounded-card bg-surface-container-low p-space-sm flex items-start justify-between gap-space-xs group"
              >
                <div className="flex flex-col gap-space-xs min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {label}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold break-words">
                    {field(value)}
                  </span>
                </div>
                {value && (
                  <button
                    className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
                    title="نسخ"
                    type="button"
                    onClick={() => {
                      void window.diwan.ui.copyText(value);
                      say('نُسخ إلى الحافظة');
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* خزنة المستمسكات */}
          <AttachmentVault
            detail={detail}
            busy={busy}
            importAttachment={importAttachment}
            setCameraOpen={setCameraOpen}
            setMultiOpen={setMultiOpen}
            withBusy={withBusy}
            say={say}
            setUploadOpen={setUploadOpen}
            setIdDuplexOpen={setIdDuplexOpen}
            setIdSheetOpen={setIdSheetOpen}
            scan={scan}
            setPreview={setPreview}
            setDetail={setDetail}
            setDeskewAttachment={setDeskewAttachment}
            ocrReady={ocrReady}
            runOcr={runOcr}
            readBack={readBack}
            reloadDetail={reloadDetail}
            reloadList={reloadList}
          />

          {/* كتب المواطن الصادرة */}
          <CitizenDocuments
            detail={detail}
            onRepeatDocument={onRepeatDocument}
            reprintDocument={reprintDocument}
          />
          <CitizenOrders key={detail.id} citizenId={detail.id} />
        </>
      )}
    </section>
  );
}
