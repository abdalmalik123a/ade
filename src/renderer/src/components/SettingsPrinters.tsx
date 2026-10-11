/**
 * الطابعات في الإعدادات: أدوارها (لكلّ نوع عملٍ «عادي» و«ملوّن» و«اسأل»)، ومعايرة كلّ طابعةٍ بورقة قياس.
 *
 * كانت في `SettingsScreen.tsx` حتى بلغ سقفه، فنُقلت كما هي (محادثة «السجلّ والزبائن وقيد العمل والإعدادات»، البند ٢٠).
 */
import { Fragment, useEffect, useState } from 'react';
import type { PrinterInfo } from '@shared/api';
import { PRINT_ROLES, type PrintRole, type PrintRoleKey, type PrintRoles } from '@shared/printRoles';
import { measureFromOffset, offsetFromMeasure } from '@shared/calibration';

/** أسماء الطابعات في الأدوار، ثم المثبّتة — لاختيار ما يُعايَر. */
export function calibrationPrinters(roles: PrintRoles, printers: PrinterInfo[]): string[] {
  const names = new Set<string>();
  for (const { key } of PRINT_ROLES) {
    const r = roles[key];
    if (r.normal) names.add(r.normal);
    if (r.color) names.add(r.color);
  }
  for (const p of printers) names.add(p.name);
  return [...names];
}

/**
 * أدوار الطابعات (خطة Production، ٢٫١): لكلّ نوع عملٍ طابعة «عادي» و«ملوّن» اختيارية، و«اسأل عند
 * كل طباعة». واسمٌ محفوظ لطابعةٍ لم تعد مثبّتة يبقى ظاهرًا «غير مثبّتة» — لا يُمحى صامتًا.
 */
export function PrintRolesTable({
  roles,
  printers,
  onChange
}: {
  roles: PrintRoles;
  printers: PrinterInfo[];
  onChange: (next: PrintRoles) => void;
}) {
  const set = (key: PrintRoleKey, next: Partial<PrintRole>) => {
    const role = { ...roles[key], ...next };
    if (!role.normal) role.color = null;
    if (role.color === role.normal) role.color = null;
    onChange({ ...roles, [key]: role });
  };
  const installed = new Set(printers.map((p) => p.name));
  const options = (current: string | null) => (
    <>
      {current && !installed.has(current) && <option value={current}>{current} (غير مثبّتة)</option>}
      {printers.map((p) => (
        <option key={p.name} value={p.name}>
          {p.displayName}
          {p.isDefault ? ' (طابعة النظام)' : ''}
        </option>
      ))}
    </>
  );
  const select =
    'w-full h-9 px-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

  return (
    <div className="flex flex-col gap-space-xs" data-print-roles="">
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {printers.length === 0
          ? 'لا طابعة مثبّتة على هذا الجهاز — ثبّتها في ويندوز ثم ارجع إلى هنا.'
          : 'طابعةٌ واحدة تطبع مباشرة بلا سؤال. وطابعتان (عادي وملوّن) يُسأل بينهما عند الطبع. و«اسأل» يعرض الطابعات كلّها في كلّ مرّة.'}
      </p>
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-space-sm gap-y-space-xs items-center">
        <span className="font-label-sm text-label-sm text-on-surface-variant">نوع العمل</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">عادي</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">ملوّن (اختياري)</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">اسأل</span>
        {PRINT_ROLES.map(({ key, label, hint }) => {
          const role = roles[key];
          return (
            <Fragment key={key}>
              <span className="flex flex-col min-w-0" data-role-label={key}>
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{label}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{hint}</span>
              </span>
              <select
                className={select}
                data-role={key}
                data-role-slot="normal"
                value={role.normal ?? ''}
                onChange={(e) => set(key, { normal: e.target.value || null })}
              >
                <option value="">— تُختار عند الطبع —</option>
                {options(role.normal)}
              </select>
              <select
                className={`${select} disabled:opacity-40`}
                data-role={key}
                data-role-slot="color"
                disabled={!role.normal}
                value={role.color ?? ''}
                onChange={(e) => set(key, { color: e.target.value || null })}
              >
                <option value="">— لا —</option>
                {options(role.color)}
              </select>
              <input
                checked={role.dialog || !role.normal}
                className="w-5 h-5 accent-secondary justify-self-center"
                data-role={key}
                data-role-slot="dialog"
                disabled={!role.normal}
                title={role.normal ? 'تُعرض الطابعات للاختيار عند كل طباعة' : 'بلا طابعة محدّدة يُسأل دائمًا'}
                type="checkbox"
                onChange={(e) => set(key, { dialog: e.target.checked })}
              />
            </Fragment>
          );
        })}
      </div>
      {printers.length > 0 && (
        <button
          className="self-start h-8 px-space-sm rounded-lg text-secondary hover:bg-surface-container-high font-label-sm text-label-sm"
          data-act="roles-like-documents"
          type="button"
          onClick={() => {
            const base = roles.documents;
            const next = { ...roles };
            for (const { key } of PRINT_ROLES) next[key] = { ...base };
            onChange(next);
          }}
        >
          اجعل الأدوار كلّها مثل «الكتب والمعاملات»
        </button>
      )}
    </div>
  );
}

/**
 * معايرة الطابعة: ورقةٌ تُطبع، وقياسان بالمسطرة يُكتبان كما هما.
 *
 * الطابعات تزيح الطباعة ملّمًا أو اثنين — فتقع الكتابة خارج خانات الاستمارة
 * المطبوعة سلفًا، ويُقصّ طرف الهويّة. والإزاحة لكل طابعة، وللطباعة الورقية وحدها.
 */
export function PrinterCalibration({
  printers,
  initial,
  offsets,
  onSaved,
  say
}: {
  printers: string[];
  initial: string | null;
  offsets: Record<string, { x: number; y: number }>;
  onSaved: (next: Record<string, { x: number; y: number }>) => void;
  say: (text: string, tone?: 'ok' | 'warn') => void;
}) {
  // لكلّ طابعةٍ إزاحتها: تُختار هنا أيّها تُعايَر — وأوّلها طابعة الكتب.
  const [chosen, setChosen] = useState<string | null>(null);
  const printer = chosen && printers.includes(chosen) ? chosen : (initial ?? printers[0] ?? null);
  const current = offsets[printer ?? ''] ?? { x: 0, y: 0 };
  const seed = measureFromOffset(current);
  const [fromRight, setFromRight] = useState(String(seed.fromRight));
  const [fromTop, setFromTop] = useState(String(seed.fromTop));
  useEffect(() => {
    const m = measureFromOffset(offsets[printer ?? ''] ?? { x: 0, y: 0 });
    setFromRight(String(m.fromRight));
    setFromTop(String(m.fromTop));
  }, [printer, offsets]);

  const num = (v: string) => Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.'));
  const box =
    'w-20 h-9 px-2 rounded-lg bg-surface-container-low border border-outline-variant text-center tabular font-label-md text-label-md text-on-surface';

  if (!printer)
    return (
      <p className="font-label-sm text-label-sm text-on-surface-variant" data-calibration="">
        معايرة الطابعة: ثبّت طابعةً في ويندوز، ثم عايرها من هنا.
      </p>
    );

  return (
    <div className="rounded-lg bg-surface-container-low p-space-sm space-y-space-xs" data-calibration="">
      <div className="flex items-center justify-between gap-space-sm">
        <span className="font-label-md text-label-md text-on-surface font-semibold shrink-0">معايرة الطابعة</span>
        <select
          className="min-w-0 flex-1 h-8 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm"
          data-calibration-printer=""
          value={printer}
          onChange={(e) => setChosen(e.target.value)}
        >
          {printers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="font-label-sm text-label-sm text-on-surface-variant tabular" data-calibration-offset="">
          {current.x || current.y ? `الإزاحة: ${current.x} يمينًا، ${current.y} نزولًا (ملم)` : 'بلا إزاحة'}
        </span>
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        اطبع الورقة، وقِس بُعد العلامة العليا عن حافّتي الورقة (الصحيح ٢٠ ملم)، واكتب القياسين كما هما.
      </p>
      <div className="flex flex-wrap items-center gap-space-sm">
        <button
          className="h-9 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
          data-act="print-calibration"
          type="button"
          onClick={() =>
            void window.diwan.output
              .printCalibration(printer)
              .then((r) => say(r.ok ? 'أُرسلت ورقة المعايرة' : r.reason || 'لم تُطبع', r.ok ? 'ok' : 'warn'))
          }
        >
          <span className="material-symbols-outlined text-[16px]">straighten</span>
          اطبع ورقة المعايرة
        </button>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          من اليمين
          <input className={box} data-measure-right="" inputMode="decimal" value={fromRight} onChange={(e) => setFromRight(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          من الأعلى
          <input className={box} data-measure-top="" inputMode="decimal" value={fromTop} onChange={(e) => setFromTop(e.target.value)} />
        </label>
        <button
          className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold"
          data-act="save-calibration"
          type="button"
          onClick={() => {
            const r = num(fromRight);
            const t = num(fromTop);
            if (!Number.isFinite(r) || !Number.isFinite(t) || r < 5 || r > 35 || t < 5 || t > 35) {
              say('القياس بين ٥ و٣٥ ملم — قِس ثانيةً', 'warn');
              return;
            }
            const next = { ...offsets, [printer]: offsetFromMeasure(r, t) };
            void window.diwan.settings.set({ printOffsets: next }).then((saved) => {
              onSaved(saved.printOffsets);
              say('حُفظت معايرة الطابعة');
            });
          }}
        >
          احفظ القياس
        </button>
      </div>
    </div>
  );
}
