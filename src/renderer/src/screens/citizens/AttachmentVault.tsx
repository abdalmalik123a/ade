/**
 * خزنة المستمسكات في ملفّ الزبون (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `CitizensScreen` كما هي: المسح والاستيراد والكاميرا
 * وعدّة بطاقات، والقراءة وظهر البطاقة، والمعاينة والطباعة والنسخ والتصدير. عرضٌ وحده: الحال والدوالّ تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count } from '@shared/arabic';
import { storeUrl } from './shared';
import { IconBtn } from '../CitizenBits';
import { choosePrinter } from '../../lib/printChoice';
import { confirmAction } from '../../kit/ask';
import type { CitizenDetail, Attachment, CitizenSummary } from '@shared/api';

type Props = {
  detail: CitizenDetail;
  busy: string | null;
  importAttachment: (docType: string) => Promise<void>;
  setCameraOpen: Dispatch<SetStateAction<boolean>>;
  setMultiOpen: Dispatch<SetStateAction<boolean>>;
  withBusy: <T>(key: string, fn: () => Promise<T>) => Promise<T | null>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
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
};

export default function AttachmentVault({ detail, busy, importAttachment, setCameraOpen, setMultiOpen, withBusy, say, setUploadOpen, setIdDuplexOpen, setIdSheetOpen, scan, setPreview, setDetail, setDeskewAttachment, ocrReady, runOcr, readBack, reloadDetail, reloadList }: Props) {
  return (
    <div className="flex flex-col gap-space-sm pt-space-xs">
      <div className="flex items-center justify-between flex-wrap gap-space-sm">
        <div className="flex flex-col">
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            خزنة المستمسكات الرسمية الممسوحة ضوئياً
          </h4>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {detail.attachments.length === 0
              ? 'لا مستمسكات لهذا الملف'
              : `${count(detail.attachments.length, 'وثيقة')} في ملفّه`}
          </span>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
            type="button"
            disabled={busy === 'import'}
            onClick={() => void importAttachment('')}
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>افتح ملفًّا</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            data-act="camera-attachment"
            title="صوّر المستمسك بكاميرا الحاسوب — ثم يُسوّى ويُقوَّم كالمسح"
            type="button"
            onClick={() => setCameraOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            <span>التقط بالكاميرا</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            data-act="multi-card"
            title="عدّة بطاقاتٍ على الزجاج معًا: تُعرف كلٌّ وتُقصّ، ويُطابَق ظهرها بوجهها"
            type="button"
            onClick={() => setMultiOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">view_module</span>
            <span>عدّة بطاقات بمسحة</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
            type="button"
            disabled={detail.attachments.length === 0 || busy === 'zip'}
            onClick={() =>
              void withBusy('zip', async () => {
                const r = await window.diwan.attachments.exportZip(detail.id);
                if (r) say(r.message);
              })
            }
          >
            <span className="material-symbols-outlined text-[18px]">photo_library</span>
            <span>تصدير الكل ZIP</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-btn bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md disabled:opacity-40"
            data-act="upload-export"
            title="كلّ مستمسكٍ صورةٌ بحدّ خانة الرفع — مرقّمةٌ بترتيب الاستمارة"
            type="button"
            disabled={detail.attachments.length === 0}
            onClick={() => setUploadOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>صدّر للرفع</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 btn-soft font-label-md text-label-md transition-all shadow-low"
            type="button"
            title="مستمسكات الزبون بوجهيها بمقاسها الحقيقي"
            onClick={() => setIdDuplexOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>استنساخ هوية</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 btn-soft font-label-md text-label-md transition-all shadow-low"
            data-act="citizen-id-sheet"
            type="button"
            title="مستمسكات الزبون كلّها بمقاسها الحقيقي على ورقة A4 واحدة"
            onClick={() => setIdSheetOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            <span>ورقة مستمسكاته</span>
          </button>
          <button
            className="flex items-center gap-space-xs px-space-md h-9 btn-act font-label-md text-label-md font-semibold transition-all disabled:opacity-40"
            type="button"
            disabled={busy === 'scan'}
            onClick={() => void scan('')}
          >
            <span className="material-symbols-outlined text-[18px]">
              {busy === 'scan' ? 'hourglass_top' : 'scanner'}
            </span>
            <span>{busy === 'scan' ? 'جارٍ المسح...' : 'مسح ضوئي فوري'}</span>
          </button>
        </div>
      </div>

      {detail.attachments.length === 0 ? (
        <div className="py-space-lg rounded-card border border-dashed border-outline-variant flex flex-col items-center gap-space-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
          <span className="font-label-md text-label-md">
            امسح المستمسك ضوئيًا أو استورده من الحاسوب
          </span>
          <span className="font-label-sm text-label-sm">
            يُحفظ داخل التطبيق ببصمة SHA-256
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
          {detail.attachments.map((a) => (
            <div
              key={a.id}
              className="rounded-card bg-surface-container-low overflow-hidden flex flex-col"
            >
              <button
                className="w-full aspect-[1.6/1] bg-surface-container-high overflow-hidden"
                type="button"
                title="معاينة بكامل الشاشة"
                onClick={() => setPreview(a)}
              >
                <img
                  alt={a.docType}
                  className="w-full h-full object-cover"
                  src={storeUrl(a.filePath)}
                />
              </button>
              <div className="p-space-sm flex flex-col gap-space-xs">
                <input
                  className="input-field w-full h-7 px-1 text-on-surface font-label-md text-label-md"
                  value={a.docType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            attachments: prev.attachments.map((x) =>
                              x.id === a.id ? { ...x, docType: v } : x
                            )
                          }
                        : prev
                    );
                  }}
                  onBlur={(e) =>
                    void window.diwan.attachments.rename(a.id, e.target.value)
                  }
                />
                <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>
                    {a.fileFormat ?? ''}
                    {a.dpi ? ` · DPI ${a.dpi}` : ''}
                  </span>
                  {a.ocrAccuracy !== null && (
                    <span className="text-secondary font-semibold">
                      OCR {Math.round(a.ocrAccuracy * 100)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <IconBtn
                    icon="visibility"
                    title="معاينة بكامل الشاشة"
                    onClick={() => setPreview(a)}
                  />
                  <IconBtn
                    icon="crop_free"
                    title="إزالة الميلان والتسوية (De-skew)"
                    onClick={() => setDeskewAttachment(a)}
                  />
                  <IconBtn
                    icon={busy === `ocr-${a.id}` ? 'hourglass_top' : 'raw_on'}
                    title={
                      ocrReady
                        ? 'استخراج النصوص OCR'
                        : 'بيانات التعرّف غير مثبّتة'
                    }
                    disabled={!ocrReady || busy === `ocr-${a.id}`}
                    onClick={() => void runOcr(a)}
                  />
                  <IconBtn
                    icon={busy === `mrz-${a.id}` ? 'hourglass_top' : 'id_card'}
                    title={ocrReady ? 'اقرأ ظهر البطاقة أو صفحة الجواز (MRZ: ثلاثة أسطرٍ أو سطران)' : 'بيانات التعرّف غير مثبّتة'}
                    disabled={!ocrReady || busy === `mrz-${a.id}`}
                    onClick={() => void readBack(a)}
                  />
                  <IconBtn
                    icon="print"
                    title="طباعة فورية ملونة"
                    onClick={() =>
                      void choosePrinter('copies').then(
                        (pick) =>
                          pick &&
                          withBusy(`print-${a.id}`, () => window.diwan.attachments.print(a.id, pick.printer))
                      )
                    }
                  />
                  <IconBtn
                    icon="content_copy"
                    title="نسخ إلى الحافظة"
                    onClick={() =>
                      void withBusy(`copy-${a.id}`, async () => {
                        const ok = await window.diwan.attachments.copyToClipboard(a.id);
                        say(ok ? 'نُسخت الصورة' : 'تعذّر النسخ', ok ? 'ok' : 'warn');
                      })
                    }
                  />
                  <IconBtn
                    icon="delete"
                    title="حذف المستمسك"
                    tone="error"
                    onClick={() =>
                      void (async () => {
                        // مسحٌ لزبونٍ ذهب يضيع بلا رجعة (ج٢).
                        const ok = await confirmAction({
                          title: `حذف المستمسك «${a.docType}»؟`,
                          message: `يُمحى من ملف «${detail.fullName}»، وتُمحى صورته من المخزن إن لم يبقَ لها استعمال. لا رجعة بعد الحذف.`,
                          confirm: 'احذفه نهائيًّا',
                          danger: true
                        });
                        if (!ok) return;
                        await withBusy(`del-${a.id}`, async () => {
                          await window.diwan.attachments.delete(a.id);
                          await reloadDetail(detail.id);
                          await reloadList();
                          say('حُذف المستمسك');
                        });
                      })()
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
