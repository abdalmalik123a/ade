/**
 * «أيّ طابعة؟» — نافذة البرنامج التي تسأل مرّةً للمهمّة كلّها (خطة Production، ٢٫١–٢٫٢).
 *
 * تُركَّب مرّةً في `App` وتنادَى من `choosePrinter`: «عادي أم ملوّن؟» حين للدور طابعتان، وقائمة
 * الطابعات المثبّتة حين طلب المكتب أن يُسأل أو لم يحدّد طابعةً لهذا الدور.
 */
import { useEffect, useRef, useState } from 'react';
import type { PrinterInfo } from '@shared/api';
import { PRINT_ROLES } from '@shared/printRoles';
import { registerPrintChooser, type PrintAsk, type PrintPick } from '../lib/printChoice';

type Pending = PrintAsk & { resolve: (pick: PrintPick | null) => void };

export default function PrintChooser() {
  const [req, setReq] = useState<Pending | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const reqRef = useRef<Pending | null>(null);
  reqRef.current = req;

  useEffect(
    () =>
      registerPrintChooser(
        (ask) =>
          new Promise<PrintPick | null>((resolve) => {
            // سؤالٌ جديد قبل جواب السابق: يُلغى السابق ولا يبقى معلّقًا.
            reqRef.current?.resolve(null);
            setReq({ ...ask, resolve });
            if (ask.plan.kind === 'dialog') {
              const preferred = ask.plan.normal;
              void window.diwan.printers.list().then((list) => {
                setPrinters(list);
                setPicked(
                  list.find((p) => p.name === preferred)?.name ?? list.find((p) => p.isDefault)?.name ?? list[0]?.name ?? null
                );
              });
            }
          })
      ),
    []
  );

  const finish = (pick: PrintPick | null) => {
    req?.resolve(pick);
    setReq(null);
    setPicked(null);
  };

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      } else if (e.key === 'Enter' && req.plan.kind === 'dialog' && picked) {
        e.preventDefault();
        e.stopPropagation();
        finish({ printer: picked, system: false });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!req) return null;
  const role = PRINT_ROLES.find((r) => r.key === req.role);
  const plan = req.plan;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/50 p-space-md"
      data-print-chooser={req.role}
      onClick={(e) => e.target === e.currentTarget && finish(null)}
    >
      <div className="w-full max-w-md max-h-[85vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[26px]">print</span>
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">على أيّ طابعة؟</h2>
            <p className="font-label-md text-label-md text-on-surface-variant truncate">{role?.label}</p>
          </div>
        </div>

        {plan.kind === 'choose-color' ? (
          <div className="p-space-md flex flex-col gap-space-sm">
            {(
              [
                ['normal', 'عادي', 'print', plan.normal],
                ['color', 'ملوّن', 'palette', plan.color]
              ] as const
            ).map(([key, label, icon, name]) => (
              <button
                key={key}
                className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container-high text-start"
                data-print-choice={key}
                type="button"
                onClick={() => finish({ printer: name, system: false })}
              >
                <span className="material-symbols-outlined text-secondary text-[24px]">{icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold">{label}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant truncate">{name}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-xs">
            {printers.length === 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant">لا طابعة مثبّتة في ويندوز.</p>
            )}
            {printers.map((p) => {
              const tag = p.name === plan.normal ? 'عادي' : p.name === plan.color ? 'ملوّن' : null;
              return (
                <button
                  key={p.name}
                  className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-xl text-start ${
                    picked === p.name
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                  }`}
                  data-print-printer={p.name}
                  type="button"
                  onClick={() => setPicked(p.name)}
                  onDoubleClick={() => finish({ printer: p.name, system: false })}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {picked === p.name ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-label-lg text-label-lg">{p.displayName || p.name}</span>
                  {tag && (
                    <span className="px-2 rounded-md bg-surface-container-highest font-label-sm text-label-sm">{tag}</span>
                  )}
                  {!p.ready && <span className="font-label-sm text-label-sm text-error">غير جاهزة</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-space-md flex items-center gap-space-sm border-t border-outline-variant/30">
          {plan.kind === 'dialog' && (
            <button
              className="h-10 px-space-lg rounded-lg bg-secondary text-on-secondary font-label-lg text-label-lg font-bold disabled:opacity-40"
              data-act="print-confirm"
              disabled={!picked}
              type="button"
              onClick={() => picked && finish({ printer: picked, system: false })}
            >
              اطبع
            </button>
          )}
          {plan.kind === 'dialog' && req.allowSystem && (
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
              data-act="print-system"
              disabled={!picked}
              title="تُفتح نافذة ويندوز لضبط الورق والجودة قبل الطبع"
              type="button"
              onClick={() => picked && finish({ printer: picked, system: true })}
            >
              بإعدادات ويندوز…
            </button>
          )}
          <span className="flex-1" />
          <button
            className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
            data-act="print-cancel"
            type="button"
            onClick={() => finish(null)}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
