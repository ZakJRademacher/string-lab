// compactification.js: what happens when a dimension is curled into a circle?
//
// Imagine a hose: from far away it looks like a 1D line, but up close it has a small
// circular direction. Put a closed string on a circle of radius R and it can:
//   • move around the circle, carrying momentum n (a whole number), costing energy n²/R²
//   • wrap around the circle w times ("winding"), costing energy w²R² (stretching)
//   • vibrate, with left/right levels N and Ñ
// Mass formula for the closed bosonic string (α′ = 1):
//     M² = n²/R² + w²R² + 2(N + Ñ − 2)      with level matching   N − Ñ = n·w
//
// T-DUALITY: swap n ↔ w and R ↔ 1/R and every mass stays the same. A tiny circle is
// physically identical to a huge one. R = 1 (the "self-dual radius") is special.

import { int, num } from './validate.js';

export const SPEC = {
  R: num(0.25, 4),
  n: int(-3, 3),
  w: int(-3, 3),
  N: int(0, 4),
  speed: num(0, 2),
};

// Default: a string MOVING around the circle (n = 1) but not wrapped (w = 0). Its
// T-dual twin (n = 0, w = 1) has a visibly different curve on the chart.
export const DEFAULTS = Object.freeze({ R: 1.6, n: 1, w: 0, N: 1, speed: 0.6 });

export const SELF_DUAL_RADIUS = 1;

/** The physical state for a parameter set, or the reason it can't exist. */
export function stateAt({ R, n, w, N }) {
  const Ntilde = N - n * w;
  if (Ntilde < 0) {
    return {
      allowed: false,
      reason: `Level matching needs N − Ñ = n·w = ${n * w}. With N = ${N} that makes Ñ = ${Ntilde}, which is impossible. Raise N.`,
    };
  }
  const momentum = (n * n) / (R * R);
  const winding = w * w * R * R;
  const oscillators = 2 * (N + Ntilde - 2);
  return {
    allowed: true,
    Ntilde,
    mass2: momentum + winding + oscillators,
    parts: { momentum, winding, oscillators },
    dual: { R: 1 / R, n: w, w: n, N },
  };
}

/** Points [R, M²] for drawing a curve on a chart (log-spaced R). */
export function mass2Curve(n, w, N, Rmin = 0.25, Rmax = 4, samples = 160) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const R = Rmin * (Rmax / Rmin) ** (i / samples);
    const s = stateAt({ R, n, w, N });
    if (s.allowed) pts.push([R, s.mass2]);
  }
  return pts;
}

export function summarize(params) {
  return stateAt(params);
}
