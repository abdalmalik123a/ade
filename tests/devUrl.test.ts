/**
 * عنوان خادم الواجهة (و١): يُقرأ في نسخة التطوير وحدها — والبرنامج المحزوم لا يحمّل نافذته من متغيّر بيئة.
 * والقراءة في `main/devUrl.ts` وحده: لا موضع آخر يقرأ المتغيّر فيفلت من الحدّ.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const app = { isPackaged: false };
/** متغيّرات البيئة للكتابة — وأنواع electron-vite تجعل هذا المتغيّر للقراءة. */
const env = process.env as Record<string, string | undefined>;
vi.mock('electron', () => ({ app }));

const { rendererDevUrl } = await import('../src/main/devUrl');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('عنوان خادم الواجهة (و١)', () => {
  afterEach(() => {
    delete env['ELECTRON_RENDERER_URL'];
    app.isPackaged = false;
  });

  it('في نسخة التطوير: العنوان كما وضعه electron-vite', () => {
    env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173';
    expect(rendererDevUrl()).toBe('http://localhost:5173');
  });

  it('وفي المحزوم لا يُقرأ — ولو وضعه برنامجٌ آخر على الجهاز', () => {
    env['ELECTRON_RENDERER_URL'] = 'http://evil.example';
    app.isPackaged = true;
    expect(rendererDevUrl()).toBeUndefined();
  });

  it('والفارغ كالغائب', () => {
    env['ELECTRON_RENDERER_URL'] = '';
    expect(rendererDevUrl()).toBeUndefined();
  });

  it('ولا موضع في العملية الرئيسية يقرأ المتغيّر إلا `devUrl.ts`', () => {
    const root = join(__dirname, '..', 'src', 'main');
    const readers = sources(root)
      .filter((p) => readFileSync(p, 'utf8').includes('ELECTRON_RENDERER_URL'))
      .map((p) => relative(root, p).replace(/\\/g, '/'));
    expect(readers).toEqual(['devUrl.ts']);
  });
});
