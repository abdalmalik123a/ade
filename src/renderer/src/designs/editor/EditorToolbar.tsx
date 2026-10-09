/**
 * شريط اللوحة: الوجه والظهر، والتراجع، والمحاذاة والتوزيع، والطبقات، والشبكة والمعاينة، والتكبير، والنسخ والحفظ.
 */
import { emptyCanvas } from '@shared/canvas';
import { startCanvasHistory, type AlignMode, type LayerMove } from '@shared/canvasEdit';
import { NUM, TOOL } from './kit';
import type { DesignEditor } from './useDesignEditor';

const ALIGNS: [AlignMode, string, string][] = [
  ['right', 'align_horizontal_right', 'حاذِ يمينًا'],
  ['hCenter', 'align_horizontal_center', 'وسّط أفقيًّا'],
  ['left', 'align_horizontal_left', 'حاذِ يسارًا'],
  ['top', 'align_vertical_top', 'حاذِ أعلى'],
  ['vCenter', 'align_vertical_center', 'وسّط عموديًّا'],
  ['bottom', 'align_vertical_bottom', 'حاذِ أسفل']
];

const LAYERS: [LayerMove, string, string][] = [
  ['front', 'flip_to_front', 'إلى الأمام'],
  ['forward', 'keyboard_arrow_up', 'خطوةً أمام'],
  ['backward', 'keyboard_arrow_down', 'خطوةً خلف'],
  ['back', 'flip_to_back', 'إلى الخلف']
];

const SAVE = 'h-9 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50';
const SAVE_COPY = 'h-9 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50';

export default function EditorToolbar({ ed }: { ed: DesignEditor }) {
  const { activeSide, selection, grid, preview, zoom, copies, designId, busy } = ed;
  const side = (on: boolean) =>
    `px-3 py-1 rounded-md font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-colors ${
      on ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface hover:bg-surface-container-high'
    }`;
  return (
    <div className="h-14 px-space-lg flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest overflow-x-auto">
      {/* مبدل الوجه والظهر */}
      <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant shrink-0" data-side-tabs="">
        <button
          type="button"
          className={side(activeSide === 'front')}
          onClick={() => {
            ed.setActiveSide('front');
            ed.setSelection([]);
          }}
        >
          <span className="material-symbols-outlined text-[16px]">id_card</span>
          <span>الوجه</span>
        </button>
        <button
          type="button"
          className={side(activeSide === 'back')}
          onClick={() => {
            if (!ed.backHistory) {
              ed.setBackHistory(startCanvasHistory(emptyCanvas(ed.history.present.size, ed.history.present.bleed)));
            }
            ed.setActiveSide('back');
            ed.setSelection([]);
          }}
        >
          <span className="material-symbols-outlined text-[16px]">sync_alt</span>
          <span>الظهر</span>
          {ed.backHasContent && <span className="w-2 h-2 rounded-full bg-secondary inline-block ring-1 ring-white" title="الظهر يحتوي عناصر أو خلفية" />}
        </button>
      </div>

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <button className={TOOL} data-undo title="تراجع (Ctrl+Z)" type="button" onClick={ed.undo}>
          <span className="material-symbols-outlined text-[18px]">undo</span>
        </button>
        <button className={TOOL} title="إعادة (Ctrl+Y)" type="button" onClick={ed.redo}>
          <span className="material-symbols-outlined text-[18px]">redo</span>
        </button>
      </div>

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        {ALIGNS.map(([mode, icon, label]) => (
          <button key={mode} className={TOOL} data-align={mode} title={label} type="button" disabled={!selection.length} onClick={() => ed.align(mode)}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </button>
        ))}
        <button className={TOOL} data-spread="x" title="وزّع أفقيًّا" type="button" disabled={selection.length < 3} onClick={() => ed.spread('x')}>
          <span className="material-symbols-outlined text-[18px]">horizontal_distribute</span>
        </button>
        <button className={TOOL} title="وزّع عموديًّا" type="button" disabled={selection.length < 3} onClick={() => ed.spread('y')}>
          <span className="material-symbols-outlined text-[18px]">vertical_distribute</span>
        </button>
      </div>

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        {LAYERS.map(([move, icon, label]) => (
          <button key={move} className={TOOL} data-layer-move={move} title={label} type="button" disabled={!selection.length} onClick={() => ed.layer(move)}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      <button className={`${TOOL} ${grid ? 'bg-primary-container text-on-primary' : ''}`} title="شبكة بسنتيمتر" type="button" onClick={() => ed.setGrid((g) => !g)}>
        <span className="material-symbols-outlined text-[18px]">grid_4x4</span>
      </button>
      <button
        className={`${TOOL} ${preview ? 'bg-primary-container text-on-primary' : ''}`}
        data-preview
        title="معاينة بلا مقابض"
        type="button"
        onClick={() => {
          ed.setPreview((p) => !p);
          ed.setSelection([]);
        }}
      >
        <span className="material-symbols-outlined text-[18px]">visibility</span>
      </button>

      <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap shrink-0">{Math.round(zoom * 100)}٪</span>
      <input className="w-24 shrink-0" max={3} min={0.15} step={0.05} type="range" value={zoom} onChange={(e) => ed.setZoom(Number(e.target.value))} />

      <div className="flex-1" />

      <div className="flex items-center gap-space-sm shrink-0">
        <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
          نسخ
          <input
            className={NUM}
            inputMode="numeric"
            title="عدد النسخ"
            value={copies}
            onChange={(e) => ed.setCopies(Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
          />
        </label>
        {ed.draftSavedAt && (
          <span
            className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap"
            data-status="design-draft"
            title="ما لم يُحفظ يُحفظ مسودّةً وحده — ويُكمَل من «قيد العمل» ورأس المعرض"
          >
            <span className="material-symbols-outlined text-[16px]">cloud_done</span>
            مسودّة {ed.draftSavedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {designId !== null ? (
          <>
            <button className={SAVE} data-act="save" title="احفظ التعديلات على نفس التصميم" type="button" disabled={busy} onClick={() => void ed.save(false)}>
              <span className="material-symbols-outlined text-[18px]">save</span>
              حفظ التعديلات
            </button>
            <button
              className={SAVE_COPY}
              data-act="save-copy"
              title="احفظ كنسخة جديدة منفصلة"
              type="button"
              disabled={busy}
              onClick={() => void ed.save(true)}
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              حفظ كنسخة
            </button>
          </>
        ) : (
          <button className={SAVE} data-act="save" title="احفظ التصميم" type="button" disabled={busy} onClick={() => void ed.save(false)}>
            <span className="material-symbols-outlined text-[18px]">save</span>
            حفظ التصميم
          </button>
        )}
      </div>
    </div>
  );
}
