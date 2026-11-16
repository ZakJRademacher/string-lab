// calabiYau.js: a picture of the hidden 6 dimensions.
//
// Superstring theory needs 10 dimensions. One popular idea: the 6 extra ones are
// curled into a tiny "Calabi–Yau" shape. A full Calabi–Yau is 6-dimensional, so we
// can't draw it. What we CAN draw is a 2D slice of one, the solutions of
//     z₁ⁿ + z₂ⁿ = 1      (z₁, z₂ complex numbers)
// For n = 5 this is a slice of the famous "quintic". Two complex numbers make
// 4 real coordinates, so we project from 4D to 3D with an adjustable angle α.
//
// The trick for finding solutions: cos²z + sin²z = 1 for any complex z, so
//     z₁ = e^(2πi·k₁/n) · (cos z)^(2/n),   z₂ = e^(2πi·k₂/n) · (sin z)^(2/n)
// solves the equation. Each pair (k₁, k₂) gives one "patch"; there are n² of them.

import { int, num } from './validate.js';

export const SPEC = {
  n: int(2, 6),
  alpha: num(0, Math.PI),
  speed: num(0, 2),
};

export const DEFAULTS = Object.freeze({ n: 5, alpha: Math.PI / 4, speed: 0.3 });

// ─── Tiny complex-number toolkit: a complex number is [real, imaginary] ───
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const expI = (theta) => [Math.cos(theta), Math.sin(theta)];
const cosC = (x, y) => [Math.cos(x) * Math.cosh(y), -Math.sin(x) * Math.sinh(y)];
const sinC = (x, y) => [Math.sin(x) * Math.cosh(y), Math.cos(x) * Math.sinh(y)];
function powReal(z, p) {
  const r = Math.hypot(z[0], z[1]);
  if (r === 0) return [0, 0];
  const theta = Math.atan2(z[1], z[0]);
  return [r ** p * Math.cos(p * theta), r ** p * Math.sin(p * theta)];
}
function powInt(z, n) {
  let out = [1, 0];
  for (let i = 0; i < n; i++) out = mul(out, z);
  return out;
}

/**
 * Build the surface as a triangle mesh.
 * Returns positions (xyz per vertex), triangle indices, a patch number per vertex
 * (for colour), and maxError: how far the points are from solving z₁ⁿ + z₂ⁿ = 1.
 */
export function surface(params, res = 18, yRange = 1.0) {
  const { n, alpha } = params;
  const perPatch = (res + 1) * (res + 1);
  const positions = new Float32Array(n * n * perPatch * 3);
  const patch = new Float32Array(n * n * perPatch);
  const indices = new Uint32Array(n * n * res * res * 6);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  let v = 0;
  let idx = 0;
  let maxError = 0;

  for (let k1 = 0; k1 < n; k1++) {
    for (let k2 = 0; k2 < n; k2++) {
      const base = v;
      const phase1 = expI((2 * Math.PI * k1) / n);
      const phase2 = expI((2 * Math.PI * k2) / n);
      for (let i = 0; i <= res; i++) {
        const x = (i / res) * (Math.PI / 2);
        for (let j = 0; j <= res; j++) {
          const y = -yRange + (j / res) * 2 * yRange;
          const z1 = mul(phase1, powReal(cosC(x, y), 2 / n));
          const z2 = mul(phase2, powReal(sinC(x, y), 2 / n));

          const sum = [powInt(z1, n)[0] + powInt(z2, n)[0], powInt(z1, n)[1] + powInt(z2, n)[1]];
          maxError = Math.max(maxError, Math.hypot(sum[0] - 1, sum[1]));

          // 4D → 3D: keep both real parts, mix the two imaginary parts by angle α.
          positions[v * 3] = z1[0];
          positions[v * 3 + 1] = z2[0];
          positions[v * 3 + 2] = ca * z1[1] + sa * z2[1];
          patch[v] = k1 * n + k2;
          v++;
        }
      }
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const a = base + i * (res + 1) + j;
          const b = a + res + 1;
          indices.set([a, b, a + 1, b, b + 1, a + 1], idx);
          idx += 6;
        }
      }
    }
  }
  return { positions, indices, patch, patches: n * n, maxError };
}

/**
 * Number of "holes" (genus) of the closed surface you get from z₁ⁿ + z₂ⁿ = 1 once the
 * missing points at infinity are added back (the Fermat curve): g = (n − 1)(n − 2) / 2.
 * n = 2 → a sphere (0 holes), n = 3 → a doughnut (1 hole), n = 5 → 6 holes.
 */
export const genus = (n) => ((n - 1) * (n - 2)) / 2;

export function summarize(params) {
  const { patches, maxError } = surface(params, 8);
  return { patches, maxEquationError: maxError, genus: genus(params.n) };
}
