/** صندوق القسم في لوح المحرّر وعنوانه (تقسيمه بعد ١٫٧٫٠) — منقولان من `EditorScreen` كما هما، وتأخذهما أقسامه. */
export const section = 'bg-surface-container-lowest rounded-card p-space-md shadow-low flex flex-col gap-space-sm';
export const title = (icon: string, text: string, extra?: React.ReactNode) => (
  <div className="flex items-center justify-between gap-space-xs">
    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
      <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
      {text}
    </h3>
    {extra}
  </div>
);
