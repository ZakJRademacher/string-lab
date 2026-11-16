// charts.js: small, dependency-free 2D charts for the Graphs tab.
// Each chart is a <figure> with a caption and a <canvas>; the views redraw them as the
// simulation runs. Colours come from the page's CSS variables, so they match both themes.

export function chartBox(title, { wide = false } = {}) {
  const el = document.createElement('figure');
  el.className = wide ? 'chart-box wide' : 'chart-box';
  const cap = document.createElement('figcaption');
  cap.textContent = title;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', title);
  el.append(cap, canvas);
  return { el, canvas, setTitle(t) { cap.textContent = t; canvas.setAttribute('aria-label', t); } };
}

/** A small block of typeset maths (uses KaTeX if the page loaded it). */
export function texBlock(title, tex, note) {
  const el = document.createElement('figure');
  el.className = 'chart-box';
  const cap = document.createElement('figcaption');
  cap.textContent = title;
  const body = document.createElement('div');
  body.className = 'formula';
  if (globalThis.katex) globalThis.katex.render(tex, body, { displayMode: true, throwOnError: false });
  else body.textContent = tex;
  el.append(cap, body);
  if (note) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = note;
    el.append(p);
  }
  return { el };
}

export function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return { text: v('--text'), muted: v('--muted'), line: v('--line'), accent: v('--chart-1'), accent2: v('--chart-2'), accent3: v('--chart-3'), ok: v('--ok') };
}

function prepare(canvas, height) {
  const dpr = globalThis.devicePixelRatio || 1;
  const W = canvas.clientWidth || 320;
  const H = height;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '11px Inter, system-ui, sans-serif';
  return { ctx, W, H };
}

/**
 * Line chart. series: [{ points: [[x, y], …], color, width, dash, alpha }].
 * opts: { xmin, xmax, ymin, ymax, height, yTicks, xLabel, yLabel, guides: [{ y, label }] }
 */
export function linePlot(canvas, series, opts) {
  const c = palette();
  const { ctx, W, H } = prepare(canvas, opts.height ?? 160);
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const X = (x) => pad.l + ((x - opts.xmin) / (opts.xmax - opts.xmin)) * (W - pad.l - pad.r);
  const Y = (y) => pad.t + (1 - (Math.max(opts.ymin, Math.min(opts.ymax, y)) - opts.ymin) / (opts.ymax - opts.ymin)) * (H - pad.t - pad.b);

  ctx.strokeStyle = c.line;
  ctx.fillStyle = c.muted;
  ctx.lineWidth = 1;
  for (const y of opts.yTicks ?? [opts.ymin, (opts.ymin + opts.ymax) / 2, opts.ymax]) {
    ctx.beginPath(); ctx.moveTo(pad.l, Y(y)); ctx.lineTo(W - pad.r, Y(y)); ctx.stroke();
    ctx.fillText(String(+y.toFixed(2)), 4, Y(y) + 4);
  }
  for (const g of opts.guides ?? []) {
    ctx.setLineDash([4, 4]); ctx.strokeStyle = c.accent;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(g.y)); ctx.lineTo(W - pad.r, Y(g.y)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = c.accent; ctx.fillText(g.label, W - pad.r - ctx.measureText(g.label).width, Y(g.y) - 4);
  }
  if (opts.xLabel) { ctx.fillStyle = c.muted; ctx.fillText(opts.xLabel, W - pad.r - ctx.measureText(opts.xLabel).width, H - 6); }
  for (const s of series) {
    if (!s.points.length) continue;
    ctx.globalAlpha = s.alpha ?? 1;
    ctx.strokeStyle = s.color ?? c.accent2;
    ctx.lineWidth = s.width ?? 2;
    ctx.setLineDash(s.dash ?? []);
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

/** Bar chart. values: numbers; opts: { max, labels, height, highlight, ghost: numbers drawn as outlines } */
export function barPlot(canvas, values, opts = {}) {
  const c = palette();
  const { ctx, W, H } = prepare(canvas, opts.height ?? 160);
  const pad = { l: 10, r: 10, t: 12, b: 20 };
  const n = values.length;
  const max = opts.max ?? Math.max(1e-9, ...values, ...(opts.ghost ?? []));
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.max(4, slot * 0.6);
  const Y = (v) => pad.t + (1 - Math.min(1, v / max)) * (H - pad.t - pad.b);
  values.forEach((v, i) => {
    const x = pad.l + i * slot + (slot - bw) / 2;
    if (opts.ghost) {
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 3]);
      ctx.strokeRect(x, Y(opts.ghost[i]), bw, H - pad.b - Y(opts.ghost[i]));
      ctx.setLineDash([]);
    }
    const grad = ctx.createLinearGradient(0, Y(v), 0, H - pad.b);
    grad.addColorStop(0, i === opts.highlight ? c.accent : c.accent3);
    grad.addColorStop(1, i === opts.highlight ? c.accent : c.accent2);
    ctx.fillStyle = grad;
    ctx.fillRect(x, Y(v), bw, Math.max(1, H - pad.b - Y(v)));
    ctx.fillStyle = c.muted;
    const label = opts.labels?.[i] ?? String(i + 1);
    ctx.fillText(label, x + bw / 2 - ctx.measureText(label).width / 2, H - 6);
    if (opts.valueLabels) {
      const t = opts.valueLabels[i];
      ctx.fillStyle = c.text;
      ctx.fillText(t, x + bw / 2 - ctx.measureText(t).width / 2, Math.max(10, Y(v) - 3));
    }
  });
}
