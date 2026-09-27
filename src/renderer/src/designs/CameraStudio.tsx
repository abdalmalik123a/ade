/**
 * استوديو التصوير — صورُ صفٍّ كامل بأسمائهم، طالبًا بعد طالب.
 *
 * يظهر اسم الطالب الحاضر بخطٍّ كبير، ويقف أمام الكاميرا فيقع وجهه في الدليل
 * البيضاوي، و«مسافة» تلتقط: تُقصّ اللقطة بنسبة صورة البطاقة (ما في الإطار هو ما
 * يُطبع — `sourceRect`)، وتُعطى لصاحبها، وينتقل الاسم إلى التالي. و«رجوع» يعيد
 * تصوير السابق.
 *
 * والكاميرا ما يراه الحاسوب منها: المدمجة فيه، أو الموصولة بـUSB — كلتاهما في
 * القائمة باسمها. والكاميرا الاحترافية تُصوِّر إلى مجلّدٍ يراقبه البرنامج:
 * كلّ لقطةٍ جديدة فيه تُعطى للطالب الحاضر، والمصوّر يضغط زرّ كاميرته وحده.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CENTER, sourceRect, type Crop } from '@shared/photoSheet';
import type { Photo } from '@shared/batch';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const FOLDER = '__folder__';
/** عرض الصورة المحفوظة بالبكسل — ٣٠٠ نقطة/إنش لصورةٍ عرضها ٥ سم تقريبًا. */
const OUT_W = 600;

export type StudioPerson = { name: string; key: string };

/** يقصّ من المصدر (فيديو أو صورة) ما في الإطار ويعيده JPEG. */
function capture(source: CanvasImageSource, natural: { w: number; h: number }, aspect: { w: number; h: number }, crop: Crop): string {
  const r = sourceRect(aspect, natural, crop);
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = Math.round((OUT_W * aspect.h) / aspect.w);
  canvas.getContext('2d')!.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function CameraStudio({
  people,
  aspect,
  photoOf,
  onShot,
  onClose
}: {
  people: StudioPerson[];
  /** مقاس صورة البطاقة بالملّم — نسبةُ ما يُقصّ. */
  aspect: { w: number; h: number };
  /** صورةُ كلّ شخصٍ إن التُقطت أو طوبقت — للبدء من أوّل من لا صورة له. */
  photoOf: (key: string) => string | undefined;
  onShot: (photo: Photo) => void;
  onClose: () => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [source, setSource] = useState<string>('');
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(() => Math.max(0, people.findIndex((p) => !photoOf(p.key))));
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const atRef = useRef(at);
  atRef.current = at;

  const person = people[at];

  // الكاميرات التي يراها الحاسوب — بأسمائها بعد الإذن الأوّل.
  useEffect(() => {
    void (async () => {
      try {
        const first = await navigator.mediaDevices.getUserMedia({ video: true });
        first.getTracks().forEach((t) => t.stop());
      } catch {
        // لا كاميرا أو لا إذن — تبقى القائمة ومعها مجلّد الكاميرا الاحترافية.
      }
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setDevices(all);
      setSource((s) => s || all[0]?.deviceId || FOLDER);
    })();
  }, []);

  // تشغيل الكاميرا المختارة بأعلى دقّةٍ تعطيها.
  useEffect(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!source || source === FOLDER) return;
    let alive = true;
    void navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: source }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        setError(null);
      })
      .catch(() => setError('تعذّر فتح الكاميرا — أهي موصولة ولا يستعملها برنامجٌ آخر؟'));
    return () => {
      alive = false;
    };
  }, [source]);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      void window.diwan.camera.unwatch();
    },
    []
  );

  /** يحفظ اللقطة ويعطيها للحاضر، ثم ينتقل إلى التالي. */
  const give = useCallback(
    async (dataUrl: string) => {
      const who = people[atRef.current];
      if (!who) return;
      const src = await window.diwan.camera.store(dataUrl);
      onShot({ name: who.key, src });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      setAt((i) => Math.min(people.length, i + 1));
    },
    [people, onShot]
  );

  const shoot = useCallback(async () => {
    const v = video.current;
    if (!v || !v.videoWidth || busy || !people[atRef.current]) return;
    setBusy(true);
    try {
      await give(capture(v, { w: v.videoWidth, h: v.videoHeight }, aspect, { ...CENTER, zoom }));
    } finally {
      setBusy(false);
    }
  }, [aspect, zoom, give, busy, people]);

  // الكاميرا الاحترافية: كلّ لقطةٍ جديدة في المجلّد تُقصّ من وسطها بنسبة البطاقة.
  useEffect(() => {
    if (source !== FOLDER || !folder) return;
    return window.diwan.camera.onShot((shot) => {
      const img = new Image();
      img.onload = () => void give(capture(img, { w: img.naturalWidth, h: img.naturalHeight }, aspect, CENTER));
      img.src = shot.dataUrl;
    });
  }, [source, folder, aspect, give]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        void shoot();
      } else if (e.key === 'Backspace') setAt((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowLeft') setAt((i) => Math.min(people.length, i + 1));
      else if (e.key === 'ArrowRight') setAt((i) => Math.max(0, i - 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shoot, people.length, onClose]);

  const taken = people.filter((p) => photoOf(p.key)).length;
  const frameH = 420;
  const frameW = (frameH * aspect.w) / aspect.h;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-inverse-surface/95" data-studio="">
      <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-lowest">
        <div className="flex items-center gap-space-md">
          <button className="w-9 h-9 rounded-lg hover:bg-surface-container-high flex items-center justify-center" title="إغلاق (Esc)" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface">استوديو التصوير</div>
            <div className="font-label-sm text-label-sm text-on-surface-variant" data-studio-progress="">
              صُوِّر {toIndic(taken)} من {toIndic(people.length)} — مسافة تلتقط، ورجوع يعيد السابق
            </div>
          </div>
        </div>
        <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface">
          الكاميرا
          <select
            className="h-9 px-space-sm rounded-lg bg-surface-container-low border border-outline-variant"
            data-act="camera-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `كاميرا ${toIndic(i + 1)}`}
              </option>
            ))}
            <option value={FOLDER}>كاميرا احترافية — مجلّد لقطاتها</option>
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center gap-space-xl p-space-lg">
        {/* الاسم الحاضر والتالي — يُقرأ من بعيد */}
        <div className="w-80 flex flex-col gap-space-md text-inverse-on-surface">
          {person ? (
            <>
              <span className="font-label-md text-label-md opacity-70">الآن ({toIndic(at + 1)})</span>
              <span className="text-[34px] leading-tight font-bold" data-studio-name="">
                {person.name}
              </span>
              {people[at + 1] && (
                <span className="font-body-md text-body-md opacity-70">التالي: {people[at + 1]!.name}</span>
              )}
              {photoOf(person.key) && <span className="font-label-md text-label-md text-secondary-fixed">له صورة — التقط ثانيةً لتبديلها</span>}
            </>
          ) : (
            <span className="text-[28px] font-bold" data-studio-done="">اكتمل الصفّ ✓</span>
          )}
        </div>

        {/* الإطار: ما فيه هو ما يُطبع */}
        <div className="flex flex-col items-center gap-space-sm">
          <div className="relative overflow-hidden rounded-lg bg-black shadow-2xl" style={{ width: frameW, height: frameH }}>
            {source === FOLDER ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-space-sm text-white/80 p-space-md text-center">
                <span className="material-symbols-outlined text-[48px]">photo_camera</span>
                {folder ? (
                  <span className="font-label-md text-label-md">يُراقَب: {folder}<br />صوِّر بكاميرتك وتصل اللقطة هنا</span>
                ) : (
                  <button
                    className="h-10 px-space-md rounded-lg bg-white/15 hover:bg-white/25 font-label-md text-label-md"
                    data-act="watch-folder"
                    type="button"
                    onClick={() => void window.diwan.camera.watchFolder().then(setFolder)}
                  >
                    اختر مجلّد لقطات الكاميرا
                  </button>
                )}
              </div>
            ) : (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute max-w-none"
                style={{
                  // الفيديو يُعرض كما يُقصّ: مغطّيًا الإطار، مكبَّرًا حول مركزه.
                  height: frameH * zoom,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            )}
            {/* الدليل البيضاوي للوجه */}
            <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/80" style={{ width: frameW * 0.62, height: frameH * 0.6 }} />
            {flash && <div className="absolute inset-0 bg-white/80" />}
            {error && <div className="absolute inset-x-0 bottom-0 p-space-sm bg-error text-on-error font-label-md text-label-md text-center">{error}</div>}
          </div>
          {source !== FOLDER && (
            <label className="flex items-center gap-space-sm font-label-md text-label-md text-inverse-on-surface">
              تقريب
              <input className="w-48" max={3} min={1} step={0.05} type="range" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
          )}
          <div className="flex items-center gap-space-sm">
            <button className="h-11 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md disabled:opacity-40" disabled={at === 0} type="button" onClick={() => setAt((i) => i - 1)}>
              السابق
            </button>
            <button
              className="h-11 px-space-xl rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-bold disabled:opacity-40"
              data-act="shoot"
              disabled={!person || source === FOLDER || busy}
              type="button"
              onClick={() => void shoot()}
            >
              التقط (مسافة)
            </button>
            <button className="h-11 px-space-md rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md disabled:opacity-40" disabled={!person} type="button" onClick={() => setAt((i) => i + 1)}>
              تخطَّ
            </button>
          </div>
        </div>
      </div>

      {/* الصفّ: من صُوِّر ومن بقي — ونقرةٌ تعود إليه */}
      <div className="shrink-0 h-24 px-space-lg flex items-center gap-space-xs overflow-x-auto bg-surface-container-lowest/10">
        {people.map((p, i) => {
          const src = photoOf(p.key);
          return (
            <button
              key={`${p.key}-${i}`}
              className={`shrink-0 w-14 h-[72px] rounded-md overflow-hidden border-2 ${i === at ? 'border-secondary' : 'border-transparent'} bg-white/10`}
              title={p.name}
              type="button"
              onClick={() => setAt(i)}
            >
              {src ? (
                <img alt="" className="w-full h-full object-cover" src={`diwan://store/${src}`} />
              ) : (
                <span className="text-[10px] text-white/70 leading-tight">{p.name.split(' ')[0]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
