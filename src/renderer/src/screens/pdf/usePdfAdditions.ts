/**
 * الإضافة في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولةٌ من `PdfScreen` كما هي: النصّ، والعلامة المائية، والاستمارة القابلة
 * للتعبئة تُملأ من ملفّ مواطن (تعميق الموجود ٧)، ورقم الصفحة، والشعار من المكتبة ومن الجهاز.
 */
import { type TextOverlay, watermarkText, fieldBox, totalRotation, numberingText, type ImageOverlay, type Overlay, type PageRef } from '@shared/pdfEdit';
import { newId, fieldsWord, type Src } from './pdfPages';
import { useState, useEffect } from 'react';
import { citizenSourceOf } from '@shared/citizenFields';
import { toIndic } from '@shared/arabic';
import { errorText } from '../../lib/errors';
import type { Dispatch, SetStateAction } from 'react';

export function usePdfAdditions(
  ctx: {
    current: string | null;
    setOverlays: Dispatch<SetStateAction<Overlay[]>>;
    setActive: Dispatch<SetStateAction<string | null>>;
    sources: Record<string, Src>;
    pages: PageRef[];
    say: (text: string, tone?: 'ok' | 'warn') => void;
    overlays: Overlay[];
    setLogoPicker: Dispatch<SetStateAction<string[] | null>>;
  }
) {
  const { current, setOverlays, setActive, sources, pages, say, overlays, setLogoPicker } = ctx;

  function addText() {
    if (!current) return;
    const o: TextOverlay = {
      id: newId('t'),
      kind: 'text',
      text: 'نصٌّ جديد',
      font: 'Arial',
      size: 16,
      color: '#0b3d91',
      bold: true,
      align: 'right',
      opacity: 1,
      angle: 0,
      // أسفل الصفحة: موضع «تمّ الاستلام» والملاحظات — لا فوق الترويسة.
      box: { x: 0.35, y: 0.86, w: 0.55, h: 0.06 },
      pages: [current]
    };
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function addWatermark() {
    const settings = await window.diwan.settings.get().catch(() => null);
    const o = watermarkText(newId('w'), settings?.officeName?.trim() || 'نسخة');
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  // ── الاستمارة القابلة للتعبئة (تعميق الموجود ٧) ─────────────────────
  // حقولها طبقات نصٍّ في مواضعها، تُملأ من ملف مواطنٍ بمعنى كلّ حقلٍ من اسمه — ويرسمها
  // محرّك الطباعة فتخرج العربية موصولة (مكتبة PDF تقطّعها في الحقل نفسه).
  const [formQuery, setFormQuery] = useState('');
  const [formHits, setFormHits] = useState<{ id: number; fullName: string }[]>([]);
  const [formCitizen, setFormCitizen] = useState<{ id: number; fullName: string } | null>(null);
  const [formFilled, setFormFilled] = useState<string[]>([]);

  useEffect(() => {
    const q = formQuery.trim();
    if (!q) {
      setFormHits([]);
      return;
    }
    let live = true;
    void window.diwan.citizens
      .list({ query: q, limit: 6 })
      .then((list) => live && setFormHits(list.map((c) => ({ id: c.id, fullName: c.fullName }))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [formQuery]);

  /** حقول الملف الفارغة طبقاتٌ في مواضعها — والمعروفة معانيها من ملف المواطن. */
  async function fillForm(sourceId: string) {
    const src = sources[sourceId];
    const fields = (src?.fields ?? []).filter((f) => f.kind !== 'check' && !f.value.trim());
    if (!src || !fields.length) return;
    const citizen = formCitizen ? ((await window.diwan.citizens.get(formCitizen.id)) as Record<string, unknown> | null) : null;
    const made: TextOverlay[] = [];
    for (const ref of pages.filter((p) => p.source === sourceId)) {
      const info = src.pages[ref.index]!;
      const pageBox = { x: info.x ?? 0, y: info.y ?? 0, width: info.width, height: info.height };
      for (const f of fields.filter((x) => x.page === ref.index)) {
        let box = fieldBox(pageBox, totalRotation(info.rotation, ref.rotate), f.rect);
        if (ref.crop) box = { x: (box.x - ref.crop.x) / ref.crop.w, y: (box.y - ref.crop.y) / ref.crop.h, w: box.w / ref.crop.w, h: box.h / ref.crop.h };
        const key = citizenSourceOf(f.name);
        const value = citizen && key ? citizen[key] : null;
        made.push({
          id: newId('f'),
          kind: 'text',
          text: typeof value === 'string' ? value : '',
          font: 'Arial',
          size: Math.round(Math.max(7, Math.min(12, f.rect.height * 0.62)) * 2) / 2,
          color: '#000000',
          bold: false,
          align: 'right',
          opacity: 1,
          angle: 0,
          box,
          pages: [ref.id]
        });
      }
    }
    setOverlays((os) => [...os, ...made]);
    setFormFilled((s) => [...s, sourceId]);
    const known = made.filter((o) => o.text).length;
    say(`صارت الحقول الفارغة (${fieldsWord(made.length)}) نصوصًا في مواضعها${citizen ? ` — ومُلئ منها ${toIndic(known)} من ملف ${formCitizen?.fullName}` : ''}. انقر أيّ حقلٍ لتكتبه`);
  }

  /** رقم الصفحة أسفل كلّ صفحة — ومرّةً واحدة: الموجود يُحدَّد ليُعدَّل. */
  function addNumbers() {
    const existing = overlays.find((o) => o.kind === 'text' && /\{(رقم|n)\}/.test(o.text));
    if (existing) {
      setActive(existing.id);
      return;
    }
    const o = numberingText(newId('n'));
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function openLogos() {
    setLogoPicker(await window.diwan.pdf.logos());
  }

  function placeLogo(src: string) {
    if (!current) return;
    setLogoPicker(null);
    const o: ImageOverlay = { id: newId('i'), kind: 'image', src, opacity: 1, angle: 0, box: { x: 0.05, y: 0.04, w: 0.18, h: 0.1 }, pages: [current] };
    setOverlays((os) => [...os, o]);
    setActive(o.id);
  }

  async function logoFromDevice() {
    try {
      const src = await window.diwan.pdf.pickLogo();
      if (src) placeLogo(src);
    } catch (e) {
      say(errorText(e, 'تعذّرت إضافة الشعار'), 'warn');
    }
  }

  return {
    addText, openLogos, addWatermark, addNumbers, formFilled, formCitizen, formQuery, setFormCitizen, setFormQuery, formHits,
    setFormHits, fillForm, placeLogo, logoFromDevice
  };
}
