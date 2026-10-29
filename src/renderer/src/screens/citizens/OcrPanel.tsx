/**
 * النصّ المستخرَج من مستمسك — أو ظهر البطاقة حقولًا بأرقام تحقّقها (تقسيم شاشة الزبائن بعد ١٫٧٫٠) — منقولٌ من `CitizensScreen`
 * كما هو.
 */
import { useState, type Dispatch, type SetStateAction } from 'react';
import { cleanIdOcrText } from '@shared/idOcrText';
import { mrzExpired, mrzLatinName, readMrz, type MrzResult } from '@shared/mrz';
import type { Attachment, CitizenDetail } from '@shared/api';

type Props = {
  setOcrPanel: Dispatch<SetStateAction<{ attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null; } | null>>;
  ocrPanel: { attachment: Attachment; text: string; confidence: number | null; mrz?: MrzResult | null };
  detail: CitizenDetail | null;
  setForm: Dispatch<SetStateAction<{ open: boolean; initial: CitizenDetail | null; }>>;
  say: (text: string, tone?: 'ok' | 'warn') => void;
};

export default function OcrPanel({ setOcrPanel, ocrPanel, detail, setForm, say }: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const mrz = ocrPanel.mrz ?? readMrz(ocrPanel.text);
  const cleaned = mrz ? ocrPanel.text : cleanIdOcrText(ocrPanel.text);
  const changed = cleaned !== ocrPanel.text;
  const displayed = showOriginal ? ocrPanel.text : cleaned;
  return (
    <div data-ocr-panel=""
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center"
      onClick={() => setOcrPanel(null)}
    >
      <div
        className="w-[min(760px,92vw)] max-h-[80vh] surface-panel flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            {ocrPanel.mrz ? (ocrPanel.mrz.format === 'TD3' ? 'جواز السفر' : 'ظهر البطاقة') : 'النصّ المستخرَج'} — {ocrPanel.attachment.docType}
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
          {/* ظهر البطاقة (هـ٧) أو صفحة الجواز (S41، D181): سطور MRZ تُقرأ حقولًا — ولكلٍّ رقم تحقّقه */}
          {(() => {
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
            const passport = mrz.format === 'TD3';
            // الرقم الوطني من البطاقة وحدها؛ والرقم الشخصيّ في الجواز يُعرض كما قُرئ.
            const personal = passport ? null : ([mrz.optional1, mrz.optional2].map((v) => v.replace(/\D/g, '')).find((v) => v.length === 12) ?? null);
            return (
              <div className="mb-space-md p-space-sm rounded-card bg-surface-container-low flex flex-col gap-1 font-label-md text-label-md" data-mrz={mrz.valid ? 'valid' : 'invalid'}>
                <span className="font-semibold text-on-surface">
                  {passport ? 'جواز السفر' : 'ظهر البطاقة'} (MRZ) — {mrz.valid ? 'قُرئ وتحقّقت أرقامه' : 'قُرئ، وفي بعض أرقامه خطأ قراءة — راجِعه'}
                </span>
                {!ocrPanel.mrz && (
                  <span className="font-label-sm text-label-sm text-tertiary">من القارئ العامّ — والأدقّ زرّ «اقرأ ظهر البطاقة أو صفحة الجواز» على المستمسك.</span>
                )}
                {row(passport ? 'رقم الجواز' : 'رقم الوثيقة', mrz.documentNumber, mrz.checks.documentNumber)}
                {passport && row('الجنسية', mrz.nationality)}
                {passport ? row('الرقم الشخصي', mrz.optional1 || null, mrz.optional1 ? mrz.checks.personal : undefined) : row('الرقم الشخصي', personal)}
                {row('الولادة', mrz.birthDate, mrz.checks.birthDate)}
                {row('الجنس', mrz.sex)}
                {row('النفاذ', mrz.expiryDate, mrz.checks.expiryDate)}
                {mrzExpired(mrz.expiryDate) && (
                  <span className="text-error font-semibold" data-mrz-expired="">
                    المستمسك منتهٍ منذ {mrz.expiryDate} — يُجدَّد قبل المعاملة
                  </span>
                )}
                {row('الاسم (لاتيني)', mrzLatinName(mrz))}
                <button
                  className="self-start mt-1 h-8 px-3 btn-act font-label-md text-label-md disabled:opacity-40"
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
                        gender: detail.gender || mrz.sex,
                        latinName: detail.latinName || mrzLatinName(mrz) || null,
                        // والجواز (S41): رقمه في خانته.
                        passportNo: detail.passportNo || (passport ? mrz.documentNumber : null)
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
          {changed && (
            <div className="mb-space-sm flex flex-wrap items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
              <span>نُقّيت عناوين كردية معروفة. قد تبقى كلمات ملتبسة وأخطاء قراءة — راجع النصّ؛ الأصل محفوظ.</span>
              <button type="button" data-act="ocr-original" aria-pressed={showOriginal}
                className="h-8 px-space-sm rounded-btn bg-surface-container-high text-on-surface"
                onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? 'اعرض النصّ المنقّى' : 'اعرض النصّ الأصلي'}
              </button>
            </div>
          )}
          {/* سطور ظهر البطاقة لاتينيةٌ من اليسار — ومن اليمين تنقلب «<» إلى «>» ويتقدّم آخرها. */}
          <pre data-ocr-text={showOriginal ? 'original' : 'cleaned'}
            dir={ocrPanel.mrz ? 'ltr' : undefined}
            className={
              ocrPanel.mrz
                ? 'font-mono text-body-md text-on-surface whitespace-pre leading-loose text-left'
                : 'font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-loose'
            }
          >
            {displayed || 'لم يُستخرج نصّ من هذه الصورة'}
          </pre>
        </div>
        <div className="h-14 px-space-md flex items-center justify-end gap-space-sm bg-surface-container-low">
          <button
            className="px-space-md h-9 rounded-btn bg-surface-container-lowest text-on-surface font-label-md text-label-md"
            type="button"
            data-act="ocr-copy"
            onClick={() => {
              void window.diwan.ui.copyText(displayed);
              say(showOriginal ? 'نُسخ النصّ الأصلي' : 'نُسخ النصّ');
            }}
          >
            {showOriginal ? 'نسخ النصّ الأصلي' : 'نسخ النصّ'}
          </button>
        </div>
      </div>
    </div>
  );
}
