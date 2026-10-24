/**
 * «حزم المحتوى» المشحونة مع البرنامج (تقسيم مكتبة النماذج بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */
import type { BundledPackInfo } from '@shared/api';
import { useEffect } from 'react';
import { count } from '@shared/arabic';

export function PacksModal({
  open,
  loading,
  packs,
  busy,
  onClose,
  onImportBundled,
  onImportFile
}: {
  open: boolean;
  loading: boolean;
  packs: BundledPackInfo[];
  busy: boolean;
  onClose: () => void;
  onImportBundled: (id: string) => Promise<void>;
  onImportFile: () => Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center p-space-md"
      data-packs-modal=""
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-card shadow-card border border-outline-variant flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 px-space-lg flex items-center justify-between border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[24px] text-secondary">inventory_2</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">حزم الجهات الجاهزة</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                معاملات رسمية ونماذج معتمدة — معروضة لتختار منها، ولا يُضاف شيء إلا بطلبك
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-btn flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="إغلاق (Esc)"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-lg overflow-y-auto space-y-space-md flex-1">
          {loading ? (
            <p className="text-center py-space-xl text-on-surface-variant font-body-md">جارٍ قراءة الحزم المتاحة...</p>
          ) : packs.length === 0 ? (
            <p className="text-center py-space-xl text-on-surface-variant font-body-md">لا حزم مشحونة في هذا الإصدار.</p>
          ) : (
            <div className="space-y-space-sm" data-bundled-packs-list="">
              {packs.map((p) => (
                <div
                  key={p.id}
                  className="p-space-md rounded-card border border-outline-variant bg-surface-container-low flex flex-col gap-space-xs"
                  data-pack-card={p.id}
                >
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <span className="font-title-md text-title-md font-bold text-on-surface">{p.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-chip bg-primary-fixed text-primary font-semibold">
                          {p.section}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                          v{p.version}
                        </span>
                        {p.imported && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-semibold flex items-center gap-0.5"
                            data-pack-imported={p.id}
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            مستوردة
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{p.description}</p>
                    </div>
                    <button
                      className={`h-9 px-space-md rounded-btn font-label-md text-label-md font-bold shrink-0 transition-colors flex items-center gap-space-xs ${
                        p.imported
                          ? 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                          : 'btn-act'
                      }`}
                      data-act={`import-bundled-${p.id}`}
                      disabled={busy}
                      type="button"
                      onClick={() => void onImportBundled(p.id)}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {p.imported ? 'refresh' : 'download'}
                      </span>
                      {p.imported ? 'استورد ثانيةً' : 'استيراد الحزمة'}
                    </button>
                  </div>
                  <div className="flex items-center gap-space-md text-[12px] text-on-surface-variant pt-space-xs border-t border-outline-variant/50">
                    <span>{count(p.counts.templates, 'نموذج')} · {count(p.counts.clips, 'كليشة')}{p.counts.letterheads ? ` · ${count(p.counts.letterheads, 'ترويسة')}` : ''}</span>
                    <span>تحقّق المصادر: {p.verifiedOn}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-space-md border-t border-outline-variant flex items-center justify-between gap-space-md bg-surface-container-lowest p-space-sm rounded-card">
            <div>
              <h3 className="font-label-md text-label-md font-bold text-on-surface">استيراد حزمة من ملف خارجي</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                ملفّ حزمة ديوان صُدّر من حاسوب آخر أو أُرسل إليك
              </p>
            </div>
            <button
              className="h-9 px-space-md rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-bold shrink-0 flex items-center gap-space-xs transition-colors"
              data-act="content-import-file"
              disabled={busy}
              type="button"
              onClick={() => void onImportFile()}
            >
              <span className="material-symbols-outlined text-[18px]">file_open</span>
              من ملف...
            </button>
          </div>
        </div>

        <div className="h-14 px-space-lg flex items-center justify-end border-t border-outline-variant bg-surface-container-low shrink-0">
          <button
            className="h-9 px-space-lg rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold transition-colors"
            type="button"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
