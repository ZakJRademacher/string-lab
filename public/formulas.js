// formulas.js: "The math behind it" panel for every tab.
//
// Each entry is { title, tex, text }:
//   tex  = the formula, written in LaTeX (the standard language for maths typesetting),
//          with YOUR current slider values plugged in, so the numbers match the picture.
//   text = what the formula means, in plain words.
// The page draws the LaTeX with KaTeX. A test renders every formula, so a typo can't ship.
//
// Units: we use "string units", where the speed of light c = 1 and the string length
// scale α′ (alpha-prime) = 1. That keeps the formulas short.

import { closedStringLevel, transverseStates, classicalPhysics, parseHarmonics } from './physics/string.js';
import { faceCounts, binomial } from './physics/dimensions.js';
import { genus } from './physics/calabiYau.js';
import { stateAt } from './physics/compactification.js';

const fmt = (x, d = 3) => {
  if (!Number.isFinite(x)) return '?';
  if (Math.abs(x) < 0.5 * 10 ** -d) return '0';
  return Number(x.toFixed(d)).toString();
};
const sci = (x) => {
  if (!(x > 0)) return '0';
  const e = Math.floor(Math.log10(x));
  return String.raw`${(x / 10 ** e).toFixed(1)}\times10^{${e}}`;
};
const k = (n) => (n === 1 ? '' : String(n)); // write "u" instead of "1u"

export function formulas(tab, p, live = {}) {
  switch (tab) {
    case 'string': return stringMath(p, live);
    case 'dimensions': return dimensionMath(p);
    case 'calabiYau': return calabiYauMath(p, live);
    case 'compactification': return compactificationMath(p);
    default: return [];
  }
}

function classicalMath(p) {
  const phys = classicalPhysics(p);
  const amps = parseHarmonics(p.harmonics);
  const active = amps.map((a, k) => [a, k + 1]).filter(([a]) => a > 0);
  const open = p.kind === 'open';
  const freqs = active.length
    ? active.slice(0, 4).map(([, n]) => String.raw`f_{${n}}=${(n * p.f1).toFixed(0)}\,\text{Hz}`).join(',\ ') + (active.length > 4 ? String.raw`,\ \dots` : '')
    : String.raw`\text{(silent)}`;
  return [
    {
      title: 'The wave equation',
      tex: String.raw`\frac{\partial^2 y}{\partial t^2}=v^2\,\frac{\partial^2 y}{\partial x^2},\qquad v=\sqrt{T/\mu}=\sqrt{${p.tension.toFixed(0)}\,\text{N}/${(phys.massPerMetre * 1000).toFixed(2)}\,\text{g/m}}=${phys.waveSpeed.toFixed(1)}\,\text{m/s}`,
      text: 'How fast a bend in the string travels depends on how tight it is (tension T) and how heavy it is (mass per metre μ). A tight, light string is fast, and so sounds high.',
    },
    {
      title: open ? 'Fixed ends allow only whole half-waves' : 'A loop allows only whole waves',
      tex: open
        ? String.raw`y(x,t)=\sum_{n=1}^{8}A_n\,\sin\frac{n\pi x}{L}\,\cos(2\pi f_n t)`
        : p.wave === 'travelling'
          ? String.raw`u(\sigma,t)=\sum_{n=1}^{8}A_n\cos\big(n(\sigma-\omega t)\big)`
          : String.raw`u(\sigma,t)=\sum_{n=1}^{8}A_n\cos(n\sigma)\,\cos(2\pi f_n t)`,
      text: open
        ? 'Both ends are pinned, so the string can only hold 1, 2, 3, … half-waves. Each is a "harmonic"; any motion is a mix of them, with amplitudes Aₙ (the mixer bars).'
        : 'Going once around the loop must bring you back to the same point, so only whole numbers of waves fit. Standing waves wobble in place; travelling waves run around the loop.',
    },
    {
      title: 'Harmonic frequencies',
      tex: String.raw`f_n=n\,f_1=\frac{n\,v}{${open ? '2L' : 'L'}}\qquad\Longrightarrow\qquad ${freqs}`,
      text: 'Every harmonic vibrates a whole number of times faster than the first. That is why a plucked string sounds like one musical note: its harmonics fit together.',
    },
    {
      title: 'Measuring the spectrum',
      tex: open
        ? String.raw`A_n(t)=\frac{2}{L}\int_0^L y(x,t)\,\sin\frac{n\pi x}{L}\,dx`
        : String.raw`A_n=\frac{1}{\pi}\Big|\int_0^{2\pi}u(\sigma,t)\,e^{-in\sigma}\,d\sigma\Big|`,
      text: 'The bar chart in Graphs measures how much of each harmonic is in the string\'s shape right now, by comparing the shape with each harmonic (a Fourier projection). It recovers exactly the amplitudes you set in the mixer.',
    },
    {
      title: 'From harmonics to quantum levels',
      tex: String.raw`N=\sum_{n\ge1} n\,N_n,\qquad \alpha'M^2=4(N-1)`,
      text: 'In the quantum string, each harmonic n can only hold whole packets of energy (Nₙ of them). Adding them up, weighted by n, gives the level N that decides the particle\'s mass. This classical string is the analogy; the quantum one is the real theory.',
    },
  ];
}

function stringMath(p, live) {
  if (p.kind && p.kind !== 'relativistic') return classicalMath(p);
  const loop = p.family === 'burden'
    ? {
      tex: String.raw`a(u)=\tfrac{1}{${p.m}}\big(\cos ${k(p.m)}u,\ \sin ${k(p.m)}u,\ 0\big),\qquad b(v)=\tfrac{1}{${p.n}}\big(\cos ${k(p.n)}v,\ ${fmt(Math.cos(p.psi), 2)}\sin ${k(p.n)}v,\ ${fmt(Math.sin(p.psi), 2)}\sin ${k(p.n)}v\big)`,
      text: `The Burden loop: each wave is a circle, traced ${p.m === 1 ? 'once' : `${p.m} times`} and ${p.n === 1 ? 'once' : `${p.n} times`} per trip around the string, tilted ψ = ${fmt(p.psi, 2)} rad apart. When m = n and ψ = 0 the loop simply shrinks to a point and grows back.`,
    }
    : {
      tex: String.raw`a'(u)=\big((1-\alpha)\cos u+\alpha\cos 3u,\ (1-\alpha)\sin u+\alpha\sin 3u,\ 2\sqrt{\alpha(1-\alpha)}\,\sin u\big),\quad \alpha=${fmt(p.alpha, 2)}`,
      text: 'The Kibble–Turok loop (from early-universe cosmic-string research). The odd-looking terms are chosen so that |a′| = 1 exactly, for every α.',
    };
  const q = closedStringLevel(p.N, p.Ntilde);
  const d = transverseStates(p.N);
  return [
    {
      title: 'How the string moves',
      tex: String.raw`\vec x(\sigma,t)=\tfrac12\Big[\,\vec a(\sigma-t)+\vec b(\sigma+t)\,\Big],\qquad |\vec{a}'|=|\vec{b}'|=1`,
      text: 'σ (sigma) labels the points along the string, t is time. a and b are two waves racing around the loop in opposite directions. The one rule, "each wave moves at exactly light speed", is enough to make the motion obey Einstein\'s relativity.',
    },
    { title: 'The loop on screen', ...loop },
    {
      title: 'Relativity check (the Virasoro constraints)',
      tex: String.raw`\dot{\vec x}\cdot\vec{x}'=0,\qquad \dot{\vec x}^{\,2}+\vec{x}'^{\,2}=1\qquad\Longrightarrow\qquad \text{worst error now}=${sci(live.constraintError ?? 0)}`,
      text: 'A dot means "rate of change in time", a prime means "rate of change along the string". The first rule says the string never slides along itself; the second ties its speed to how stretched it is. The app measures both numerically every moment: the error is just computer rounding.',
    },
    {
      title: 'Speed, and why cusps happen',
      tex: String.raw`|\dot{\vec x}|=\tfrac12\,\big|\vec{b}'(\sigma+t)-\vec{a}'(\sigma-t)\big|\le 1,\qquad =1\ \text{exactly when}\ \vec{b}'=-\vec{a}'\qquad(\text{now: }${fmt((live.maxSpeed ?? 0) * 100, 1)}\%\ \text{of}\ c)`,
      text: 'Both a′ and b′ are arrows of length 1, so they trace curves on a ball. Wherever the curve of b′ crosses the mirror image of a′, a piece of string touches light speed: a cusp. Two curves on a ball usually cross, so cusps are normal, not rare.',
    },
    {
      title: 'The worldsheet and the action',
      tex: String.raw`S=-T\!\int\! dA=-\frac{1}{2\pi\alpha'}\times\big(\text{area of the worldsheet}\big)`,
      text: 'A point particle traces a line through spacetime; a string traces a surface, the worldsheet you see glowing. Nature picks the motion that makes this (spacetime) area stationary, like a soap film pulled tight. T is the string\'s tension.',
    },
    {
      title: 'Quantum levels: the particle menu',
      tex: q.allowed
        ? String.raw`\alpha' M^2=4(N-1),\quad N=\tilde N\qquad\Longrightarrow\qquad \alpha'M^2=4(${p.N}-1)=${q.mass2}`
        : String.raw`N=${p.N}\neq\tilde N=${p.Ntilde}\qquad\Longrightarrow\qquad\text{no such state}`,
      text: 'Once quantum mechanics is switched on, the string can only vibrate in whole-number levels N (left-moving) and Ñ (right-moving), and a closed string needs them equal. Each level is a particle of a definite mass. Level 1 is massless and includes the graviton: gravity comes out of the theory automatically.',
    },
    {
      title: 'Counting the states',
      tex: String.raw`\sum_{N\ge0} d_N\,q^N=\prod_{k\ge1}\frac{1}{(1-q^k)^{24}},\qquad \text{states}=d_N^{\,2}=${d.toLocaleString('en-US').replace(/,/g, '{,}')}^2=${(d * d).toLocaleString('en-US').replace(/,/g, '{,}')}`,
      text: 'This bosonic string needs 26 dimensions; 24 of them are directions the string can wiggle in. Counting the ways to build level N from wiggles in 24 directions gives d_N; squaring covers left and right movers. These numbers grow explosively: that is the famous "Hagedorn" growth of string states.',
    },
  ];
}

function dimensionMath(p) {
  const n = p.dim;
  const f = faceCounts(p.shape, n);
  const names = ['corners', 'edges', 'faces', '3D cells', '4D cells', '5D cells', '6D cells', '7D cells', '8D cells'];
  const list = f.map((v, i) => String.raw`${v}\ \text{${names[i]}}`).join(',\ ');
  const euler = f.map((v, i) => (i === 0 ? `${v}` : `${i % 2 ? '-' : '+'}${v}`)).join('');
  const chi = f.reduce((s, v, i) => s + (i % 2 ? -v : v), 0);
  const cube = p.shape === 'cube' || n < 2;
  const items = [
    {
      title: cube ? 'Building a hypercube' : 'Building a cross-polytope',
      tex: cube
        ? String.raw`\text{corners}=2^n=2^{${n}}=${f[0]},\qquad \text{edges}=n\cdot2^{n-1}=${n}\cdot2^{${n - 1}}=${f[1]}`
        : String.raw`\text{corners}=2n=${f[0]},\qquad \text{edges}=2n(n-1)=${f[1]}`,
      text: cube
        ? 'Take a cube in n−1 dimensions, make a copy, slide it along a brand-new direction and join matching corners. Every step doubles the corners. That\'s why the 4D tesseract looks like a cube inside a cube.'
        : 'Put one point at +1 and one at −1 on every axis, then join every pair except exact opposites. In 3D this makes an octahedron.',
    },
    {
      title: 'Counting every piece',
      tex: cube
        ? String.raw`f_k=2^{\,n-k}\binom{n}{k}\qquad\Longrightarrow\qquad ${list}`
        : String.raw`f_k=2^{\,k+1}\binom{n}{k+1}\qquad\Longrightarrow\qquad ${list}`,
      text: `f_k counts the k-dimensional pieces of the surface. "n choose k" counts which k directions a piece spans. ${cube && n === 4 ? 'So the tesseract is bounded by 8 cubes, just as a cube is bounded by 6 squares.' : ''}`.trim(),
    },
    {
      title: 'Euler\'s formula, in any dimension',
      tex: String.raw`f_0-f_1+f_2-\cdots=1-(-1)^n\qquad\Longrightarrow\qquad ${euler}=${chi}`,
      text: 'In 3D this is Euler\'s famous V − E + F = 2. The same alternating sum works for any convex shape in any dimension, and gives 0 in even dimensions and 2 in odd ones. A neat check that the counts above are right.',
    },
    {
      title: 'Rotating in a plane, not around an axis',
      tex: String.raw`\begin{pmatrix}x_i'\\x_j'\end{pmatrix}=\begin{pmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{pmatrix}\begin{pmatrix}x_i\\x_j\end{pmatrix},\qquad \text{planes available}=\binom{n}{2}=${binomial(n, 2)}`,
      text: 'In 3D we say things rotate "around an axis", but really they rotate within a plane. In higher dimensions only the plane picture works. Pick which planes spin in the Rotation planes panel; turning through a plane that includes a hidden axis is what makes the shape seem to turn inside out.',
    },
    {
      title: 'Flattening to 3D',
      tex: p.projection !== 'perspective'
        ? String.raw`(x_1,\dots,x_{n})\ \longmapsto\ (x_1,x_2,x_3)`
        : n <= 4
          ? String.raw`x_k'=x_k\cdot\frac{d}{d-w},\qquad w=x_4,\quad d=4`
          : String.raw`x_k'=x_k\cdot\frac{d}{d-w},\qquad w=\frac{x_4+\cdots+x_{${n}}}{\sqrt{${n - 3}}},\quad d=2\sqrt{${n}}`,
      text: p.projection !== 'perspective'
        ? 'A flat shadow: simply forget the hidden coordinates. Lengths along hidden directions vanish, so edges overlap.'
        : n <= 4
          ? 'Perspective: parts of the shape that are "closer" along the hidden direction are drawn bigger, exactly like a camera makes near things look large. That is why the tesseract\'s inner cube looks smaller: it is farther away in 4D.'
          : 'Perspective with one combined depth w, built from all the hidden axes. Applying a separate depth factor for each hidden axis multiplies them together and, above 5D, can divide by almost zero; this version always stays between two-thirds and twice the size.',
    },
  ];
  // Euler's formula is about the surface of a shape with at least 1 dimension.
  return n >= 1 ? items : items.filter((i) => !i.title.startsWith('Euler'));
}

function calabiYauMath(p, live) {
  const n = p.n;
  const g = genus(n);
  return [
    {
      title: 'The equation',
      tex: String.raw`z_1^{${n}}+z_2^{${n}}=1,\qquad z_1,z_2\in\mathbb{C}`,
      text: 'z₁ and z₂ are complex numbers (each has a real and an imaginary part), so the solutions form a 2-dimensional surface living in 4 real dimensions.',
    },
    {
      title: 'Solving it with a trick',
      tex: String.raw`z_1=e^{2\pi i k_1/${n}}\,(\cos z)^{2/${n}},\qquad z_2=e^{2\pi i k_2/${n}}\,(\sin z)^{2/${n}},\qquad k_1,k_2\in\{0,\dots,${n - 1}\}`,
      text: `Because cos²z + sin²z = 1 is true for every complex z, raising both sides to the right powers gives solutions. The factors e^(2πik/n) are the n different "n-th roots of 1": each choice of k₁, k₂ gives one coloured patch, ${n * n} in total. The app checks every point: the worst error now is ${(live.maxError ?? 0).toExponential(1)}.`,
    },
    {
      title: 'Drawing 4 dimensions in 3',
      tex: String.raw`(x,y,z)=\big(\operatorname{Re}z_1,\ \operatorname{Re}z_2,\ \cos\alpha\,\operatorname{Im}z_1+\sin\alpha\,\operatorname{Im}z_2\big),\qquad \alpha=${fmt(p.alpha, 2)}`,
      text: 'We keep both real parts and blend the two imaginary parts into one direction using the angle α. Turning α is like walking around the 4D object and looking at a different shadow.',
    },
    {
      title: 'How many holes?',
      tex: String.raw`g=\frac{(n-1)(n-2)}{2}=\frac{${n - 1}\cdot${n - 2}}{2}=${g}`,
      text: `Add the missing points "at infinity" and the surface closes up into a shape with g holes: ${g === 0 ? 'a sphere, no holes.' : g === 1 ? 'a doughnut, one hole.' : `like a pretzel with ${g} holes.`} The number of holes is a "topological" fact: no stretching or bending can change it.`,
    },
    {
      title: 'The real thing: the quintic',
      tex: String.raw`z_1^5+z_2^5+z_3^5+z_4^5+z_5^5=0\ \ \text{in}\ \mathbb{CP}^4,\qquad \chi=-200`,
      text: 'The famous Calabi–Yau is 6-dimensional and uses five complex coordinates; our picture is a 2D slice of it. Its Euler number −200 matters: in the simplest string models, the number of particle "families" is half of it, 100. Our universe has 3, so physicists look for other shapes. There are at least hundreds of millions of candidates.',
    },
  ];
}

function compactificationMath(p) {
  const s = stateAt(p);
  const R = fmt(p.R, 2);
  const mass = s.allowed
    ? String.raw`=\frac{${p.n * p.n}}{${R}^2}+${p.w * p.w}\cdot${R}^2+2(${p.N}+${s.Ntilde}-2)=${fmt(s.parts.momentum)}+${fmt(s.parts.winding)}+(${fmt(s.parts.oscillators)})=${fmt(s.mass2)}`
    : String.raw`\quad(\text{not allowed: }\tilde N=N-nw=${p.N - p.n * p.w}<0)`;
  return [
    {
      title: 'The mass formula',
      tex: String.raw`M^2=\frac{n^2}{R^2}+w^2R^2+2\big(N+\tilde N-2\big)\ ${mass}`,
      text: 'Three ways to carry energy: moving around the circle (first term), being wrapped around it (second), and vibrating (third). M² is mass squared, in string units.',
    },
    {
      title: 'Level matching',
      tex: String.raw`N-\tilde N=n\,w\qquad\Longrightarrow\qquad\tilde N=${p.N}-(${p.n})(${p.w})=${p.N - p.n * p.w}`,
      text: 'Left- and right-moving vibrations must balance, unless the string both moves and wraps. Ñ can\'t be negative, so some combinations simply don\'t exist.',
    },
    {
      title: 'Why momentum comes in steps',
      tex: String.raw`e^{ipy}=e^{ip(y+2\pi R)}\quad\Longrightarrow\quad p=\frac{n}{R}=\frac{${p.n}}{${R}}=${fmt(p.n / p.R)}`,
      text: 'In quantum mechanics a moving particle is a wave. Going once around the circle must bring the wave back to itself, so only whole numbers of wavelengths fit. On a tiny circle each step is huge: that\'s why a tiny extra dimension would be invisible: you\'d need enormous energy to move in it.',
    },
    {
      title: 'Why wrapping costs energy',
      tex: String.raw`E_{\text{wrap}}=T\times\text{length}=\frac{1}{2\pi\alpha'}\cdot2\pi R\,|w|=\frac{|w|R}{\alpha'}`,
      text: 'A wrapped string is stretched around the circle, and a stretched string stores energy, like a rubber band. Particles can\'t wrap at all: this is something only strings can do.',
    },
    {
      title: 'T-duality',
      tex: String.raw`R\;\longrightarrow\;\frac{\alpha'}{R},\qquad n\;\longleftrightarrow\;w\qquad(\text{here: }R=${R}\ \leftrightarrow\ ${fmt(1 / p.R, 2)})`,
      text: 'Swap "moving" with "wrapping" and replace R by 1/R: every mass in the formula stays the same. A string cannot tell a circle of radius 2 from one of radius ½. There is, in a sense, a smallest meaningful size.',
    },
    {
      title: 'The self-dual radius',
      tex: String.raw`R=\sqrt{\alpha'}=1\qquad\Longrightarrow\qquad M^2_{\,n=w=\pm1,\,N=1}=\Big(R-\frac1R\Big)^2=0`,
      text: 'At exactly R = 1 the circle is its own twin, and some states that are normally heavy become massless. Extra massless particles mean extra forces: the symmetry of the theory grows. Geometry is deciding which forces exist.',
    },
  ];
}
