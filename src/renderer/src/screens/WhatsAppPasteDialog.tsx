/**
 * نافذة التحليل الذكي لنصوص رسائل الواتساب (WhatsApp Smart Parse Dialog).
 *
 * يلصق الموظف نص رسالة الواتساب أو تيليجرام بنقرة واحدة، فيقوم المحرك فوراً
 * بالتعرف على الاسم، الرقم الوطني، الهاتف، المواليد، بطاقة السكن، العنوان، إلخ،
 * ويعرضها في جدول تفاعلي منظم مع زر تطبيق لتعبئة النموذج بالكامل فوراً.
 */
import { useMemo, useState } from 'react';
import { parseWhatsAppMessage, type ExtractedCitizen } from '@shared/whatsappParser';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (extracted: ExtractedCitizen) => void;
};

export default function WhatsAppPasteDialog({ isOpen, onClose, onApply }: Props) {
  const [rawText, setRawText] = useState('');

  const extracted = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseWhatsAppMessage(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawText(text);
    } catch {
      // ignore
    }
  };

  const handleApply = () => {
    if (extracted) {
      onApply(extracted);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        {/* الترويسة */}
        <header className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[24px]">chat_paste</span>
            <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
              لصق ذكي من رسائل الواتساب (WhatsApp Smart Parse)
            </h3>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* جسم النافذة */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                <span>الصق نص رسالة الزبون من الواتساب هنا</span>
                <span className="text-secondary text-xs">(محلل محلي 100% دون إنترنت)</span>
              </label>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded bg-primary/10"
                onClick={handlePasteClipboard}
              >
                <span className="material-symbols-outlined text-[16px]">content_paste</span>
                لصق من الحافظة
              </button>
            </div>
            <textarea
              className="w-full h-32 p-3 rounded-xl border border-outline bg-surface text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm leading-relaxed resize-none"
              placeholder={`مثال:\nالسلام عليكم\nالاسم: حيدر كريم جاسم العبيدي\nالرقم الوطني: 199512345678\nالتولد: 1995/07/21\nرقم الهاتف: 07701234567\nالسكن: بغداد - الكرخ محلة 612 زقاق 14 دار 8`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              autoFocus
            />
          </div>

          {/* الحقول المستخرجة */}
          {extracted && (
            <div className="rounded-xl border border-secondary/30 bg-secondary-fixed/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-title-sm text-title-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    check_circle
                  </span>
                  تم التعرّف على {extracted.detectedFieldsCount} حقول بنجاح:
                </span>
                <span className="text-xs text-on-surface-variant font-mono">
                  {extracted.fullName ? 'تم اكتشاف الاسم' : 'لم يُكتشف الاسم'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'الاسم الكامل', val: extracted.fullName, key: 'name' },
                  { label: 'الرقم الوطني', val: extracted.nationalId, key: 'nid' },
                  { label: 'رقم الهاتف', val: extracted.phone, key: 'phone' },
                  { label: 'تاريخ الولادة', val: extracted.birthDate, key: 'birth' },
                  { label: 'محل الولادة', val: extracted.birthPlace, key: 'place' },
                  { label: 'بطاقة السكن', val: extracted.housingCardNo, key: 'hc' },
                  { label: 'العنوان والسكن', val: extracted.address, key: 'addr' },
                  { label: 'أقرب نقطة دالة', val: extracted.landmark, key: 'lm' },
                  { label: 'الوظيفة', val: extracted.jobTitle, key: 'job' },
                  { label: 'مكان العمل', val: extracted.workplace, key: 'work' },
                  { label: 'اسم الأم', val: extracted.motherName, key: 'mother' }
                ].map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      item.val
                        ? 'border-secondary/30 bg-surface text-on-surface'
                        : 'border-outline-variant/50 bg-surface/40 text-on-surface-variant/50'
                    }`}
                  >
                    <span className="font-semibold text-xs">{item.label}:</span>
                    <span className="font-mono text-xs text-left truncate max-w-[200px]" dir="ltr">
                      {item.val || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* أزرار الإجراء */}
        <footer className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
          <button
            type="button"
            className="px-4 h-10 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!extracted || extracted.detectedFieldsCount === 0}
            className="px-6 h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all disabled:opacity-40"
            onClick={handleApply}
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            تطبيق وتعبئة بيانات المواطن
          </button>
        </footer>
      </div>
    </div>
  );
}
