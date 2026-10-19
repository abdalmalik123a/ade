/**
 * صانع هويات الوجه والظهر (ID Duplex 1:1 Dialog).
 *
 * استنساخ وطباعة الهويات والمستمسكات (البطاقة الوطنية، إجازة السوق، بطاقة السكن)
 * بمقاس ١٠٠٪ حقيقي (١:١ بالمليمتر) على ورق A4، مع دعم معالجة ميلان صور الهاتف،
 * والطباعة بوجهين متطابقين، أو صفحة واحدة للدوائر الرسمية.
 */
import { useMemo, useState } from 'react';
import { useTransientScans } from '../lib/transientScans';
import type { Attachment } from '@shared/api';
import {
  STANDARD_CARD_SIZES,
  generateIdDuplexHtml,
  type IdCardConfig,
  type IdColorFilter,
  type IdDuplexLayoutMode
} from '@shared/idCardDuplex';
import DeskewModal from './DeskewModal';
import { WATERMARK_PRESETS } from '@shared/watermark';
import { errorText } from '../lib/errors';
import { useToast } from '../kit/useToast';
import { choosePrinter } from '../lib/printChoice';
import { useToolNav } from '../components/ToolFrame';
import { useEscape } from '../kit/useEscape';
import IdOptionsPanel from './idDuplex/IdOptionsPanel';
import IdPreview from './idDuplex/IdPreview';
import IdActions from './idDuplex/IdActions';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  citizenName?: string;
  attachments?: Attachment[];
};

export default function IdDuplexDialog({ isOpen, onClose, citizenName, attachments = [] }: Props) {
  useEscape(onClose, isOpen);
  // المسح عابرٌ: يُحذف حين يُغلق الحوار (مراجعة ٧ ت١).
  const scanTransient = useTransientScans();
  // الخطّافات كلّها قبل `return null` أدناه: كان هذا بعده، فيتغيّر عددها بين تصييرٍ وتصيير (ج٥).
  const { printRoles } = useToolNav();
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
  const { toast, say: sayTone } = useToast(3200);
  const say = (text: string, warn = false) => sayTone(text, warn ? 'warn' : 'ok');

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
      const src = await scanTransient(300);
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
    const pick = await choosePrinter('copies', { allowSystem: true });
    if (!pick) return;
    setBusy(true);
    try {
      const out = await window.diwan.output.print({
        sheetHtml: pagesHtml.join(''),
        printer: pick.printer,
        copies: 1,
        silent: !pick.system,
        page: { w: 210, h: 297 },
        duplex: mode === 'duplex'
      });
      say(out.ok ? 'أُرسلت الهوية إلى الطابعة بمقاسها الحقيقي' : out.reason || 'لم تتم الطباعة', !out.ok);
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[94vh] flex flex-col bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        {/* الترويسة */}
        <header className="px-6 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-[26px]">badge</span>
            <div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                استنساخ هوية — الوجه والظهر
              </h3>
              <p className="text-xs text-on-surface-variant">
                الهوية والبطاقة بمقاسها الحقيقي بالمليمتر على ورقة A4
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
          <IdOptionsPanel
            swapSides={swapSides}
            frontSrc={frontSrc}
            setDeskewTarget={setDeskewTarget}
            resolveUrl={resolveUrl}
            pickFromFile={pickFromFile}
            busy={busy}
            scanSide={scanSide}
            attachments={attachments}
            setFrontSrc={setFrontSrc}
            backSrc={backSrc}
            setBackSrc={setBackSrc}
            mode={mode}
            setMode={setMode}
            sizeKey={sizeKey}
            setSizeKey={setSizeKey}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            brightness={brightness}
            setBrightness={setBrightness}
            contrast={contrast}
            setContrast={setContrast}
            showDivider={showDivider}
            setShowDivider={setShowDivider}
            showCutMarks={showCutMarks}
            setShowCutMarks={setShowCutMarks}
            wmOn={wmOn}
            setWmOn={setWmOn}
            wmTo={wmTo}
            setWmTo={setWmTo}
            setWmText={setWmText}
            wmText={wmText}
            wmOpacity={wmOpacity}
            setWmOpacity={setWmOpacity}
          />

          {/* الجانب الأيسر: المعاينة الحية لورقة A4 الحقيقية */}
          <IdPreview
            pagesHtml={pagesHtml}
            mode={mode}
          />
        </div>

        {/* أزرار الإجراء */}
        <IdActions
          onClose={onClose}
          toast={toast}
          printRoles={printRoles}
          busy={busy}
          pagesHtml={pagesHtml}
          handleSavePdf={handleSavePdf}
          handlePrint={handlePrint}
        />
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
