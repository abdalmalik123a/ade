/**
 * `diwan://store/<المسار النسبي>` — ملفٌّ داخل مخزن المكتب وحده، للقراءة. ومنه تعرض الواجهة كلّ صورةٍ وPDF في المخزن.
 *
 * ما يكتبه ديوان مشفّرًا (المستمسكات والصور الشخصية والكتب الصادرة، D238) يُفكّ هنا بمفتاح المكتب قبل الردّ،
 * وما سواه يُقرأ كما هو بـ`net.fetch` (رؤوس الملفّ ونوعه كما كانت). وكان في `main/index.ts` حتى قارب سقفه.
 */
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { storeDir } from './db';
import { resolveStorePath } from './services/localPaths';
import { isPrivate, readStore } from './services/storeCrypt';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.pdf': 'application/pdf'
};

// رأس CORS: الواجهة تقرأ بكسلات الشعار لتستخرج لون الجهة، ولوحةٌ رُسمت عليها
// صورةٌ من أصلٍ آخر بلا هذا الرأس تُقفَل فلا تُقرأ. والمخزن محلّيٌّ للقراءة وحدها.
const CORS = { 'Access-Control-Allow-Origin': '*' };

export function registerStoreProtocol(): void {
  protocol.handle('diwan', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'store') return new Response('not found', { status: 404 });
    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return new Response('forbidden', { status: 403 });
    }
    // محلولًا داخل المخزن (و٥): لا «..» ولا مسارٌ مطلق ولا مسار شبكة.
    const file = resolveStorePath(storeDir(), rel);
    if (!file) return new Response('forbidden', { status: 403 });
    if (isPrivate(rel)) {
      try {
        const bytes = await readStore(file);
        return new Response(new Uint8Array(bytes), {
          status: 200,
          headers: { ...CORS, 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' }
        });
      } catch (e) {
        const missing = (e as { code?: string }).code === 'ENOENT';
        return new Response(missing ? 'not found' : 'unreadable', { status: missing ? 404 : 500, headers: CORS });
      }
    }
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, { status: res.status, headers });
  });
}
