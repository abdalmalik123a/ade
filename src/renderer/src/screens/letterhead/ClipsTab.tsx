/**
 * تبويب «الكليشات» في شاشة الترويسة (تقسيمها بعد ١٫٧٫٠) — منقولٌ من `LetterheadScreen` كما هو: كتابة العبارة واتّجاهها وقائمتها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { settingInput } from './shared';
import type { Addressing, Clip } from '@shared/api';
import { guessAddressing, ADDRESSING_LABEL, ADDRESSING, ADDRESSING_HINT } from '@shared/addressing';

type Props = {
  editingClipId: number | null;
  clipTitle: string;
  setClipTitle: Dispatch<SetStateAction<string>>;
  clipCategory: string;
  setClipCategory: Dispatch<SetStateAction<string>>;
  clipBody: string;
  setClipBody: Dispatch<SetStateAction<string>>;
  clipDirection: Addressing | 'auto' | 'any';
  setClipDirection: Dispatch<SetStateAction<Addressing | 'auto' | 'any'>>;
  saveClip: () => Promise<void>;
  setEditingClipId: Dispatch<SetStateAction<number | null>>;
  clipsList: Clip[];
  clipQuery: string;
  setClipQuery: Dispatch<SetStateAction<string>>;
  deleteClip: (id: number) => Promise<void>;
};

export default function ClipsTab({ editingClipId, clipTitle, setClipTitle, clipCategory, setClipCategory, clipBody, setClipBody, clipDirection, setClipDirection, saveClip, setEditingClipId, clipsList, clipQuery, setClipQuery, deleteClip }: Props) {
  return (
    <div className="flex-1 flex flex-col p-space-md space-y-space-md overflow-y-auto">
      <div className="bg-surface-container-lowest p-space-md rounded-card shadow-xs space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-ico bg-grad-act text-on-primary shadow-act">
              <span className="material-symbols-outlined text-[18px]">post_add</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {editingClipId ? 'تعديل كليشة' : 'إضافة كليشة جديدة'}
            </h3>
          </div>
        </div>

        <div className="space-y-space-xs">
          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                عنوان الكليشة <span className="text-error">*</span>
              </span>
              <input
                className={settingInput}
                placeholder="مثال: افتتاحية محكمة البداءة"
                type="text"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                التصنيف
              </span>
              <input
                className={settingInput}
                placeholder="مثال: محاكم، كتب إدارية…"
                type="text"
                value={clipCategory}
                onChange={(e) => setClipCategory(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              محتوى النص / الكليشة <span className="text-error">*</span>
            </span>
            <textarea
              className="input-field w-full min-h-[100px] p-space-sm text-on-surface font-label-md text-label-md leading-6 resize-y"
              placeholder="اكتب العبارة أو النص الذي تعيد استخدامه دائمًا…"
              value={clipBody}
              onChange={(e) => setClipBody(e.target.value)}
            />
          </label>

          {/* لمن تُكتب: فتتصدّر في كتابٍ باتجاهها (FOUNDATION §٦) */}
          <label className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium shrink-0">تُكتب</span>
            <select
              className={`${settingInput} cursor-pointer`}
              data-clip-direction-input=""
              value={clipDirection}
              onChange={(e) => setClipDirection(e.target.value as Addressing | 'auto' | 'any')}
            >
              <option value="auto">
                {(() => {
                  const g = guessAddressing(clipBody);
                  return g ? `تلقائيًّا من أفعالها — ${ADDRESSING_LABEL[g]}` : 'تلقائيًّا من أفعالها';
                })()}
              </option>
              {ADDRESSING.map((a) => (
                <option key={a} value={a}>
                  {ADDRESSING_LABEL[a]} ({ADDRESSING_HINT[a]})
                </option>
              ))}
              <option value="any">لأيّ جهة</option>
            </select>
          </label>

          <div className="flex items-center gap-space-xs pt-space-xs">
            <button
              className="flex-1 h-9 btn-act font-label-md text-label-md font-bold flex items-center justify-center gap-space-xs transition-all"
              type="button"
              onClick={() => void saveClip()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{editingClipId ? 'حفظ التعديل' : 'حفظ الكليشة'}</span>
            </button>
            {editingClipId && (
              <button
                className="h-9 px-3 rounded-btn text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-label-md"
                type="button"
                onClick={() => {
                  setEditingClipId(null);
                  setClipTitle('');
                  setClipBody('');
                  setClipCategory('');
                  setClipDirection('auto');
                }}
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
      </div>

      {/* قائمة الكليشات */}
      <div className="bg-surface-container-lowest p-space-md rounded-card shadow-xs space-y-space-sm flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            الكليشات المحفوظة ({clipsList.length})
          </span>
          <div className="w-48 relative">
            <input
              className="input-field w-full h-8 pr-7 pl-2 text-on-surface font-label-sm text-label-sm"
              placeholder="بحث في الكليشات…"
              type="search"
              value={clipQuery}
              onChange={(e) => setClipQuery(e.target.value)}
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-space-xs pr-1">
          {clipsList.length === 0 ? (
            <div className="py-space-xl text-center flex flex-col items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">article</span>
              <span className="font-label-md text-label-md">لا توجد كليشات محفوظة</span>
              <span className="font-label-sm text-label-sm">تُبنى من عمل المكتب: اكتب العبارة التي تتكرّر واحفظها</span>
            </div>
          ) : (
            clipsList.map((c) => (
              <div
                key={c.id}
                className="p-space-sm rounded-card bg-surface-container-low hover:bg-surface-container-high transition-all flex flex-col gap-1 border border-outline-variant/20"
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    {c.title}
                  </span>
                  <div className="flex items-center gap-1">
                    {c.direction && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant">
                        {ADDRESSING_LABEL[c.direction]}
                      </span>
                    )}
                    {c.category && (
                      <span className="px-2 py-0.5 rounded-chip text-[10px] bg-primary-fixed text-primary font-semibold">
                        {c.category}
                      </span>
                    )}
                    <button
                      className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-secondary"
                      title="تعديل الكليشة"
                      type="button"
                      onClick={() => {
                        setEditingClipId(c.id);
                        setClipTitle(c.title);
                        setClipBody(c.body);
                        setClipDirection(c.direction ?? 'any');
                        setClipCategory(c.category ?? '');
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      className="w-7 h-7 rounded flex items-center justify-center text-error hover:bg-error-container"
                      title="حذف الكليشة"
                      type="button"
                      onClick={() => void deleteClip(c.id)}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant line-clamp-2 whitespace-pre-wrap leading-5">
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
