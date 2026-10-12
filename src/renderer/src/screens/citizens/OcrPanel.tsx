/**
 * النصّ المستخرَج من مستمسك — أو ظهر البطاقة حقولًا بأرقام تحقّقها (تقسيم شاشة الزبائن بعد ١٫٧٫٠) — منقولٌ من `CitizensScreen`
 * كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import { readMrz, type MrzResult } from '@shared/mrz';
import type { Attachment, CitizenDetail } from '@shared/api';

type Props = {
  setOcrPanel: Dispatch<SetStateAction<{ attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null; } | null>>;
  ocrPanel: { attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null };
  detail: CitizenDetail | null;
  setForm: Dispatch<SetStateAction<{ open: boolean; initial: CitizenDetail | null; }>>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
};

export default function OcrPanel({ setOcrPanel, ocrPanel, detail, setForm, say }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center"
      onClick={() => setOcrPanel(null)}
    >
      <div
        className="w-[min(760px,92vw)] max-h-[80vh] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            {ocrPanel.mrz ? 'ظهر البطاقة' : 'النصّ المستخرَج'} — {ocrPanel.attachment.docType}
          </span>
          <div className="flex items-center gap-space-sm">
            {ocrPanel.confidence !== null && (
            <span
              className={
                ocrPanel.confidence >= 0.9
                  ? 'font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold'
                  : 'font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold'
              }
            >
              دقة {Math.round(ocrPanel.confidence * 100)}%
            </span>
            )}
            <button
              className="w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center"
              type="button"
              onClick={() => setOcrPanel(null)}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        <div className="p-space-md overflow-y-auto">
          {/* ظهر البطاقة (هـ٧): سطور MRZ تُقرأ حقولًا — ولكلٍّ رقم تحقّقه */}
          {(() => {
            const mrz = ocrPanel.mrz ?? readMrz(ocrPanel.text);
            if (!mrz || !detail) return null;
            const row = (label: string, value: string | null, good?: boolean) =>
              value ? (
                <div key={label} className="flex items-center gap-space-xs">
                  <span className="w-28 text-on-surface-variant">{label}</span>
                  <span className="font-mono text-on-surface">{value}</span>
                  {good !== undefined && (
                    <span className={good ? 'text-secondary' : 'text-error font-semibold'}>{good ? '✓' : 'رقم التحقّق لا يطابق'}</span>
                  )}
                </div>
              ) : null;
            const personal = [mrz.optional1, mrz.optional2].map((v) => v.replace(/\D/g, '')).find((v) => v.length === 12) ?? null;
            return (
              <div className="mb-space-md p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1 font-label-md text-label-md" data-mrz={mrz.valid ? 'valid' : 'invalid'}>
                <span className="font-semibold text-on-surface">
                  ظهر البطاقة (MRZ) — {mrz.valid ? 'قُرئ وتحقّقت أرقامه' : 'قُرئ، وفي بعض أرقامه خطأ قراءة — راجِعه'}
                </span>
                {!ocrPanel.mrz && (
                  <span className="font-label-sm text-label-sm text-tertiary">من القارئ العامّ — والأدقّ زرّ «اقرأ ظهر البطاقة» على المستمسك.</span>
                )}
                {row('رقم الوثيقة', mrz.documentNumber, mrz.checks.documentNumber)}
                {row('الرقم الشخصي', personal)}
                {row('الولادة', mrz.birthDate, mrz.checks.birthDate)}
                {row('الجنس', mrz.sex)}
                {row('النفاذ', mrz.expiryDate, mrz.checks.expiryDate)}
                {row('الاسم (لاتيني)', [mrz.givenNames, mrz.surname].filter(Boolean).join(' '))}
                <button
                  className="self-start mt-1 h-8 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md disabled:opacity-40"
                  data-act="mrz-fill"
                  type="button"
                  disabled={!mrz.valid}
                  title={mrz.valid ? 'تُفتح بطاقة المواطن مملوءةً — تراجعها ثم تحفظ' : 'لا يُملأ ملفٌّ من قراءةٍ لم تتحقّق'}
                  onClick={() => {
                    setOcrPanel(null);
                    setForm({
                      open: true,
                      initial: {
                        ...detail,
                        birthDate: detail.birthDate || mrz.birthDate,
                        nationalId: detail.nationalId || personal,
                        gender: detail.gender || mrz.sex
                      }
                    });
                  }}
                >
                  املأ ملفّه بها
                </button>
              </div>
            );
          })()}
          {ocrPanel.confidence !== null && ocrPanel.confidence < 0.9 && (
            <p className="font-label-sm text-label-sm text-error mb-space-sm">
              الدقة دون 90% — راجع النصّ قبل اعتماده في كتاب رسمي.
            </p>
          )}
          {/* سطور ظهر البطاقة لاتينيةٌ من اليسار — ومن اليمين تنقلب «<» إلى «>» ويتقدّم آخرها. */}
          <pre
            dir={ocrPanel.mrz ? 'ltr' : undefined}
            className={
              ocrPanel.mrz
                ? 'font-mono text-body-md text-on-surface whitespace-pre leading-loose text-left'
                : 'font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-loose'
            }
          >
            {ocrPanel.text || 'لم يُستخرج نصّ من هذه الصورة'}
          </pre>
        </div>
        <div className="h-14 px-space-md flex items-center justify-end gap-space-sm bg-surface-container-low">
          <button
            className="px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
            type="button"
            onClick={() => {
              void window.diwan.ui.copyText(ocrPanel.text);
              say('نُسخ النصّ');
            }}
          >
            نسخ النصّ
          </button>
        </div>
      </div>
    </div>
  );
}
