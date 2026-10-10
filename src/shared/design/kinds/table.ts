/**
 * الجدول: أعمدةٌ بعرضها ومحاذاتها، وصفوفٌ خلاياها نصٌّ أو حقلٌ أو وسومٌ تُملأ، وترويسةٌ ملوّنة وتقليمٌ إن طُلب.
 */
import { newUuid } from '../../doc';
import { escapeHtml } from '../../html';
import { ptToPx } from '../model/units';
import { isObj } from '../model/box';
import type { Box, ImsakiyaSettings, TableCell, TableColumn, TableElement, TableRowStyle } from '../model/types';
import { cssColor } from '../shapes';
import { boxStyle } from '../render/box';
import type { KindSpec } from './types';

/** جدولٌ جديد: تسلسلٌ وبيانٌ وملاحظات — والمكتب يسمّي أعمدته لما يريد. */
const defaultTableColumns = (): TableColumn[] => [
  { title: 'ت', widthPercent: 12, align: 'center' },
  { title: 'البيان', widthPercent: 58, align: 'right' },
  { title: 'ملاحظات', widthPercent: 30, align: 'center' }
];
const defaultTableRows = (): TableCell[][] => [
  [{ text: '١' }, { text: '' }, { text: '' }],
  [{ text: '٢' }, { text: '' }, { text: '' }],
  [{ text: '٣' }, { text: '' }, { text: '' }]
];

export function tableElement(patch: Partial<TableElement> & { box: Box }): TableElement {
  return {
    id: newUuid(),
    kind: 'table',
    z: 1,
    dir: 'rtl',
    columns: defaultTableColumns(),
    rows: defaultTableRows(),
    headerBg: '#f1f5f9',
    headerColor: '#0f172a',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    fontSize: 10,
    headerFontSize: 11,
    stripe: false,
    ...patch
  };
}

/** قيمة الخليّة: حقلُها أو نصُّها، ووسومه `{…}` بقيمها — وما لم يُملأ يبقى وسمًا. */
const cellValue = (cell: TableCell, values: Record<string, string>): string =>
  (cell.field ? (values[cell.field] ?? `{${cell.field}}`) : cell.text).replace(/\{([^{}]+)\}/g, (_m, k: string) => values[k.trim()] ?? `{${k.trim()}}`);

/** أنماط الصفوف مقوَّمة: ألوانٌ آمنة وعريضٌ، بطول الصفوف لا أكثر — وما لا شيء فيه عدم. */
function normalizeRowStyles(raw: unknown, rows: number): { rowStyles?: (TableRowStyle | null)[] } {
  if (!Array.isArray(raw)) return {};
  const out = raw.slice(0, rows).map((r): TableRowStyle | null => {
    if (!isObj(r)) return null;
    const style: TableRowStyle = {};
    if (typeof r.bg === 'string') style.bg = cssColor(r.bg, '#fff7d6');
    if (typeof r.color === 'string') style.color = cssColor(r.color, '#111111');
    if (r.bold === true) style.bold = true;
    return Object.keys(style).length ? style : null;
  });
  return out.some(Boolean) ? { rowStyles: out } : {};
}

/** إعداد الإمساكية (٣٫٤) مقوَّمًا: تاريخٌ صحيح وتقويمٌ معروف — وإلا فليس جدول إمساكية. */
function normalizeImsakiya(raw: unknown): { imsakiya?: ImsakiyaSettings } {
  if (!isObj(raw) || typeof raw.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.start)) return {};
  const calendar = raw.calendar === 'gregorian' || raw.calendar === 'hijri' ? raw.calendar : 'both';
  return { imsakiya: { start: raw.start, calendar, digits: raw.digits === 'latin' ? 'latin' : 'indic', fridays: raw.fridays !== false } };
}

export const TABLE_KIND: KindSpec<TableElement> = {
  kind: 'table',
  normalize(raw, b) {
    const rawCols = Array.isArray(raw.columns) ? raw.columns : [];
    const columns: TableColumn[] = rawCols.map((c, ci) => ({
      title: isObj(c) && typeof c.title === 'string' ? c.title : `عمود ${ci + 1}`,
      widthPercent: isObj(c) && typeof c.widthPercent === 'number' ? c.widthPercent : 100 / Math.max(1, rawCols.length),
      align: isObj(c) && (c.align === 'center' || c.align === 'left' || c.align === 'right') ? c.align : 'center'
    }));
    const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
    const rows: TableCell[][] = rawRows.map((r) =>
      Array.isArray(r)
        ? r.map((c) => ({
            text: isObj(c) && typeof c.text === 'string' ? c.text : typeof c === 'string' ? c : '',
            field: isObj(c) && typeof c.field === 'string' ? c.field : undefined,
            align: isObj(c) && (c.align === 'center' || c.align === 'left' || c.align === 'right') ? c.align : undefined,
            bold: isObj(c) && c.bold === true ? true : undefined
          }))
        : []
    );
    return {
      id: b.id,
      kind: 'table',
      name: b.name,
      box: b.box,
      z: b.z,
      locked: b.locked,
      rotate: b.rotate,
      dir: b.dir,
      columns: columns.length ? columns : defaultTableColumns(),
      rows: rows.length ? rows : defaultTableRows(),
      headerBg: typeof raw.headerBg === 'string' ? raw.headerBg : '#f1f5f9',
      headerColor: typeof raw.headerColor === 'string' ? raw.headerColor : '#0f172a',
      borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : '#cbd5e1',
      borderWidth: typeof raw.borderWidth === 'number' ? raw.borderWidth : 1,
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 10,
      headerFontSize: typeof raw.headerFontSize === 'number' ? raw.headerFontSize : 11,
      font: typeof raw.font === 'string' ? raw.font : undefined,
      stripe: raw.stripe === true,
      stripeBg: typeof raw.stripeBg === 'string' ? raw.stripeBg : '#f8fafc',
      ...(raw.borders === 'rows' || raw.borders === 'none' ? { borders: raw.borders } : {}),
      ...(raw.hideHeader === true ? { hideHeader: true } : {}),
      ...(raw.dense === true ? { dense: true } : {}),
      ...normalizeRowStyles(raw.rowStyles, rows.length || 3),
      ...normalizeImsakiya(raw.imsakiya)
    };
  },
  render(el, { canvas, values, opts }) {
    const borderPx = Math.max(1, Math.round((el.borderWidth ?? 1) * (opts.dpi / 96)));
    const borderColor = el.borderColor ?? '#cbd5e1';
    const borderStyle = `${borderPx}px solid ${borderColor}`;
    // الحدود (١٫٩): كلّها كما كانت، أو أسطرٌ أفقية، أو بلا حدود.
    const mode = el.borders ?? 'all';
    const cellBorder = mode === 'all' ? `border:${borderStyle}` : mode === 'rows' ? `border:none;border-bottom:${borderStyle}` : 'border:none';
    const headBorder = mode === 'all' ? `border:${borderStyle}` : mode === 'rows' ? `border:none;border-bottom:${borderPx * 2}px solid ${borderColor}` : 'border:none';
    const fontSizePx = ptToPx(el.fontSize ?? 10, opts.dpi);
    const headerFontSizePx = ptToPx(el.headerFontSize ?? 11, opts.dpi);
    const headerBg = el.headerBg ?? '#f1f5f9';
    const headerColor = el.headerColor ?? '#0f172a';
    const fontFam = el.font ? `font-family:${el.font};` : '';
    // المتقاربة (٣٫٤): حشوٌ أقلّ وسطرٌ أضيق — والعادية كما كانت حرفًا.
    const pad = el.dense ? 'padding:1px 4px;line-height:1.2' : 'padding:4px 6px';

    const ths = el.columns
      .map(
        (col) =>
          `<th style="${headBorder};background:${headerBg};color:${headerColor};${pad};text-align:${col.align ?? 'center'};width:${col.widthPercent}%;font-size:${headerFontSizePx.toFixed(1)}px;font-weight:700">${escapeHtml(col.title)}</th>`
      )
      .join('');

    const trs = el.rows
      .map((row, ri) => {
        const rs = el.rowStyles?.[ri] ?? null;
        const bg = rs?.bg ? `background:${rs.bg};` : el.stripe && ri % 2 === 1 ? `background:${el.stripeBg ?? '#f8fafc'};` : '';
        const ink = rs?.color ? `color:${rs.color};` : '';
        const tds = row
          .map((cell, ci) => {
            const col = el.columns[ci];
            const align = cell.align ?? col?.align ?? 'center';
            const weight = cell.bold || rs?.bold ? 'font-weight:700;' : '';
            return `<td style="${cellBorder};${pad};text-align:${align};font-size:${fontSizePx.toFixed(1)}px;${weight}">${escapeHtml(cellValue(cell, values))}</td>`;
          })
          .join('');
        return `<tr style="${bg}${ink}">${tds}</tr>`;
      })
      .join('');

    const style = [boxStyle(el, canvas, opts.dpi), 'display:block', 'overflow:hidden', fontFam].filter(Boolean).join(';');

    return (
      `<div dir="${el.dir ?? 'rtl'}" style="${style}">` +
      `<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">` +
      `${el.hideHeader ? '' : `<thead><tr>${ths}</tr></thead>`}` +
      `<tbody>${trs}</tbody>` +
      `</table></div>`
    );
  },
  keys(el) {
    const out: string[] = [];
    for (const row of el.rows) {
      for (const cell of row) {
        if (cell.field) out.push(cell.field);
        for (const m of cell.text.matchAll(/\{([^{}]+)\}/g)) if (m[1]?.trim()) out.push(m[1].trim());
      }
    }
    return out;
  },
  text(el, values) {
    const lines: string[] = [];
    for (const row of el.rows) {
      const rowStr = row.map((c) => cellValue(c, values)).join(' | ');
      if (rowStr.trim()) lines.push(rowStr);
    }
    return lines;
  }
};
