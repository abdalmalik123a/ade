/**
 * مجلّد بيانات المكتب يختاره المكتب (D236): المؤشّر، والمقترح، وفحص الاختيار، والنقل بلا فقد.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_NAME,
  checkChoice,
  clearPendingMove,
  hasData,
  moveData,
  readPendingMove,
  readPointer,
  suggestDataDir,
  writePendingMove,
  writePointer,
  type Disk
} from '../src/main/services/dataLocation';

const tmp = (tag: string) => mkdtempSync(join(tmpdir(), `diwan-dataloc-${tag}-`));

/** مجلّد بياناتٍ صغير: قاعدةٌ حقيقية ومستمسكٌ في المخزن. */
function office(dir: string): void {
  mkdirSync(join(dir, 'store', 'attachments'), { recursive: true });
  const db = new Database(join(dir, 'diwan.db'));
  db.exec("CREATE TABLE citizens (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO citizens (name) VALUES ('زينب علي حسن');");
  db.close();
  writeFileSync(join(dir, 'store', 'attachments', 'scan-1.png'), Buffer.alloc(2048, 7));
  writeFileSync(join(dir, 'diwan-license.json'), '{}');
}

const DISKS: Disk[] = [
  { id: 'C:', type: 3 },
  { id: 'D:', type: 3 },
  { id: 'E:', type: 2 },
  { id: 'Z:', type: 4 }
];

describe('مؤشّر مجلّد البيانات', () => {
  it('يُكتب ويُقرأ، ومؤشّرٌ تالف أو مسارٌ نسبيّ لا يُعتمد', () => {
    const userData = tmp('ptr');
    expect(readPointer(userData)).toBeNull();
    writePointer(userData, { path: 'D:\\DiwanData', asides: ['C:\\x-before-move-1'] });
    expect(readPointer(userData)).toEqual({ path: 'D:\\DiwanData', asides: ['C:\\x-before-move-1'] });
    expect(existsSync(join(userData, 'data-location.json.tmp'))).toBe(false);
    writeFileSync(join(userData, 'data-location.json'), '{"path":"relative\\\\dir"}');
    expect(readPointer(userData)).toBeNull();
    writeFileSync(join(userData, 'data-location.json'), '{"path":');
    expect(readPointer(userData)).toBeNull();
  });

  it('والنقل المطلوب من الإعدادات يُحفظ للإقلاع التالي ثم يُمحى', () => {
    const userData = tmp('pending');
    expect(readPendingMove(userData)).toBeNull();
    writePendingMove(userData, 'D:\\New');
    expect(readPendingMove(userData)).toBe('D:\\New');
    clearPendingMove(userData);
    expect(readPendingMove(userData)).toBeNull();
  });
});

describe('المكان المقترح', () => {
  it('أوّل قرصٍ ثابتٍ غير قرص النظام، لا المنقول ولا الشبكة', () => {
    expect(suggestDataDir(DISKS, 'C:')).toBe(`D:\\${SUGGESTED_NAME}`);
    expect(suggestDataDir([{ id: 'C:', type: 3 }, { id: 'E:', type: 2 }, { id: 'Z:', type: 4 }], 'C:')).toBe(`C:\\${SUGGESTED_NAME}`);
    expect(suggestDataDir([{ id: 'F:', type: 3 }, { id: 'C:', type: 3 }, { id: 'D:', type: 3 }], 'c:')).toBe(`D:\\${SUGGESTED_NAME}`);
  });
});

describe('فحص المجلّد المختار', () => {
  const env = {
    APPDATA: 'C:\\Users\\salem\\AppData\\Roaming',
    LOCALAPPDATA: 'C:\\Users\\salem\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
    SystemRoot: 'C:\\Windows',
    OneDrive: 'C:\\Users\\salem\\OneDrive'
  };
  const ctx = { userData: 'C:\\Users\\salem\\AppData\\Roaming\\diwan', disks: DISKS, env };

  it('يرفض الشبكة وAppData ومجلّدات النظام', () => {
    expect(checkChoice('\\\\server\\share\\diwan', ctx).error).toMatch(/شبكة/);
    expect(checkChoice('Z:\\diwan', ctx).error).toMatch(/شبكة/);
    expect(checkChoice('C:\\Users\\salem\\AppData\\Local\\DiwanData', ctx).error).toMatch(/AppData/);
    expect(checkChoice('C:\\Users\\salem\\AppData\\Roaming\\diwan\\data', ctx).error).toMatch(/AppData/);
    expect(checkChoice('C:\\Program Files\\Diwan', ctx).error).toMatch(/للنظام/);
    expect(checkChoice('relative', ctx).error).toBeTruthy();
  });

  it('وينبّه على OneDrive والفلاشة، ويقبل القرص الثابت', () => {
    expect(checkChoice('C:\\Users\\salem\\OneDrive\\Documents\\DiwanData', ctx).warning).toMatch(/OneDrive/);
    expect(checkChoice('E:\\DiwanData', ctx).warning).toMatch(/فلاشة/);
    expect(checkChoice('D:\\DiwanData', ctx)).toEqual({ target: 'D:\\DiwanData' });
  });

  it('ومجلّدٌ فيه ملفّاتٌ غير ديوان تُوضع البيانات داخله في DiwanData، وفيه بيانات ديوان يُفتح كما هو', () => {
    const busy = tmp('busy');
    writeFileSync(join(busy, 'letter.docx'), 'x');
    const local = { ...ctx, userData: tmp('ud'), env: {} };
    expect(checkChoice(busy, local).target).toBe(join(busy, SUGGESTED_NAME));
    const withData = tmp('withdata');
    office(withData);
    expect(checkChoice(withData, local).target).toBe(withData);
    const empty = tmp('empty');
    expect(checkChoice(empty, local).target).toBe(empty);
  });
});

describe('نقل البيانات بلا فقد', () => {
  it('على القرص نفسه: إعادة تسمية، ولا يبقى شيءٌ جانبًا', async () => {
    const root = tmp('same');
    const from = join(root, 'data');
    const to = join(root, 'DiwanData');
    office(from);
    expect(await moveData(from, to)).toEqual({ moved: true });
    expect(existsSync(from)).toBe(false);
    expect(hasData(to)).toBe(true);
    expect(readFileSync(join(to, 'store', 'attachments', 'scan-1.png')).length).toBe(2048);
  });

  it('بين قرصين: نسخٌ وتحقّق، والقديم جانبًا كما هو، ولا يبقى .partial', async () => {
    const root = tmp('cross');
    const from = join(root, 'data');
    const to = join(root, 'other', 'DiwanData');
    office(from);
    const out = await moveData(from, to, { sameDisk: false, now: () => new Date('2026-10-30T09:00:00Z') });
    expect(out.moved).toBe(true);
    expect(out.aside).toBe(`${from}-before-move-2026-10-30T09-00-00`);
    expect(hasData(to)).toBe(true);
    expect(hasData(out.aside!)).toBe(true);
    expect(existsSync(from)).toBe(false);
    expect(existsSync(`${to}.partial`)).toBe(false);
    const db = new Database(join(to, 'diwan.db'), { readonly: true });
    expect(db.prepare('SELECT name FROM citizens').pluck().get()).toBe('زينب علي حسن');
    db.close();
  });

  it('قاعدةٌ منسوخة لا تجتاز الفحص: يبقى المصدر، ولا يصير الهدف، ويُعاد النسخ من أوّله بعدها', async () => {
    const root = tmp('broken');
    const from = join(root, 'data');
    const to = join(root, 'other', 'DiwanData');
    office(from);
    await expect(moveData(from, to, { sameDisk: false, integrity: () => 'malformed' })).rejects.toThrow(/فحص السلامة/);
    expect(hasData(from)).toBe(true);
    expect(existsSync(to)).toBe(false);
    const out = await moveData(from, to, { sameDisk: false });
    expect(out.moved).toBe(true);
    expect(existsSync(`${to}.partial`)).toBe(false);
  });

  it('لا يُكتب فوق بيانات ديوانٍ في الهدف، والمصدر الفارغ يُنشئ الهدف وحده', async () => {
    const root = tmp('guard');
    const from = join(root, 'data');
    const to = join(root, 'DiwanData');
    office(from);
    office(to);
    await expect(moveData(from, to)).rejects.toThrow(/لا يُكتب فوقها/);
    expect(hasData(from)).toBe(true);
    const empty = join(root, 'empty');
    const fresh = join(root, 'fresh');
    expect(await moveData(empty, fresh)).toEqual({ moved: false });
    expect(readdirSync(fresh)).toEqual([]);
  });
});
