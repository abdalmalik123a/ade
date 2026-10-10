/**
 * طبقات Photoshop — السجلّات: الطبقات من القاع إلى القمّة ومواضع قنواتها، بلا فكّ بكسل (DESIGNS.md ٠٫٩).
 */
import { height, readRect, toBuffer, utf16be, width, type Channel, type PsdDoc, type PsdLayer, type PsdText } from './psdTypes';
import { readTextLayer } from './psdText';
import { readEffects, type PsdEffects } from './psdEffects';

// ── السجلّات ─────────────────────────────────────────────────────────

/**
 * يقرأ سجلّات الطبقات ومواضع قنواتها — بلا فكّ بكسل واحد.
 *
 * ويُرجع `null` لما ليس PSD (أو PSB بأطواله الثمانية)؛ وملفٌّ بلا طبقات يعود
 * بقائمةٍ فارغة لا بخطأ.
 */
export function parsePsdLayers(bytes: Uint8Array): PsdDoc | null {
  const buf = toBuffer(bytes);
  if (buf.length < 26 || buf.toString('ascii', 0, 4) !== '8BPS' || buf.readUInt16BE(4) !== 1) return null;
  const doc: PsdDoc = {
    height: buf.readUInt32BE(14),
    width: buf.readUInt32BE(18),
    depth: buf.readUInt16BE(22),
    colorMode: buf.readUInt16BE(24),
    layers: []
  };

  let at = 26;
  for (let i = 0; i < 2; i++) {
    if (at + 4 > buf.length) return doc;
    at += 4 + buf.readUInt32BE(at); // الصيغة اللونية، ثم الموارد
  }
  if (at + 10 > buf.length || buf.readUInt32BE(at) < 6) return doc;
  const infoLength = buf.readUInt32BE(at + 4);
  if (infoLength < 2) return doc;
  const infoEnd = Math.min(at + 8 + infoLength, buf.length);
  at += 8;
  const count = Math.abs(buf.readInt16BE(at));
  at += 2;

  type Raw = Omit<PsdLayer, 'groups'> & { ownHidden: boolean };
  const raw: Raw[] = [];

  for (let index = 0; index < count; index++) {
    if (at + 18 > infoEnd) return doc;
    const rect = readRect(buf, at);
    const channelCount = buf.readUInt16BE(at + 16);
    at += 18;
    const channels: Channel[] = [];
    for (let c = 0; c < channelCount; c++) {
      channels.push({ id: buf.readInt16BE(at), length: buf.readUInt32BE(at + 2), offset: 0 });
      at += 6;
    }
    if (at + 16 > infoEnd) return doc;
    const blend = buf.toString('ascii', at + 4, at + 8);
    const opacity = buf[at + 8]! / 255;
    const clipping = buf[at + 9] === 1;
    // البتّ الثاني «مخفيّة» — والمعيار يسمّيه «مرئية»، والعمل على خلافه.
    const ownHidden = (buf[at + 10]! & 2) !== 0;
    const extraLength = buf.readUInt32BE(at + 12);
    at += 16;
    const extraEnd = Math.min(at + extraLength, infoEnd);

    let p = at;
    let mask: PsdLayer['mask'] = null;
    const maskLength = buf.readUInt32BE(p);
    if (maskLength >= 18 && p + 22 <= extraEnd) {
      const r = readRect(buf, p + 4);
      const disabled = (buf[p + 21]! & 2) !== 0;
      if (!disabled && width(r) > 0 && height(r) > 0) mask = { ...r, defaultColor: buf[p + 20]! };
    }
    p += 4 + maskLength;
    if (p + 4 <= extraEnd) p += 4 + buf.readUInt32BE(p); // مجالات المزج

    let name = '';
    if (p < extraEnd) {
      const nameLength = buf[p]!;
      name = buf.toString('latin1', p + 1, Math.min(p + 1 + nameLength, extraEnd));
      p += Math.ceil((1 + nameLength) / 4) * 4;
    }

    let divider = 0;
    let fill = 1;
    let text: PsdText | undefined;
    let effects: PsdEffects | undefined;
    let smart = false;
    while (p + 12 <= extraEnd) {
      const sig = buf.toString('ascii', p, p + 4);
      if (sig !== '8BIM' && sig !== '8B64') break;
      const key = buf.toString('ascii', p + 4, p + 8);
      const length = buf.readUInt32BE(p + 8);
      const data = buf.subarray(p + 12, Math.min(p + 12 + length, extraEnd));
      if (key === 'luni' && data.length >= 4) {
        const n = data.readUInt32BE(0);
        if (4 + n * 2 <= data.length) name = utf16be(data.subarray(4, 4 + n * 2)).replace(/\0+$/, '');
      } else if ((key === 'lsct' || key === 'lsdk') && data.length >= 4) {
        divider = data.readUInt32BE(0);
      } else if (key === 'iOpa' && data.length >= 1) {
        fill = data[0]! / 255;
      } else if (key === 'TySh') {
        text = readTextLayer(data);
      } else if (key === 'lfx2') {
        effects = readEffects(data) ?? undefined;
      } else if (key === 'SoLd' || key === 'PlLd' || key === 'SoLE') {
        smart = true;
      }
      p += 12 + length + (length % 2);
    }
    at = extraEnd;

    raw.push({ index, name: name.trim(), rect, channels, blend, opacity: opacity * fill, clipping, hidden: ownHidden, ownHidden, mask, divider, text, effects, ...(smart && { smart }) });
  }

  // بيانات القنوات بعد السجلّات كلّها، بترتيبها.
  for (const layer of raw) {
    for (const channel of layer.channels) {
      channel.offset = at;
      at += channel.length;
    }
  }

  // المجموعات: رأسها فوق أبنائها في الملف (يُقرأ من القمّة)، وذيلها تحتهم.
  const stack: { name: string; hidden: boolean; opacity: number }[] = [];
  const groups = new Map<number, string[]>();
  for (let i = raw.length - 1; i >= 0; i--) {
    const layer = raw[i]!;
    const parent = stack[stack.length - 1];
    if (layer.divider === 3) {
      stack.pop();
      continue;
    }
    layer.hidden = layer.ownHidden || (parent?.hidden ?? false);
    layer.opacity *= parent?.opacity ?? 1;
    groups.set(i, stack.map((g) => g.name));
    if (layer.divider === 1 || layer.divider === 2) {
      stack.push({ name: layer.name, hidden: layer.hidden, opacity: layer.opacity });
    }
  }

  doc.layers = raw.map(({ ownHidden: _, ...layer }, i) => ({ ...layer, groups: groups.get(i) ?? [] }));
  return doc;
}
