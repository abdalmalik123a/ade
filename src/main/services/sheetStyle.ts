/**
 * أنماط الورقة كما ترسمها نافذة الإخراج، تُحفظ مع كلّ كتابٍ يصدر — نُقل من `render.ts` (D80).
 */
import type { SheetStyle } from '@shared/api';
import { rendererDevUrl } from '../devUrl';
import { join, posix } from 'node:path';
import { readFileSync } from 'node:fs';

let styleCache: SheetStyle | null | undefined;

/**
 * أنماط الورقة كما ترسمها نافذة الإخراج الآن: ملفّات الأنماط التي تربطها `index.html`، وصنف
 * `<body>` الذي يرث منه خطّها — تُحفظ مع كلّ كتابٍ يصدر (خطة Production، ١٫٣).
 *
 * تُقرأ من الملفّ المبنيّ نفسه الذي تحمّله نافذة الإخراج، لا من الواجهة: فهي ما رُسم به فعلًا.
 * و`url(./…)` في الأنماط نسبيٌّ إلى مجلّدها، فيُكتب نسبيًّا إلى `index.html` لتُحقن يومًا في
 * صفحتها. وفي نمط التطوير (خادم Vite) لا ملفّ مبنيًّا يُوثق به، فلا يُلتقط شيء.
 */
export function sheetStyle(): SheetStyle | null {
  if (styleCache !== undefined) return styleCache;
  styleCache = null;
  if (rendererDevUrl()) return styleCache;
  try {
    const dir = join(__dirname, '../renderer');
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/<link\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /\brel="stylesheet"/.test(tag))
      .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1])
      .filter((href): href is string => Boolean(href));
    const css = hrefs
      .map((href) => {
        const base = posix.dirname(href.replace(/^\.\//, ''));
        return readFileSync(join(dir, href), 'utf8').replace(/url\(\s*(['"]?)\.\//g, `url($1./${base}/`);
      })
      .join('\n');
    const bodyClass = /<body\b[^>]*\bclass="([^"]*)"/.exec(html)?.[1] ?? null;
    if (css.trim()) styleCache = { css, bodyClass };
  } catch {
    // لا ملفّ مبنيّ يُقرأ — يصدر الكتاب بلا أنماطٍ محفوظة، ويُعاد طبعه بأنماط يومه كما كان.
  }
  return styleCache;
}
