/**
 * التقاطٌ مباشر بكاميرا الحاسوب أو الموصولة به (ج١٢) — في ملف المواطن.
 *
 * المستمسك: الإطار كلّه بأعلى دقّةٍ تعطيها الكاميرا، ثم يُسوّى ويُقوَّم كما يُسوّى
 * مسحُ الهاتف (DeskewModal). والصورة الشخصية: إطارٌ بنسبة ٤×٦ في وسط الصورة يُقصّ
 * كما في الاستوديو. ولا شبكة: الكاميرا جهازٌ محلّي، واللقطة لا تغادر الحاسوب.
 */
import { useEffect, useRef, useState } from 'react';
import { CENTER, sourceRect } from '@shared/photoSheet';

export default function CameraCapture({
  title,
  aspect = null,
  outWidth = 600,
  confirmLabel = 'اعتمد اللقطة',
  secondary,
  onCapture,
  onClose
}: {
  title: string;
  /** نسبة القصّ (الصورة الشخصية ٤×٦) — وبغيرها الإطار كلّه. */
  aspect?: { w: number; h: number } | null;
  /** عرض المقصوص بالبكسل — للصورة الشخصية؛ والإطار الكامل بدقّته. */
  outWidth?: number;
  confirmLabel?: string;
  /** زرٌّ ثانٍ للّقطة: «احفظها كما هي» بجانب «سوِّها وقوِّمها». */
  secondary?: { label: string; onPick: (dataUrl: string) => void };
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [source, setSource] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // الكاميرات التي يراها الحاسوب — بأسمائها بعد الإذن الأوّل.
  useEffect(() => {
    void (async () => {
      try {
        const first = await navigator.mediaDevices.getUserMedia({ video: true });
        first.getTracks().forEach((t) => t.stop());
      } catch {
        setError('لا كاميرا موصولة، أو لم يُؤذن بها');
      }
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setDevices(all);
      setSource((s) => s || all[0]?.deviceId || '');
    })();
  }, []);

  useEffect(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!source) return;
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

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    if (aspect) {
      const r = sourceRect(aspect, { w: v.videoWidth, h: v.videoHeight }, CENTER);
      canvas.width = outWidth;
      canvas.height = Math.round((outWidth * aspect.h) / aspect.w);
      canvas.getContext('2d')!.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')!.drawImage(v, 0, 0);
    }
    setShot(canvas.toDataURL('image/jpeg', 0.92));
  }

  // إطار القصّ فوق الصورة الحيّة — يُرى ما سيُلتقط.
  const frame = aspect ? { aspectRatio: `${aspect.w} / ${aspect.h}`, height: '86%' } : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/60 p-space-md" data-camera-capture="">
      <div className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[22px]">photo_camera</span>
          <h2 className="flex-1 font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          {devices.length > 1 && !shot && (
            <select
              className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `كاميرا ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          {shot ? (
            <img alt="اللقطة" className="max-w-full max-h-full object-contain" data-camera-shot="" src={shot} />
          ) : (
            <>
              <video ref={video} autoPlay muted playsInline className="w-full h-full object-contain" />
              {frame && <div className="absolute border-2 border-secondary rounded shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" style={frame} />}
            </>
          )}
          {error && !shot && (
            <span className="absolute inset-x-0 bottom-3 text-center font-label-md text-label-md text-white">{error}</span>
          )}
        </div>

        <div className="p-space-md bg-surface-container-low flex items-center justify-between gap-space-sm">
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          {shot ? (
            <div className="flex gap-space-xs">
              <button className="h-10 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md" data-act="camera-retake" type="button" onClick={() => setShot(null)}>
                أعِد اللقطة
              </button>
              {secondary && (
                <button
                  className="h-10 px-space-md rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md"
                  data-act="camera-secondary"
                  type="button"
                  onClick={() => secondary.onPick(shot)}
                >
                  {secondary.label}
                </button>
              )}
              <button
                className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
                data-act="camera-confirm"
                type="button"
                onClick={() => onCapture(shot)}
              >
                {confirmLabel}
              </button>
            </div>
          ) : (
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-space-xs disabled:opacity-40"
              data-act="camera-take"
              type="button"
              disabled={Boolean(error) || !source}
              onClick={take}
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              التقط
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
