// dimensions.js: how do you picture a 4D, 5D … 9D object?
//
// The same way a shadow pictures a 3D object on a 2D wall: project it.
// We build an n-cube (or a cross-polytope) in n dimensions, rotate it through
// chosen PLANES, then flatten it one hidden dimension at a time until it fits in 3D.

import { int, num, oneOf, pattern } from './validate.js';

export const MAX_DIM = 9;
/** Names of the axes, as physicists often label them. */
export const AXES = ['X', 'Y', 'Z', 'W', 'V', 'U', 'S', 'R', 'Q'];

// "auto", "" (no spin) or a comma list of planes like "XW,YZ".
const PLANE_LIST = /^(auto|([XYZWVUSRQ]{2})(,[XYZWVUSRQ]{2}){0,35})?$/;

export const SPEC = {
  dim: int(0, MAX_DIM),
  shape: oneOf(['cube', 'cross']),
  projection: oneOf(['perspective', 'orthographic']),
  speed: num(0, 2),
  spin: pattern(PLANE_LIST, 'a list of rotation planes like "XW,YZ"', 'auto'),
};

export const DEFAULTS = Object.freeze({ dim: 4, shape: 'cube', projection: 'perspective', speed: 0.6, spin: 'auto' });

const NAMES = ['point', 'line segment', 'square', 'cube', 'tesseract', 'penteract', 'hexeract', 'hepteract', 'octeract', 'enneract'];
const CROSS_NAMES = { 2: 'square (diamond)', 3: 'octahedron', 4: '16-cell' };
export function shapeName(shape, dim) {
  if (shape === 'cross' && dim >= 2) return CROSS_NAMES[dim] ?? `${dim}-orthoplex`;
  return NAMES[dim];
}

/**
 * Vertices and edges of an n-dimensional shape.
 * Each edge is [i, j, axis]; `axis` is the dimension it points along (used for colour).
 */
export function polytope(shape, dim) {
  const vertices = [];
  const edges = [];
  if (shape === 'cross' && dim >= 2) {
    // Cross-polytope: one point at ± along every axis (an octahedron in 3D).
    for (let k = 0; k < dim; k++) {
      for (const sign of [1, -1]) {
        const v = new Array(dim).fill(0);
        v[k] = sign * 1.5;
        vertices.push(v);
      }
    }
    // Connect every pair of points, except exact opposites.
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const ai = i >> 1;
        const aj = j >> 1;
        if (ai !== aj) edges.push([i, j, Math.max(ai, aj)]);
      }
    }
    return { vertices, edges };
  }
  // n-cube: every combination of ±1 in each coordinate, 2^n corners.
  for (let mask = 0; mask < 1 << dim; mask++) {
    vertices.push(Array.from({ length: dim }, (_, k) => ((mask >> k) & 1 ? 1 : -1)));
  }
  // Two corners share an edge when they differ in exactly one coordinate.
  for (let i = 0; i < vertices.length; i++) {
    for (let k = 0; k < dim; k++) {
      const j = i ^ (1 << k);
      if (j > i) edges.push([i, j, k]);
    }
  }
  return { vertices, edges };
}

/** Every rotation plane in n dimensions: n(n−1)/2 of them, e.g. XY, XZ, XW, … */
export function allPlanes(dim) {
  const planes = [];
  for (let i = 0; i < dim; i++) {
    for (let j = i + 1; j < dim; j++) planes.push({ i, j, code: AXES[i] + AXES[j] });
  }
  return planes;
}

/** The default spin: a slow ordinary turn, plus one plane per hidden dimension. */
export function autoPlanes(dim) {
  if (dim < 2) return [];
  const planes = [[0, Math.min(2, dim - 1), 0.25]];
  for (let k = 3; k < dim; k++) planes.push([(k - 3) % 3, k, 0.45 + 0.15 * k]);
  return planes;
}
export const rotationPlanes = autoPlanes; // older name, kept for compatibility

/** Which planes spin, as [i, j, rate] triples, from the "spin" setting. */
export function spinningPlanes(spin, dim) {
  if (spin === 'auto') return autoPlanes(dim);
  if (!spin) return [];
  const byCode = new Map(allPlanes(dim).map((p) => [p.code, p]));
  return spin.split(',').filter((code) => byCode.has(code)).map((code, n) => {
    const p = byCode.get(code);
    return [p.i, p.j, 0.5 + 0.11 * n];
  });
}

/** Rotate a point: spinning planes turn with time; `offsets` adds fixed angles per plane code. */
export function rotate(point, dim, t, planes = autoPlanes(dim), offsets = {}) {
  const p = point.slice();
  const turn = (i, j, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const pi = p[i];
    const pj = p[j];
    p[i] = c * pi - s * pj;
    p[j] = s * pi + c * pj;
  };
  for (const [code, angle] of Object.entries(offsets)) {
    const i = AXES.indexOf(code[0]);
    const j = AXES.indexOf(code[1]);
    if (angle && i >= 0 && j < dim && j >= 0) turn(i, j, angle);
  }
  for (const [i, j, rate] of planes) turn(i, j, rate * t);
  return p;
}

/** Flatten an n-D point down to 3D, one dimension at a time. */
export function project(point, mode, distance = 4) {
  let p = point.slice();
  while (p.length > 3) {
    const last = p.pop();
    if (mode === 'perspective') {
      // Like a camera: things "closer" in the hidden direction look bigger.
      const f = distance / (distance - last);
      p = p.map((x) => x * f);
    }
    // orthographic: just drop the coordinate (a flat shadow).
  }
  while (p.length < 3) p.push(0);
  return p;
}

/**
 * Flatten using ONE combined depth: w = (x₄ + … + xₙ) / √(n − 3), factor d / (d − w).
 * Projecting one axis at a time compounds the factors and can divide by almost zero
 * above 5D (a 9-cube "explodes"). With d = 2√n and |w| ≤ √n, the factor always stays
 * between ⅔ and 2. In 4D this is exactly the same as project().
 */
export function projectAll(point, mode) {
  const n = point.length;
  if (n <= 4) return project(point, mode);
  let w = 0;
  for (let i = 3; i < n; i++) w += point[i];
  w /= Math.sqrt(n - 3);
  const d = 2 * Math.sqrt(n);
  const f = mode === 'perspective' ? d / (d - w) : 1;
  return [point[0] * f, point[1] * f, point[2] * f];
}

/**
 * Everything the 3D view needs for one frame: 3D positions, the edges, and each
 * vertex's "hidden depth" (its position along the hidden axes, from −1 to 1, for colour).
 */
//
// frame() runs every animation frame for up to 512 corners, so it avoids creating new
// arrays: it rotates each corner inside one reusable scratch array, works out the same
// projection as projectAll() inline, and (if given `out`) writes into last frame's arrays.
// The result is identical to rotate() + projectAll(); a test checks that.

const scratch = new Float64Array(MAX_DIM);
const stepsScratch = new Float64Array(4 * 72);
let planesKey = '';
let planesCached = [];

export function frame(params, t, shapeCache, offsets = {}, out) {
  const { vertices, edges } = shapeCache ?? polytope(params.shape, params.dim);
  const dim = params.dim;
  const key = `${params.spin ?? 'auto'}|${dim}`;
  if (key !== planesKey) { planesKey = key; planesCached = spinningPlanes(params.spin ?? 'auto', dim); }
  const planes = planesCached;
  const positions = out?.positions.length === vertices.length * 3 ? out.positions : new Float32Array(vertices.length * 3);
  const depth = out?.depth.length === vertices.length ? out.depth : new Float32Array(vertices.length);
  const hidden = Math.max(0, dim - 3);

  // Fixed angles (from the inspector) and spinning planes, as [i, j, cos, sin] steps,
  // written into a reusable array (at most 36 + 36 planes in 9D).
  const steps = stepsScratch;
  let n = 0;
  for (const code in offsets) {
    const angle = offsets[code];
    const i = AXES.indexOf(code[0]);
    const j = AXES.indexOf(code[1]);
    if (angle && i >= 0 && j >= 0 && j < dim && n < steps.length) {
      steps[n++] = i; steps[n++] = j; steps[n++] = Math.cos(angle); steps[n++] = Math.sin(angle);
    }
  }
  for (let q = 0; q < planes.length && n < steps.length; q++) {
    const pl = planes[q];
    steps[n++] = pl[0]; steps[n++] = pl[1]; steps[n++] = Math.cos(pl[2] * t); steps[n++] = Math.sin(pl[2] * t);
  }

  const perspective = params.projection === 'perspective';
  const d4 = 4;
  const dn = 2 * Math.sqrt(dim);
  const invHidden = hidden ? 1 / Math.sqrt(hidden) : 0;
  for (let v = 0; v < vertices.length; v++) {
    const src = vertices[v];
    for (let k = 0; k < dim; k++) scratch[k] = src[k];
    for (let s = 0; s < n; s += 4) {
      const i = steps[s];
      const j = steps[s + 1];
      const c = steps[s + 2];
      const sn = steps[s + 3];
      const pi = scratch[i];
      const pj = scratch[j];
      scratch[i] = c * pi - sn * pj;
      scratch[j] = sn * pi + c * pj;
    }
    let sum = 0;
    for (let k = 3; k < dim; k++) sum += scratch[k];
    depth[v] = hidden ? Math.max(-1, Math.min(1, sum / (1.4 * Math.sqrt(hidden)))) : 0;
    // Same maths as projectAll(): one depth factor (4D: w = x₄, d = 4; above: combined w, d = 2√n).
    let f = 1;
    if (perspective && dim === 4) f = d4 / (d4 - scratch[3]);
    else if (perspective && dim > 4) f = dn / (dn - sum * invHidden);
    positions[v * 3] = (dim > 0 ? scratch[0] : 0) * f;
    positions[v * 3 + 1] = (dim > 1 ? scratch[1] : 0) * f;
    positions[v * 3 + 2] = (dim > 2 ? scratch[2] : 0) * f;
  }
  return { positions, edges, depth };
}

export function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/**
 * How many pieces of each dimension the shape's surface has:
 * index 0 = corners, 1 = edges, 2 = squares/triangles, 3 = solid cells, ...
 *   hypercube:       f_k = 2^(n−k) · C(n, k)
 *   cross-polytope:  f_k = 2^(k+1) · C(n, k+1)
 */
export function faceCounts(shape, dim) {
  if (dim === 0) return [1];
  const counts = [];
  for (let k = 0; k < dim; k++) {
    counts.push(shape === 'cross' && dim >= 2 ? 2 ** (k + 1) * binomial(dim, k + 1) : 2 ** (dim - k) * binomial(dim, k));
  }
  return counts;
}

/** Euler's formula, generalised: f0 − f1 + f2 − … = 1 − (−1)^n for any convex shape. */
export function eulerCharacteristic(shape, dim) {
  return faceCounts(shape, dim).reduce((sum, f, k) => sum + (k % 2 ? -f : f), 0);
}

/** The square faces of an n-cube, as 4 vertex indices each (for drawing translucent faces). */
export function cubeSquares(dim) {
  const squares = [];
  for (let a = 0; a < dim; a++) {
    for (let b = a + 1; b < dim; b++) {
      for (let mask = 0; mask < 1 << dim; mask++) {
        if (mask & (1 << a) || mask & (1 << b)) continue;
        squares.push([mask, mask | (1 << a), mask | (1 << a) | (1 << b), mask | (1 << b)]);
      }
    }
  }
  return squares;
}

export function summarize(params) {
  const { vertices, edges } = polytope(params.shape, params.dim);
  return { name: shapeName(params.shape, params.dim), vertices: vertices.length, edges: edges.length, faces: faceCounts(params.shape, params.dim), spinningPlanes: params.spin };
}
