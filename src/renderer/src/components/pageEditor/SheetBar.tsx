/**
 * شريط الورقة في محرّر الورقة (تقسيم PageEditor بعد ١٫٧٫٠) — منقولٌ منه كما هو: المقاس والاتجاه والهوامش بكلمةٍ أو بأرقام،
 * والترويسة وترقيم الصفحات وأرقامها، والعلامة المائية.
 */
import type { HeadChoice } from './types';
import type { Dispatch, SetStateAction } from 'react';
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
        onChange={(e) => setPage({ size: e.target.value as PageSize })}
      >
        {(Object.keys(PAGE_NAMES) as PageSize[]).map((s) => (
          <option key={s} value={s}>
            {PAGE_NAMES[s]}
          </option>
        ))}
      </select>
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
    </div>
  );
}
