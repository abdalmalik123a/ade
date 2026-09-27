/**
 * نافذة بطاقة التعبئة (هـ٦): صغيرةٌ فوق المتصفّح، تبقى في الأعلى، والنقر ينسخ.
 *
 * نافذةٌ واحدة لا تتكاثر: فتحها لمواطنٍ آخر يُحمّله فيها. والواجهة نفسها بعلامة
 * `mode=fillcard` — فتأخذ خطوطها وأنماطها وجسرها كما هي، ولا شبكة.
 */
import { join } from 'node:path';
import { BrowserWindow } from 'electron';

let card: BrowserWindow | null = null;

export async function openFillCard(citizenId: number): Promise<void> {
  const query = { mode: 'fillcard', citizen: String(citizenId) };
  if (!card || card.isDestroyed()) {
    card = new BrowserWindow({
      width: 400,
      height: 680,
      minWidth: 320,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      title: 'بطاقة التعبئة',
      backgroundColor: '#f8f9ff',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    });
    // فوق المتصفّح وإن كان بملء الشاشة.
    card.setAlwaysOnTop(true, 'floating');
    card.on('closed', () => {
      card = null;
    });
  }
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) await card.loadURL(`${devUrl}/index.html?${new URLSearchParams(query).toString()}`);
  else await card.loadFile(join(__dirname, '../renderer/index.html'), { query });
  card.show();
  card.focus();
}
