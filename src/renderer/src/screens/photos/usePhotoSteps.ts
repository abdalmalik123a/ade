/**
 * خطوات الصورة الشخصية (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `PhotosScreen` كما هي: الفتح واللصق (وما جاء من «الملفّات» مرّةً
 * بمفتاحه)، وإزالة الخلفية على الجهاز، والمقاس من القوالب، والقاط ولبسه واستيراده — ويرتفع إلى الذقن إن ظهرت فوقه ملابس
 * الزبون (البند ٣٩، `@shared/portraitSkin`).
 */
import { useRef, useEffect } from 'react';
import { type Landmarks, landmarks, autoCrop, fitSuit, rowWidths } from '@shared/portraitMask';
import { autoEnhance, NEUTRAL, type Enhance } from '@shared/portraitEnhance';
import { clothesTop, raiseSuit, skinSample } from '@shared/portraitSkin';
import { withFace } from '@shared/portraitFace';
import { prepareSuit } from '@shared/suitMatte';
import { errorText } from '../../lib/errors';
import { workPixels, loadImage, dataUrlOf, loadSuit, fallbackPlace, type Work, type Suit } from '../../lib/portraitCanvas';
import { CENTER, type Crop, type Size } from '@shared/photoSheet';
import { CUSTOM_ID, type Cut, type Worn, type Tool, type PhotoIncoming, type Bg } from './photoShared';
import type { PhotoPreset } from '@shared/photoPresets';
import type { CustomSuit, SuitCategory } from '@shared/suits';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';

let photoIncomingSeen = 0;

export function usePhotoSteps(
  ctx: {
    preset: PhotoPreset;
    work: MutableRefObject<Work | null>;
    setCutState: Dispatch<SetStateAction<'none' | 'running' | 'done'>>;
    cut: MutableRefObject<Cut | null>;
    setLm: Dispatch<SetStateAction<Landmarks | null>>;
    autoLight: boolean;
    setEnhance: Dispatch<SetStateAction<Enhance>>;
    setCrop: Dispatch<SetStateAction<Crop>>;
    setCutVersion: Dispatch<SetStateAction<number>>;
    say: (text: string, warn?: boolean) => void;
    setBusy: Dispatch<SetStateAction<string | null>>;
    toned: MutableRefObject<Uint8ClampedArray<ArrayBufferLike> | null>;
    maskOn: MutableRefObject<boolean>;
    line: MutableRefObject<{ line: Float32Array; lo: number; hi: number; } | null>;
    setSrc: Dispatch<SetStateAction<string | null>>;
    setNatural: Dispatch<SetStateAction<Size | null>>;
    setWorn: Dispatch<SetStateAction<Worn | null>>;
    setTool: Dispatch<SetStateAction<Tool>>;
    setReview: Dispatch<SetStateAction<{ path: string; px: Size; } | null>>;
    rebuildSubject: (rect?: { x: number; y: number; w: number; h: number; }) => void;
    modelReady: boolean;
    incoming: PhotoIncoming | null;
    setPresetId: Dispatch<SetStateAction<string>>;
    setCount: Dispatch<SetStateAction<number | null>>;
    presets: PhotoPreset[];
    setBg: Dispatch<SetStateAction<Bg>>;
    lm: Landmarks | null;
    natural: Size | null;
    tool: Tool;
    cutState: 'none' | 'running' | 'done';
    suitCache: MutableRefObject<Map<string, Suit>>;
    bg: Bg;
    setCustomSuits: Dispatch<SetStateAction<CustomSuit[]>>;
    setSuitTab: Dispatch<SetStateAction<SuitCategory>>;
    worn: Worn | null;
  }
) {
  const {
    preset, work, setCutState, cut, setLm, autoLight, setEnhance, setCrop, setCutVersion, say, setBusy, toned, maskOn, line, setSrc,
    setNatural, setWorn, setTool, setReview, rebuildSubject, modelReady, incoming, setPresetId, setCount, presets, setBg, lm, natural,
    tool, cutState, suitCache, bg, setCustomSuits, setSuitTab, worn
  } = ctx;

  const presetRef = useRef(preset);
  presetRef.current = preset;

  async function removeBackground(): Promise<Landmarks | null> {
    const w = work.current;
    if (!w) return null;
    setCutState('running');
    try {
      const res = await window.diwan.photos.cutout({ pixels: new Uint8Array(w.pixels.buffer, w.pixels.byteOffset, w.pixels.byteLength), width: w.width, height: w.height });
      if (work.current !== w) return null; // فُتحت صورةٌ أخرى في أثنائه
      const alpha = Uint8Array.from(res.alpha);
      cut.current = { alpha, model: Uint8Array.from(res.alpha), pixels: new Uint8ClampedArray(res.pixels.buffer, res.pixels.byteOffset, res.pixels.byteLength), face: res.face, shoulders: res.shoulders ?? null };
      // الذقن من الوجه إن وُجد (إصلاح البند ٣٩): تقدير القناع يقع على الشفة في صورٍ حقيقية.
      const l = withFace(landmarks(alpha, w.width, w.height), res.face);
      const p = presetRef.current;
      setLm(l);
      setCutState('done');
      if (autoLight) setEnhance(autoEnhance(cut.current.pixels, alpha, w.width, w.height));
      if (l && l.shoulderY !== null && p.head) setCrop(autoCrop(l, { w: w.width, h: w.height }, { w: p.widthMm, h: p.heightMm }, p.head));
      setCutVersion((v) => v + 1);
      if (!l) say('أُزيلت الخلفية — ولم يُعرف الرأس من الكتفين: قُصّ باليد', true);
      return l;
    } catch (e) {
      if (work.current === w) setCutState('none');
      say(errorText(e, 'تعذّرت إزالة الخلفية'), true);
      return null;
    }
  }

  async function load(path: string) {
    setBusy('تُفتح الصورة…');
    try {
      const w = workPixels(await loadImage(`diwan://store/${path}`));
      work.current = w;
      cut.current = null;
      toned.current = w.pixels;
      maskOn.current = false;
      line.current = null;
      setSrc(path);
      setNatural({ w: w.width, h: w.height });
      setCrop(CENTER);
      setLm(null);
      setCutState('none');
      setWorn(null);
      setTool('move');
      setReview(null);
      setEnhance(autoLight ? autoEnhance(w.pixels, null, w.width, w.height) : NEUTRAL);
      rebuildSubject();
      setCutVersion((v) => v + 1);
      if (modelReady) void removeBackground();
    } catch (e) {
      say(errorText(e, 'تعذّر فتح الصورة'), true);
    } finally {
      setBusy(null);
    }
  }
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!incoming || incoming.key === photoIncomingSeen) return;
    photoIncomingSeen = incoming.key;
    void loadRef.current(incoming.path);
  }, [incoming]);

  async function open() {
    const path = await window.diwan.photos.pickPhoto();
    if (path) await load(path);
  }

  async function pasteButton() {
    try {
      const path = await window.diwan.photos.clipboardImage();
      if (path) await load(path);
      else say('لا صورة في الحافظة — انسخ الصورة أوّلًا (من واتساب أو المتصفّح)', true);
    } catch (e) {
      say(errorText(e, 'تعذّر لصق الصورة'), true);
    }
  }

  // Ctrl+V في الشاشة: صورة الحافظة تُحفظ في المخزن كأيّ صورةٍ تُفتح — إلا في خانة كتابة.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void (async () => {
        let dataUrl: string;
        if (file.type === 'image/png' || file.type === 'image/jpeg') dataUrl = await dataUrlOf(file);
        else {
          const bmp = await createImageBitmap(file);
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext('2d')!.drawImage(bmp, 0, 0);
          bmp.close();
          dataUrl = c.toDataURL('image/png');
        }
        await loadRef.current(await window.diwan.photos.storePasted(dataUrl));
      })().catch((err) => say(errorText(err, 'تعذّر لصق الصورة'), true));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function choosePreset(id: string) {
    setPresetId(id);
    setCount(null);
    setReview(null);
    const p = id === CUSTOM_ID ? null : presets.find((x) => x.id === id);
    if (p) setBg((b) => (b.kind === 'original' ? b : p.background));
    if (p?.head && lm && natural) setCrop(autoCrop(lm, natural, { w: p.widthMm, h: p.heightMm }, p.head));
  }

  async function chooseSuit(key: string | null, url?: string) {
    if (!key || !url) {
      setWorn(null);
      if (tool === 'suit') setTool('move');
      return;
    }
    const w = work.current;
    if (!w) return;
    setBusy('يُلبَس القاط…');
    try {
      let l = lm;
      if (cutState === 'none' && modelReady) l = await removeBackground();
      let s = suitCache.current.get(key);
      if (!s) {
        s = await loadSuit(key, url);
        suitCache.current.set(key, s);
      }
      const c = cut.current;
      const fitted = l && c ? fitSuit(s.anchor, s.rows, rowWidths(c.alpha, w.width, w.height), l, s.tops) : fallbackPlace(s, { w: w.width, h: w.height });
      // ياقة الزبون أو كنزته ظاهرةٌ بين ذقنه والقاط: يرتفع القاط حتى يغطّيها، والذقن حدّه.
      const skin = l && c ? skinSample(c.pixels, c.alpha, w.width, w.height, l, c.face) : null;
      const base = l && c && skin ? raiseSuit(fitted, clothesTop(c.pixels, c.alpha, w.width, l, skin, fitted.y, c.face), l.chin) : fitted;
      setWorn({ suit: s, at: base, base });
      setTool('suit');
      if (bg.kind === 'original') setBg({ kind: 'white' });
    } catch (e) {
      say(errorText(e, 'تعذّر تحميل القاط'), true);
    } finally {
      setBusy(null);
    }
  }

  async function importSuit() {
    try {
      const r = await window.diwan.photos.importSuit();
      if (!r) return;
      let s: CustomSuit;
      if ('suit' in r) s = r.suit;
      else {
        // ما ليس PNG شفّافة يفكّه Chromium (JPG وWebP وBMP)، ثم يُحضَّر كما تحضّره `prepare-suits.py` (S39).
        // والتحضير في خيط الواجهة (~١٫٧ ث لصورة هاتف ١٢ ميغابكسل): يُقال قبله، ويُفسح إطارٌ ليُرسم القول (D171).
        setBusy('يُحضَّر القاط…');
        await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
        const bmp = await createImageBitmap(new Blob([r.prepare.bytes.slice()]));
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const ready = prepareSuit(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (!ready) {
          say('الصورة ليست قاطًا على خلفيةٍ بيضاء أو شفّافة — احفظه PNG شفّافًا أو على أبيضٍ نقيّ', true);
          return;
        }
        s = await window.diwan.photos.addSuit({ name: r.prepare.name, rgba: new Uint8Array(ready.rgba.buffer, ready.rgba.byteOffset, ready.rgba.byteLength), width: ready.width, height: ready.height });
      }
      setCustomSuits((list) => [...list, s]);
      setSuitTab('custom');
      say(`أُضيف «${s.name}» إلى القاط`);
      await chooseSuit(s.id, `diwan://store/${s.path}`);
    } catch (e) {
      say(errorText(e, 'تعذّر استيراد القاط'), true);
    } finally {
      setBusy(null);
    }
  }

  async function deleteSuit(id: string) {
    setCustomSuits(await window.diwan.photos.deleteSuit(id));
    suitCache.current.delete(id);
    if (worn?.suit.key === id) setWorn(null);
  }

  return { open, pasteButton, removeBackground, importSuit, chooseSuit, deleteSuit, choosePreset };
}
