/**
 * يكتب المفتاح العامّ الذي يحمله برنامج ديوان (src/main/license/ownerKey.ts) في الأداة — فتقول عند فتحها
 * إن كان مفتاحك الخاص هو ما يقبله البرنامج. يجري قبل بناء الأداة (npm run keytool).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ts = readFileSync(resolve(HERE, '..', '..', 'src', 'main', 'license', 'ownerKey.ts'), 'utf8');
const pem = ts.slice(ts.indexOf('-----BEGIN PUBLIC KEY-----'), ts.indexOf('-----END PUBLIC KEY-----') + '-----END PUBLIC KEY-----'.length);
writeFileSync(join(HERE, 'appKey.mjs'), `/** المفتاح العامّ في برنامج ديوان — تكتبه sync-key.mjs، لا يُعدَّل يدويًّا. */\nexport const APP_PUBLIC_KEY = \`${pem}\`;\n`);
console.log('✓ appKey.mjs');
