/**
 * «لمن التصميم؟» في المعرض (DESIGNS.md ٠٫٩): الجهة أو الشعار، والاسم كما يُطبع، واللون — لون الجهة المحفوظ أوّلًا وإلا
 * ما يُستخرج من شعارها — والنمط. ومنها هويّةُ كلّ لمحةٍ وكلّ تصميمٍ يُفتح.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Seal } from '@shared/api';
import type { Client } from '@shared/orders';
import { PALETTES, STYLES, dominantColor, paletteFrom, type Brand } from '@shared/design/kit';

/** لون الشعار من بكسلاته — والصورة تُقرأ من المخزن برأس CORS فلا تُقفَل اللوحة. */
export async function logoColor(path: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `diwan://store/${path}`;
  await img.decode();
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  return dominantColor(ctx.getImageData(0, 0, size, size).data);
}

export function useGalleryBrand(presetClient: { id: number; key: number } | null | undefined) {
  const [logos, setLogos] = useState<Seal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  /** «لمن؟»: جهةٌ من ملفّاتها، أو شعارٌ مرفوعٌ بلا جهة. */
  const [who, setWho] = useState<{ client?: number; logo?: number } | null>(null);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [paletteKey, setPaletteKey] = useState('royal');
  const [style, setStyle] = useState('official');

  useEffect(() => {
    // الشعارات المربوطة بجهةٍ تُعرض مع جهتها — فلا تتكرّر الجهة مرّتين في الصفّ.
    void window.diwan.seals.list().then((all) => setLogos(all.filter((s) => s.kind === 'شعار' && s.imagePath && !s.authorityId)));
    void window.diwan.clients.list().then(setClients);
  }, [presetClient?.key]);

  useEffect(() => {
    if (presetClient) setWho({ client: presetClient.id });
  }, [presetClient?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = who?.client ? (clients.find((c) => c.id === who.client) ?? null) : null;
  const rawLogo = who?.logo ? (logos.find((l) => l.id === who.logo) ?? null) : null;
  const logo = client ? (client.logo ? { name: client.name, imagePath: client.logo } : null) : rawLogo;

  // جهةٌ أو شعارٌ اختير: اسمه اسم الجهة ما لم يُكتب غيره، ولونه لوحتها —
  // لون الجهة المحفوظ في ملفّها أولًا، وإلا ما يُستخرج من شعارها.
  useEffect(() => {
    setBrandColor(null);
    if (client?.color) {
      setBrandColor(client.color);
      setPaletteKey('brand');
      return;
    }
    if (!logo?.imagePath) {
      if (paletteKey === 'brand') setPaletteKey('royal');
      return;
    }
    let alive = true;
    void logoColor(logo.imagePath)
      .then((hex) => {
        if (!alive) return;
        setBrandColor(hex);
        if (hex) setPaletteKey('brand');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo?.imagePath, client?.id, client?.color]);

  const palette = useMemo(
    () =>
      paletteKey === 'brand' && brandColor
        ? paletteFrom(brandColor, 'لون الشعار')
        : (PALETTES.find((p) => p.key === paletteKey) ?? PALETTES[0]!),
    [paletteKey, brandColor]
  );
  const brand: Brand = useMemo(
    () => ({ name: name.trim() || client?.name || logo?.name || undefined, logo: logo?.imagePath ?? null }),
    [name, logo, client]
  );
  const current = STYLES.find((s) => s.key === style)!;

  return { logos, clients, who, setWho, name, setName, brandColor, paletteKey, setPaletteKey, style, setStyle, client, logo, palette, brand, current };
}

export type GalleryBrand = ReturnType<typeof useGalleryBrand>;
