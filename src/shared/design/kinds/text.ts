/**
 * النصّ: صندوقٌ فيه عقد المتن نفسها (`run` و`field` و`break`) — يُرسم بحجمه بالنقاط، ويصغر ليسع إن طُلب.
 */
import { newUuid, type DocField, type Inline } from '../../doc';
import { escapeHtml } from '../../html';
import { GENDER_KEY, isChoiceKey, pickChoice, resolveChoices } from '../../gender';
import type { MissingMode } from '../../docHtml';
import { mmToPx, ptToPx } from '../model/units';
import { isObj } from '../model/box';
import type { Box, TextElement } from '../model/types';
import { boxStyle } from '../render/box';
import { cssGradient, normalizeGradient } from '../paint';
import type { KindSpec, RenderCtx } from './types';

export function textElement(patch: Partial<TextElement> & { box: Box }): TextElement {
  return {
    id: newUuid(),
    kind: 'text',
    inlines: [],
    align: 'center',
    vAlign: 'middle',
    size: 14,
    color: '#111111',
    z: 1,
    dir: 'rtl',
    ...patch
  };
}

/** فراغٌ بطول ما كُتب — لا ينكمش فتتشوّه اللوحة. */
function blank(field: DocField | undefined): string {
  return `<span style="display:inline-block;min-width:${field?.width ?? 10}ch;border-bottom:1px dotted currentColor">&nbsp;</span>`;
}

function inlinesHtml(inlines: Inline[], values: Record<string, string>, fields: Map<string, DocField>, missing: MissingMode): string {
  return inlines
    .map((node) => {
      if (node.kind === 'break') return '<br/>';
      if (node.kind === 'run') {
        let out = escapeHtml(resolveChoices(node.text, values[GENDER_KEY]));
        const m = node.marks;
        if (m?.underline) out = `<u>${out}</u>`;
        if (m?.italic) out = `<em>${out}</em>`;
        if (m?.bold) out = `<strong>${out}</strong>`;
        return out;
      }
      if (isChoiceKey(node.ref)) return escapeHtml(pickChoice(node.ref, values[GENDER_KEY]));
      const value = values[node.ref];
      // قيمةٌ لاتينية (رقمٌ بشَرطة، بريد) تُعزل باتجاهها: «2026-0457» داخل سطرٍ
      // عربي كانت تُعرض «0457-2026». والعربية تبقى في مجرى السطر كما هي.
      // `fv`: القيمة المملوءة — وحدها تُطبع في «القيم وحدها» على ورقة الدائرة المطبوعة (المرحلة ٤).
      if (value) return /[؀-ۿ]/.test(value) || !/[A-Za-z0-9]/.test(value) ? `<span class="fv">${escapeHtml(value)}</span>` : `<bdi class="fv" dir="ltr">${escapeHtml(value)}</bdi>`;
      if (missing === 'hide') return '';
      if (missing === 'blank') return blank(fields.get(node.ref));
      return `{${escapeHtml(node.ref)}}`;
    })
    .join('');
}

const V_ALIGN: Record<TextElement['vAlign'], string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

/**
 * عرض النصّ تقديرًا بوحدة em — قبل أن يقيسه المتصفّح.
 *
 * الحرف العربي في خطوطنا بين ٠٫٤ و٠٫٦ em، والمسافة ربعها. والتقدير متحفّظٌ عمدًا:
 * يبدأ بالخطّ أصغر قليلًا فلا يُقصّ شيء حتى قبل القياس، ثم يكبّره القياس
 * (`canvasFit.ts`) إلى أقصى ما يسع — في المعاينة وفي نافذة الطباعة معًا.
 */
export function estimateEm(text: string, bold = false): number {
  let em = 0;
  for (const ch of text) {
    if (ch === ' ') em += 0.28;
    else if (/[ً-ٰٟ]/.test(ch)) continue; // التشكيل لا يأخذ عرضًا
    else if (/[0-9٠-٩]/.test(ch)) em += 0.56;
    else em += 0.52;
  }
  return em * (bold ? 1.08 : 1);
}

/** نصّ العنصر كما سيُرسم: القيم محلّ حقولها — ليُقدَّر عرضه. */
function plainText(inlines: Inline[], values: Record<string, string>, fields: Map<string, DocField>): string {
  return inlines
    .map((n) =>
      n.kind === 'run'
        ? resolveChoices(n.text, values[GENDER_KEY])
        : n.kind === 'field' && isChoiceKey(n.ref)
          ? pickChoice(n.ref, values[GENDER_KEY])
          : n.kind === 'break'
            ? ' '
            : values[n.ref] || '—'.repeat(Math.ceil((fields.get(n.ref)?.width ?? 10) / 3))
    )
    .join('');
}

function render(el: TextElement, { canvas, values, fields, opts }: RenderCtx): string {
  const inner = inlinesHtml(el.inlines, values, fields, opts.missing);
  // الحجم بالنقاط يصير بكسلات عند الدقّة المطلوبة — فالطباعة لا تتصاغر.
  const max = ptToPx(el.size, opts.dpi);
  let size = max;
  if (el.fit === 'shrink') {
    const width = el.box.w * mmToPx(canvas.size.w, opts.dpi);
    const text = plainText(el.inlines, values, fields);
    const em = estimateEm(text, el.bold) + (el.letterSpacing ?? 0) * [...text].length;
    if (em > 0) size = Math.min(max, (width * 0.96) / em);
  }
  // `flex-start` في صندوقٍ عربيّ هو اليمين: فالمحاذاة تُقلب مع الاتجاه، وإلا
  // وقع الاسم المحاذى يمينًا على اليسار حين يصغر ليسع.
  const rtl = (el.dir ?? 'rtl') === 'rtl';
  const justify = el.align === 'center' ? 'center' : el.align === 'justify' ? 'stretch' : (el.align === 'right') === rtl ? 'flex-start' : 'flex-end';
  const style = [
    boxStyle(el, canvas, opts.dpi),
    'display:flex',
    `align-items:${V_ALIGN[el.vAlign]}`,
    `justify-content:${justify}`,
    `text-align:${el.align}`,
    `font-size:${size.toFixed(2)}px`,
    `line-height:${el.lineHeight ?? 1.4}`,
    `color:${el.color}`,
    el.font ? `font-family:${el.font}` : '',
    el.bold ? 'font-weight:700' : '',
    el.italic ? 'font-style:italic' : '',
    el.wordSpacing ? `word-spacing:${el.wordSpacing}em` : '',
    el.letterSpacing ? `letter-spacing:${el.letterSpacing}em` : '',
    'overflow:hidden'
  ]
    .filter(Boolean)
    .join(';');
  // النصّ المتدرّج (DESIGNS.md ١٫٣): التدرّج خلفيةُ الأسطر مقصوصةً بحروفها — متّجهٌ في PDF.
  const paint = el.gradient ? `;background:${cssGradient(el.gradient)};-webkit-background-clip:text;background-clip:text;color:transparent` : '';
  if (el.fit === 'shrink') {
    // سطرٌ واحد يُقاس: `data-fit` أقصى حجمٍ مسموح، والقياس يختار ما يسع تحته.
    return `<div dir="${el.dir ?? 'rtl'}" data-fit="${max.toFixed(2)}" style="${style}"><span style="white-space:nowrap${paint}">${inner}</span></div>`;
  }
  return `<div dir="${el.dir ?? 'rtl'}" style="${style}"><span style="width:100%${paint}">${inner}</span></div>`;
}

export const TEXT_KIND: KindSpec<TextElement> = {
  kind: 'text',
  normalize(raw, b) {
    const rawInlines = Array.isArray(raw.inlines) ? raw.inlines : typeof raw.text === 'string' ? [{ kind: 'run', text: raw.text }] : [];
    const inlines = rawInlines.map((i) => (isObj(i) && typeof i.kind === 'string' ? (i as unknown as Inline) : { kind: 'run' as const, text: String(i ?? '') }));
    return {
      id: b.id,
      kind: 'text',
      name: b.name,
      box: b.box,
      z: b.z,
      locked: b.locked,
      rotate: b.rotate,
      dir: b.dir,
      inlines,
      align: raw.align === 'left' ? 'left' : raw.align === 'right' ? 'right' : 'center',
      vAlign: raw.vAlign === 'top' ? 'top' : raw.vAlign === 'bottom' ? 'bottom' : 'middle',
      size: typeof raw.size === 'number' && raw.size > 0 ? raw.size : 14,
      color: typeof raw.color === 'string' && raw.color ? raw.color : '#111111',
      font: typeof raw.font === 'string' ? raw.font : undefined,
      bold: raw.bold === true,
      italic: raw.italic === true,
      lineHeight: typeof raw.lineHeight === 'number' ? raw.lineHeight : undefined,
      fit: raw.fit === 'shrink' ? 'shrink' : undefined,
      wordSpacing: typeof raw.wordSpacing === 'number' ? raw.wordSpacing : undefined,
      letterSpacing: typeof raw.letterSpacing === 'number' ? raw.letterSpacing : undefined,
      ...(normalizeGradient(raw.gradient) ? { gradient: normalizeGradient(raw.gradient) } : {})
    };
  },
  render,
  keys: (el) => el.inlines.flatMap((node) => (node.kind === 'field' ? [node.ref] : [])),
  text(el, values) {
    const line = el.inlines.map((n) => (n.kind === 'run' ? n.text : n.kind === 'break' ? ' ' : (values[n.ref] ?? `{${n.ref}}`))).join('');
    return line.trim() ? [line] : [];
  }
};
