/**
 * ملفّ PDF المشفَّر (هـ٢): المقيَّد بصلاحيات ناشره يُفتح في أيّ قارئ، والمحميّ يطلب كلمة مرور — ولكلٍّ رسالته.
 *
 * الملفّات صفحةٌ بيضاء شُفّرت بأداةٍ مستقلّة (pypdf 6.19: كلمة المالك «owner-secret»، والمستخدم فارغة أو «1234»،
 * وصلاحيةُ الطباعة وحدها) بالمراجعات كلّها: RC4-40 (٢) وRC4-128 (٣) وAES-128 (٤) وAES-256 (٦). والحَكَم pdf.js
 * نفسه: ما يفتحه بلا كلمة «مقيَّد»، وما يطلب له كلمةً «محميّ» — فالفحص يوافق القارئ لا نفسه.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lockedMessage, pdfLock } from '../src/main/services/pdfLock';
import { inspectPdf } from '../src/main/services/pdfEdit';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

const RESTRICTED = ['restricted-rc4-40.pdf', 'restricted-rc4-128.pdf', 'restricted-aes-128.pdf', 'restricted-aes-256.pdf'];
const PASSWORD = ['password-rc4-128.pdf', 'password-aes-256.pdf'];

/** pdf.js: أيفتحه بلا كلمة؟ */
async function readerOpens(bytes: Uint8Array): Promise<boolean> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    await task.promise;
    return true;
  } catch (e) {
    if ((e as { name?: string }).name === 'PasswordException') return false;
    throw e;
  } finally {
    void task.destroy();
  }
}

describe('المقيَّد والمحميّ (هـ٢)', () => {
  it.each(RESTRICTED)('%s يفتحه القارئ بلا كلمة — فهو «مقيَّد»', async (name) => {
    const bytes = fixture(name);
    expect(await readerOpens(bytes)).toBe(true);
    expect(await pdfLock(bytes)).toBe('restricted');
  });

  it.each(PASSWORD)('%s يطلب له القارئ كلمة — فهو «محميّ»', async (name) => {
    const bytes = fixture(name);
    expect(await readerOpens(bytes)).toBe(false);
    expect(await pdfLock(bytes)).toBe('password');
  });

  it('وفتحه في المحرّر يقول الصحيح: المقيَّد «يُفتح في أيّ قارئ» — لا «كلمة مرور»', async () => {
    const err = await inspectPdf(fixture('restricted-aes-256.pdf')).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/مقيَّدٌ بصلاحيات ناشره.*يُفتح في أيّ قارئ بلا كلمة مرور.*اطبعه PDF جديدًا/);
    expect((err as Error).message).not.toMatch(/محميٌّ بكلمة مرور/);
  });

  it('والمحميّ يقول «كلمة مرور تُطلب لفتحه» وما يُفعل', async () => {
    const err = await inspectPdf(fixture('password-rc4-128.pdf')).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/محميٌّ بكلمة مرور تُطلب لفتحه.*اطبعه PDF جديدًا/);
  });

  it('وما لا يُعرف قفله (قاموسٌ ناقص) يُقال بالاحتمالين — لا يُجزم', async () => {
    const odd = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n' +
        'trailer << /Root 1 0 R /Encrypt << /Filter /Standard /V 1 /R 2 >> >>\n%%EOF'
    );
    expect(await pdfLock(odd)).toBeNull();
    await expect(inspectPdf(odd)).rejects.toThrow('مقيَّدٌ أو محميّ');
  });

  it('والملفّ غير المشفَّر لا قفل له', async () => {
    const plain = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF');
    expect(await pdfLock(plain)).toBeNull();
    expect(await pdfLock(new TextEncoder().encode('ليس PDF'))).toBeNull();
  });

  it('والرسائل الثلاث بلغة المكتب وبما يُفعل', () => {
    for (const lock of ['password', 'restricted', null] as const) expect(lockedMessage(lock)).toMatch(/Microsoft Print to PDF/);
  });
});
