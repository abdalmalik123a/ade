/**
 * شريط اللوحة: الوجه والظهر، والتراجع، و«تحرير ▾» (الحافظة والتجميع) و«رتّب ▾» (المحاذاة والتوزيع والطبقات)، والشبكة
 * والمعاينة، والتكبير، والنسخ والحفظ. وكان نحو ثلاثين أيقونةً في صفٍّ واحد — لغة مصمّمٍ لا موظف (محادثة «التصاميم»،
 * البند ١٣): فما يُستعمل كلّ يوم ظاهر، والباقي في قائمتين بأسمائه واختصاراته (`ToolbarMenu`).
 */
import { emptyCanvas } from '@shared/canvas';
import { startCanvasHistory, type AlignMode, type LayerMove } from '@shared/canvasEdit';
import { NUM, TOOL } from './kit';
import type { DesignEditor } from './useDesignEditor';
import ToolbarMenu from './ToolbarMenu';
import DesignToolDock from './DesignToolDock';
import ContextFormatBar from './ContextFormatBar';

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

/** سطرٌ في قائمة «تحرير»: أيقونةٌ واسمٌ واختصار. */
const ROW = 'h-8 px-2 rounded-card flex items-center gap-2 text-on-surface hover:bg-surface-container-high font-label-md text-label-md disabled:opacity-40 disabled:hover:bg-transparent';
const CAPTION = 'font-label-sm text-label-sm text-on-surface-variant';

type EditAct = 'selectAll' | 'copy' | 'cut' | 'paste' | 'group' | 'ungroup';
/** الفعل وأيقونته واسمه واختصاره، وما يلزم ليُفعَّل. */
const EDIT_TOOLS: [EditAct, string, string, string, 'selection' | 'two' | 'group' | null][] = [
  ['selectAll', 'select_all', 'حدّد الكلّ', 'Ctrl+A', null],
  ['copy', 'content_copy', 'انسخ', 'Ctrl+C', 'selection'],
  ['cut', 'content_cut', 'قصّ', 'Ctrl+X', 'selection'],
  ['paste', 'content_paste', 'الصق', 'Ctrl+V', null],
  ['group', 'group_work', 'جمّع', 'Ctrl+G', 'two'],
  ['ungroup', 'workspaces', 'فكّ التجميع', 'Ctrl+Shift+G', 'group']
];
const EDIT_RUN: Record<EditAct, (ed: DesignEditor) => unknown> = {
  selectAll: (ed) => ed.selectAll(),
  copy: (ed) => ed.copy(),
  cut: (ed) => ed.cut(),
  paste: (ed) => ed.paste(),
  group: (ed) => ed.group(),
  ungroup: (ed) => ed.ungroup()
};

const SAVE = 'h-9 px-space-md rounded-card bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50';
const SAVE_COPY = 'h-9 px-space-md rounded-card bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50';

export default function EditorToolbar({ ed }: { ed: DesignEditor }) {
  const { activeSide, selection, grid, preview, zoom, copies, designId, busy } = ed;
  const side = (on: boolean) =>
    `px-3 py-1 rounded-md font-label-sm text-label-sm font-semibold flex items-center gap-1.5 transition-colors ${
      on ? 'bg-primary-fixed text-primary shadow-xs' : 'text-on-surface hover:bg-surface-container-high'
    }`;
  return (
    <div className="h-14 px-space-lg flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest overflow-x-auto">
      {/* مبدل الوجه والظهر */}
      <div className="flex items-center bg-surface-container-low p-0.5 rounded-card border border-outline-variant shrink-0" data-side-tabs="">
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

      {/* شريط الأدوات السريع (Dock) */}
      <DesignToolDock ed={ed} />

      {/* شريط التنسيق السياقي عند وجود عنصر محدد */}
      {selection.length > 0 && <ContextFormatBar ed={ed} />}

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      {/* الحافظة والتجميع (DESIGNS.md ١٫٦) — لكلّ اختصارٍ زرّه، باسمه في القائمة. */}
      <ToolbarMenu act="edit" icon="edit" label="تحرير">
        {EDIT_TOOLS.map(([act, icon, name, keys, needs]) => (
          <button
            key={act}
            className={ROW}
            data-edit={act}
            title={`${name} (${keys})`}
            type="button"
            disabled={needs === 'selection' ? !selection.length : needs === 'two' ? selection.length < 2 : needs === 'group' ? !ed.grouped : false}
            onClick={() => void EDIT_RUN[act](ed)}
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{icon}</span>
            <span className="flex-1 text-right">{name}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant" dir="ltr">
              {keys}
            </span>
          </button>
        ))}
      </ToolbarMenu>

      {/* المحاذاة والتوزيع والطبقات — لما حُدِّد. */}
      <ToolbarMenu act="arrange" icon="align_horizontal_center" label="رتّب">
        <span className={CAPTION}>المحاذاة{selection.length ? '' : ' — حدّد عنصرًا أوّلًا'}</span>
        <div className="flex items-center gap-1">
          {ALIGNS.map(([mode, icon, label]) => (
            <button key={mode} className={TOOL} data-align={mode} title={label} type="button" disabled={!selection.length} onClick={() => ed.align(mode)}>
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </button>
          ))}
        </div>
        <span className={CAPTION}>التوزيع — لثلاثة عناصر فأكثر</span>
        <div className="flex items-center gap-1">
          <button className={ROW} data-spread="x" title="وزّع أفقيًّا" type="button" disabled={selection.length < 3} onClick={() => ed.spread('x')}>
            <span className="material-symbols-outlined text-[18px]">horizontal_distribute</span>
            أفقيًّا
          </button>
          <button className={ROW} data-spread="y" title="وزّع عموديًّا" type="button" disabled={selection.length < 3} onClick={() => ed.spread('y')}>
            <span className="material-symbols-outlined text-[18px]">vertical_distribute</span>
            عموديًّا
          </button>
        </div>
        <span className={CAPTION}>الطبقات</span>
        <div className="grid grid-cols-2 gap-1">
          {LAYERS.map(([move, icon, label]) => (
            <button key={move} className={ROW} data-layer-move={move} title={label} type="button" disabled={!selection.length} onClick={() => ed.layer(move)}>
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </ToolbarMenu>

      <div className="w-px h-6 bg-outline-variant shrink-0" />

      <button className={`${TOOL} ${grid ? 'bg-primary-fixed text-primary' : ''}`} title="شبكة بسنتيمتر" type="button" onClick={() => ed.setGrid((g) => !g)}>
        <span className="material-symbols-outlined text-[18px]">grid_4x4</span>
      </button>
      <button
        className={`${TOOL} ${preview ? 'bg-primary-fixed text-primary' : ''}`}
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

      <button className={TOOL} data-zoom="out" title="صغّر (Ctrl مع العجلة)" type="button" onClick={() => ed.zoomBy(1 / 1.2)}>
        <span className="material-symbols-outlined text-[18px]">zoom_out</span>
      </button>
      <button className={TOOL} data-zoom="fit" title="بقدر الشاشة" type="button" onClick={ed.zoomFit}>
        <span className="material-symbols-outlined text-[18px]">fit_screen</span>
      </button>
      <button className={TOOL} data-zoom="in" title="كبّر (Ctrl مع العجلة)" type="button" onClick={() => ed.zoomBy(1.2)}>
        <span className="material-symbols-outlined text-[18px]">zoom_in</span>
      </button>
      <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap shrink-0">{Math.round(zoom * 100)}٪</span>

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
