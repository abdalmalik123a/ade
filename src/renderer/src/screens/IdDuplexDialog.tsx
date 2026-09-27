/**
 * صانع هويات الوجه والظهر (ID Duplex 1:1 Dialog).
 *
 * استنساخ وطباعة الهويات والمستمسكات (البطاقة الوطنية، إجازة السوق، بطاقة السكن)
 * بمقاس ١٠٠٪ حقيقي (١:١ بالمليمتر) على ورق A4، مع دعم معالجة ميلان صور الهاتف،
 * والطباعة بوجهين متطابقين، أو صفحة واحدة للدوائر الرسمية.
 */
import { useMemo, useState } from 'react';
import type { Attachment, PrinterInfo } from '@shared/api';
import {
  STANDARD_CARD_SIZES,
  generateIdDuplexHtml,
  type IdCardConfig,
  type IdColorFilter,
  type IdDuplexLayoutMode
} from '@shared/idCardDuplex';
import DeskewModal from './DeskewModal';
import { WATERMARK_PRESETS, purposeWatermark } from '@shared/watermark';
import { errorText } from '../lib/errors';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  printer: PrinterInfo | null;
  citizenName?: string;
  attachments?: Attachment[];
};

export default function IdDuplexDialog({
  isOpen,
  onClose,
  printer,
  citizenName,
  attachments = []
}: Props) {
  const [sizeKey, setSizeKey] = useState('id1');
  const [mode, setMode] = useState<IdDuplexLayoutMode>('stacked');
  const [frontSrc, setFrontSrc] = useState<string | null>(null);
  const [backSrc, setBackSrc] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<IdColorFilter>('color');
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [showDivider, setShowDivider] = useState(true);
  const [showCutMarks, setShowCutMarks] = useState(true);
  /** العلامة المائية فوق النسخة (هـ٣): الجهة التي تُقدَّم إليها تُسمّى فيها. */
  const [wmOn, setWmOn] = useState(false);
  const [wmTo, setWmTo] = useState('');
  const [wmText, setWmText] = useState<string>(WATERMARK_PRESETS.copy);
  const [wmOpacity, setWmOpacity] = useState(0.22);
  const [busy, setBusy] = useState(false);
  const [deskewTarget, setDeskewTarget] = useState<'front' | 'back' | null>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  const say = (text: string, warn = false) => {
    setToast({ text, warn });
    window.setTimeout(() => setToast(null), 3200);
  };

  const cardSize = useMemo(() => {
    const std = STANDARD_CARD_SIZES.find((s) => s.key === sizeKey);
    return std ? { w: std.w, h: std.h } : { w: 85.6, h: 54.0 };
  }, [sizeKey]);

  const config: IdCardConfig = useMemo(
    () => ({
      cardSize,
      mode,
      frontSrc,
      backSrc,
      colorFilter,
      brightness,
      contrast,
      showDividerLine: showDivider,
      showCutMarks,
      watermark: wmOn ? { text: wmText, opacity: wmOpacity, sizeMm: Math.max(2.4, cardSize.h / 16) } : null
    }),
    [cardSize, mode, frontSrc, backSrc, colorFilter, brightness, contrast, showDivider, showCutMarks, wmOn, wmText, wmOpacity]
  );

  const resolveUrl = (src: string) => {
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
    return `diwan://store/${src}`;
  };

  const pagesHtml = useMemo(() => {
    if (!frontSrc && !backSrc) return [];
    return generateIdDuplexHtml(config, resolveUrl);
  }, [config, frontSrc, backSrc]);

  if (!isOpen) return null;

  async function pickFromFile(side: 'front' | 'back') {
    const picked = await window.diwan.files.pickImage('photos');
    if (picked) {
      if (side === 'front') setFrontSrc(picked);
      else setBackSrc(picked);
    }
  }

  /**
   * يمسح الوجه أو الظهر بالماسح ثم يفتح التسوية: صورة الماسح صفحةٌ كاملة والبطاقة
   * في ركنها، فتُكشف أركانها آليًّا وتُقصّ بمقاسها قبل أن تُصفّ ١:١.
   */
  async function scanSide(side: 'front' | 'back') {
    setBusy(true);
    try {
      const src = await window.diwan.scanner.scanImage(300);
      if (side === 'front') setFrontSrc(src);
      else setBackSrc(src);
      setDeskewTarget(side);
    } catch (e) {
      say(e instanceof Error ? e.message : 'تعذّر المسح', true);
    } finally {
      setBusy(false);
    }
  }

  function swapSides() {
    const temp = frontSrc;
    setFrontSrc(backSrc);
    setBackSrc(temp);
  }

  async function handlePrint() {
    if (pagesHtml.length === 0) {
      say('الرجاء اختيار صورة الوجه أو الظهر أولاً', true);
      return;
    }
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: pagesHtml.join(''),
        printer: printer?.name ?? null,
        copies: 1,
        silent: false,
        page: { w: 210, h: 297 },
        duplex: mode === 'duplex'
      });
      say(out.ok ? 'تم إرسال الهوية إلى الطابعة بمقاس 1:1' : out.reason || 'لم تتم الطباعة', !out.ok);
    } catch (e) {
      say(errorText(e, 'تعذّرت الطباعة'), true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePdf() {
    if (pagesHtml.length === 0) {
      say('الرجاء اختيار صورة الوجه أو الظهر أولاً', true);
      return;
    }
    setBusy(true);
    try {
      const name = citizenName ? `هوية - ${citizenName}` : 'استنساخ هوية 1-1';
      const path = await window.diwan.output.savePdf({
        sheetHtml: pagesHtml.join(''),
        suggestedName: name,
        page: { w: 210, h: 297 }
      });
      if (path) say('تم حفظ مستمسك الهوية كملف PDF');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), true);
    } finally {
      setBusy(false);
    }
  }

  const activeDeskewSrc = deskewTarget === 'front' ? frontSrc : backSrc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[94vh] flex flex-col bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        {/* الترويسة */}
        <header className="px-6 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[26px]">badge</span>
            <div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                صانع هويات الوجه والظهر (ID Duplex 1:1)
              </h3>
              <p className="text-xs text-on-surface-variant">
                طباعة واستنساخ الهويات والبطاقات بمقاس ١٠٠٪ حقيقي بالمليمتر على ورق A4
                {citizenName ? ` · ${citizenName}` : ''}
              </p>
            </div>
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
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* الجانب الأيمن: إعدادات واختيار الصور والنمط */}
          <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-l border-outline-variant bg-surface-container-low p-4 overflow-y-auto space-y-4 shrink-0">
            {/* بطاقتي الوجه والظهر */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">صور المستمسك:</span>
                <button
                  type="button"
                  onClick={swapSides}
                  className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-0.5 rounded bg-primary/10"
                >
                  <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                  تبديل الوجه والظهر
                </button>
              </div>

              {/* بطاقة الوجه */}
              <div className="p-3 rounded-xl border border-outline-variant bg-surface space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-secondary flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    وجه الهوية (Front)
                  </span>
                  {frontSrc && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      onClick={() => setDeskewTarget('front')}
                    >
                      <span className="material-symbols-outlined text-[14px]">crop_free</span>
                      تعديل الميلان
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-20 h-14 rounded-lg bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
                    {frontSrc ? (
                      <img
                        alt="Face"
                        src={resolveUrl(frontSrc)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                        image
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-xs text-on-surface text-center font-medium"
                      onClick={() => void pickFromFile('front')}
                    >
                      استعراض من الحاسوب
                    </button>
                    <button
                      type="button"
                      data-act="scan-front"
                      disabled={busy}
                      className="px-2 py-1 rounded bg-secondary-container hover:opacity-90 text-xs text-on-secondary-container text-center font-medium disabled:opacity-50"
                      onClick={() => void scanSide('front')}
                    >
                      امسح بالماسح الضوئي
                    </button>
                    {attachments.length > 0 && (
                      <select
                        className="text-xs p-1 rounded bg-surface-container-high text-on-surface border-none"
                        onChange={(e) => {
                          if (e.target.value) setFrontSrc(e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          من مرفقات المواطن...
                        </option>
                        {attachments.map((a) => (
                          <option key={a.id} value={a.filePath ?? ''}>
                            {a.docType || 'مستمسك'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* بطاقة الظهر */}
              <div className="p-3 rounded-xl border border-outline-variant bg-surface space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-secondary flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    ظهر الهوية (Back)
                  </span>
                  {backSrc && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      onClick={() => setDeskewTarget('back')}
                    >
                      <span className="material-symbols-outlined text-[14px]">crop_free</span>
                      تعديل الميلان
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-20 h-14 rounded-lg bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
                    {backSrc ? (
                      <img
                        alt="Back"
                        src={resolveUrl(backSrc)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                        image
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-xs text-on-surface text-center font-medium"
                      onClick={() => void pickFromFile('back')}
                    >
                      استعراض من الحاسوب
                    </button>
                    <button
                      type="button"
                      data-act="scan-back"
                      disabled={busy}
                      className="px-2 py-1 rounded bg-secondary-container hover:opacity-90 text-xs text-on-secondary-container text-center font-medium disabled:opacity-50"
                      onClick={() => void scanSide('back')}
                    >
                      امسح بالماسح الضوئي
                    </button>
                    {attachments.length > 0 && (
                      <select
                        className="text-xs p-1 rounded bg-surface-container-high text-on-surface border-none"
                        onChange={(e) => {
                          if (e.target.value) setBackSrc(e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          من مرفقات المواطن...
                        </option>
                        {attachments.map((a) => (
                          <option key={a.id} value={a.filePath ?? ''}>
                            {a.docType || 'مستمسك'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* نمط التصفيف على ورقة A4 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface">
                طريقة التصفيف على A4:
              </label>
              <div className="flex flex-col gap-1 text-xs">
                {[
                  {
                    key: 'stacked',
                    label: 'صفحة واحدة (وجه وظهر في المنتصف)',
                    desc: 'النمط الرسمي المعتمد في الدوائر العراقية'
                  },
                  {
                    key: 'sideBySide',
                    label: 'صفحة واحدة (جنبًا إلى جنب)',
                    desc: 'مناسب لطي الورقة والتغليف السريع'
                  },
                  {
                    key: 'duplex',
                    label: 'طباعة بوجهين (Duplex 1:1)',
                    desc: 'تطابق ١٠٠٪ بين الوجه والظهر على ورقة واحدة'
                  },
                  {
                    key: 'repeat',
                    label: 'تكرار عدة بطاقات على الورقة',
                    desc: 'لطباعة ٨ أو ٩ نسخ دفعة واحدة للقص'
                  }
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`px-3 py-2 rounded-lg text-right transition-all flex flex-col ${
                      mode === m.key
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    onClick={() => setMode(m.key as IdDuplexLayoutMode)}
                  >
                    <span>{m.label}</span>
                    <span className="text-[10px] opacity-80 font-normal">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* مقاس البطاقة */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface">مقاس البطاقة:</label>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {STANDARD_CARD_SIZES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-right font-medium transition-all ${
                      sizeKey === s.key
                        ? 'bg-secondary text-on-secondary font-bold'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    onClick={() => setSizeKey(s.key)}
                  >
                    {s.label} ({s.w} × {s.h} ملم)
                  </button>
                ))}
              </div>
            </div>

            {/* ألوان الطباعة */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface">ألوان المستمسك:</label>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {[
                  { key: 'color', label: 'ملونة' },
                  { key: 'photocopy', label: 'استنساخ رسمي' },
                  { key: 'grayscale', label: 'رمادي' }
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`py-1.5 rounded-lg text-center font-medium transition-all ${
                      colorFilter === c.key
                        ? 'bg-secondary-container text-on-secondary-container font-bold border border-secondary'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    onClick={() => setColorFilter(c.key as IdColorFilter)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* منزلقات السطوع والتباين */}
            <div className="space-y-2 pt-2 border-t border-outline-variant text-xs">
              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>سطوع الطباعة</span>
                  <span className="font-mono">{Math.round(brightness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>تباين المستمسك</span>
                  <span className="font-mono">{Math.round(contrast * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* خيارات إضافية */}
            <div className="space-y-2 pt-2 border-t border-outline-variant text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDivider}
                  onChange={(e) => setShowDivider(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>إظهار خط منصف للطي والقص</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCutMarks}
                  onChange={(e) => setShowCutMarks(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>إطار إرشادي خفيف حول الهوية</span>
              </label>
            </div>

            {/* العلامة المائية فوق النسخة — فالنسخة المعطاة لجهةٍ لا تصلح لغيرها */}
            <div className="space-y-2 pt-2 border-t border-outline-variant text-xs" data-id-watermark="">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={wmOn}
                  data-act="id-watermark"
                  onChange={(e) => setWmOn(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>علامة مائية فوق النسخة</span>
              </label>
              {wmOn && (
                <>
                  <input
                    className="w-full h-8 px-2 rounded bg-surface text-on-surface border border-outline-variant"
                    data-watermark-to=""
                    placeholder="الجهة التي تُقدَّم إليها — مثال: مصرف الرشيد"
                    value={wmTo}
                    onChange={(e) => {
                      setWmTo(e.target.value);
                      setWmText(purposeWatermark(e.target.value));
                    }}
                  />
                  <input
                    className="w-full h-8 px-2 rounded bg-surface text-on-surface border border-outline-variant"
                    data-watermark-text=""
                    value={wmText}
                    onChange={(e) => setWmText(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <span>الوضوح</span>
                    <input
                      className="flex-1"
                      max={0.5}
                      min={0.1}
                      step={0.02}
                      type="range"
                      value={wmOpacity}
                      onChange={(e) => setWmOpacity(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* الجانب الأيسر: المعاينة الحية لورقة A4 الحقيقية */}
          <div className="flex-1 bg-neutral-800 flex flex-col items-center justify-center p-6 overflow-auto">
            {pagesHtml.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-white/50">
                <span className="material-symbols-outlined text-[48px]">badge</span>
                <span>اختر صورة الوجه أو الظهر لبدء المعاينة الحية للورقة</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-6">
                {pagesHtml.map((pHtml, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <span className="text-white/70 text-xs font-mono">
                      {mode === 'duplex'
                        ? idx === 0
                          ? 'الوجه الأمامي (Page 1)'
                          : 'الظهر الخلفي (Page 2)'
                        : `ورقة A4 (${idx + 1})`}
                    </span>
                    <div
                      className="bg-white shadow-2xl rounded-sm overflow-hidden border border-black/20 origin-center transition-transform"
                      style={{
                        width: '297px', // معاينة بنسبة A4 مصغرة
                        height: '420px',
                        transform: 'scale(1)'
                      }}
                      dangerouslySetInnerHTML={{
                        __html: pHtml.replace(/width:210mm;height:297mm/g, 'width:297px;height:420px')
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* أزرار الإجراء */}
        <footer className="px-6 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 h-10 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              onClick={onClose}
            >
              إغلاق
            </button>
            {toast && (
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  toast.warn ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary'
                }`}
              >
                {toast.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || pagesHtml.length === 0}
              className="px-4 h-10 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-40"
              onClick={() => void handleSavePdf()}
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              حفظ كملف PDF
            </button>

            <button
              type="button"
              disabled={busy || pagesHtml.length === 0}
              className="px-6 h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all disabled:opacity-40"
              onClick={() => void handlePrint()}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              طباعة فورية A4 (١:١)
            </button>
          </div>
        </footer>
      </div>

      {/* مودال إزالة الميلان */}
      {deskewTarget && activeDeskewSrc && (
        <DeskewModal
          isOpen={true}
          imageSrc={resolveUrl(activeDeskewSrc)}
          onClose={() => setDeskewTarget(null)}
          onApply={(flatDataUrl) => {
            if (deskewTarget === 'front') setFrontSrc(flatDataUrl);
            else setBackSrc(flatDataUrl);
            setDeskewTarget(null);
            say('تمت تسوية وفرد الهوية بنجاح');
          }}
        />
      )}
    </div>
  );
}
