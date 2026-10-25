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
 *
 * ومعه `tests/fixtures/passport-fake.png` (S41، D180): صفحة بيانات جوازٍ بالظواهر نفسها وسطرين من ٤٤ (TD3)، ببياناتٍ مختلَقة
 * (زينب علي حسن، جوازٌ مخترع)، ومكان الصورة مستطيلٌ فارغ لا وجه فيه. و`MRZ_FIXTURE=passport` يكتبه وحده (فلا تُعاد كتابة صورة البطاقة).
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

// جواز السفر (TD3): مخترعٌ كلّه.
const pad44 = (s) => s.padEnd(44, '<');
const passportNo = 'A12345678';
const personalP = '199012345678<<';
const pLine2 = `${passportNo}${check(passportNo)}IRQ${birth}${check(birth)}F${expiry}${check(expiry)}${personalP}${check(personalP)}`;
const pComposite = pLine2.slice(0, 10) + pLine2.slice(13, 20) + pLine2.slice(21, 43);
export const PASSPORT = [pad44('P<IRQHASSAN<<ZAINAB<ALI'), pLine2 + check(pComposite)];

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

/** صفحةٌ تُرسم في Chromium التطبيق: `spec` مقاسها وكلامها وسطورها وخطّها — ويعود الرمادي base64. */
async function draw(page, spec) {
  return page.eval(`
    const spec = ${JSON.stringify(spec)};
    const { W, H } = spec;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // مولّد أرقامٍ ثابت — فالصورة نفسها في كلّ مرّة.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    g.save();
    g.translate(spec.x, spec.y);
    g.rotate((1 * Math.PI) / 180);
    const cw = spec.cw, ch = spec.ch;
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, cw, ch);
    // التخطيط: خطٌّ أغمق كلّ ثلاثة بكسلات.
    g.fillStyle = 'rgba(90,90,90,0.35)';
    for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1);

    g.fillStyle = '#3a3a3a';
    g.textAlign = 'right';
    g.direction = 'rtl';
    g.font = 'bold 34px Tahoma';
    g.fillText(spec.title, cw - 40, 60);
    g.font = '26px Tahoma';
    spec.text.forEach((t, i) => g.fillText(t, cw - 40, [105, 160, 205, 250][i]));
    // مكان الصورة (الجواز): مستطيلٌ فارغ — لا وجه.
    if (spec.photo) { g.fillStyle = '#e6e6e6'; g.fillRect(...spec.photo); g.fillStyle = '#3a3a3a'; }

    g.textAlign = 'left';
    g.direction = 'ltr';
    g.font = spec.font;
    g.letterSpacing = spec.spacing;
    g.fillStyle = '#2e2e2e';
    spec.mrz.forEach((line, i) => g.fillText(line, 55, spec.mrzY + i * spec.mrzStep));
    // يسارٌ باهت.
    const fade = g.createLinearGradient(40, 0, 420, 0);
    fade.addColorStop(0, 'rgba(207,207,207,0.55)');
    fade.addColorStop(1, 'rgba(207,207,207,0)');
    g.fillStyle = fade;
    g.fillRect(40, spec.mrzY - 50, 380, spec.mrz.length * spec.mrzStep + 15);
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
}

export default async function scenario(page) {
  const done = [];
  if (process.env.MRZ_FIXTURE !== 'passport') {
    const img = await draw(page, {
      W: 1400, H: 900, x: 180, y: 130, cw: 1020, ch: 645,
      title: 'جمهورية العراق',
      text: ['وزارة الداخلية — مديرية الأحوال المدنية والجوازات والإقامة', 'محل الولادة: بغداد       جهة الإصدار: مديرية الأحوال المدنية', 'الرقم العائلي: ٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠'],
      font: '41px Consolas', spacing: '7px', mrz: MRZ, mrzY: 470, mrzStep: 58
    });
    const out = resolve('tests/fixtures/card-back-fake.png');
    writeFileSync(out, grayPng(Buffer.from(img.data, 'base64'), img.W, img.H));
    done.push(`كُتب ${out}\n${MRZ.join('\n')}`);
  }
  const img = await draw(page, {
    W: 1500, H: 1050, x: 90, y: 90, cw: 1300, ch: 880,
    title: 'جمهورية العراق — جواز سفر',
    text: ['الاسم: زينب علي حسن', 'محل الولادة: بغداد       جهة الإصدار: مديرية الجوازات', 'تاريخ الإصدار: ٢٠٢١/٠٢/٢١'],
    photo: [60, 120, 300, 380],
    font: '36px Consolas', spacing: '6px', mrz: PASSPORT, mrzY: 760, mrzStep: 62
  });
  const out = resolve('tests/fixtures/passport-fake.png');
  writeFileSync(out, grayPng(Buffer.from(img.data, 'base64'), img.W, img.H));
  done.push(`كُتب ${out}\n${PASSPORT.join('\n')}`);
  return done.join('\n');
}
