import { useState } from 'react';
import { BLEED_MM, SIZE_PRESETS, type CanvasSize, type SizePreset } from '@shared/canvas';
import { useEscape } from '../kit/useEscape';

export type NewBlankModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (size: CanvasSize, bleed: number, title: string) => void;
};

export default function NewBlankModal({ isOpen, onClose, onCreate }: NewBlankModalProps) {
  useEscape(onClose, isOpen);
  const [selectedKey, setSelectedKey] = useState<string>('a4-landscape');
  const [width, setWidth] = useState<number>(297);
  const [height, setHeight] = useState<number>(210);
  const [bleed, setBleed] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');

  if (!isOpen) return null;

  const handleSelectPreset = (p: SizePreset) => {
    setSelectedKey(p.key);
    setWidth(p.size.w);
    setHeight(p.size.h);
    setBleed(p.bleed);
  };

  const handleCustomSelect = () => {
    setSelectedKey('custom');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (width <= 0 || height <= 0) return;
    onCreate({ w: width, h: height }, bleed ? BLEED_MM : 0, title.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md text-right">
        {/* الرأس */}
        <header className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[24px]">aspect_ratio</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                بدء تصميم فارغ جديد (البدء من الصفر)
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                لوحة بيضاء نقية قابلة للرسم، الكتابة، إضافة الجداول والباركود والخلفيات الحرة
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-space-md">
          {/* اسم التصميم */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1 font-semibold">
              اسم التصميم أو المشروع
            </label>
            <input
              type="text"
              className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface focus:border-primary outline-none"
              placeholder="مثال: هوية موظف، كرت شخصي، شهادة شكر..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* المقاسات المعيارية الشائعة */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2 font-semibold">
              اختر مقاس الورق أو المطبوع
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SIZE_PRESETS.map((p) => {
                const isSelected = selectedKey === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary-container/30 text-on-surface shadow-xs'
                        : 'border-outline-variant/60 bg-surface-container-lowest hover:border-outline hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-label-md text-label-md font-bold truncate">{p.label}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                      )}
                    </div>
                    <span className="font-label-xs text-label-xs text-on-surface-variant tabular">
                      {p.size.w} × {p.size.h} ملم {p.bleed ? '· نزف' : ''}
                    </span>
                  </button>
                );
              })}

              {/* خيار مقاس مخصص */}
              <button
                type="button"
                onClick={handleCustomSelect}
                className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  selectedKey === 'custom'
                    ? 'border-primary bg-primary-container/30 text-on-surface shadow-xs'
                    : 'border-outline-variant/60 bg-surface-container-lowest hover:border-outline hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-label-md text-label-md font-bold">مقاس مخصص</span>
                  {selectedKey === 'custom' && (
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  )}
                </div>
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  حدد الأبعاد يدوياً
                </span>
              </button>
            </div>
          </div>

          {/* مدخلات الأبعاد الدقيقة */}
          <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                <span>العرض:</span>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="1200"
                  className="w-24 h-9 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface"
                  value={width}
                  onChange={(e) => {
                    setWidth(Number(e.target.value) || 0);
                    setSelectedKey('custom');
                  }}
                />
                <span className="text-on-surface-variant font-label-sm">ملم</span>
              </label>

              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                <span>الارتفاع:</span>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="1200"
                  className="w-24 h-9 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface"
                  value={height}
                  onChange={(e) => {
                    setHeight(Number(e.target.value) || 0);
                    setSelectedKey('custom');
                  }}
                />
                <span className="text-on-surface-variant font-label-sm">ملم</span>
              </label>

              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface cursor-pointer mr-auto">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary"
                  checked={bleed}
                  onChange={(e) => setBleed(e.target.checked)}
                />
                <span>نزف طباعي ٣ ملم وعلامات قص (Bleed)</span>
              </label>
            </div>
          </div>

          {/* أزرار الإجراء */}
          <div className="flex items-center justify-end gap-space-sm pt-space-xs border-t border-outline-variant">
            <button
              type="button"
              className="h-10 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="h-10 px-space-lg rounded-lg bg-primary hover:bg-primary/95 text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">draw</span>
              <span>بدء التصميم على اللوحة البيضاء</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
