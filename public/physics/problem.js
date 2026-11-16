// problem.js: the problem string theory tries to solve.
//
// Physics has two great theories:
//   • quantum mechanics, for the very small: particles are fuzzy clouds of possibility
//   • general relativity, for the very large: mass bends space, and that bend is gravity
// Usually they never meet. Inside a black hole they must: a huge mass is squeezed into a
// tiny region, and using both theories together gives infinities (nonsense).
//
// The numbers here are real (SI units). The 3D picture is an illustration, not to scale.

import { num, oneOf } from './validate.js';

export const HBAR = 1.054571817e-34; // reduced Planck constant, J·s
export const G = 6.6743e-11;         // Newton's gravitational constant, m³/(kg·s²)
export const C = 299792458;          // speed of light, m/s
export const SUN = 1.98892e30;       // mass of the Sun, kg

export const SPEC = {
  focus: oneOf(['small', 'large', 'clash']), // which theory the picture shows
  mass: num(1, 20),                          // the heavy object, in Suns
  speed: num(0, 2),
};

export const DEFAULTS = Object.freeze({ focus: 'small', mass: 1, speed: 0.6 });

/** The Planck length: where quantum effects and gravity become equally important. */
export const PLANCK_LENGTH = Math.sqrt((HBAR * G) / C ** 3); // ≈ 1.6 × 10⁻³⁵ m

/** The Schwarzschild radius of a mass (kg): squeeze it smaller and it becomes a black hole. */
export function schwarzschildRadius(kg) {
  return (2 * G * kg) / C ** 2;
}

/** Everything the readout and the maths panel need, in one place. */
export function summarize(p) {
  const kg = p.mass * SUN;
  const rs = schwarzschildRadius(kg);
  return {
    focus: p.focus,
    massKg: kg,
    schwarzschildRadius: rs,              // metres
    planckLength: PLANCK_LENGTH,          // metres
    sizeRatio: rs / PLANCK_LENGTH,        // how many Planck lengths fit across the black hole
  };
}
