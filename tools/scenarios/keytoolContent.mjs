/** D210: أداة المالك تختم أقسام المحتوى بمفتاح تحديث مصنوع في المؤقّت؛ لا يصل إلى مجلّده الحقيقي. */
import { generateKeyPairSync, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import * as core from '../keytool/core.mjs';

export const appDir = 'tools/keytool';
const DIR = join(process.env.TEMP ?? '.', `diwan-keytool-content-${Date.now()}`);
const PASSWORD = 'test-content-123456';
let updatePublic;
export function prepare() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, core.PLAIN_KEY_FILE), generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }));
  core.encryptExistingKey(DIR, PASSWORD);
  updatePublic = core.createUpdateKey(DIR, PASSWORD);
  writeFileSync(join(DIR, 'section.diwanpack'), zipSync({ 'diwan-content.json': strToU8(JSON.stringify({ app: 'diwan', kind: 'content', format: 1, appVersion: '1.9.0', createdAt: '2026-10-29', templates: [], clips: [], letterheads: [] })) }));
  return { DIWAN_OWNER_DIR: DIR, DIWAN_KEYTOOL_IDLE_MS: '120000' };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  await page.until(`return !document.querySelector('[data-screen="login"]').classList.contains('hidden');`);
  await page.eval(`document.querySelector('#pw').value = ${JSON.stringify(PASSWORD)}; document.querySelector('#unlockBtn').click(); return true;`);
  if (!await page.until(`return !document.querySelector('[data-screen="app"]').classList.contains('hidden');`)) throw new Error('فتح أداة الاختبار');
  await page.eval(`document.querySelector('[data-tab="seal"]').click(); return true;`);
  ok('المجلّد المؤقّت وحده ظاهر، والمحتوى أربعة اختيارات', (await page.text()).includes(DIR) && await page.eval(`return document.querySelectorAll('#sealContent option').length === 4;`));
  for (const content of ['templates', 'clips', 'letterheads']) {
    await page.eval(`document.querySelector('#sealTitle').value='عنوان سابق'; const s = document.querySelector('#sealContent'); s.value=${JSON.stringify(content)}; s.dispatchEvent(new Event('change')); return true;`);
    ok(`واختيار ${content} يُظهر ملف القسم ويخفي مجلّد القاط`, await page.eval(`return !document.querySelector('#pickContent').classList.contains('hidden') && document.querySelector('#pickPieces').classList.contains('hidden') && !document.querySelector('#sealSectionHint').classList.contains('hidden') && document.querySelector('#sealTitle').value === '';`));
    const kind = content === 'clips' ? 'buyer' : 'first';
    const r = await page.eval(`return await window.keytool.makeSeal({ file: ${JSON.stringify(join(DIR, 'section.diwanpack'))}, content: ${JSON.stringify(content)}, kind: ${JSON.stringify(kind)}, title: ${JSON.stringify(content + '/٢٠٢٦: اختبار')} });`);
    let good = false;
    if (r.ok && existsSync(r.value.out)) {
      const buf = readFileSync(r.value.out), at = 'DIWANSEAL1\n'.length;
      const length = buf.readUInt32BE(at), head = buf.subarray(at + 4, at + 4 + length);
      const sigLength = buf.readUInt32BE(at + 4 + length), sig = buf.subarray(at + 8 + length, at + 8 + length + sigLength);
      const h = JSON.parse(head.toString('utf8'));
      good = h.content === content && h.kind === kind && r.value.items === 1 && verify(null, Buffer.concat([Buffer.from('diwan-seal\n'), head]), updatePublic, sig) && r.value.out === join(DIR, `${content} ٢٠٢٦ اختبار.diwanseal`);
    }
    ok(`وصنع ${content} يمرّر القسم والنوع ويختم بمفتاح التحديث باسم نظيف`, good);
  }
  const bad = await page.eval(`return await window.keytool.makeSeal({ file: ${JSON.stringify(join(DIR, 'missing.png'))}, content: 'templates', kind: 'first', title: 'خطأ' });`);
  ok('والملف الخاطئ يُرفض برسالة عربية', !bad.ok && bad.error.includes('اختر ملف القسم'));
  await page.eval(`const s=document.querySelector('#sealContent'); s.value='suits'; s.dispatchEvent(new Event('change')); return true;`);
  ok('والعودة إلى القاط تُعيد اختيار المجلّد', await page.eval(`return !document.querySelector('#pickPieces').classList.contains('hidden') && document.querySelector('#pickContent').classList.contains('hidden');`));
  return steps.join('\n');
}
