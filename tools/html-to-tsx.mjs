/**
 * محوِّل التصميم: stitch_/<screen>/code.html  →  TSX
 *
 * الغرض: نقل العلامات كما هي حرفًا بحرف، دون أن تمسّها يدي.
 * كل صنف Tailwind وكل مسافة وكل أيقونة تبقى كما خرجت من التصميم.
 * ما يتغيّر هو ما يفرضه JSX فقط (class→className، الأقواس المعقوفة، الخصائص المنطقية).
 *
 * الاستعمال:  node tools/html-to-tsx.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseFragment } from 'parse5';

const SCREENS = [
  { dir: 'a4', component: 'EditorRaw' },
  { dir: '_1', component: 'ArchiveRaw' },
  { dir: '_2', component: 'CitizensRaw' },
  { dir: '_3', component: 'TemplatesRaw' }
];

/** خصائص HTML التي يسمّيها JSX تسمية أخرى. */
const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  srcset: 'srcSet',
  novalidate: 'noValidate',
  enctype: 'encType',
  datetime: 'dateTime',
  crossorigin: 'crossOrigin',
  'accept-charset': 'acceptCharset',
  usemap: 'useMap',
  frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen'
};

/** خصائص منطقية: وجودها يكفي، وقيمتها في HTML سلسلة فارغة. */
const BOOLEAN_ATTRS = new Set([
  'disabled', 'readonly', 'required', 'checked', 'selected',
  'multiple', 'autofocus', 'novalidate', 'open', 'hidden', 'default'
]);

/** خصائص يريدها JSX عددًا لا سلسلة. */
const NUMERIC_ATTRS = new Set([
  'rows', 'cols', 'size', 'span', 'start', 'width', 'height',
  'maxlength', 'minlength', 'tabindex', 'colspan', 'rowspan', 'step'
]);

/** عناصر بلا محتوى. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function camel(prop) {
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** style="a:b;c:d" → {{ a: 'b', c: 'd' }} */
function styleToObject(value) {
  const entries = value
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      if (i === -1) return null;
      const key = d.slice(0, i).trim();
      const val = d.slice(i + 1).trim();
      const name = key.startsWith('--') ? `'${key}'` : camel(key);
      return `${name}: ${JSON.stringify(val)}`;
    })
    .filter(Boolean);
  return `{{ ${entries.join(', ')} }}`;
}

/** النص الحرّ في JSX: الأقواس المعقوفة والأصفاد المائلة تكسر الصيغة. */
function escapeText(text) {
  if (!/[{}<>]/.test(text)) return text;
  return text.replace(/[{}<>]/g, (ch) => `{'${ch}'}`);
}

function renderAttrs(node, indent) {
  const out = [];
  let selectDefault = null;

  for (const attr of node.attrs ?? []) {
    const raw = attr.name;
    const value = attr.value;

    // معالِجات مضمّنة (onclick="…") سلوكٌ لا علامات — تُجمع كمواصفة وتُحذف.
    if (/^on[a-z]+$/.test(raw)) {
      collectedHandlers.push(`<${node.nodeName} ${raw}> ${value}`);
      continue;
    }

    // صور تجريبية مستضافة خارجيًا: تخالف «محلي» و«يبدأ فارغًا» معًا.
    // تُحذف ويوسم مكانها ليملأه المكتب من الماسح الضوئي أو من ملف المواطن.
    if ((raw === 'src' || raw === 'srcset') && /^https?:/i.test(value)) {
      droppedImages.push(`<${node.nodeName}> ${value.slice(0, 60)}…`);
      if (raw === 'src') out.push('data-placeholder="image"');
      continue;
    }

    // <option selected> لا يقبلها React — تُرفع إلى defaultValue على <select>
    if (raw === 'selected' && node.nodeName === 'option') continue;

    if (raw === 'style') {
      out.push(`style=${styleToObject(value)}`);
      continue;
    }

    // value/checked على حقول الإدخال: React يريدها غير مُتحكَّم بها عند النقل الأولي
    if (raw === 'value' && (node.nodeName === 'input' || node.nodeName === 'textarea')) {
      out.push(`defaultValue=${JSON.stringify(value)}`);
      continue;
    }
    if (raw === 'checked') {
      out.push('defaultChecked');
      continue;
    }

    const name = ATTR_MAP[raw] ?? (raw.startsWith('data-') || raw.startsWith('aria-') ? raw : raw);

    if (BOOLEAN_ATTRS.has(raw) && value === '') {
      out.push(name);
      continue;
    }
    if (NUMERIC_ATTRS.has(raw) && /^-?\d+(\.\d+)?$/.test(value)) {
      out.push(`${name}={${value}}`);
      continue;
    }
    out.push(`${name}=${JSON.stringify(value)}`);
  }

  // <textarea>نص</textarea> لا يقبله React — المحتوى يصير defaultValue.
  if (node.nodeName === 'textarea') {
    const text = (node.childNodes ?? [])
      .filter((c) => c.nodeName === '#text')
      .map((c) => c.value)
      .join('')
      .trim();
    if (text) out.push(`defaultValue=${JSON.stringify(text)}`);
  }

  // التقاط الخيار المحدَّد داخل <select>
  if (node.nodeName === 'select') {
    const selected = (node.childNodes ?? []).find(
      (c) => c.nodeName === 'option' && (c.attrs ?? []).some((a) => a.name === 'selected')
    );
    if (selected) {
      const text = (selected.childNodes ?? [])
        .filter((c) => c.nodeName === '#text')
        .map((c) => c.value)
        .join('')
        .trim();
      selectDefault = text;
      out.push(`defaultValue=${JSON.stringify(text)}`);
    }
  }

  if (out.length === 0) return '';
  if (out.length <= 2 && out.join(' ').length < 90) return ' ' + out.join(' ');
  return '\n' + out.map((a) => indent + '  ' + a).join('\n') + '\n' + indent;
}

/** سكربتات التصميم تُجمع على حدة: هي مواصفة سلوك، لا علامات تُعرض. */
const collectedScripts = [];
const collectedHandlers = [];
const droppedImages = [];

function serialize(node, depth) {
  const indent = '  '.repeat(depth);

  if (node.nodeName === 'script') {
    const code = (node.childNodes ?? [])
      .filter((c) => c.nodeName === '#text')
      .map((c) => c.value)
      .join('');
    if (code.trim()) collectedScripts.push(code.trim());
    return '';
  }

  if (node.nodeName === '#text') {
    const text = node.value;
    if (!text.trim()) return '';
    return indent + escapeText(text.trim()) + '\n';
  }

  if (node.nodeName === '#comment') {
    return indent + `{/* ${node.data.trim().replace(/\*\//g, '*\\/')} */}\n`;
  }

  const tag = node.nodeName;
  const attrs = renderAttrs(node, indent);
  const children = (node.childNodes ?? []).filter(
    (c) => !(c.nodeName === '#text' && !c.value.trim())
  );

  if (VOID_ELEMENTS.has(tag) || tag === 'textarea' || children.length === 0) {
    return `${indent}<${tag}${attrs}${attrs.endsWith(indent) ? '' : ' '}/>\n`;
  }

  // نص مفرد قصير: أبقِه في السطر ذاته كما في الأصل
  if (children.length === 1 && children[0].nodeName === '#text') {
    const text = escapeText(children[0].value.trim());
    if (text.length < 70 && !attrs.includes('\n')) {
      return `${indent}<${tag}${attrs}>${text}</${tag}>\n`;
    }
  }

  let out = `${indent}<${tag}${attrs}>\n`;
  for (const child of children) out += serialize(child, depth + 1);
  out += `${indent}</${tag}>\n`;
  return out;
}

function extractMain(html) {
  const start = html.indexOf('<main');
  const end = html.lastIndexOf('</main>') + '</main>'.length;
  if (start === -1 || end < start) throw new Error('لم يُعثر على <main>');
  return html.slice(start, end);
}

mkdirSync('src/renderer/src/screens/raw', { recursive: true });

for (const { dir, component } of SCREENS) {
  const html = readFileSync(`stitch_/${dir}/code.html`, 'utf8');
  const fragment = parseFragment(extractMain(html));
  const main = fragment.childNodes.find((n) => n.nodeName === 'main');
  if (!main) throw new Error(`لم يُعثر على <main> في ${dir}`);

  collectedScripts.length = 0;
  collectedHandlers.length = 0;
  droppedImages.length = 0;
  const body = serialize(main, 2).replace(/\n$/, '');
  if (collectedScripts.length || collectedHandlers.length) {
    mkdirSync('docs/design-behavior', { recursive: true });
    writeFileSync(
      `docs/design-behavior/${dir.replace(/^_/, 'screen_')}.js`,
      `// سلوك مستخرج من stitch_/${dir}/code.html — مواصفة مرجعية، لا يُنفَّذ.\n\n` +
        collectedScripts.join('\n\n// ───────────────\n\n') +
        (collectedHandlers.length
          ? '\n\n// ── معالِجات مضمّنة في العلامات ──\n' +
            collectedHandlers.map((h) => '// ' + h).join('\n')
          : '') +
        '\n'
    );
    console.log(`  ↳ سلوك مرجعي: docs/design-behavior/${dir.replace(/^_/, 'screen_')}.js`);
  }
  const file = `/* مُولَّد آليًا من stitch_/${dir}/code.html — لا تُحرّره يدويًا.
   أعِد التوليد بـ: node tools/html-to-tsx.mjs */
/* eslint-disable */

export default function ${component}() {
  return (
${body}
  );
}
`;
  writeFileSync(`src/renderer/src/screens/raw/${component}.tsx`, file);
  console.log(`${component}.tsx  ←  stitch_/${dir}/code.html  (${file.length} حرفًا)`);
}
