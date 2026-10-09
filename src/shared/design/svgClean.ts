/**
 * تعقيم الرسمة المتّجهة (SVG) قبل أن تدخل مكتبة العناصر (DESIGNS.md ٣٫٨ و٠٫٨): **لا شيفرة ولا روابط خارجية**.
 *
 * بقائمة سماحٍ لا بقائمة منعٍ: يُعاد بناء الملفّ من عناصر الرسم وخصائصه المعروفة وحدها، وما سواها يسقط بما فيه —
 * `<script>` و`<foreignObject>` وخصائص `on…` وروابط `http:`/`file:`/`javascript:`، و`@import` و`url()` إلى خارج الملفّ،
 * و`<!DOCTYPE>` بكياناته (فلا «مليار ضحكة»)، وطبقات Inkscape وIllustrator الخاصّة. والصورة النقطية داخلها مقبولةٌ مضمَّنةً
 * (`data:image/png;base64,…`) لا رابطًا.
 *
 * والرسمة تُعرض بعدها `<img>` أيضًا — والمتصفّح لا يشغّل في الصورة شيفرةً ولا يجلب موردًا — فالتعقيم حمايةٌ ثانية، وهو ما
 * يجعل الملفّ نفسه نظيفًا أينما ذهب (نسخةٌ احتياطية، حزمة، تصميمٌ يُصدَّر).
 *
 * خالصٌ بلا DOM (نواة التصاميم) — يُختبر في الوحدة، وتستعمله العملية الرئيسة.
 */

/** أكبر رسمةٍ تُقبل — الزخارف والإطارات من المصمّمين دون هذا بكثير. */
export const SVG_MAX = 5 * 1024 * 1024;
const MAX_ELEMENTS = 50_000;

const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'switch', 'style', 'marker',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'image',
  'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feComposite', 'feFlood', 'feMerge', 'feMergeNode',
  'feDropShadow', 'feMorphology', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA'
]);

const ATTRS = new Set([
  'id', 'class', 'style', 'transform', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr',
  'width', 'height', 'viewBox', 'preserveAspectRatio', 'points', 'pathLength', 'version', 'xml:space',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'display', 'visibility', 'overflow',
  'clip-path', 'clip-rule', 'clipPathUnits', 'mask', 'maskUnits', 'maskContentUnits', 'filter', 'filterUnits', 'primitiveUnits',
  'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod',
  'patternUnits', 'patternContentUnits', 'patternTransform',
  'marker-start', 'marker-mid', 'marker-end', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline',
  'letter-spacing', 'word-spacing', 'direction', 'unicode-bidi', 'writing-mode', 'dx', 'dy', 'rotate', 'textLength',
  'lengthAdjust', 'startOffset', 'method', 'spacing', 'side',
  'vector-effect', 'paint-order', 'shape-rendering', 'image-rendering', 'color-interpolation', 'color-interpolation-filters',
  'in', 'in2', 'result', 'stdDeviation', 'mode', 'type', 'values', 'operator', 'k1', 'k2', 'k3', 'k4', 'flood-color',
  'flood-opacity', 'radius', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'edgeMode',
  'href', 'xlink:href'
]);

/** الرابط المسموح: داخل الملفّ (#…)، أو صورةٌ نقطية مضمَّنة. */
const SAFE_HREF = /^\s*(#[\w.:-]+|data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+)\s*$/i;
const BAD_VALUE = /(javascript|vbscript|livescript)\s*:|expression\s*\(|-moz-binding|behavior\s*:/i;

/** CSS بلا `@import` ولا `url()` إلى خارج الملفّ. */
function cleanCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none')
    .replace(/(javascript|vbscript)\s*:/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/<\//g, '<\\/');
}

const XML_ENTITY = /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi;
/** النصّ كما يُكتب: `&` بلا كيانٍ معروف يُهرَّب، و`<` كذلك — وكيانات الـDOCTYPE المحذوف لا تبقى معلّقة. */
const escapeText = (s: string) => s.replace(/&[a-z_][\w.-]*;/gi, (m) => (/^&(amp|lt|gt|quot|apos);$/i.test(m) ? m : '')).replace(XML_ENTITY, '&amp;').replace(/</g, '&lt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');

function cleanAttr(name: string, value: string): string | null {
  if (!ATTRS.has(name)) return null;
  if (BAD_VALUE.test(value)) return null;
  if (name === 'href' || name === 'xlink:href') return SAFE_HREF.test(value) ? value.trim() : null;
  if (name === 'style') return cleanCss(value);
  // url() في القيم (fill وclip-path وmask وfilter…) إلى داخل الملفّ وحده.
  if (/url\(/i.test(value) && /url\(\s*(['"]?)(?!#)/i.test(value)) return null;
  return value;
}

type Tag = { name: string; attrs: [string, string][]; selfClosing: boolean };

function parseTag(src: string): Tag | null {
  const m = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(src);
  if (!m) return null;
  const attrs: [string, string][] = [];
  const re = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let a: RegExpExecArray | null;
  while ((a = re.exec(m[2]!))) attrs.push([a[1]!, a[3] ?? a[4] ?? '']);
  return { name: m[1]!, attrs, selfClosing: m[3] === '/' };
}

export type CleanSvg = { svg: string; width: number; height: number };

/** يعقّم الرسمة ويعيدها نظيفةً بمقاسها (من viewBox، أو width/height) — أو يرمي بالسبب بالعربية. */
export function cleanSvg(input: string): CleanSvg {
  if (input.length > SVG_MAX) throw new Error('الرسمة أكبر من ٥ ميغابايت');
  const out: string[] = [];
  /** المكتوب من العناصر المفتوحة — والمحذوف يُعدّ عمقه حتى يُغلق بما فيه. */
  const stack: { name: string; kept: boolean }[] = [];
  let skip = 0;
  let count = 0;
  let root: Tag | null = null;
  let i = 0;
  const inStyle = () => stack[stack.length - 1]?.name === 'style' && skip === 0;

  while (i < input.length) {
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      i = end < 0 ? input.length : end + 3;
    } else if (input.startsWith('<![CDATA[', i)) {
      const end = input.indexOf(']]>', i + 9);
      const text = input.slice(i + 9, end < 0 ? input.length : end);
      if (!skip && stack.length) out.push(inStyle() ? escapeText(cleanCss(text)) : escapeText(text));
      i = end < 0 ? input.length : end + 3;
    } else if (input.startsWith('<!', i)) {
      // DOCTYPE بمجموعته الداخلية [...] — يُحذف كلّه، فلا كيانات تتمدّد.
      let depth = 0;
      let j = i + 2;
      for (; j < input.length; j++) {
        if (input[j] === '[') depth++;
        else if (input[j] === ']') depth--;
        else if (input[j] === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (input.startsWith('<?', i)) {
      const end = input.indexOf('?>', i + 2);
      i = end < 0 ? input.length : end + 2;
    } else if (input.startsWith('</', i)) {
      const end = input.indexOf('>', i);
      const name = input.slice(i + 2, end < 0 ? input.length : end).trim();
      i = end < 0 ? input.length : end + 1;
      const at = stack.map((s) => s.name).lastIndexOf(name);
      if (at < 0) continue; // إغلاقٌ بلا فتح — يُتجاهل.
      while (stack.length > at) {
        const top = stack.pop()!;
        if (top.kept) out.push(`</${top.name}>`);
        else skip--;
      }
    } else if (input[i] === '<') {
      // نهاية الوسم: أوّل «>» خارج علامات الاقتباس.
      let j = i + 1;
      let quote = '';
      for (; j < input.length; j++) {
        const c = input[j]!;
        if (quote) {
          if (c === quote) quote = '';
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
      }
      const tag = parseTag(input.slice(i, j + 1));
      i = j + 1;
      if (!tag) continue;
      if (++count > MAX_ELEMENTS) throw new Error('الرسمة أكثر عناصر من أن تُقبل');
      const kept = skip === 0 && ELEMENTS.has(tag.name) && (root !== null || tag.name === 'svg');
      if (!root && kept) root = tag;
      if (!root && skip === 0 && !kept) throw new Error('ليس رسمةً متّجهة (SVG)');
      if (kept) {
        const attrs = tag.attrs.flatMap(([n, v]) => {
          const clean = cleanAttr(n, v);
          return clean === null ? [] : [` ${n}="${escapeAttr(clean)}"`];
        });
        if (tag === root) attrs.unshift(' xmlns="http://www.w3.org/2000/svg"');
        out.push(`<${tag.name}${attrs.join('')}${tag.selfClosing ? '/' : ''}>`);
      }
      if (!tag.selfClosing) {
        stack.push({ name: tag.name, kept });
        if (!kept) skip++;
      }
    } else {
      const end = input.indexOf('<', i);
      const text = input.slice(i, end < 0 ? input.length : end);
      i = end < 0 ? input.length : end;
      if (!skip && stack.length) out.push(inStyle() ? escapeText(cleanCss(text)) : escapeText(text));
    }
  }
  if (!root) throw new Error('ليس رسمةً متّجهة (SVG)');
  while (stack.length) {
    const top = stack.pop()!;
    if (top.kept) out.push(`</${top.name}>`);
  }

  const get = (n: string) => root!.attrs.find(([k]) => k === n)?.[1];
  const box = (get('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const num = (v?: string) => (v && /^\s*[\d.]+\s*(px)?\s*$/.test(v) ? parseFloat(v) : NaN);
  let width = box.length === 4 && box.every(Number.isFinite) ? box[2]! : num(get('width'));
  let height = box.length === 4 && box.every(Number.isFinite) ? box[3]! : num(get('height'));
  if (!(width > 0) || !(height > 0)) throw new Error('الرسمة بلا مقاس (viewBox أو العرض والارتفاع)');
  let svg = out.join('');
  // بلا viewBox لا تتمدّد الرسمة مع صندوقها — يُضاف من عرضها وارتفاعها.
  if (!get('viewBox')) svg = svg.replace(/^<svg /, `<svg viewBox="0 0 ${width} ${height}" `);
  if (svg.includes(' xlink:href="')) svg = svg.replace(/^<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
  width = Math.round(width * 100) / 100;
  height = Math.round(height * 100) / 100;
  return { svg, width, height };
}
