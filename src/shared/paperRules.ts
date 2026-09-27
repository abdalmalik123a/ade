/**
 * صورة الورقة قبل قراءتها (هـ٨) — دوالّ خالصة على البكسلات، تُختبر بلا متصفّح.
 *
 * القارئ المحلي يقرأ الأسطر جيّدًا ويضلّ في ثلاثة: **الجدول** — خطوطه تقطع الأسطر
 * فلا يُقرأ منه شيء؛ و**الخطّ الفاصل** تحت الترويسة؛ و**الختم والتوقيع** — يقرؤهما
 * حروفًا لا معنى لها. فقبل القراءة:
 *
 * - تُكشف **الخطوط الطويلة**: ما تقاطع منها أفقيًّا وعموديًّا جدولٌ بخاناته، والأفقيّ
 *   المنفرد خطٌّ فاصل. ثم تُمحى، فتُقرأ الخانات أسطرًا وتُوزَّع كلماتها بمواضعها.
 * - يُمحى **الحبر الملوّن غير السطريّ**: الختم والتوقيع الأزرق لا يُنقلان (والكتاب
 *   يُوقَّع ويُختم من جديد)، والعنوان الملوّن في الترويسة سطرٌ عريض فيبقى. والحبر
 *   الأسود تحت الختم يبقى: يُمحى الملوّن وحده.
 */
import { detectQuad, flattenLight, warpPerspective, type PixelData } from './deskew';
import { isColoredInk, straighten } from './scanClean';

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** جدولٌ من خطوطه: مواضع الأفقيّة من الأعلى، والعموديّة من اليسار — بالبكسل. */
export type TableGrid = { box: Box; rows: number[]; cols: number[] };

export type Rules = {
  tables: TableGrid[];
  /** خطوطٌ أفقية منفردة (ليست من جدول) — أوّلها تحت الترويسة غالبًا. */
  dividers: Box[];
  /** كلّ ما يُمحى قبل القراءة: خطوط الجداول والفواصل. */
  erase: Box[];
};

const DARK = 150;

function darkMask(px: PixelData): Uint8Array {
  const { width: w, height: h, data: d } = px;
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    // الملوّن ليس خطًّا: حافة الختم المستديرة لا تُحسب عمودًا.
    if (isColoredInk(r, g, b)) continue;
    if (0.299 * r + 0.587 * g + 0.114 * b < DARK) out[p] = 1;
  }
  return out;
}

type Run = { at: number; from: number; to: number };

/**
 * أشرطةٌ طويلة متّصلة في صفٍّ (أو عمود)، تتسامح مع ثقوبٍ صغيرة — والصفّ يُقرأ مع
 * جاريه، فخطٌّ مال بكسلًا بعد التقويم لا ينقطع.
 */
function runs(mask: Uint8Array, w: number, h: number, vertical: boolean, minLen: number, gap: number): Run[] {
  const lines = vertical ? w : h;
  const len = vertical ? h : w;
  const at = (line: number, k: number) => {
    let hit = 0;
    for (let o = -1; o <= 1 && !hit; o++) {
      const l = line + o;
      if (l < 0 || l >= lines) continue;
      hit = vertical ? mask[k * w + l]! : mask[l * w + k]!;
    }
    return hit;
  };
  const out: Run[] = [];
  for (let line = 0; line < lines; line++) {
    let start = -1;
    let last = -1;
    for (let k = 0; k <= len; k++) {
      const on = k < len && at(line, k);
      if (on) {
        if (start < 0) start = k;
        last = k;
      } else if (start >= 0 && k - last > gap) {
        if (last - start + 1 >= minLen) out.push({ at: line, from: start, to: last });
        start = -1;
      }
    }
  }
  return out;
}

/** أشرطة الصفوف المتجاورة خطٌّ واحدٌ بسُمكه. */
function group(list: Run[], horizontal: boolean): Box[] {
  const sorted = [...list].sort((a, b) => a.at - b.at || a.from - b.from);
  const lines: { box: Box; last: number }[] = [];
  for (const r of sorted) {
    const hit = lines.find((l) => {
      const [a0, a1] = horizontal ? [l.box.x0, l.box.x1] : [l.box.y0, l.box.y1];
      return r.at - l.last <= 2 && r.from <= a1 && r.to >= a0;
    });
    if (hit) {
      hit.last = r.at;
      if (horizontal) {
        hit.box = { x0: Math.min(hit.box.x0, r.from), x1: Math.max(hit.box.x1, r.to), y0: hit.box.y0, y1: r.at };
      } else {
        hit.box = { y0: Math.min(hit.box.y0, r.from), y1: Math.max(hit.box.y1, r.to), x0: hit.box.x0, x1: r.at };
      }
    } else {
      lines.push({
        last: r.at,
        box: horizontal ? { x0: r.from, x1: r.to, y0: r.at, y1: r.at } : { y0: r.from, y1: r.to, x0: r.at, x1: r.at }
      });
    }
  }
  return lines.map((l) => l.box);
}

/** مواضعُ متقاربة موضعٌ واحد — خطّا الخانة الواحدة من الجانبين لا يصيران عمودين. */
function distinct(values: number[], tol: number): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length && v - out[out.length - 1]! <= tol) continue;
    out.push(v);
  }
  return out;
}

/**
 * الخطوط الطويلة في الورقة: الجداول بخاناتها، والفواصل الأفقية.
 *
 * الأفقيّ أطول من ١٥٪ من العرض، والعموديّ أطول من ٣٪ من الارتفاع — ولا يُعدّ
 * العموديّ خطَّ جدولٍ ما لم يقطع أفقيَّين: حرف الألف في عنوانٍ كبير ليس عمودًا.
 */
export function findRules(px: PixelData): Rules {
  const { width: w, height: h } = px;
  const mask = darkMask(px);
  const gap = Math.max(2, Math.round(w / 700));
  const hs = group(runs(mask, w, h, false, Math.round(w * 0.15), gap), true);
  const vs = group(runs(mask, w, h, true, Math.round(h * 0.03), gap), false);
  const tol = Math.max(4, Math.round(w / 250));

  const cross = (hz: Box, v: Box) =>
    v.x0 >= hz.x0 - tol && v.x1 <= hz.x1 + tol && hz.y0 >= v.y0 - tol && hz.y1 <= v.y1 + tol;

  // الأفقيّة والعموديّة المتقاطعة شبكةٌ واحدة — مكوّناتٌ متّصلة.
  const parent = [...hs, ...vs].map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  hs.forEach((hz, i) =>
    vs.forEach((v, j) => {
      if (cross(hz, v)) parent[find(i)] = find(hs.length + j);
    })
  );
  const comps = new Map<number, { hs: Box[]; vs: Box[] }>();
  hs.forEach((hz, i) => {
    const c = comps.get(find(i)) ?? { hs: [], vs: [] };
    c.hs.push(hz);
    comps.set(find(i), c);
  });
  vs.forEach((v, j) => {
    const c = comps.get(find(hs.length + j)) ?? { hs: [], vs: [] };
    c.vs.push(v);
    comps.set(find(hs.length + j), c);
  });

  const tables: TableGrid[] = [];
  const inTable = new Set<Box>();
  const erase: Box[] = [];
  for (const c of comps.values()) {
    if (c.hs.length < 2 || c.vs.length < 2) continue;
    const rows = distinct(
      c.hs.map((b) => Math.round((b.y0 + b.y1) / 2)),
      tol
    );
    const cols = distinct(
      c.vs.map((b) => Math.round((b.x0 + b.x1) / 2)),
      tol
    );
    // إطارٌ حول فقرةٍ (خانةٌ واحدة) ليس جدولًا — يُمحى ولا يُبنى.
    const all = [...c.hs, ...c.vs];
    erase.push(...all);
    if ((rows.length - 1) * (cols.length - 1) < 2) continue;
    for (const b of all) inTable.add(b);
    tables.push({
      box: {
        x0: Math.min(...all.map((b) => b.x0)),
        y0: Math.min(...all.map((b) => b.y0)),
        x1: Math.max(...all.map((b) => b.x1)),
        y1: Math.max(...all.map((b) => b.y1))
      },
      rows,
      cols
    });
  }
  const dividers = hs.filter((b) => !inTable.has(b) && !erase.includes(b));
  erase.push(...dividers);
  tables.sort((a, b) => a.box.y0 - b.box.y0);
  dividers.sort((a, b) => a.y0 - b.y0);
  return { tables, dividers, erase };
}

/** نسخةٌ من الصورة بلا الخطوط المكشوفة — بهامش بكسلين حولها. */
export function eraseBoxes(px: PixelData, boxes: Box[], pad = 2): PixelData {
  const { width: w, height: h } = px;
  const data = new Uint8ClampedArray(px.data);
  for (const b of boxes) {
    const x0 = Math.max(0, b.x0 - pad);
    const x1 = Math.min(w - 1, b.x1 + pad);
    const y0 = Math.max(0, b.y0 - pad);
    const y1 = Math.min(h - 1, b.y1 + pad);
    for (let y = y0; y <= y1; y++) data.fill(255, (y * w + x0) * 4, (y * w + x1 + 1) * 4);
  }
  return { width: w, height: h, data };
}

/**
 * يمحو الحبر الملوّن الذي ليس سطرًا: الختم والتوقيع والشعار.
 *
 * يُجمع الملوّن في كتلٍ متّصلة (على شبكةٍ مصغّرة، بعد توسيعٍ يصل حروف الكلمة)،
 * فالكتلة العريضة القصيرة سطرُ نصٍّ ملوّن فتبقى، وما سواها يُمحى **ملوّنُه وحده** —
 * فالكتابة السوداء التي عبرها الختم تبقى تُقرأ.
 */
export function dropColoredMarks(px: PixelData): { px: PixelData; removed: Box[] } {
  const { width: w, height: h, data: d } = px;
  const cell = Math.max(2, Math.round(w / 500));
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isColoredInk(d[i]!, d[i + 1]!, d[i + 2]!)) grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = 1;
    }
  }
  // توسيعٌ أفقيٌّ أعرض من العموديّ: كلمات السطر الملوّن تتّصل كتلةً عريضة واحدة
  // (الفراغ بين الكلمات أقلّ من ١٪ من العرض)، وحروف الختم المتفرّقة كتلةٌ مستديرة.
  const grown = new Uint8Array(gw * gh);
  const RX = Math.max(2, Math.round((w * 0.012) / cell));
  const RY = 1;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (!grid[gy * gw + gx]) continue;
      for (let dy = -RY; dy <= RY; dy++) {
        for (let dx = -RX; dx <= RX; dx++) {
          const yy = gy + dy;
          const xx = gx + dx;
          if (yy >= 0 && xx >= 0 && yy < gh && xx < gw) grown[yy * gw + xx] = 1;
        }
      }
    }
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const drop: Box[] = [];
  const lines: { box: Box; cells: number[] }[] = [];
  const dropCells: number[][] = [];
  const stack: number[] = [];
  let n = 0;
  for (let s = 0; s < gw * gh; s++) {
    if (!grown[s] || label[s]! >= 0) continue;
    const cells: number[] = [];
    label[s] = n;
    stack.push(s);
    let [x0, y0, x1, y1] = [gw, gh, 0, 0];
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const cx = c % gw;
      const cy = (c - cx) / gw;
      x0 = Math.min(x0, cx);
      x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy);
      y1 = Math.max(y1, cy);
      for (const nb of [c - 1, c + 1, c - gw, c + gw]) {
        if (nb < 0 || nb >= gw * gh) continue;
        if ((nb === c - 1 && cx === 0) || (nb === c + 1 && cx === gw - 1)) continue;
        if (grown[nb] && label[nb]! < 0) {
          label[nb] = n;
          stack.push(nb);
        }
      }
    }
    n++;
    const bw = (x1 - x0 + 1) * cell;
    const bh = (y1 - y0 + 1) * cell;
    const box = { x0: x0 * cell, y0: y0 * cell, x1: Math.min(w - 1, (x1 + 1) * cell - 1), y1: Math.min(h - 1, (y1 + 1) * cell - 1) };
    // ذرّةٌ ملوّنة لا تضرّ القراءة، والسطر الملوّن (عريضٌ قصير) نصٌّ يُقرأ — ما لم يكن
    // داخل ختمٍ مستدير: «ختم المدرسة» في وسط الحلقة سطرٌ أزرق، وهو من الختم.
    if (bw < w * 0.02 && bh < w * 0.02) continue;
    if (bw / bh >= 3.2 && bh <= h * 0.06) {
      lines.push({ box, cells });
      continue;
    }
    drop.push(box);
    dropCells.push(cells);
  }
  const within = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;
  for (const l of lines) {
    if (drop.some((d) => within(l.box, d))) dropCells.push(l.cells);
  }
  if (!drop.length) return { px, removed: [] };

  const data = new Uint8ClampedArray(d);
  for (const cells of dropCells) {
    for (const c of cells) {
      const cx = c % gw;
      const cy = (c - cx) / gw;
      for (let y = cy * cell; y < Math.min(h, (cy + 1) * cell); y++) {
        for (let x = cx * cell; x < Math.min(w, (cx + 1) * cell); x++) {
          const i = (y * w + x) * 4;
          if (isColoredInk(data[i]!, data[i + 1]!, data[i + 2]!)) data[i] = data[i + 1] = data[i + 2] = 255;
        }
      }
    }
  }
  return { px: { width: w, height: h, data }, removed: drop };
}

export type PreparedPaper = {
  /** الورقة مقوَّمةً كما هي — تُعرض للمراجعة بختمها. */
  view: PixelData;
  /** ما يُقرأ: بلا ختمٍ ملوّن ولا خطوط. */
  clean: PixelData;
  rules: Rules;
  marks: Box[];
  /** زاوية التقويم بالدرجات. */
  angle: number;
  /** سُوّيت من أركانها (صورة هاتف)؟ */
  warped: boolean;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * الورقة قبل قراءتها، بالترتيب: صورة الهاتف تُسوّى من أركانها إلى A4، ثم تُقوَّم من
 * أسطرها، ثم يُمحى الختم الملوّن (على ألوانها الأصلية — قبل تسوية الإضاءة)، ثم تُسوّى
 * إضاءة الصورة، ثم تُكشف الخطوط وتُمحى.
 */
export function preparePaper(src: PixelData, opts: { photo: boolean }): PreparedPaper {
  let px = src;
  let warped = false;
  if (opts.photo) {
    const quad = detectQuad(px);
    if (quad) {
      const qw = Math.max(dist(quad.tl, quad.tr), dist(quad.bl, quad.br));
      const qh = Math.max(dist(quad.tl, quad.bl), dist(quad.tr, quad.br));
      const share = (qw * qh) / (px.width * px.height);
      // الورقة بملء الإطار لا أركان لها تُسوّى؛ وما صغُر جدًّا ليس الورقة.
      if (share > 0.3 && share < 0.95) {
        const tw = Math.min(2480, Math.round(qw));
        px = warpPerspective(px, quad, tw, Math.round((tw * 297) / 210));
        warped = true;
      }
    }
  }
  const s = straighten(px);
  const view = s.px;
  const d = dropColoredMarks(view);
  const work = opts.photo ? flattenLight(d.px, { gray: true }) : d.px;
  const rules = findRules(work);
  return { view, clean: eraseBoxes(work, rules.erase), rules, marks: d.removed, angle: s.angle, warped };
}
