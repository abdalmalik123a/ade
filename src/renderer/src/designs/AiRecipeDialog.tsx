import { useEffect, useMemo, useState } from 'react';
import {
  callGeminiAi,
  generateAiPrompt,
  colorsFromText,
  generateOfflineRecipe,
  parseDesignRecipe,
  recipeToCanvas,
  recolorRecipe,
  type DesignColors
} from '@shared/designRecipe';
import {
  generateWebAiPrompt,
  parseWebDesign
} from '@shared/webDesign';
import { SIZE_PRESETS, type Canvas } from '@shared/canvas';

export type AiRecipeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (canvas: Canvas, title: string) => void;
};

const SUGGESTIONS = [
  {
    title: 'شهادة حفظ قرآن كريم',
    desc: 'شهادة إتمام وحفظ القرآن الكريم مع المصحف الشريف وبسملة مذهبة وزخرفة إسلامية',
    preset: 'a4-landscape'
  },
  {
    title: 'شهادة تفوق للأطفال',
    desc: 'شهادة تفوق وتميّز للأطفال في الروضة والابتدائي مع نجوم كارتونية وقلم مرح',
    preset: 'a4-landscape'
  },
  {
    title: 'هوية موظف رسمية',
    desc: 'هوية موظف وبطاقة تعريفية مع موضع صورة شخصية ورمز QR واسم الشركة',
    preset: 'id-card'
  },
  {
    title: 'درع تكريم ووفاء',
    desc: 'درع شكر وتقدير ووفاء رسمي مع كأس ذهبي وإكليل غار ملكي وشعار النسر',
    preset: 'a4-landscape'
  }
];

export default function AiRecipeDialog({ isOpen, onClose, onApply }: AiRecipeDialogProps) {
  const [tab, setTab] = useState<'direct' | 'manual'>('direct');
  const [description, setDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('a4-landscape');
  /** المفتاح يُحفظ في العملية الرئيسية مشفّرًا؛ والواجهة تعرف أنه موجود لا قيمته. */
  const [hasKey, setHasKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  /** ألوان صاحب الطلب — وما لم يُختر يُقرأ من نصّ الطلب، ثم يختاره النموذج. */
  const [picked, setPicked] = useState<DesignColors>({});
  const [busy, setBusy] = useState(false);

  // الكود اليدوي
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // مفتاحٌ قديم في localStorage يُنقل مرّةً إلى الحفظ المشفّر ثم يُمحى منه.
      try {
        const legacy = localStorage.getItem('diwan_gemini_api_key');
        if (legacy?.trim()) await window.diwan.designs.setGeminiKey(legacy);
        localStorage.removeItem('diwan_gemini_api_key');
      } catch {
        // لا localStorage في هذا السياق — لا شيء يُنقل.
      }
      setHasKey(await window.diwan.designs.hasGeminiKey());
    })();
  }, []);

  /** يحفظ ما كُتب في الخانة — ويعيد: أصار عندنا مفتاح؟ */
  const commitKey = async (): Promise<boolean> => {
    if (!keyDraft.trim()) return hasKey;
    await window.diwan.designs.setGeminiKey(keyDraft);
    setKeyDraft('');
    setShowKeyInput(false);
    setHasKey(true);
    return true;
  };

  const forgetKey = async () => {
    await window.diwan.designs.setGeminiKey('');
    setHasKey(false);
    setShowKeyInput(true);
  };

  /** الألوان النافذة: المختار بالخانة أولًا، ثم ما ذُكر في نصّ الطلب. */
  const colors = useMemo<DesignColors>(() => {
    const said = colorsFromText(description);
    return { primary: picked.primary ?? said.primary, accent: picked.accent ?? said.accent };
  }, [picked, description]);

  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  // 1. توليد فوري بالذكاء الاصطناعي (Gemini Free)
  const handleGenerateDirect = async () => {
    if (!description.trim()) {
      say('اكتب ما تريد تصميمه أولاً أو اختر من النماذج الجاهزة');
      return;
    }

    if (!(await commitKey())) {
      setShowKeyInput(true);
      say('يرجى لصق مفتاح Gemini المجاني (Free API Key) أو استخدام التوليد المحلي الفوري');
      return;
    }

    setBusy(true);
    try {
      const res = await callGeminiAi(description, window.diwan.designs.gemini, colors);
      if (res.error || !res.recipe) {
        say(res.error || 'تعذّر التوليد بالذكاء الاصطناعي — يمكنك استخدام التوليد المحلي الفوري');
        return;
      }
      const canvas = recipeToCanvas(res.recipe);
      onApply(canvas, res.recipe.title);
      onClose();
    } catch (e) {
      say(`حدث خطأ أثناء التوليد: ${e instanceof Error ? e.message : 'تحقق من الشبكة'}`);
    } finally {
      setBusy(false);
    }
  };

  // 2. توليد محلي فوري بدون نت نهائيًّا
  const handleGenerateOffline = () => {
    const prompt = description.trim() || 'شهادة شكر وتقدير رسمية';
    // التوليد المحلي بلوحته، ثم تُصبغ بألوان صاحب الطلب إن اختارها أو ذكرها.
    const recipe = recolorRecipe(generateOfflineRecipe(prompt, selectedPreset), colors);
    const canvas = recipeToCanvas(recipe);
    onApply(canvas, recipe.title);
    onClose();
  };

  // 3. التوليد اليدوي (نسخ ولصق)
  /**
   * صيغتان: HTML/CSS لتصميمٍ حرّ فاخر، ووصفة JSON (Diwan Design JSON) تبني طبقاتٍ
   * من عناصر اللوحة نفسها — نصوصًا وحقولًا تُحرَّر وتُدمج دفعةً. واللصق يقبل كليهما.
   */
  const handleCopyPrompt = async (format: 'html' | 'json' = 'html') => {
    const promptText =
      format === 'json' ? generateAiPrompt(description, undefined, colors) : generateWebAiPrompt(description, colors);
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      say('تم نسخ صيغة الطلب للحافظة! الصقها الآن في Gemini أو ChatGPT');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      say('تعذّر النسخ التلقائي — حدّد النص وانسخه يدويًا');
    }
  };

  const parseResult = useMemo(() => {
    if (!isOpen || tab !== 'manual') return null;
    const trimmed = code.trim();
    if (!trimmed) return null;

    if (
      trimmed.includes('<') &&
      (trimmed.includes('div') ||
        trimmed.includes('svg') ||
        trimmed.includes('html') ||
        trimmed.includes('data-layer'))
    ) {
      try {
        const { canvas, title } = parseWebDesign(trimmed);
        if (canvas.elements.length > 0) {
          return { canvas, title, format: 'HTML5/SVG طبقات', count: canvas.elements.length, error: undefined };
        }
      } catch {
        // تراجع
      }
    }

    const { recipe, error } = parseDesignRecipe(trimmed);
    if (recipe) {
      return {
        canvas: recipeToCanvas(recipe),
        title: recipe.title,
        format: 'JSON وصفة',
        count: recipe.elements.length,
        error: undefined
      };
    }

    return { canvas: null, title: '', format: '', count: 0, error: error || 'تعذّر استخراج عناصر التصميم من الكود المدخل' };
  }, [code, isOpen, tab]);

  const handleApplyManual = () => {
    if (!parseResult?.canvas) {
      say(parseResult?.error || 'الصق كود الـ HTML/SVG أو الوصفة أولاً');
      return;
    }
    onApply(parseResult.canvas, parseResult.title);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md text-right">
        {/* الرأس */}
        <header className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[26px]">auto_awesome</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                مصمّم ديوان الذكي بالذكاء الاصطناعي
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                توليد فوري لشهادات التقدير، هويات الموظفين، والدروع — طبقات متحركة 100% بدون أي كود
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* ألسنة التبويب */}
        <div className="flex border-b border-outline-variant gap-2">
          <button
            type="button"
            className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              tab === 'direct'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setTab('direct')}
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            توليد فوري مباشر (بدون كود)
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              tab === 'manual'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setTab('manual')}
          >
            <span className="material-symbols-outlined text-[18px]">code</span>
            لصق كود يدوي (ChatGPT / Claude / Gemini)
          </button>
        </div>

        {/* التبويب 1: التوليد الفوري المباشر */}
        {tab === 'direct' && (
          <div className="space-y-space-md">
            {/* حقل الوصف */}
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md font-bold text-on-surface block">
                اكتب ما تريد تصميمه ببساطة:
              </label>
              <textarea
                className="w-full h-24 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-right"
                placeholder="مثال: شهادة شكر وتقدير لحفظ القرآن الكريم مع المصحف الشريف وزخرفة إسلامية مذهبة وباسم الطالب والشيخ..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* اقتراحات سريعة بنقرة زر */}
            <div className="space-y-1.5">
              <span className="text-[12px] font-bold text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">tips_and_updates</span>
                أو اختر نموذجًا جاهزًا بنقرة واحدة:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="p-2.5 rounded-xl text-right bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/70 hover:border-primary transition-all group"
                    onClick={() => {
                      setDescription(item.desc);
                      setSelectedPreset(item.preset);
                    }}
                  >
                    <div className="font-bold text-[12px] text-primary group-hover:text-primary-container">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-on-surface-variant line-clamp-1">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* خيارات المقاس والمفتاح */}
            <div className="grid grid-cols-2 gap-space-sm pt-1">
              <div>
                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                  المقاس المطلوب:
                </label>
                <select
                  className="w-full h-9 px-2.5 rounded-lg bg-surface-container border border-outline-variant text-[12px] text-on-surface font-semibold focus:outline-none"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                >
                  {SIZE_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} ({p.size.w} × {p.size.h} ملم)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-on-surface-variant">
                    مفتاح Gemini API (مجاني دائمًا):
                  </label>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline font-bold"
                      onClick={() => setShowKeyInput(!showKeyInput)}
                    >
                      {hasKey ? 'تغيير المفتاح' : 'إدخال المفتاح'}
                    </button>
                    {hasKey && (
                      <button type="button" className="text-[11px] text-error hover:underline" onClick={() => void forgetKey()}>
                        حذفه
                      </button>
                    )}
                  </span>
                </div>
                {showKeyInput || !hasKey ? (
                  <input
                    type="password"
                    placeholder="AIzaSy... الصق مفتاحك هنا"
                    value={keyDraft}
                    data-gemini-key=""
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onBlur={() => void commitKey()}
                    className="w-full h-9 px-2.5 rounded-lg bg-surface-container border border-outline-variant text-[12px] font-mono dir-ltr text-left focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <div className="h-9 px-2.5 rounded-lg bg-surface-container flex items-center justify-between text-[11px] text-emerald-700 font-bold">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      المفتاح محفوظ على هذا الجهاز — لا يُطلب ثانيةً
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">••••••••</span>
                  </div>
                )}
              </div>
            </div>

            {/* الألوان: لصاحب الطلب، وإلا قُرئت من نصّه، وإلا اختارها النموذج */}
            <div className="flex items-center gap-space-sm flex-wrap text-[11px]" data-design-colors="">
              <span className="font-bold text-on-surface-variant">ألوان التصميم:</span>
              {(
                [
                  ['primary', 'الرئيسي'],
                  ['accent', 'الإبراز']
                ] as const
              ).map(([role, label]) => (
                <span key={role} className="flex items-center gap-1">
                  <label
                    className="relative w-8 h-8 rounded-lg border border-outline-variant cursor-pointer overflow-hidden flex items-center justify-center"
                    style={colors[role] ? { background: colors[role] } : undefined}
                    title={`اللون ${label}${colors[role] && !picked[role] ? ' — من نصّ الطلب' : ''}`}
                  >
                    {!colors[role] && <span className="material-symbols-outlined text-[16px] text-on-surface-variant">palette</span>}
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={colors[role] ?? '#1f5fbf'}
                      onChange={(e) => setPicked((p) => ({ ...p, [role]: e.target.value }))}
                    />
                  </label>
                  <span className="text-on-surface-variant">{label}</span>
                  {picked[role] && (
                    <button
                      type="button"
                      className="text-on-surface-variant hover:text-error"
                      title="أعده تلقائيًّا"
                      onClick={() => setPicked((p) => ({ ...p, [role]: undefined }))}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </span>
              ))}
              <span className="text-on-surface-variant">
                {colors.primary || colors.accent
                  ? '— يلتزم بها التوليد'
                  : '— تلقائي: اختر لونًا، أو اذكره في الطلب («بألوان خضراء وذهبية»)، أو دع النموذج يختار'}
              </span>
            </div>

            <p className="text-[11px] text-on-surface-variant flex items-center justify-between">
              <span>
                💡 لا تملك مفتاحًا أو الإنترنت غير متوفر؟ اضغط <strong>توليد محلي فوري</strong> وسيعمل 100% بدون نت!
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-bold text-[11px] shrink-0"
              >
                احصل على مفتاح Gemini مجاني ↗
              </a>
            </p>
          </div>
        )}

        {/* التبويب 2: اللصق اليدوي */}
        {tab === 'manual' && (
          <div className="space-y-space-md">
            {/* الخطوة 1 */}
            <div className="bg-surface-container-lowest p-space-sm rounded-xl border border-outline-variant/60 space-y-1.5">
              <span className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary font-bold text-[12px] flex items-center justify-center">1</span>
                انسخ صيغة الطلب للذكاء الاصطناعي:
              </span>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant font-label-md text-label-md text-on-surface focus:outline-none"
                  placeholder="مواصفات التصميم..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  className="h-9 px-3 rounded-lg bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md font-bold flex items-center gap-1"
                  type="button"
                  title="تصميمٌ حرّ بـHTML/CSS"
                  onClick={() => void handleCopyPrompt('html')}
                >
                  <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'تم النسخ' : 'انسخ الطلب (HTML)'}
                </button>
                <button
                  className="h-9 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-bold flex items-center gap-1"
                  type="button"
                  data-act="copy-json-prompt"
                  title="وصفة JSON: طبقاتٌ من عناصر اللوحة، والحقول تُدمج دفعةً"
                  onClick={() => void handleCopyPrompt('json')}
                >
                  <span className="material-symbols-outlined text-[16px]">data_object</span>
                  JSON
                </button>
              </div>
            </div>

            {/* الخطوة 2 */}
            <div className="bg-surface-container-lowest p-space-sm rounded-xl border border-outline-variant/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary font-bold text-[12px] flex items-center justify-center">2</span>
                  الصق الكود الذي يعيده الذكاء الاصطناعي هنا:
                </span>
                {parseResult?.canvas && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 text-[11px] font-bold">
                    جاهز: {parseResult.title} ({parseResult.count} طبقة)
                  </span>
                )}
              </div>
              <textarea
                className="w-full h-32 p-3 rounded-lg bg-surface-container-low border border-outline-variant font-mono text-[12px] text-on-surface focus:outline-none dir-ltr text-left"
                placeholder={'<!-- الصق كود HTML أو JSON هنا -->'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* التنبيهات */}
        {toast && (
          <div className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold text-center animate-pulse">
            {toast}
          </div>
        )}

        {/* التذييل والأزرار */}
        <footer className="flex items-center justify-between pt-space-xs border-t border-outline-variant">
          <span className="font-label-xs text-label-xs text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            تصاميم قابلة للتحريك والسحب بالفأرة 100%
          </span>

          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3.5 rounded-lg hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              إلغاء
            </button>

            {tab === 'direct' ? (
              <>
                <button
                  className="h-9 px-3.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold flex items-center gap-1.5 transition-all border border-outline-variant"
                  type="button"
                  onClick={handleGenerateOffline}
                  disabled={busy}
                  title="توليد محلي فوري بأعلى دقة بدون حاجة للإنترنت"
                >
                  <span className="material-symbols-outlined text-[17px] text-amber-600">offline_bolt</span>
                  توليد محلي فوري (بدون نت)
                </button>

                <button
                  className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-md disabled:opacity-40 transition-all"
                  type="button"
                  onClick={() => void handleGenerateDirect()}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                      جاري التوليد بـ Gemini...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                      توليد فوري بالذكاء الاصطناعي
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5 shadow-md disabled:opacity-40 transition-all"
                disabled={!parseResult?.canvas}
                type="button"
                onClick={handleApplyManual}
              >
                <span className="material-symbols-outlined text-[18px]">draw</span>
                إنشاء التصميم القابل للتحرير
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
