/**
 * يكتب المفتاحين العامّين اللذين يحملهما برنامج ديوان (src/main/license/ownerKey.ts) في الأداة — فتقول عند فتحها
 * إن كان مفتاحك الخاص هو ما يقبله البرنامج، وإن كان البرنامج يعرف مفتاح التحديث (البند ٣٣). يجري قبل بناء الأداة
 * (npm run keytool). مفتاح التراخيص أوّل مفتاحٍ في الملفّ، ومفتاح التحديث ما يلي `OWNER_UPDATE_PUBLIC_KEY =` إن كان.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BEGIN = '-----BEGIN PUBLIC KEY-----';
const END = '-----END PUBLIC KEY-----';
const ts = readFileSync(resolve(HERE, '..', '..', 'src', 'main', 'license', 'ownerKey.ts'), 'utf8');
const pemAt = (from) => {
  const start = ts.indexOf(BEGIN, from);
  return start < 0 ? '' : ts.slice(start, ts.indexOf(END, start) + END.length);
};
const pem = pemAt(0);
const at = ts.indexOf('OWNER_UPDATE_PUBLIC_KEY =');
const update = at < 0 ? '' : pemAt(at);
writeFileSync(
  join(HERE, 'appKey.mjs'),
  `/** المفتاحان العامّان في برنامج ديوان — تكتبهما sync-key.mjs، لا يُعدَّلان يدويًّا. */\nexport const APP_PUBLIC_KEY = \`${pem}\`;\nexport const APP_UPDATE_KEY = \`${update}\`;\n`
);
console.log(`✓ appKey.mjs${update ? ' — ومعه مفتاح التحديث' : ' — ولا مفتاح تحديثٍ في البرنامج بعد'}`);
