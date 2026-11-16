# String Lab

An interactive, beginner-friendly explorer of string theory ideas, with five modules:

- **The problem:** quantum fuzz (the very small), curved space (gravity) and a black hole where they clash
- **Strings:** a relativistic closed string with cusps and its worldsheet, plus a classical string lab with 8 harmonics
- **Extra dimensions:** n-cubes and cross-polytopes from 0D to 9D, rotated in any plane and projected to 3D
- **Calabi–Yau:** the curve z₁ⁿ + z₂ⁿ = 1 (the quintic slice at n = 5), glossy or hologram
- **Compactification:** strings on a circle, winding, momentum and T-duality

Two modes: **Simple**, a guided tour with plain-English controls for newcomers, and
**Advanced**, a full laboratory with an inspector, presets, live formulas, graphs and
diagnostics. No accounts: saved setups stay in your own browser.

**Live:** <https://string-lab.zakjrademacher.workers.dev>

## Scope: who it's for and what it won't do

**For:** curious people with no physics background. They should leave with a few
interesting ideas, not a physics education.

**The one question it answers:** *what is string theory, and why does it say there are
hidden dimensions?*

**Four ideas a visitor should take away: the problem, the idea, the cost and the catch.**
Each one answers the question the one before it raises.

1. **The problem:** our two best theories clash. Quantum mechanics explains the very small,
   Einstein's gravity explains the very large, and in places like black holes they give
   nonsense together. *So how do we fix it?*
2. **The idea:** everything might be made of tiny vibrating strings, with different
   vibrations being different particles. One vibration behaves exactly like gravity, so
   strings could unite the two theories. *Sounds great, so what's the catch?*
3. **The cost:** the idea works, but only if there are ten dimensions. So where are they?
   Curled up too small to see (and their shape would decide which particles exist), or we
   are stuck on a "sheet" inside a bigger space.
4. **The catch:** nobody has been able to test it. The energies are far beyond any machine,
   there are too many possible shapes to pin down our universe, and physicists still
   debate whether it is right.

**Not in scope (on purpose):** the five versions of string theory and M-theory (at most one
"wow" sentence), the maths of energy levels, history, and anything that needs a physics
background to follow. Advanced mode is a lab for the extra-curious, not the main
experience. New ideas must support one of the four ideas above, or they don't go in.

## Quick start

```bash
npm install
npm run dev      # local preview, http://localhost:5173
npm test         # 66 tests, offline
npm run deploy   # publish to Cloudflare
```

**New to this? Read [GUIDE.md](GUIDE.md):** it walks through how every part was built and why.

## Stack

A static site (plain JavaScript modules, no framework, no server) · Three.js for 3D · KaTeX for
maths · hosted as static assets on Cloudflare Workers, deployed with the `cf` CLI + Vite.
