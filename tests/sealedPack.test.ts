/**
 * الحزمة المختومة (S48، D203): كاتب أداة المالك (`tools/keytool/core.mjs`) وقارئ ديوان (`services/sealedPack.ts`) معًا —
 * ذهابٌ وإياب، ورفضُ ما لم يختمه المالك وما عُبث به وما ليس حزمة، ولا يصلح توقيع تحديثٍ ختمًا، والحمولة لا تُقرأ بلا المفتاح.
 */
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error — وحدة ESM بلا أنواع، تُختبر كما تعمل في الأداة (كـ`keytool.test`).
import * as core from '../tools/keytool/core.mjs';
import { openSealedPack } from '../src/main/services/sealedPack';
import { SEAL_ERRORS, SEAL_LIMITS, SEAL_MAGIC, validItems } from '../src/shared/sealedPack';

const DIR = mkdtempSync(join(tmpdir(), 'diwan-seal-'));
const WORK = join(DIR, 'work');
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const owner = generateKeyPairSync('ed25519');
const stranger = generateKeyPairSync('ed25519');
const pem = (k: typeof owner) => k.publicKey.export({ type: 'spki', format: 'pem' }).toString();
// «PNG» و«PSD» يكفيهما هنا بايتاتٌ معروفة: القارئ لا يفكّ الصور (D204 وD205).
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('قاط أسود — بايتات اختبار'.repeat(50))]);
const PSD = Buffer.concat([Buffer.from('8BPS'), Buffer.from('طبقتان'.repeat(80))]);
writeFileSync(join(DIR, 'قاط أسود.png'), PNG);
writeFileSync(join(DIR, 'قاطان.psd'), PSD);

let n = 0;
async function seal(opts: { kind?: string; key?: typeof owner; title?: string } = {}): Promise<string> {
  const out = join(DIR, `pack-${++n}.diwanseal`);
  await core.writeSealedPack({
    items: core.sealItemsFrom(DIR),
    kind: opts.kind ?? 'first',
    title: opts.title ?? 'قاط المكتب الأوّل',
    privateKey: (opts.key ?? owner).privateKey,
    out
  });
  return out;
}
const open = (path: string, keys = [pem(owner)]) => openSealedPack(path, keys, WORK);
const reason = (p: Promise<unknown>) => p.then(() => 'قُبل', (e: Error) => e.message);
/** أجزاء الملفّ: موضع الرأس وطوله، وبداية الحمولة. */
function parts(buf: Buffer) {
  const m = Buffer.from(SEAL_MAGIC).length;
  const headLen = buf.readUInt32BE(m);
  const sigLen = buf.readUInt32BE(m + 4 + headLen);
  return { headAt: m + 4, headLen, bodyAt: m + 4 + headLen + 4 + sigLen };
}

describe('الحزمة المختومة', () => {
  it('اسم الملفّ من العنوان: محارف Windows والحدود والفارغ، والعنوان نفسه يبقى كما هو', () => {
    expect(core.sealFileName('قاط/٢٠٢٦: الأوّل')).toBe('قاط ٢٠٢٦ الأوّل.diwanseal');
    expect(core.sealFileName(' .. قاط\\*?"<>|\u0000\u001f\u007f . ')).toBe('قاط.diwanseal');
    expect(core.sealFileName(' .. /: . ')).toBe('حزمة.diwanseal');
    expect(core.sealFileName('قاط المكتب')).toBe('قاط المكتب.diwanseal');
  });

  it('keygen seal بلا --out: عنوان فيه فواصل مسار يُصنع باسم نظيف ويحتفظ بعنوانه', async () => {
    const key = join(DIR, 'test-key.pem');
    writeFileSync(key, owner.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const title = 'قاط/٢٠٢٦: الأوّل';
    const pieces = mkdtempSync(join(DIR, 'cli-'));
    writeFileSync(join(pieces, 'قاط.png'), PNG);
    execFileSync(process.execPath, [join(__dirname, '../tools/license/keygen.mjs'), 'seal', pieces, '--kind', 'first', '--title', title, '--key', key]);
    const out = join(DIR, core.sealFileName(title));
    const opened = await open(out);
    expect(opened.head.title).toBe(title);
    opened.cleanup();
    rmSync(out);
  });

  it('ذهابٌ وإياب: الرأس كما كُتب، والقطعتان بأسمائهما وبايتاتهما، والمؤقّت يُحذف', async () => {
    const opened = await open(await seal({ kind: 'buyer', title: 'قاط المشتري' }));
    expect([opened.head.content, opened.head.kind, opened.head.title, opened.head.app]).toEqual(['suits', 'buyer', 'قاط المشتري', 'diwan']);
    expect(opened.items.map((i) => [i.name, i.ext])).toEqual([
      ['قاط أسود', 'png'],
      ['قاطان', 'psd']
    ]);
    expect(readFileSync(opened.items[0]!.path).equals(PNG)).toBe(true);
    expect(readFileSync(opened.items[1]!.path).equals(PSD)).toBe(true);
    opened.cleanup();
    expect(readdirSync(WORK)).toEqual([]);
  });

  it('بمفتاحٍ غير مفتاح المالك: «ليست مختومة» — وبأيٍّ من مفاتيحه تُقبل', async () => {
    expect(await reason(open(await seal({ key: stranger })))).toBe(SEAL_ERRORS.unsigned);
    const ok = await open(await seal(), ['ليس مفتاحًا', pem(stranger), pem(owner)]);
    ok.cleanup();
    expect(ok.items).toHaveLength(2);
  });

  it('ما عُبث به: بايتٌ في الحمولة ← «عُبث»، وفي الرأس (أولى ← للمشتري) ← «ليست مختومة»، وبترٌ ← «عُبث»', async () => {
    const buf = readFileSync(await seal());
    const { headAt, headLen, bodyAt } = parts(buf);
    const body = Buffer.from(buf);
    body[bodyAt + 40] ^= 0xff;
    writeFileSync(join(DIR, 'body.diwanseal'), body);
    expect(await reason(open(join(DIR, 'body.diwanseal')))).toBe(SEAL_ERRORS.tampered);
    // وبايتٌ في القطعة الأخيرة نفسها (لا في القائمة): لا يمرّ ولو صحّت القائمة.
    const item = Buffer.from(buf);
    item[buf.length - 16 - 30] ^= 0x5a;
    writeFileSync(join(DIR, 'item.diwanseal'), item);
    expect(await reason(open(join(DIR, 'item.diwanseal')))).toBe(SEAL_ERRORS.tampered);

    const head = buf.subarray(headAt, headAt + headLen).toString('utf8').replace('"kind":"first"', '"kind":"buyer"');
    const forged = Buffer.concat([buf.subarray(0, headAt), Buffer.from(head, 'utf8'), buf.subarray(headAt + headLen)]);
    writeFileSync(join(DIR, 'head.diwanseal'), forged);
    expect(await reason(open(join(DIR, 'head.diwanseal')))).toBe(SEAL_ERRORS.unsigned);

    writeFileSync(join(DIR, 'cut.diwanseal'), buf.subarray(0, buf.length - 7));
    expect(await reason(open(join(DIR, 'cut.diwanseal')))).toBe(SEAL_ERRORS.tampered);
  });

  it('ما ليس حزمة: ZIP، ونصّ، وفارغ ← «ليس حزمة»', async () => {
    writeFileSync(join(DIR, 'zip.diwanseal'), Buffer.from('PK\u0003\u0004 ليس حزمة'));
    writeFileSync(join(DIR, 'empty.diwanseal'), Buffer.alloc(0));
    writeFileSync(join(DIR, 'magic.diwanseal'), Buffer.concat([Buffer.from(SEAL_MAGIC), Buffer.from([0, 0, 0, 5]), Buffer.from('{bad}')]));
    for (const f of ['zip', 'empty', 'magic']) expect(await reason(open(join(DIR, `${f}.diwanseal`)))).toBe(SEAL_ERRORS.notPack);
  });

  it('توقيع تحديثٍ (بلا بادئة «diwan-seal») لا يصلح ختمًا', async () => {
    const buf = readFileSync(await seal());
    const { headAt, headLen, bodyAt } = parts(buf);
    const head = buf.subarray(headAt, headAt + headLen);
    const updateStyle = sign(null, head, owner.privateKey);
    const sigLen = Buffer.alloc(4);
    sigLen.writeUInt32BE(updateStyle.length, 0);
    const swapped = Buffer.concat([buf.subarray(0, headAt + headLen), sigLen, updateStyle, buf.subarray(bodyAt)]);
    writeFileSync(join(DIR, 'update-sig.diwanseal'), swapped);
    expect(await reason(open(join(DIR, 'update-sig.diwanseal')))).toBe(SEAL_ERRORS.unsigned);
  });

  it('والحمولة لا تُقرأ بلا المفتاح: لا ZIP ولا اسم قطعةٍ ولا بايتاتها ظاهرة', async () => {
    const buf = readFileSync(await seal());
    const body = buf.subarray(parts(buf).bodyAt);
    expect(body.subarray(0, 2).toString('latin1')).not.toBe('PK');
    expect(body.includes(Buffer.from('قاط أسود', 'utf8'))).toBe(false);
    expect(body.includes(PNG.subarray(8, 60))).toBe(false);
  });

  it.each(['templates', 'clips', 'letterheads'] as const)('قسم %s يحمل ملف محتوى واحدًا والختم كما كان', async (content) => {
    const path = join(DIR, `${content}.diwanpack`);
    writeFileSync(path, 'حمولة محتوى اختبار — لا تُفكّ هنا');
    const out = join(DIR, `${content}.diwanseal`);
    await core.writeSealedPack({ items: [{ name: 'قسم تجريبي', path }], content, kind: 'first', title: 'قسم', privateKey: owner.privateKey, out });
    const opened = await open(out);
    expect(opened.head.content).toBe(content);
    expect(opened.items.map((i) => i.ext)).toEqual(['diwanpack']);
    expect(readFileSync(opened.items[0]!.path).equals(readFileSync(path))).toBe(true);
    opened.cleanup();
  });

  it.each(['templates', 'clips', 'letterheads'] as const)('keygen seal --content %s يختم ملف القسم الواحد', async (content) => {
    const path = join(DIR, `${content}-cli.diwanpack`);
    writeFileSync(path, 'حمولة قسم اختبار');
    const key = join(DIR, 'cli-owner.pem');
    writeFileSync(key, owner.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const out = join(DIR, `${content}-cli.diwanseal`);
    execFileSync(process.execPath, [join(__dirname, '../tools/license/keygen.mjs'), 'seal', path, '--content', content, '--kind', 'buyer', '--title', 'قسم', '--key', key, '--out', out]);
    const opened = await open(out);
    expect([opened.head.content, opened.head.kind, opened.items[0]?.ext]).toEqual([content, 'buyer', 'diwanpack']);
    opened.cleanup();
    expect(core.sealItemsFrom(path, content)).toEqual([{ name: `${content}-cli`, path }]);
  });

  it('اختيار ملف القسم يرفض المجلّد أو امتدادًا آخر أو نوعًا غير معروف', () => {
    expect(() => core.sealItemsFrom(DIR, 'templates')).toThrow('اختر ملف القسم');
    expect(() => core.sealItemsFrom(join(DIR, 'قاط أسود.png'), 'clips')).toThrow('اختر ملف القسم');
    expect(() => core.sealItemsFrom(DIR, 'unknown')).toThrow('اختر محتوى الحزمة');
  });

  it('قائمة القطع توافق نوع الرأس: لا PNG تحت رأس قسم، ولا ملفا محتوى، ولا محتوى في القاط', async () => {
    const png = { name: 'قاط', ext: 'png', size: 10, sha256: 'a'.repeat(64) };
    const pack = { ...png, ext: 'diwanpack' };
    expect(validItems({ items: [png] }, 10, 'templates')).toBeNull();
    expect(validItems({ items: [pack, pack] }, 20, 'clips')).toBeNull();
    expect(validItems({ items: [pack] }, 10)).toBeNull();
    await expect(core.writeSealedPack({ items: [{ name: 'قاط', path: join(DIR, 'قاط أسود.png') }], content: 'templates', kind: 'first', title: 'قسم', privateKey: owner.privateKey, out: join(DIR, 'bad.diwanseal') })).rejects.toThrow('ملف القسم');
    expect(validItems({ items: [pack] }, 10, 'letterheads')).toHaveLength(1);
  });

  it('والحدود: قطعةٌ فوق الحدّ، وقائمةٌ لا يطابق مجموعها ما بقي ← تُرفض', () => {
    const it1 = { name: 'قاط', ext: 'png', size: 10, sha256: 'a'.repeat(64) };
    expect(validItems({ items: [it1] }, 10)).toHaveLength(1);
    expect(validItems({ items: [it1] }, 11)).toBeNull();
    expect(validItems({ items: [{ ...it1, size: SEAL_LIMITS.item + 1 }] }, SEAL_LIMITS.item + 1)).toBeNull();
    expect(validItems({ items: [{ ...it1, ext: 'exe' }] }, 10)).toBeNull();
    expect(validItems({ items: [{ ...it1, name: '../../' }] }, 10)?.[0]?.name).toBe('.. ..');
  });
});
