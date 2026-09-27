/**
 * نافذة تسوية وإزالة ميلان المستمسكات (Perspective De-skew Modal).
 *
 * تتيح للموظف سحب أركان الهوية الأربعة بالفأرة على الصورة المائلة،
 * مع اختيار مقاس الهوية (البطاقة الوطنية ID-1 أو بطاقة السكن A7 أو الوثيقة A4)،
 * لتوليد صورة مستوية مسطحة تماماً ١:١ مع تحسين التباين وتبييض الخلفية.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DESKEW_ASPECTS,
  defaultQuadForSize,
  detectQuad,
  flattenLight,
  warpPerspective,
  type PixelData,
  type Point,
  type Quad
} from '@shared/deskew';

type Props = {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply: (resultDataUrl: string) => void;
};

/** بكسلات الصورة كما حُمّلت — ليقرأها الكاشف. */
function pixelsOf(img: HTMLImageElement): PixelData | null {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function detectCorners(img: HTMLImageElement): Quad | null {
  const px = pixelsOf(img);
  return px ? detectQuad(px) : null;
}

/**
 * «مسح نظيف»: ظلُّ اليد ووهجُ المصباح يُسوَّيان، والورق أبيض والحبر حبر —
 * كأنها خرجت من ماسح. وسائر المرشّحات جرت في التسوية نفسها.
 */
function finish(px: PixelData, mode: string): PixelData {
  return mode === 'scan' ? flattenLight(px, { gray: true, ink: 1.3 }) : px;
}

export default function DeskewModal({ isOpen, imageSrc, onClose, onApply }: Props) {
  const [aspectKey, setAspectKey] = useState('id1');
  const [quad, setQuad] = useState<Quad | null>(null);
  const [filterMode, setFilterMode] = useState<'color' | 'photocopy' | 'grayscale' | 'scan'>('color');
  /** أكُشفت الأركان آليًّا — أم بقيت على الإطار الافتراضي ينتظر يد الموظف؟ */
  const [detected, setDetected] = useState<boolean | null>(null);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [activeCorner, setActiveCorner] = useState<'tl' | 'tr' | 'br' | 'bl' | null>(null);
  const [processing, setProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // تحميل الصورة وتعيين الأركان الافتراضية
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // الأركان تُكشف آليًّا أولًا — صورة الماسح صفحةٌ كاملة والبطاقة في ركنها.
      const found = detectCorners(img);
      setDetected(Boolean(found));
      setQuad(found ?? defaultQuadForSize(img.naturalWidth, img.naturalHeight, 0.08));
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // تحديث المعاينة الحية على previewCanvas
  const updatePreview = useCallback(() => {
    const img = imgRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!img || !previewCanvas || !quad) return;

    const preset = DESKEW_ASPECTS.find((p) => p.key === aspectKey);
    const aspect = preset ? preset.aspect : (img.naturalWidth / img.naturalHeight);

    // أبعاد المعاينة المستوية (بدقة مناسبة للمعاينة السريعة)
    const targetW = 600;
    const targetH = Math.round(targetW / aspect);

    // استخراج بكسلات الصورة الأصلية
    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0);
    const srcData = offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

    const warped = finish(
      warpPerspective(srcData, quad, targetW, targetH, {
        grayscale: filterMode === 'grayscale',
        highContrast: filterMode === 'photocopy',
        brightness,
        contrast
      }),
      filterMode
    );

    previewCanvas.width = targetW;
    previewCanvas.height = targetH;
    const pCtx = previewCanvas.getContext('2d');
    if (pCtx) {
      const outImg = pCtx.createImageData(targetW, targetH);
      outImg.data.set(warped.data);
      pCtx.putImageData(outImg, 0, 0);
    }
  }, [quad, aspectKey, filterMode, brightness, contrast]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // رسم الصورة الأصلية مع أركان التحديد الرباعية
  const drawEditor = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !quad) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // تعتيم خفيف خارج الشكل الرباعي
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // تفريغ المنطقة داخل الشكل الرباعي
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad.tl.x, quad.tl.y);
    ctx.lineTo(quad.tr.x, quad.tr.y);
    ctx.lineTo(quad.br.x, quad.br.y);
    ctx.lineTo(quad.bl.x, quad.bl.y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    // رسم الخطوط الحدودية
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(2, img.naturalWidth / 250);
    ctx.beginPath();
    ctx.moveTo(quad.tl.x, quad.tl.y);
    ctx.lineTo(quad.tr.x, quad.tr.y);
    ctx.lineTo(quad.br.x, quad.br.y);
    ctx.lineTo(quad.bl.x, quad.bl.y);
    ctx.closePath();
    ctx.stroke();

    // رسم دوائر الأركان
    const radius = Math.max(8, img.naturalWidth / 60);
    const corners: { key: keyof Quad; pt: Point; label: string }[] = [
      { key: 'tl', pt: quad.tl, label: 'أعلى-يسار' },
      { key: 'tr', pt: quad.tr, label: 'أعلى-يمين' },
      { key: 'br', pt: quad.br, label: 'أسفل-يمين' },
      { key: 'bl', pt: quad.bl, label: 'أسفل-يسار' }
    ];

    for (const c of corners) {
      ctx.fillStyle = activeCorner === c.key ? '#ef4444' : '#22c55e';
      ctx.beginPath();
      ctx.arc(c.pt.x, c.pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = radius / 3;
      ctx.stroke();
    }
  }, [quad, activeCorner]);

  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  // تحريك الأركان بالفأرة
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !quad) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hitDist = Math.max(30, img.naturalWidth / 20);

    const corners: (keyof Quad)[] = ['tl', 'tr', 'br', 'bl'];
    let closest: keyof Quad | null = null;
    let minDist = Infinity;

    for (const c of corners) {
      const pt = quad[c];
      const d = Math.hypot(pt.x - clickX, pt.y - clickY);
      if (d < hitDist && d < minDist) {
        minDist = d;
        closest = c;
      }
    }

    if (closest) {
      setActiveCorner(closest);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeCorner || !canvasRef.current || !imgRef.current || !quad) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth / rect.width;
    const scaleY = imgRef.current.naturalHeight / rect.height;

    const curX = Math.max(0, Math.min(imgRef.current.naturalWidth, (e.clientX - rect.left) * scaleX));
    const curY = Math.max(0, Math.min(imgRef.current.naturalHeight, (e.clientY - rect.top) * scaleY));

    setQuad((prev) => (prev ? { ...prev, [activeCorner]: { x: curX, y: curY } } : null));
  };

  const handlePointerUp = () => {
    setActiveCorner(null);
  };

  // تطبيق النتيجة النهائية بدقة عالية
  const handleApply = () => {
    const img = imgRef.current;
    if (!img || !quad) return;

    setProcessing(true);
    try {
      const preset = DESKEW_ASPECTS.find((p) => p.key === aspectKey);
      const aspect = preset ? preset.aspect : (img.naturalWidth / img.naturalHeight);

      // دقة إنتاجية عالية (High Res: مثلاً 1200 بكسل عرض)
      const outW = 1200;
      const outH = Math.round(outW / aspect);

      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0);
      const srcData = offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

      const warped = finish(
        warpPerspective(srcData, quad, outW, outH, {
          grayscale: filterMode === 'grayscale',
          highContrast: filterMode === 'photocopy',
          brightness,
          contrast
        }),
        filterMode
      );

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = outW;
      finalCanvas.height = outH;
      const fCtx = finalCanvas.getContext('2d');
      if (!fCtx) return;

      const finalImg = fCtx.createImageData(outW, outH);
      finalImg.data.set(warped.data);
      fCtx.putImageData(finalImg, 0, 0);
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.92);
      onApply(dataUrl);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[92vh] flex flex-col bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        {/* الترويسة */}
        <header className="px-6 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[24px]">crop_free</span>
            <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
              إزالة ميلان المستمسكات (Perspective De-skew & Flatten)
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

        {/* جسم النافذة: مقسوم إلى شاشتين */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* الجانب الأيمن: محرر الأركان التفاعلي */}
          <div className="flex-1 bg-neutral-900 flex flex-col p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2 text-white/80 text-xs">
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                {detected === false
                  ? 'لم تتميّز البطاقة عن خلفيتها — اسحب الدوائر الخضراء إلى أركانها'
                  : 'كُشفت الأركان آليًّا — اسحب أيّ دائرةٍ لتصحيحها'}
              </span>
              <button
                type="button"
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white"
                data-act="detect-corners"
                onClick={() => {
                  const img = imgRef.current;
                  if (!img) return;
                  const found = detectCorners(img);
                  setDetected(Boolean(found));
                  setQuad(found ?? defaultQuadForSize(img.naturalWidth, img.naturalHeight, 0.08));
                }}
              >
                كشف الأركان تلقائيًّا
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain cursor-crosshair rounded shadow-lg touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
          </div>

          {/* الجانب الأيسر: المعاينة المستوية وأدوات التحكم */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-r border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
            {/* المعاينة الحية */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                المعاينة المستوية (١:١):
              </label>
              <div className="w-full aspect-[1.58/1] bg-surface rounded-xl border border-outline-variant overflow-hidden flex items-center justify-center p-2 shadow-inner">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-full object-contain shadow-md rounded"
                />
              </div>
            </div>

            {/* اختيار نوع المقاس */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface">
                نوع المستمسك ومقاسه:
              </label>
              <div className="flex flex-col gap-1 text-xs">
                {DESKEW_ASPECTS.map((asp) => (
                  <button
                    key={asp.key}
                    type="button"
                    className={`px-3 py-2 rounded-lg text-right font-medium transition-all ${
                      aspectKey === asp.key
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    onClick={() => setAspectKey(asp.key)}
                  >
                    {asp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* فلتر الألوان */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface">فلتر الصورة:</label>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  { key: 'color', label: 'ملون' },
                  { key: 'photocopy', label: 'استنساخ' },
                  { key: 'grayscale', label: 'رمادي' },
                  { key: 'scan', label: 'مسح نظيف' }
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`py-1.5 rounded-lg text-center font-medium transition-all ${
                      filterMode === f.key
                        ? 'bg-secondary text-on-secondary font-bold'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface'
                    }`}
                    onClick={() => setFilterMode(f.key as any)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* منزلقات السطوع والتباين */}
            <div className="space-y-2 pt-2 border-t border-outline-variant">
              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>السطوع</span>
                  <span className="font-mono">{Math.round(brightness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                  <span>التباين</span>
                  <span className="font-mono">{Math.round(contrast * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.8"
                  step="0.05"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* أزرار الإجراء */}
        <footer className="px-6 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
          <button
            type="button"
            className="px-4 h-10 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={processing}
            className="px-6 h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all disabled:opacity-40"
            onClick={handleApply}
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            حفظ وتطبيق المستمسك المستوي
          </button>
        </footer>
      </div>
    </div>
  );
}
