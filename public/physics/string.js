// string.js: the vibrating string module's math. Pure functions only:
// numbers in, numbers out. No web page, database or AI code lives here.
//
// ─── The physics in one paragraph ──────────────────────────────────────────
// A classical closed relativistic string, in "static gauge" (time = t), moves as
//     x(σ, t) = ½ [ a(σ − t) + b(σ + t) ]
// where a and b are closed curves whose tangents have length exactly 1:
//     |a′| = |b′| = 1      (with the speed of light c = 1)
// a is a wave running one way around the string, b a wave running the other way.
// If that rule holds, the string automatically obeys the "Virasoro constraints"
// (the equations that make the motion physically valid). Where the two waves line
// up exactly, a point on the string reaches the speed of light: a "cusp".

import { int, num, oneOf, pattern } from './validate.js';

export const FAMILIES = ['burden', 'kibble-turok'];
export const HARMONICS = 8;
const AMPLITUDE_LIST = /^(0|1|0?\.\d{1,3})(,(0|1|0?\.\d{1,3})){7}$/; // eight numbers from 0 to 1

export const SPEC = {
  // What kind of string: the exact relativistic loop, or a classical string (an analogy).
  kind: oneOf(['relativistic', 'open', 'closed'], 'relativistic'),
  harmonics: pattern(AMPLITUDE_LIST, 'eight amplitudes between 0 and 1', '1,0,0,0,0,0,0,0'),
  wave: oneOf(['standing', 'travelling'], 'standing'),
  f1: num(20, 880, 110),     // fundamental frequency in hertz (110 Hz = a guitar's A string)
  tension: num(10, 1000, 242), // string tension in newtons
  family: oneOf(FAMILIES), // which family of string loops
  m: int(1, 6),            // Burden: wave number of the left-moving wave
  n: int(1, 6),            // Burden: wave number of the right-moving wave
  psi: num(0, Math.PI),    // tilt angle between the two waves (radians)
  alpha: num(0, 1),        // Kibble–Turok: shape parameter
  speed: num(0, 2),        // animation playback speed
  N: int(0, 6),            // quantum panel: left-moving excitation level
  Ntilde: int(0, 6),       // quantum panel: right-moving excitation level
  sheet: oneOf(['on', 'off'], 'on'), // draw the worldsheet (added later, so it has a fallback)
};

export const DEFAULTS = Object.freeze({
  kind: 'relativistic', harmonics: '1,0,0,0,0,0,0,0', wave: 'standing', f1: 110, tension: 242,
  family: 'burden', m: 1, n: 2, psi: 1.2, alpha: 0.5, speed: 0.6, N: 1, Ntilde: 1, sheet: 'on',
});

// ─── Classical string (an educational analogy, not a quantum string) ────────
// A guitar-like string of length L, fixed at both ends ("open"), or a closed loop.
// Its motion is a sum of harmonics: whole numbers of half-waves (open) or waves (closed).
//   open:   y(x,t) = Σ Aₙ sin(nπx/L) cos(2π fₙ t)
//   closed: u(σ,t) = Σ Aₙ cos(nσ) cos(2π fₙ t)   (standing)
//           u(σ,t) = Σ Aₙ cos(n(σ − ωt))          (travelling)
// with fₙ = n·f₁. Time in the animation is slowed down enormously so you can watch it.

export const STRING_LENGTH = 0.65; // metres (a typical guitar scale length)

export function parseHarmonics(text) {
  const a = String(text).split(',').map(Number);
  return Array.from({ length: HARMONICS }, (_, i) => (Number.isFinite(a[i]) ? Math.max(0, Math.min(1, a[i])) : 0));
}
export function formatHarmonics(amps) {
  return amps.map((a) => String(Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000)).join(',');
}

/** Displacement at position x ∈ [0, 1] along the string (fraction of its length), at animation time t. */
export function classicalDisplacement(p, x, t, amps = parseHarmonics(p.harmonics)) {
  let y = 0;
  for (let k = 0; k < HARMONICS; k++) {
    const n = k + 1;
    const A = amps[k];
    if (!A) continue;
    if (p.kind === 'open') y += A * Math.sin(n * Math.PI * x) * Math.cos(n * t);
    else if (p.wave === 'travelling') y += A * Math.cos(n * (2 * Math.PI * x - t));
    else y += A * Math.cos(n * 2 * Math.PI * x) * Math.cos(n * t);
  }
  return y;
}

/**
 * Live "spectrum": measure how much of each harmonic is in the string's current shape,
 * by projecting the shape onto each harmonic (a Fourier projection, done numerically).
 */
export function modeSpectrum(p, t, samples = 512) {
  const amps = parseHarmonics(p.harmonics);
  const ys = Array.from({ length: samples }, (_, i) => classicalDisplacement(p, (i + 0.5) / samples, t, amps));
  return Array.from({ length: HARMONICS }, (_, k) => {
    const n = k + 1;
    let a = 0;
    let b = 0;
    for (let i = 0; i < samples; i++) {
      const x = (i + 0.5) / samples;
      if (p.kind === 'open') a += ys[i] * Math.sin(n * Math.PI * x);
      else { a += ys[i] * Math.cos(2 * Math.PI * n * x); b += ys[i] * Math.sin(2 * Math.PI * n * x); }
    }
    return (2 / samples) * Math.hypot(a, b);
  });
}

/** Real-world numbers for the classical string: wave speed, mass per metre, harmonic frequencies. */
export function classicalPhysics(p) {
  const L = p.kind === 'open' ? STRING_LENGTH : 2 * Math.PI * 0.1; // the loop: 10 cm radius
  const waveSpeed = (p.kind === 'open' ? 2 : 1) * L * p.f1;        // open: f₁ = v / 2L; closed: f₁ = v / L
  const massPerMetre = p.tension / (waveSpeed * waveSpeed);         // v = √(T / μ)
  return { length: L, waveSpeed, massPerMetre, frequencies: Array.from({ length: HARMONICS }, (_, k) => (k + 1) * p.f1) };
}

// ─── The two waves: each returns a point (pos) and its unit tangent (tan) ───

function leftMover(p, u) {
  if (p.family === 'burden') {
    const m = p.m;
    return {
      pos: [Math.cos(m * u) / m, Math.sin(m * u) / m, 0],
      tan: [-Math.sin(m * u), Math.cos(m * u), 0],
    };
  }
  const a = p.alpha; // Kibble–Turok loop
  const k = 2 * Math.sqrt(a * (1 - a));
  return {
    pos: [
      (1 - a) * Math.sin(u) + (a / 3) * Math.sin(3 * u),
      -(1 - a) * Math.cos(u) - (a / 3) * Math.cos(3 * u),
      -k * Math.cos(u),
    ],
    tan: [
      (1 - a) * Math.cos(u) + a * Math.cos(3 * u),
      (1 - a) * Math.sin(u) + a * Math.sin(3 * u),
      k * Math.sin(u),
    ],
  };
}

function rightMover(p, v) {
  const c = Math.cos(p.psi);
  const s = Math.sin(p.psi);
  if (p.family === 'burden') {
    const n = p.n;
    return {
      pos: [Math.cos(n * v) / n, (c * Math.sin(n * v)) / n, (s * Math.sin(n * v)) / n],
      tan: [-Math.sin(n * v), c * Math.cos(n * v), s * Math.cos(n * v)],
    };
  }
  return {
    pos: [Math.sin(v), -c * Math.cos(v), -s * Math.cos(v)],
    tan: [Math.cos(v), c * Math.sin(v), s * Math.sin(v)],
  };
}

/** Position of point σ on the string at time t. */
export function positionAt(p, sigma, t) {
  const a = leftMover(p, sigma - t).pos;
  const b = rightMover(p, sigma + t).pos;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/**
 * The same two waves as leftMover / rightMover, but written into a scratch array
 * [px, py, pz, tx, ty, tz] instead of returning new objects. Used by the per-frame
 * stringState(), so animating creates no garbage for the browser to clean up.
 */
function waveInto(p, u, left, out) {
  if (p.family === 'burden') {
    const k = left ? p.m : p.n;
    const c = Math.cos(k * u);
    const s = Math.sin(k * u);
    if (left) {
      out[0] = c / k; out[1] = s / k; out[2] = 0; out[3] = -s; out[4] = c; out[5] = 0;
    } else {
      const cp = Math.cos(p.psi);
      const sp = Math.sin(p.psi);
      out[0] = c / k; out[1] = (cp * s) / k; out[2] = (sp * s) / k; out[3] = -s; out[4] = cp * c; out[5] = sp * c;
    }
    return;
  }
  const su = Math.sin(u);
  const cu = Math.cos(u);
  if (left) {
    const a = p.alpha;
    const k = 2 * Math.sqrt(a * (1 - a));
    const s3 = Math.sin(3 * u);
    const c3 = Math.cos(3 * u);
    out[0] = (1 - a) * su + (a / 3) * s3; out[1] = -(1 - a) * cu - (a / 3) * c3; out[2] = -k * cu;
    out[3] = (1 - a) * cu + a * c3; out[4] = (1 - a) * su + a * s3; out[5] = k * su;
  } else {
    const cp = Math.cos(p.psi);
    const sp = Math.sin(p.psi);
    out[0] = su; out[1] = -cp * cu; out[2] = -sp * cu; out[3] = cu; out[4] = cp * su; out[5] = sp * su;
  }
}
const scratchA = new Float64Array(6);
const scratchB = new Float64Array(6);

/**
 * The whole string at time t. Returns flat arrays (fast for 3D drawing):
 * positions = [x0,y0,z0, x1,y1,z1, ...]; speeds = each point's speed as a fraction of c.
 * Pass `out` (a previous result of the same size) to reuse its arrays instead of making new ones.
 */
export function stringState(p, t, samples = 240, out) {
  const positions = out?.positions.length === samples * 3 ? out.positions : new Float32Array(samples * 3);
  const speeds = out?.speeds.length === samples ? out.speeds : new Float32Array(samples);
  const A = scratchA;
  const B = scratchB;
  for (let i = 0; i < samples; i++) {
    const sigma = (i / samples) * 2 * Math.PI;
    waveInto(p, sigma - t, true, A);
    waveInto(p, sigma + t, false, B);
    positions[i * 3] = (A[0] + B[0]) / 2;
    positions[i * 3 + 1] = (A[1] + B[1]) / 2;
    positions[i * 3 + 2] = (A[2] + B[2]) / 2;
    // velocity = ½(−a′ + b′)
    speeds[i] = Math.min(1, Math.hypot(B[3] - A[3], B[4] - A[4], B[5] - A[5]) / 2);
  }
  return { positions, speeds };
}

/**
 * Independent "physics check": measures the Virasoro constraints numerically,
 *     ẋ · x′ = 0     and     |ẋ|² + |x′|² = 1
 * using ONLY a position function and finite differences. Returns the worst violation.
 * Near 0 means the motion is physically valid. Because it only looks at positions,
 * it would catch a typo in the formulas above.
 */
export function measureConstraints(positionFn, t, samples = 120, h = 1e-4) {
  let worst = 0;
  for (let i = 0; i < samples; i++) {
    const s = (i / samples) * 2 * Math.PI;
    const dt = sub(positionFn(s, t + h), positionFn(s, t - h)).map((d) => d / (2 * h));
    const ds = sub(positionFn(s + h, t), positionFn(s - h, t)).map((d) => d / (2 * h));
    worst = Math.max(worst, Math.abs(dot(dt, ds)), Math.abs(dot(dt, dt) + dot(ds, ds) - 1));
  }
  return worst;
}

export function constraintError(p, t) {
  return measureConstraints((s, time) => positionAt(p, s, time), t);
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// ─── Quantum panel ─────────────────────────────────────────────────────────
// The animation is a CLASSICAL string. In the quantum theory, vibrations come in
// whole-number levels. For the closed bosonic string (26 dimensions, α′ = 1):
//     level matching:  N = Ñ          mass:  M² = 4(N − 1)

/** Ways to build level N from oscillators in (D − 2) transverse directions. */
export function transverseStates(N, D = 26) {
  const c = new Array(N + 1).fill(0);
  c[0] = 1;
  for (let k = 1; k <= N; k++) {
    for (let rep = 0; rep < D - 2; rep++) {
      for (let i = k; i <= N; i++) c[i] += c[i - k];
    }
  }
  return c[N];
}

export function closedStringLevel(N, Ntilde) {
  if (N !== Ntilde) {
    return {
      allowed: false,
      label: 'Not allowed',
      note: 'Level matching fails. A closed string needs equal left- and right-moving excitation (N = Ñ), so this state does not exist.',
    };
  }
  const mass2 = 4 * (N - 1);
  const states = transverseStates(N) ** 2;
  if (N === 0) {
    return { allowed: true, mass2, states, label: 'Tachyon',
      note: 'Negative mass². A known sign that bosonic string theory is incomplete; superstring theory removes it.' };
  }
  if (N === 1) {
    return { allowed: true, mass2, states, label: 'Massless: graviton, B-field, dilaton',
      note: 'The famous result: a closed string automatically contains a graviton, the particle of gravity. 576 states = 299 graviton + 276 B-field + 1 dilaton.' };
  }
  return { allowed: true, mass2, states, label: 'Massive tower',
    note: 'Extremely heavy states (near the Planck mass). Their number grows explosively with N.' };
}

export function summarize(p, t = 0) {
  if (p.kind !== 'relativistic') {
    return { kind: `classical ${p.kind} string (an analogy)`, harmonics: parseHarmonics(p.harmonics), ...classicalPhysics(p) };
  }
  const { speeds } = stringState(p, t);
  return {
    constraintError: constraintError(p, t),
    maxSpeedFractionOfLight: Math.max(...speeds),
    quantumLevel: closedStringLevel(p.N, p.Ntilde),
  };
}
