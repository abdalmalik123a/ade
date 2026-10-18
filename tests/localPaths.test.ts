/**
 * مساراتٌ من الواجهة تصير ملفّاتٍ تُقرأ (و٥): صورة Word الملصوقة ملفٌّ محلّيّ في المجلّد المؤقّت أو المخزن وحده —
 * لا رابطٌ بمضيف ولا مسار شبكة (قراءته ترسل بصمة دخول الموظف إلى ذلك الجهاز) — و`diwan://store/…` داخل المخزن.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { isInside, pastedImagePath, resolveStorePath, storeFile } from '../src/main/services/localPaths';
import { docSchema } from '../src/shared/docPm';

const TMP = tmpdir();
const STORE = join(TMP, 'diwan-store-test');
const roots = [TMP, STORE];
const wordClip = join(TMP, 'msohtmlclip1', '01', 'clip_image001.png');

describe('صورة Word الملصوقة (و٥)', () => {
  it('ملفّ Word المؤقّت يُقبل — كما يضعه Word', () => {
    expect(pastedImagePath(pathToFileURL(wordClip).href, roots)).toBe(wordClip);
    // وحرف القرص بأيّ حالةٍ كان.
    const lower = pathToFileURL(wordClip).href.replace(/^file:\/\/\/([A-Z]):/, (_m, d: string) => `file:///${d.toLowerCase()}:`);
    expect(pastedImagePath(lower, roots)).not.toBeNull();
    expect(pastedImagePath(pathToFileURL(join(STORE, 'images', 'a.png')).href, roots)).not.toBeNull();
  });

  it('ورابطٌ بمضيف أو مسار شبكة يُرفض قبل أيّ قراءة', () => {
    expect(pastedImagePath('file://server/share/x.png', roots)).toBeNull();
    expect(pastedImagePath('file:////server/share/x.png', roots)).toBeNull();
    expect(pastedImagePath('file://192.168.1.5/c$/x.png', roots)).toBeNull();
    expect(pastedImagePath('file:///%5C%5Cserver/share/x.png', roots)).toBeNull();
  });

  it('وما خارج المجلّدين يُرفض — ولو بـ«..»', () => {
    expect(pastedImagePath('file:///C:/Windows/win.ini', roots)).toBeNull();
    expect(pastedImagePath(`${pathToFileURL(TMP).href}/../../Desktop/x.png`, roots)).toBeNull();
    expect(pastedImagePath('http://example.com/x.png', roots)).toBeNull();
    expect(pastedImagePath('ليس رابطًا', roots)).toBeNull();
  });
});

describe('ملفّ المخزن من مساره النسبي (و٥)', () => {
  it('داخله يُقبل', () => {
    expect(resolveStorePath(STORE, 'images/a.png')).toBe(join(STORE, 'images', 'a.png'));
    expect(resolveStorePath(STORE, 'images/../letterheads/b.png')).toBe(join(STORE, 'letterheads', 'b.png'));
  });

  it('وما خرج منه أو كان المخزن نفسه يُرفض', () => {
    for (const bad of ['../x.png', 'images/../../x.png', 'C:/Windows/win.ini', '//server/share/x.png', '\\\\server\\share\\x.png', '', '.', 'a\0b']) {
      expect(resolveStorePath(STORE, bad)).toBeNull();
    }
  });

  it('والاحتواء بالمسار المحلول لا بالنصّ', () => {
    expect(isInside(STORE, join(STORE, 'a'))).toBe(true);
    expect(isInside(STORE, STORE)).toBe(true);
    expect(isInside(STORE, `${STORE}-other`)).toBe(false);
    expect(isInside(STORE, join(STORE, '..', 'x'))).toBe(false);
  });
});

describe('ملفٌّ موجودٌ في المخزن — للشعار والختم وصور Word (A04، D69)', () => {
  const store = mkdtempSync(join(TMP, 'diwan-storefile-'));
  // ملفٌّ موجودٌ بجانب المخزن لا فيه — كقاعدة البيانات بجانب `store/`.
  const outside = `${store}-outside.db`;
  mkdirSync(join(store, 'seals'));
  writeFileSync(join(store, 'seals', 'logo.png'), 'png');
  writeFileSync(outside, 'db');
  afterAll(() => {
    rmSync(store, { recursive: true, force: true });
    rmSync(outside, { force: true });
  });

  it('ملفٌّ في المخزن يعود مساره المحلول', () => {
    expect(storeFile(store, 'seals/logo.png')).toBe(join(store, 'seals', 'logo.png'));
    expect(storeFile(store, 'seals/../seals/logo.png')).toBe(join(store, 'seals', 'logo.png'));
  });

  it('و`null` لـ«..» ومطلقٍ ومسار شبكة وملفٍّ غير موجود ومجلّدٍ وغير نصّ', () => {
    const bad: unknown[] = [`../${basename(outside)}`, '../diwan.db', outside, join(store, 'seals', 'logo.png'), 'C:/Windows/win.ini'];
    bad.push('\\\\server\\share\\logo.png', '//server/share/logo.png', 'seals/missing.png', 'seals', '', 'seals/logo.png\0', null, 7);
    for (const rel of bad) {
      expect(storeFile(store, rel)).toBeNull();
    }
  });
});

describe('لصق الصور في المحرّر (و٥)', () => {
  /** قاعدة قراءة `<img src>` كما يقرؤها ProseMirror من الملصوق. */
  const rule = docSchema.spec.nodes.get('image')!.parseDOM!.find((r) => 'tag' in r && r.tag === 'img[src]')!;
  const attrs = (src: string) =>
    (rule as { getAttrs: (el: unknown) => unknown }).getAttrs({ getAttribute: (n: string) => (n === 'src' ? src : null) });

  it('ملفٌّ على قرصٍ محلّيّ وصورةٌ مضمّنة يُلصقان', () => {
    expect(attrs('file:///C:/Users/x/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png')).toMatchObject({ src: expect.stringContaining('clip_image001') });
    expect(attrs('data:image/png;base64,AAAA')).toMatchObject({ src: 'data:image/png;base64,AAAA' });
  });

  it('ورابطٌ بمضيف أو مسار شبكة أو من الإنترنت لا يُلصق', () => {
    for (const src of ['file://server/share/x.png', 'file:////server/share/x.png', 'https://example.com/x.png', 'file:x.png']) expect(attrs(src)).toBe(false);
  });
});
