/**
 * أدوات لوح المحرّر: البحث والاستبدال، و«هات الزبون»، و«أضف حقلًا إلى الكتاب».
 *
 * كانت في `EditorScreen.tsx` حتى بلغ سقفه، فنُقلت كما هي (محادثة «الشبّاك واليوم الأوّل»).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CitizenDetail, TemplateSummary } from '@shared/api';
import { emptyDoc, paragraph, type Doc } from '@shared/doc';
import { countInDoc, replaceInDoc } from '@shared/findReplace';
import { CORE_FIELDS, FIELD_GROUPS, type CatalogField } from '@shared/letterFields';
import { Modal, inputCls } from './EditorDialogs';

/** بحثٌ واستبدال في الكتاب — متساهلٌ مع الهمزة — وبحثٌ في نصوص المكتبة كلّها. */
export function FindReplaceBar({
  doc,
  templates,
  onChange,
  onOpenTemplate
}: {
  doc: Doc;
  templates: TemplateSummary[];
  onChange: (d: Doc) => void;
  onOpenTemplate: (id: number) => void;
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [loose, setLoose] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const count = countInDoc(doc, find, loose);
  const inLibrary = useMemo(() => {
    if (!find.trim()) return [];
    const probe = emptyDoc();
    return templates.filter((t) => {
      probe.blocks = [paragraph([{ kind: 'run', text: `${t.title}\n${t.bodyHtml}` }])];
      return countInDoc(probe, find, loose) > 0;
    });
  }, [find, loose, templates]);
  return (
    <div className="px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant/40 flex flex-col gap-space-xs" data-find="">
      <div className="flex flex-wrap items-center gap-space-xs">
        <input className={`${inputCls} w-56`} data-find-input="" placeholder="ابحث عن…" value={find} onChange={(e) => (setFind(e.target.value), setMsg(null))} />
        <input className={`${inputCls} w-56`} data-replace-input="" placeholder="واستبدل بـ…" value={replace} onChange={(e) => setReplace(e.target.value)} />
        <label className="flex items-center gap-1 font-label-sm text-label-sm cursor-pointer">
          <input checked={loose} className="w-4 h-4 accent-secondary" type="checkbox" onChange={(e) => setLoose(e.target.checked)} />
          متساهلٌ مع الهمزة
        </label>
        <span className="font-label-sm text-label-sm text-on-surface-variant" data-find-count="">
          {find.trim() ? `${count} في الكتاب` : ''}
        </span>
        <button
          className="h-9 px-3 btn-act font-label-sm text-label-sm disabled:opacity-40"
          data-act="replace-all"
          disabled={count === 0}
          type="button"
          onClick={() => {
            const out = replaceInDoc(doc, find, replace, loose);
            onChange(out.doc);
            setMsg(`استُبدل ${out.count} — والحقول لا تُمسّ`);
          }}
        >
          استبدل الكل
        </button>
        {msg && <span className="font-label-sm text-label-sm text-secondary">{msg}</span>}
      </div>
      {inLibrary.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 font-label-sm text-label-sm">
          <span className="text-on-surface-variant">وفي المكتبة:</span>
          {inLibrary.slice(0, 12).map((t) => (
            <button key={t.id} className="h-7 px-2 rounded-chip bg-surface-container-lowest hover:bg-surface-container-high" type="button" onClick={() => onOpenTemplate(t.id)}>
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** استيراد سريع من سجل المواطنين — F2، والبحث متساهل مع الهمزة. */
export function CitizenPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: CitizenDetail) => void }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ id: number; fullName: string; nationalId: string | null; jobTitle: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void window.diwan.citizens.list({ query, limit: 40 }).then((list) => {
        if (!live) return;
        setRows(list);
        setLoading(false);
      });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <Modal title="هات الزبون" onClose={onClose}>
      <input autoFocus className={inputCls} placeholder="ابحث بالاسم أو الرقم الوطني أو الهاتف..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-space-sm max-h-[50vh] overflow-y-auto divide-y divide-outline-variant">
        {loading ? (
          <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">جارٍ البحث...</div>
        ) : rows.length === 0 ? (
          <div className="py-space-lg text-center text-on-surface-variant font-label-md text-label-md">{query ? 'لا مواطن بهذا البحث' : 'لا زبائن بعد'}</div>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              className="w-full text-right py-space-sm px-space-xs hover:bg-surface-container-high flex items-center justify-between"
              type="button"
              onClick={() => void window.diwan.citizens.get(r.id).then((c) => c && onPick(c))}
            >
              <span className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-bold">{r.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{r.jobTitle ?? '—'}</span>
              </span>
              <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">{r.nationalId ?? ''}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

/** حقلٌ من كتالوج المعاملات الرسمية، أو حقلٌ يسمّيه المكتب — يُدرج في الورقة حيث وقف المؤشّر. */
export function FieldPicker({ existing, onClose, onPick }: { existing: string[]; onClose: () => void; onPick: (f: CatalogField) => void }) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const term = query.trim();
  // صاحب العلاقة أوّلًا: الاسم والرقم الوطني والجهة والغرض — ما لا يخلو منه كتاب.
  const all = [{ name: 'صاحب العلاقة', hint: 'الاسم والرقم الوطني والجهة والغرض', fields: CORE_FIELDS }, ...FIELD_GROUPS];
  const groups = all.map((g) => ({ ...g, fields: g.fields.filter((f) => !term || f.label.includes(term)) })).filter((g) => g.fields.length > 0);
  const used = new Set(existing);
  return (
    <Modal title="أضف حقلًا إلى الكتاب" onClose={onClose}>
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-xs">
          <input
            autoFocus
            className={inputCls}
            placeholder="حقلٌ تسمّيه بنفسك — مثال: رقم الإضبارة"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) onPick({ label: custom.trim(), token: custom.trim() });
            }}
          />
          <button
            className="h-9 px-space-md btn-act font-label-md text-label-md font-bold disabled:opacity-40"
            disabled={!custom.trim()}
            type="button"
            onClick={() => onPick({ label: custom.trim(), token: custom.trim() })}
          >
            أضف
          </button>
        </div>
        <input className={inputCls} placeholder="ابحث في حقول المعاملات الرسمية..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-[45vh] overflow-y-auto flex flex-col gap-space-md">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-space-xs">
              <span className="font-label-lg text-label-lg text-on-surface font-bold">
                {g.name} <span className="font-label-sm text-label-sm text-on-surface-variant font-normal">{g.hint}</span>
              </span>
              <div className="flex flex-wrap gap-space-xs">
                {g.fields.map((f) => (
                  <button
                    key={f.token}
                    className={`h-8 px-space-sm rounded-btn font-label-sm text-label-sm ${used.has(f.label) ? 'bg-surface-container text-on-surface-variant' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'}`}
                    type="button"
                    onClick={() => onPick(f)}
                  >
                    {f.label}
                    {used.has(f.label) && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
