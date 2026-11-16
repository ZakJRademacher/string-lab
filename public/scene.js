// scene.js: the shared 3D "stage" every tab draws on (using the Three.js library).
//
// Graphics pipeline, in order:
//   1. Render the scene (camera + objects + lights).
//   2. Bloom: anything brighter than a threshold gets a soft glow around it.
//      Bright, unlit ("basic") materials glow; the rest stays crisp.
//   3. Tone mapping (ACES, the same curve films use) and colour correction.
// An environment map (a virtual photo studio) gives shiny surfaces believable reflections.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// (Guarded so tests can load this file outside a browser.)
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // Render scale: how many real pixels per CSS pixel. Sharper costs more; the app lowers it
  // automatically if the frame rate drops (see adaptQuality in app.js).
  const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  const minPixelRatio = Math.min(0.75, maxPixelRatio);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // Colours of space come from the CSS palette, so a palette change recolours the 3D world too.
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const space = new THREE.Color(token('--space', '#05070d'));
  const scene = new THREE.Scene();
  scene.background = makeBackdrop(token('--space', '#05070d'), token('--nebula-1', '#0a2442'), token('--nebula-2', '#1c1450'));
  scene.fog = new THREE.FogExp2(space, 0.035);

  // Studio reflections for shiny materials.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
  camera.position.set(3.2, 2.2, 4.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 14;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(token('--rim', '#7f9cff')), 0.9);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const stars = makeStarfield(1800, Number(token('--star-a', '0.6')), Number(token('--star-b', '0.1')));
  scene.add(stars);

  // Lab helpers: a floor grid and labelled x / y / z axes (toggled from the toolbar).
  const grid = new THREE.GridHelper(12, 24, new THREE.Color(token('--grid-major', '#5a74bd')), new THREE.Color(token('--grid-minor', '#2b3a66')));
  grid.position.y = -1.9;
  grid.material.transparent = true;
  grid.material.opacity = 0.8;
  grid.material.fog = false;
  grid.visible = false;
  scene.add(grid);
  const axes = makeAxes();
  axes.visible = false;
  scene.add(axes);
  const helpers = new Set([stars, grid, axes]);

  // Post-processing chain.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const size = new THREE.Vector2(1, 1); // canvas size in CSS pixels (fat lines need it)

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    size.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // Double-click: focus the camera on whatever is under the pointer (or back on the centre).
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.05;
  renderer.domElement.addEventListener('dblclick', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = scene.children.filter((o) => !helpers.has(o) && !o.isLight);
    const hit = raycaster.intersectObjects(targets, true)[0];
    controls.target.copy(hit ? hit.point : new THREE.Vector3());
  });

  renderer.info.autoReset = false; // count every pass of a frame together (for Diagnostics)
  let lastLook = [3.2, 2.2, 4.2];

  return {
    scene,
    camera,
    controls,
    size,
    render(dt) {
      if (!reducedMotion) stars.rotation.y += dt * 0.01;
      controls.update();
      renderer.info.reset();
      composer.render();
    },
    lookFrom(position) {
      lastLook = position;
      // On tall, narrow screens (phones) step back so the whole scene fits the width.
      const backOff = Math.max(1, 1.25 / camera.aspect);
      camera.position.set(...position).multiplyScalar(backOff);
      controls.target.set(0, 0, 0);
    },
    resetCamera() { this.lookFrom(lastLook); },
    setBloom(strength) {
      bloom.strength = strength;
    },
    setBloomEnabled(on) { bloom.enabled = on; },
    setGrid(on) { grid.visible = on; },
    setAxes(on) { axes.visible = on; },
    setAutoRotate(on) { controls.autoRotate = on; controls.autoRotateSpeed = 0.9; },
    /** Current render scale, and its allowed range. */
    pixelRatio() { return renderer.getPixelRatio(); },
    pixelRatioRange: { min: minPixelRatio, max: maxPixelRatio },
    setPixelRatio(r) {
      const next = Math.max(minPixelRatio, Math.min(maxPixelRatio, r));
      if (Math.abs(next - renderer.getPixelRatio()) < 0.01) return false;
      renderer.setPixelRatio(next);
      composer.setPixelRatio(next);
      resize();
      return true;
    },
    stats() {
      const { render } = renderer.info;
      return { calls: render.calls, triangles: render.triangles, lines: render.lines, points: render.points, pixelRatio: renderer.getPixelRatio() };
    },
  };
}

/** x / y / z axes with small text labels, in the same colours as the dimension explorer. */
function makeAxes() {
  const group = new THREE.Group();
  const specs = [['x', 0x5b8cff, [2.3, 0, 0]], ['y', 0x3ccf91, [0, 2.3, 0]], ['z', 0xb57bff, [0, 0, 2.3]]];
  for (const [name, color, end] of specs) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...end)]);
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })));
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = '600 40px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 32, 34);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    sprite.position.set(...end).multiplyScalar(1.08);
    sprite.scale.setScalar(0.28);
    group.add(sprite);
  }
  return group;
}

/** A soft painted sky: the space colour with two faint clouds of nebula colour. */
function makeBackdrop(space, a, b) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = space;
  g.fillRect(0, 0, 512, 512);
  const cloud = (x, y, r, color, alpha) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, space);
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  };
  cloud(110, 100, 380, a, 1);
  cloud(430, 410, 340, b, 1);
  cloud(330, 170, 200, b, 0.45);
  cloud(160, 380, 180, a, 0.4);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A sphere of faint stars, far away, mostly white with a few tinted by the palette. */
function makeStarfield(count = 1800, hueA = 0.6, hueB = 0.1) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 25 + Math.random() * 40;
    const s = Math.sqrt(1 - u * u);
    positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3);
    const tint = Math.random();
    c.setHSL(tint < 0.15 ? hueA : tint > 0.92 ? hueB : hueA, tint < 0.15 || tint > 0.92 ? 0.6 : 0.1, 0.55 + Math.random() * 0.35);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.09, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, fog: false,
  }));
}

/** Free GPU memory used by a group of 3D objects (important when switching tabs). */
export function disposeGroup(group) {
  group.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    mats.forEach((m) => m.dispose());
  });
}

/**
 * A tube that follows a moving curve WITHOUT being rebuilt every frame.
 *
 * Why: creating a new TubeGeometry 60 times a second makes megabytes of garbage per
 * second, and the browser pauses now and then to clean it up, which you see as stutter.
 * Here the vertex buffer is made once; each frame we only overwrite the numbers in it.
 * Each ring of the tube is placed using "parallel transport" frames, which keep the
 * tube from twisting as the curve bends.
 *
 * points: flat array [x0, y0, z0, x1, …] of up to maxPoints points.
 */
export function dynamicTube(maxPoints, radius, material, radial = 8) {
  const rings = maxPoints + 1; // +1 so a closed loop can repeat its first ring
  const positions = new Float32Array(rings * (radial + 1) * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const index = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(index);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false; // the curve moves; skip recomputing its bounds each frame

  // Scratch vectors, reused every frame (no allocations while animating).
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const P = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const next = new THREE.Vector3();
  const cos = Float32Array.from({ length: radial + 1 }, (_, j) => Math.cos((j / radial) * Math.PI * 2));
  const sin = Float32Array.from({ length: radial + 1 }, (_, j) => Math.sin((j / radial) * Math.PI * 2));

  function writeRing(ring) {
    for (let j = 0; j <= radial; j++) {
      const o = (ring * (radial + 1) + j) * 3;
      positions[o] = P.x + radius * (cos[j] * N.x + sin[j] * B.x);
      positions[o + 1] = P.y + radius * (cos[j] * N.y + sin[j] * B.y);
      positions[o + 2] = P.z + radius * (cos[j] * N.z + sin[j] * B.z);
    }
  }

  return {
    mesh,
    setPoints(points, count, closed) {
      const n = Math.min(count, maxPoints);
      for (let i = 0; i < n; i++) {
        const ip = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
        const inx = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
        prev.fromArray(points, ip * 3);
        next.fromArray(points, inx * 3);
        T.subVectors(next, prev).normalize();
        if (i === 0) {
          // Any direction perpendicular to the first tangent will do.
          N.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0);
        }
        N.addScaledVector(T, -N.dot(T)).normalize(); // carry the frame along the curve
        B.crossVectors(T, N);
        P.fromArray(points, i * 3);
        writeRing(i);
      }
      let used = n;
      if (closed && n > 1) {
        // Close the loop: repeat the first ring at the end.
        const first = 0;
        const last = n * (radial + 1) * 3;
        positions.copyWithin(last, first, (radial + 1) * 3);
        used = n + 1;
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, Math.max(0, used - 1) * radial * 6);
    },
  };
}

/** A row of small glowing spheres, one per point, each with its own colour and size. */
export function beads(count, radius, material) {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, 12, 10),
    material ?? new THREE.MeshBasicMaterial({ toneMapped: false }),
    count,
  );
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  return {
    mesh,
    set(i, x, y, z, scale, hexOrColor) {
      m.makeScale(scale, scale, scale).setPosition(x, y, z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, typeof hexOrColor === 'number' ? color.setHex(hexOrColor) : hexOrColor);
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
