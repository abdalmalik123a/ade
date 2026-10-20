/**
 * شريط الورقة في محرّر الورقة (تقسيم PageEditor بعد ١٫٧٫٠) — منقولٌ منه كما هو: المقاس والاتجاه والهوامش بكلمةٍ أو بأرقام،
 * والترويسة وترقيم الصفحات وأرقامها، والعلامة المائية.
 */
import type { HeadChoice } from './types';
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { ToolSep, Tool } from '../editorKit';
import { type PageSize, PAGE_NAMES, type Numerals, MARGIN_PRESETS, type MarginPreset, type Doc, type PageSetup } from '@shared/doc';
import { pagesLabel } from './commands';

type Props = {
  head: HeadChoice | undefined;
  topRule: () => { pos: number; size: number; } | null;
  toggleLinesRule: () => void;
  doc: Doc;
  setPage: (patch: Partial<PageSetup>) => void;
  preset: 'narrow' | 'medium' | 'wide' | null;
  customMargins: boolean;
  setCustomMargins: Dispatch<SetStateAction<boolean>>;
  margins: { top: number; right: number; bottom: number; left: number; };
  pages: number;
};

export default function SheetBar({ head, topRule, toggleLinesRule, doc, setPage, preset, customMargins, setCustomMargins, margins, pages }: Props) {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [tempW, setTempW] = useState(doc.pageSetup.customSize?.w ?? 210);
  const [tempH, setTempH] = useState(doc.pageSetup.customSize?.h ?? 297);

  useEffect(() => {
    if (showCustomDialog) {
      setTempW(doc.pageSetup.customSize?.w ?? 210);
      setTempH(doc.pageSetup.customSize?.h ?? 297);
    }
  }, [showCustomDialog, doc.pageSetup.customSize]);
  return (
    <div className="flex items-center gap-1 flex-wrap px-space-sm py-1 bg-surface-container-low border-b border-outline-variant/30" data-page-bar="">
      {head && (
      <>
        <span className="font-label-sm text-label-sm text-on-surface-variant ms-1">الترويسة</span>
        {(
          [
            ['formal', 'رسمية', 'ترويسةٌ من المكتبة تُطبع فوق المتن'],
            ['lines', 'أسطرٌ في أعلى الورقة', 'تكتب الرأس على الورقة نفسها كما في Word'],
            ['none', 'بلا', 'لا شيء فوق المتن']
          ] as const
        ).map(([m, label, hint]) => {
          const noLibrary = m === 'formal' && head.letterheads.length === 0 && !head.onEdit;
          return (
            <button
              key={m}
              className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors disabled:opacity-40 ${
                head.mode === m ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
              }`}
              data-head={m}
              disabled={noLibrary}
              title={noLibrary ? 'لا ترويسة في المكتبة بعد — صمّمها من «الترويسات والشعارات»' : hint}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (m === 'formal') {
                  if (head.mode === 'formal') return;
                  const first = head.letterheads[0];
                  if (first) head.onChoose({ mode: 'formal', id: first.id });
                  else head.onEdit?.();
                } else head.onChoose({ mode: m });
              }}
            >
              {label}
            </button>
          );
        })}
        {head.mode === 'formal' && head.letterheads.length > 1 && (
          <select
            aria-label="الترويسة الرسمية"
            className="h-8 max-w-[11rem] rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
            data-act="letterhead"
            value={head.letterheadId ?? ''}
            onChange={(e) => e.target.value && head.onChoose({ mode: 'formal', id: Number(e.target.value) })}
          >
            {head.letterheadId === null && <option value="">ترويسة هذا الكتاب</option>}
            {head.letterheads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        {(head.mode === 'lines' || (head.mode === 'formal' && head.divider)) && (
          <label className="flex items-center gap-1 px-1 font-label-md text-label-md text-on-surface cursor-pointer" title="خطٌّ أفقيّ بين الرأس والمتن">
            <input
              checked={head.mode === 'lines' ? Boolean(topRule()) : Boolean(head.divider?.on)}
              className="w-4 h-4 accent-secondary"
              data-act="head-divider"
              type="checkbox"
              onChange={(e) => (head.mode === 'lines' ? toggleLinesRule() : head.divider?.set(e.target.checked))}
            />
            خطّ فاصل
          </label>
        )}
        {head.mode === 'formal' && head.onEdit && (
          <button
            className="h-8 px-2 rounded-lg font-label-md text-label-md text-secondary hover:bg-surface-container-high"
            data-act="head-edit"
            type="button"
            onClick={head.onEdit}
          >
            حرّر الترويسة
          </button>
        )}
        <ToolSep />
      </>
    )}
    <span className="font-label-sm text-label-sm text-on-surface-variant ms-1">الورقة</span>
      <select
        aria-label="مقاس الورقة"
        className="h-8 rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
        data-act="page-size"
        value={doc.pageSetup.size}
        onChange={(e) => {
          const s = e.target.value as PageSize;
          if (s === 'custom') {
            const current = doc.pageSetup.customSize ?? { w: 210, h: 297 };
            setPage({ size: 'custom', customSize: current });
            setShowCustomDialog(true);
          } else {
            setPage({ size: s });
          }
        }}
      >
        {(Object.keys(PAGE_NAMES) as PageSize[]).map((s) => (
          <option key={s} value={s}>
            {s === 'custom' ? 'مخصّص...' : PAGE_NAMES[s]}
          </option>
        ))}
      </select>
      {doc.pageSetup.size === 'custom' && (
        <div className="flex items-center gap-1" data-custom-size-controls="">
          <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            عرض
            <input
              className="h-8 w-14 rounded-lg bg-surface-container-lowest px-1.5 text-center font-label-md text-label-md text-on-surface tabular"
              data-custom-w=""
              max={1000}
              min={50}
              type="number"
              value={doc.pageSetup.customSize?.w ?? 210}
              onInput={(e) => {
                const w = Math.max(50, Math.min(1000, Number((e.target as HTMLInputElement).value) || 50));
                setPage({ customSize: { w, h: doc.pageSetup.customSize?.h ?? 297 } });
              }}
              onChange={(e) => {
                const w = Math.max(50, Math.min(1000, Number(e.target.value) || 50));
                setPage({ customSize: { w, h: doc.pageSetup.customSize?.h ?? 297 } });
              }}
            />
          </label>
          <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            ارتفاع
            <input
              className="h-8 w-14 rounded-lg bg-surface-container-lowest px-1.5 text-center font-label-md text-label-md text-on-surface tabular"
              data-custom-h=""
              max={1000}
              min={50}
              type="number"
              value={doc.pageSetup.customSize?.h ?? 297}
              onInput={(e) => {
                const h = Math.max(50, Math.min(1000, Number((e.target as HTMLInputElement).value) || 50));
                setPage({ customSize: { w: doc.pageSetup.customSize?.w ?? 210, h } });
              }}
              onChange={(e) => {
                const h = Math.max(50, Math.min(1000, Number(e.target.value) || 50));
                setPage({ customSize: { w: doc.pageSetup.customSize?.w ?? 210, h } });
              }}
            />
          </label>
          <button
            className="h-8 px-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
            data-act="custom-size-dialog-btn"
            title="حوار مقاس الورقة المخصّص"
            type="button"
            onClick={() => setShowCustomDialog(true)}
          >
            <span className="material-symbols-outlined text-base">aspect_ratio</span>
          </button>
        </div>
      )}
      <Tool act="portrait" icon="crop_portrait" title="عمودية" active={doc.pageSetup.orientation === 'portrait'} onRun={() => setPage({ orientation: 'portrait' })} />
      <Tool act="landscape" icon="crop_landscape" title="أفقية" active={doc.pageSetup.orientation === 'landscape'} onRun={() => setPage({ orientation: 'landscape' })} />
      {/* أرقام الورقة كما في ورقة الأسئلة: الترقيم و«صفحة ١ من ٢» — ونصّ الكتاب كما كُتب (ما بعد البند ٣). */}
      <select
        aria-label="أرقام الترقيم والصفحات"
        className="h-8 rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md text-on-surface"
        data-act="numerals"
        title="أرقام الترقيم وأرقام الصفحات — ونصّ الكتاب يبقى كما كُتب"
        value={doc.pageSetup.numerals}
        onChange={(e) => setPage({ numerals: e.target.value as Numerals })}
      >
        <option value="arabic">1 2 3</option>
        <option value="indic">١ ٢ ٣</option>
      </select>
      <ToolSep />
      <span className="font-label-sm text-label-sm text-on-surface-variant">الهوامش</span>
      {(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((k) => (
        <button
          key={k}
          className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors ${
            preset === k && !customMargins ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
          }`}
          data-margins={k}
          title={`${MARGIN_PRESETS[k].mm} ملم من كلّ جانب`}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setCustomMargins(false);
            const mm = MARGIN_PRESETS[k].mm;
            setPage({ margins: { top: mm, right: mm, bottom: mm, left: mm } });
          }}
        >
          {MARGIN_PRESETS[k].label}
        </button>
      ))}
      <button
        className={`h-8 px-2.5 rounded-lg font-label-md text-label-md transition-colors ${
          preset === null || customMargins ? 'bg-secondary-fixed text-secondary font-bold' : 'text-on-surface hover:bg-surface-container-high'
        }`}
        data-margins="custom"
        title="هامشٌ لكلّ جانبٍ بالملّيمتر"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setCustomMargins((v) => !v)}
      >
        مخصّصة
      </button>
      {(customMargins || preset === null) &&
        (
          [
            ['top', 'أعلى'],
            ['right', 'يمين'],
            ['bottom', 'أسفل'],
            ['left', 'يسار']
          ] as const
        ).map(([side, label]) => (
          <label key={side} className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            {label}
            <input
              className="h-8 w-14 rounded-lg bg-surface-container-lowest px-1.5 text-center font-label-md text-label-md text-on-surface tabular"
              data-margin={side}
              max={60}
              min={0}
              type="number"
              value={margins[side]}
              onChange={(e) => {
                const v = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                setPage({ margins: { ...margins, [side]: v } });
              }}
            />
          </label>
        ))}
      <span className="ms-auto font-label-sm text-label-sm text-on-surface-variant tabular" data-page-count={pages}>
        {pagesLabel(pages)}
      </span>
      {showCustomDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-space-md"
          data-custom-size-dialog=""
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomDialog(false);
          }}
        >
          <div className="bg-surface-container-high p-space-md rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col gap-3 min-w-[18rem]">
            <h3 className="font-title-sm text-title-sm text-on-surface">مقاس مخصّص للورقة (ملم)</h3>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex flex-col gap-1 font-label-sm text-on-surface-variant">
                العرض (ملم)
                <input
                  type="number"
                  data-dialog-custom-w=""
                  className="h-9 rounded-lg bg-surface-container-lowest px-2 font-body-md text-on-surface tabular border border-outline-variant/40"
                  min={50}
                  max={1000}
                  value={tempW}
                  onInput={(e) => setTempW(Number((e.target as HTMLInputElement).value) || 0)}
                  onChange={(e) => setTempW(Number(e.target.value) || 0)}
                />
              </label>
              <label className="flex-1 flex flex-col gap-1 font-label-sm text-on-surface-variant">
                الارتفاع (ملم)
                <input
                  type="number"
                  data-dialog-custom-h=""
                  className="h-9 rounded-lg bg-surface-container-lowest px-2 font-body-md text-on-surface tabular border border-outline-variant/40"
                  min={50}
                  max={1000}
                  value={tempH}
                  onInput={(e) => setTempH(Number((e.target as HTMLInputElement).value) || 0)}
                  onChange={(e) => setTempH(Number(e.target.value) || 0)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                data-act="custom-size-cancel"
                className="h-9 px-3 rounded-lg hover:bg-surface-container-highest text-on-surface font-label-md"
                onClick={() => setShowCustomDialog(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                data-act="custom-size-apply"
                className="h-9 px-4 rounded-lg bg-primary text-on-primary font-label-md font-bold"
                onClick={() => {
                  const w = Math.max(50, Math.min(1000, tempW || 210));
                  const h = Math.max(50, Math.min(1000, tempH || 297));
                  setPage({ size: 'custom', customSize: { w, h } });
                  setShowCustomDialog(false);
                }}
              >
                تطبيق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
