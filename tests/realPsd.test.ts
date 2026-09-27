/**
 * قوالب Photoshop حقيقية من السوق — على جهاز المالك وحده.
 *
 * لا تُحزم في المستودع (ترخيصها لصاحبها)، فيُتخطّى الاختبار صراحةً حيث لا
 * توجد، ولا ينجح صامتًا. وحيث توجد يثبت ما كُشف عليها: الخلفية صورةٌ تُقرأ لا
 * بيضاء، وألوانها موجبةٌ لا سالبة، والنصوص عناصرُ بألوانها ومُحيت من الخلفية.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { psdDesign } from '../src/main/services/designImport';

const folder = 'C:\\Users\\AM_TJ\\Downloads\\Employee Photo Identity Card PSD Template By GyanTech';

function psdFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? psdFiles(join(dir, e.name)) : e.name.toLowerCase().endsWith('.psd') ? [join(dir, e.name)] : []
  );
}

/** بكسلات PNG كما نكتبه (مرشّحٌ صفريّ). */
function pixels(png: Uint8Array): { w: number; rgba: Uint8Array } {
  const buf = Buffer.from(png);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    if (buf.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = unzlibSync(Buffer.concat(idat));
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) rgba.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  return { w, rgba };
}

describe.skipIf(!existsSync(folder))('قوالب GyanTech الحقيقية', () => {
  const files = existsSync(folder) ? psdFiles(folder).filter((_, i) => i % 4 === 0) : [];

  it.each(files.map((f) => [f.slice(folder.length + 1), f]))('%s', (_, file) => {
    const out = psdDesign(readFileSync(file), 'x.psd');
    expect(out.size).not.toBeNull();
    const bg = pixels(out.images[0]!.bytes);
    // ليست بيضاء كلّها، وليست سالبة: الورق الأبيض في الزوايا أو اللون الداكن حقيقيّان.
    const distinct = new Set<number>();
    for (let i = 0; i < bg.rgba.length; i += 4 * 211) distinct.add((bg.rgba[i]! << 16) | (bg.rgba[i + 1]! << 8) | bg.rgba[i + 2]!);
    expect(distinct.size).toBeGreaterThan(20);

    const texts = out.elements.filter((e) => e.kind === 'text');
    expect(texts.length).toBeGreaterThan(3);
    for (const t of texts) expect(t.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
