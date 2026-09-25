/**
 * الدفعة — قائمة الصفّ من Excel، ومجلّد صوره، وكم ورقةً ستخرج.
 *
 * يُنسخ من Excel ويُلصق هنا كما هو. ويُقال للمكتب قبل الطباعة ما سيحدث: كم
 * اسمًا، وكم ورقة، وكم صورةً طوبقت ولمن لم توجد صورته — فلا تُطبع أربعمئة هوية
 * ثم يُكتشف أن ثلاثين منها بلا صورة.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DocField } from '@shared/doc';
import { matchPhotos, parseRows, type Photo } from '@shared/batch';
import { sheetCount, type Imposition } from '@shared/imposition';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function BatchPanel({
  fields,
  imageKeys,
  imp,
  initialText = '',
  onRows,
  onPreview
}: {
  /** قائمةٌ جاءت مع طلب — تُفتح بها الدفعة جاهزة. */
  initialText?: string;
  fields: DocField[];
  /** حقول الصور — تُملأ من المجلّد لا من القائمة. */
  imageKeys: string[];
  imp: Imposition;
  onRows: (rows: Record<string, string>[]) => void;
  onPreview: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);

  const textKeys = fields.map((f) => f.key).filter((k) => !imageKeys.includes(k));
  const parsed = useMemo(() => parseRows(text, textKeys), [text, textKeys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const photoKey = imageKeys[0];
  const matched = useMemo(
    () => (photoKey && photos.length ? matchPhotos(parsed.rows, photos, photoKey, textKeys) : null),
    [parsed, photos, photoKey, textKeys.join('|')] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const rows = matched?.rows ?? parsed.rows;

  useEffect(() => onRows(rows), [rows, onRows]);

  async function pickFolder() {
    setBusy(true);
    try {
      const list = await window.diwan.files.pickImageFolder('photos');
      if (list) setPhotos(list);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-sm" data-batch="">
      <div className="flex items-center justify-between">
        <h2 className="font-body-md text-body-md text-on-surface font-semibold">دفعة — قائمة أسماء</h2>
        {text && (
          <button
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-error"
            type="button"
            onClick={() => {
              setText('');
              setPhotos([]);
            }}
          >
            امسح
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-space-sm">
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          افتح ملف Excel، أو انسخ أعمدته والصقها هنا. السطر الأول عناوين: {textKeys.slice(0, 4).join('، ')}
          {textKeys.length > 4 ? '…' : ''}
        </p>
        <button
          className="shrink-0 h-8 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
          data-act="open-sheet"
          type="button"
          onClick={() => void window.diwan.files.readSheet().then((out) => out && setText(out.text))}
        >
          <span className="material-symbols-outlined text-[16px]">table_view</span>
          ملف Excel
        </button>
      </div>
      <textarea
        className="w-full h-28 p-space-sm rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface resize-y"
        data-batch-text=""
        dir="rtl"
        placeholder={`${textKeys.slice(0, 3).join('\t')}\n…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {parsed.rows.length > 0 && (
        <div className="space-y-space-xs">
          <p className="font-label-md text-label-md text-on-surface" data-batch-summary="">
            <b className="tabular">{toIndic(parsed.rows.length)}</b> اسمًا ←{' '}
            <b className="tabular">{toIndic(sheetCount(imp, parsed.rows.length))}</b> ورقة
            {!imp.single && <span className="text-on-surface-variant"> ({toIndic(imp.per)} في الورقة)</span>}
          </p>
          <div className="flex flex-wrap gap-1">
            {parsed.mapped.map((k) => (
              <span key={k} className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                {k}
              </span>
            ))}
          </div>
          {parsed.ignored.length > 0 && (
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              عمودٌ بلا حقلٍ في التصميم فتُرك: {parsed.ignored.join('، ')}
            </p>
          )}
        </div>
      )}

      {photoKey && parsed.rows.length > 0 && (
        <div className="space-y-space-xs">
          <button
            className="w-full h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            data-act="photos"
            disabled={busy}
            type="button"
            onClick={() => void pickFolder()}
          >
            <span className="material-symbols-outlined text-[18px]">photo_library</span>
            {busy ? 'تُنسخ الصور…' : 'مجلّد الصور — كلٌّ باسم صاحبه أو رقمه'}
          </button>
          {matched && (
            <p
              className={`font-label-sm text-label-sm ${matched.unmatched.length ? 'text-error' : 'text-secondary'}`}
              data-batch-photos=""
            >
              طوبقت {toIndic(matched.matched)} صورة من {toIndic(parsed.rows.length)}
              {matched.unmatched.length > 0 &&
                ` — بلا صورة: ${matched.unmatched.slice(0, 5).join('، ')}${matched.unmatched.length > 5 ? '…' : ''}`}
            </p>
          )}
        </div>
      )}

      {parsed.rows.length > 0 && (
        <button
          className="w-full h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5"
          data-act="sheets"
          type="button"
          onClick={onPreview}
        >
          <span className="material-symbols-outlined text-[18px]">grid_view</span>
          راجع الأوراق قبل الطباعة
        </button>
      )}
    </div>
  );
}
