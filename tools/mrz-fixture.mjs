/**
 * مولّد `tests/fixtures/card-back-fake.png` — ظهر بطاقةٍ موحّدة ببياناتٍ مخترعة.
 *
 *   node tools/drive.mjs tools/mrz-fixture.mjs
 *
 * يُرسم في Chromium التطبيق (فالعربيّ موصولٌ مشكَّل كما يُطبع) بظواهر نسخةٍ مصوّرة حقيقية
 * للبطاقة (٢٨ أيلول ٢٠٢٦) كسرت القارئ واحدةً واحدة:
 * - **البطاقة رماديّة على ورقٍ أبيض** — فعتبة الصفحة جعلتها كتلة حبرٍ واحدة.
 * - **تخطيطٌ أفقيّ دقيق يقطع الحروف** — فقطّعتها العتبة شرائح، وقرأ القارئ 8 حرفًا.
 * - **ميلٌ درجةً واحدة** — فانقطع السطر عن نطاقٍ أفقيّ ثابت.
 * - **يسار السطور باهت** — فضاع أوّل رمزٍ منها.
 * - **غبار** نقاطٍ متفرّقة، وكلامٌ عربيّ فوق السطور.
 * والسطور بمعيار TD1 كما في البطاقة العراقية: رقم الوثيقة حرفٌ وثمانية أرقام، وبعده الرقم
 * الشخصي (١٢ رقمًا) في الحقل الاختياري، واللقب فارغ.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const weights = [7, 3, 1];
const value = (c) => (c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
const check = (s) => String([...s].reduce((sum, c, i) => sum + value(c) * weights[i % 3], 0) % 10);
const pad = (s) => s.padEnd(30, '<');

// مخترعة كلّها.
const doc = 'Z12345678';
const personal = '199012345678';
const birth = '900115';
const expiry = '310220';
const line1 = pad(`IDIRQ${doc}${check(doc)}${personal}`);
const partial = `${birth}${check(birth)}M${expiry}${check(expiry)}IRQ`;
const line2 = pad(partial).slice(0, 29);
const composite = line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29);
export const MRZ = [line1, line2 + check(composite), pad('<<SAMIR<KHALID')];

/** PNG رماديّ بثمانية بتّات. */
function grayPng(gray, width, height) {
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; // بتّات
  head[9] = 0; // رماديّ
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export default async function scenario(page) {
  const img = await page.eval(`
    const W = 1400, H = 900;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // مولّد أرقامٍ ثابت — فالصورة نفسها في كلّ مرّة.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    g.save();
    g.translate(180, 130);
    g.rotate((1 * Math.PI) / 180);
    const cw = 1020, ch = 645;
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, cw, ch);
    // التخطيط: خطٌّ أغمق كلّ ثلاثة بكسلات.
    g.fillStyle = 'rgba(90,90,90,0.35)';
    for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1);

    g.fillStyle = '#3a3a3a';
    g.textAlign = 'right';
    g.direction = 'rtl';
    g.font = 'bold 34px Tahoma';
    g.fillText('جمهورية العراق', cw - 40, 60);
    g.font = '26px Tahoma';
    g.fillText('وزارة الداخلية — مديرية الأحوال المدنية والجوازات والإقامة', cw - 40, 105);
    g.fillText('محل الولادة: بغداد       جهة الإصدار: مديرية الأحوال المدنية', cw - 40, 160);
    g.fillText('الرقم العائلي: ٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠', cw - 40, 205);

    g.textAlign = 'left';
    g.direction = 'ltr';
    g.font = '41px Consolas';
    g.letterSpacing = '7px';
    g.fillStyle = '#2e2e2e';
    ${JSON.stringify(MRZ)}.forEach((line, i) => g.fillText(line, 55, 470 + i * 58));
    // يسارٌ باهت.
    const fade = g.createLinearGradient(40, 0, 420, 0);
    fade.addColorStop(0, 'rgba(207,207,207,0.55)');
    fade.addColorStop(1, 'rgba(207,207,207,0)');
    g.fillStyle = fade;
    g.fillRect(40, 420, 380, 190);
    g.restore();

    // غبار.
    g.fillStyle = '#555';
    for (let i = 0; i < 900; i++) g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
    // رماديٌّ بايتًا لكلّ بكسل — ثلث حجم الألوان.
    const px = g.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H);
    for (let i = 0; i < gray.length; i++) gray[i] = px[i * 4];
    let bin = '';
    for (let i = 0; i < gray.length; i += 0x8000) bin += String.fromCharCode(...gray.subarray(i, i + 0x8000));
    return { W, H, data: btoa(bin) };
  `);
  const out = resolve('tests/fixtures/card-back-fake.png');
  writeFileSync(out, grayPng(Buffer.from(img.data, 'base64'), img.W, img.H));
  return `كُتب ${out}\n${MRZ.join('\n')}`;
}
