/**
 * سجل التراجع والإعادة لاستوديو الصور الشخصية (Full Undo / Redo History Stack)
 *
 * يحفظ لقطاتٍ بحدٍّ أقصى ٢٥ خطوةً (وبسقف ذاكرة):
 * - تعديلات قناع الشفافية (alpha mask).
 * - بكسلات الألوان والترميم (pixels).
 * - موضع وتحويل القاط (worn at / scale / angle).
 * - المعالم والقص (lm / crop).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import type { SuitTransform, Landmarks } from '@shared/portraitMask';
import type { Crop } from '@shared/photoSheet';
import type { Cut, Worn } from './photoShared';

export type HistorySnapshot = {
  alpha: Uint8Array;
  pixels: Uint8ClampedArray;
  wornAt: SuitTransform | null;
  crop: Crop;
  lm: Landmarks | null;
  desc?: string;
};

const MAX_HISTORY = 25;
/** سقف الذاكرة للقطات: اللقطة الواحدة نحو ٣٠ ميغا في صورةٍ بأكبر مقاس، فيقلّ العدد بدل أن تمتلئ الذاكرة. */
const HISTORY_BYTES = 200 * 1024 * 1024;

const snapBytes = (s: HistorySnapshot) => s.alpha.byteLength + s.pixels.byteLength;

export type HistoryControls = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  push: (desc?: string) => void;
  clear: () => void;
  resetAll: () => void;
  historyLength: number;
};

export function usePhotoHistory(options: {
  cut: React.MutableRefObject<Cut | null>;
  worn: Worn | null;
  setWorn: React.Dispatch<React.SetStateAction<Worn | null>>;
  crop: Crop;
  setCrop: React.Dispatch<React.SetStateAction<Crop>>;
  lm: Landmarks | null;
  setLm: React.Dispatch<React.SetStateAction<Landmarks | null>>;
  setCutVersion: React.Dispatch<React.SetStateAction<number>>;
  rebuildSubject: (rect?: { x: number; y: number; w: number; h: number }) => void;
  draw: () => void;
}): HistoryControls {
  const { cut, worn, setWorn, crop, setCrop, lm, setLm, setCutVersion, rebuildSubject, draw } = options;

  const past = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const initial = useRef<HistorySnapshot | null>(null);

  const [state, setState] = useState({ canUndo: false, canRedo: false, length: 0 });

  const syncState = useCallback(() => {
    setState({
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      length: past.current.length
    });
  }, []);

  const takeSnapshot = useCallback((desc?: string): HistorySnapshot | null => {
    const c = cut.current;
    if (!c) return null;
    return {
      alpha: new Uint8Array(c.alpha),
      pixels: new Uint8ClampedArray(c.pixels),
      wornAt: worn ? { ...worn.at } : null,
      crop: { ...crop },
      lm: lm ? { ...lm } : null,
      desc
    };
  }, [cut, worn, crop, lm]);

  const push = useCallback((desc?: string) => {
    const snap = takeSnapshot(desc);
    if (!snap) return;

    if (!initial.current) {
      initial.current = snap;
    }

    past.current.push(snap);
    let bytes = past.current.reduce((n, x) => n + snapBytes(x), 0);
    while (past.current.length > 1 && (past.current.length > MAX_HISTORY || bytes > HISTORY_BYTES)) {
      bytes -= snapBytes(past.current.shift()!);
    }
    future.current = [];
    syncState();
  }, [takeSnapshot, syncState]);

  const applySnapshot = useCallback((snap: HistorySnapshot) => {
    const c = cut.current;
    if (c) {
      c.alpha.set(snap.alpha);
      c.pixels.set(snap.pixels);
    }
    if (snap.wornAt) {
      setWorn((w) => w && { ...w, at: { ...snap.wornAt! } });
    }
    setCrop({ ...snap.crop });
    setLm(snap.lm ? { ...snap.lm } : null);
    setCutVersion((v) => v + 1);
    rebuildSubject();
    draw();
  }, [cut, setWorn, setCrop, setLm, setCutVersion, rebuildSubject, draw]);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const currentSnap = takeSnapshot('current');
    if (!currentSnap) return;

    const prev = past.current.pop()!;
    future.current.push(currentSnap);
    applySnapshot(prev);
    syncState();
  }, [takeSnapshot, applySnapshot, syncState]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const currentSnap = takeSnapshot('current');
    if (!currentSnap) return;

    const next = future.current.pop()!;
    past.current.push(currentSnap);
    applySnapshot(next);
    syncState();
  }, [takeSnapshot, applySnapshot, syncState]);

  const resetAll = useCallback(() => {
    if (!initial.current) return;
    const currentSnap = takeSnapshot('before-reset');
    if (currentSnap) past.current.push(currentSnap);
    applySnapshot(initial.current);
    syncState();
  }, [takeSnapshot, applySnapshot, syncState]);

  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    initial.current = null;
    syncState();
  }, [syncState]);

  // استماع لاختصارات لوحة المفاتيح Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return {
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    undo,
    redo,
    push,
    clear,
    resetAll,
    historyLength: state.length
  };
}
