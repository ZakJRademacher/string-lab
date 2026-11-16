// Smoothness changes must not change the physics. These tests check that the fast,
// allocation-free code gives exactly the same answers as the simple, original code.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as str from '../public/physics/string.js';
import { dynamicTube } from '../public/scene.js';
import * as dims from '../public/physics/dimensions.js';

test('the fast frame() matches rotate() + projectAll() exactly, 0D to 9D', () => {
  for (const shape of ['cube', 'cross']) {
    for (let n = 0; n <= 9; n++) {
      for (const spin of ['auto', 'XW,YZ', '']) {
        for (const projection of ['perspective', 'orthographic']) {
          const params = { dim: n, shape, projection, spin, speed: 1 };
          const sh = dims.polytope(shape, n);
          const offsets = n >= 4 ? { XW: 0.4, YZ: -0.3 } : {};
          const t = 2.7;
          const fast = dims.frame(params, t, sh, offsets);
          const planes = dims.spinningPlanes(spin, n);
          sh.vertices.forEach((v, i) => {
            const expected = dims.projectAll(dims.rotate(v, n, t, planes, offsets), projection);
            for (let k = 0; k < 3; k++) {
              assert.ok(Math.abs(fast.positions[i * 3 + k] - expected[k]) < 1e-5, `${shape} ${n}D ${spin} ${projection} vertex ${i}`);
            }
          });
          const again = dims.frame(params, t + 1, sh, offsets, fast);
          assert.equal(again.positions, fast.positions, 'reuses the arrays it is given');
        }
      }
    }
  }
});

test('the fast stringState matches positionAt exactly, for both loop families', () => {
  const cases = [
    { ...str.DEFAULTS, family: 'burden', m: 2, n: 3, psi: 0.9 },
    { ...str.DEFAULTS, family: 'kibble-turok', alpha: 0.3, psi: 2.0 },
  ];
  for (const p of cases) {
    for (const t of [0, 0.7, 2.3]) {
      const { positions } = str.stringState(p, t, 60);
      for (let i = 0; i < 60; i++) {
        const expected = str.positionAt(p, (i / 60) * 2 * Math.PI, t);
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(positions[i * 3 + k] - expected[k]) < 1e-6, `${p.family} t=${t} i=${i}`);
      }
    }
  }
});

test('stringState reuses the arrays it is given (no new memory per frame)', () => {
  const p = { ...str.DEFAULTS };
  const first = str.stringState(p, 0.1, 240);
  const second = str.stringState(p, 0.2, 240, first);
  assert.equal(second.positions, first.positions);
  assert.equal(second.speeds, first.speeds);
  const fresh = str.stringState(p, 0.2, 240);
  assert.deepEqual(Array.from(second.positions), Array.from(fresh.positions));
});

test('the reusable tube puts every ring exactly one radius from its curve point', () => {
  const tube = dynamicTube(64, 0.05, new THREE.MeshBasicMaterial(), 8);
  const pts = new Float32Array(64 * 3);
  for (let i = 0; i < 64; i++) {
    const s = (i / 64) * Math.PI * 2;
    pts.set([Math.cos(s), Math.sin(s), 0.2 * Math.sin(3 * s)], i * 3);
  }
  const buffer = tube.mesh.geometry.attributes.position.array;
  tube.setPoints(pts, 64, true);
  assert.equal(tube.mesh.geometry.attributes.position.array, buffer, 'same buffer, not a new one');
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j <= 8; j++) {
      const o = (i * 9 + j) * 3;
      const d = Math.hypot(buffer[o] - pts[i * 3], buffer[o + 1] - pts[i * 3 + 1], buffer[o + 2] - pts[i * 3 + 2]);
      assert.ok(Math.abs(d - 0.05) < 1e-5, `ring ${i}, vertex ${j}: ${d}`);
    }
  }
  assert.equal(tube.mesh.geometry.drawRange.count, 64 * 8 * 6, 'a closed loop draws every segment, including the join');
  tube.setPoints(pts, 40, false);
  assert.equal(tube.mesh.geometry.drawRange.count, 39 * 8 * 6, 'an open curve has one fewer segment than points');
});
