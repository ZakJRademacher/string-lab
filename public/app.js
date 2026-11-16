// app.js: the browser side of String Lab (the "dining room").
//
// Two layouts share one engine:
//   Simple mode    the 3D picture, a short story, and a few plain-English controls
//   Advanced mode  a full laboratory: module sidebar, inspector, toolbar, play bar,
//                  and a dock with the maths, graphs and diagnostics
//
// The single source of truth for the physics is `lab`: one object holding every module's
// settings. Sliders, presets, saved files and the tour all change the app the
// same way: build a new `lab`, validate it, redraw. Viewer preferences that are not physics
// (grid on/off, wireframe look, which dock tab is open…) live separately in `ui`.

import { createStage, disposeGroup } from './scene.js';
import { defaultLabState, validateLabState, MODULES, LAB_TABS } from './physics/index.js';
import { checkFields } from './physics/validate.js';
import { AXES, autoPlanes } from './physics/dimensions.js';
import stringView from './views/stringView.js';
import dimensionsView from './views/dimensionsView.js';
import calabiYauView from './views/calabiYauView.js';
import compactificationView from './views/compactificationView.js';
import problemView from './views/problemView.js';
import { formulas } from './formulas.js';
import { TOUR, STEPS, firstStepOfChapter, applyStep, WELCOME_PICTURE } from './tour.js';
import { createSaveStore } from './saves.js';

const VIEWS = {
  string: stringView,
  dimensions: dimensionsView,
  calabiYau: calabiYauView,
  compactification: compactificationView,
  problem: problemView,
};
const MODULE_ORDER = ['dimensions', 'calabiYau', 'string', 'compactification'].filter((t) => LAB_TABS.includes(t)); // order in the lab sidebar
const DRAFT_KEY = 'string-lab:draft';
const UI_KEY = 'string-lab:ui';
const TOUR_KEY = 'string-lab:tour-v2'; // v2: the tour starts at stop 1 (the old intro steps moved to the welcome screen)
const MODE_KEY = 'string-lab:mode';

// ─── Small helpers ────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

/** Create an element: el('button', {class: 'x', onclick: fn}, 'Label'). Text is always safe text, never HTML. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k === 'html') node.innerHTML = v; // only ever used with our own fixed SVG icons
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Replace an element's contents, skipping empty slots (null/false), which would otherwise show as the word "null". */
function setChildren(node, ...kids) {
  node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

/** Sliders show a cyan fill up to the thumb; the CSS reads how far as --fill. */
function paintRange(r) {
  const min = Number(r.min) || 0;
  const max = Number(r.max) || 100;
  r.style.setProperty('--fill', `${((Number(r.value) - min) / (max - min || 1)) * 100}%`);
}
document.addEventListener('input', (e) => { if (e.target.matches?.('input[type="range"]')) paintRange(e.target); });
new MutationObserver(() => document.querySelectorAll('input[type="range"]').forEach(paintRange))
  .observe(document.body, { childList: true, subtree: true });

/** Draw a LaTeX formula with KaTeX (loaded in index.html). Falls back to plain text. */
function mathNode(tex) {
  const node = el('div', { class: 'formula' });
  if (window.katex) window.katex.render(tex, node, { displayMode: true, throwOnError: false });
  else node.append(el('code', {}, tex));
  return node;
}

// Browser storage can be blocked (private windows), so every use is wrapped in try/catch.
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── State ────────────────────────────────────────────────────────────────
function loadDraft() {
  const saved = readJSON(DRAFT_KEY);
  if (!saved) return null;
  const r = validateLabState(saved);
  return r.ok ? r.value : null;
}
let draftTimer = 0;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => writeJSON(DRAFT_KEY, lab), 300);
}

let lab = loadDraft() ?? defaultLabState();
let current = null; // { key, view, instance }
let elapsed = 0;
let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastLive = {};
let lastInfoRows = [];
let infoShape = ""; // which rows the readout currently shows (see renderInfo)

// Viewer preferences (not physics, not saved to the server).
const UI_DEFAULTS = {
  grid: true, axes: false, autoRotate: false, bloom: true, dock: 'math',
  dimColor: 'axis', dimFaces: false, dimPlane: 'XW', dimAngles: {},
  cyLook: 'glossy', cySurface: true, cyWire: true, cyRes: 30, cyOpacity: 1,
  stringSelected: 0, stringSolo: false, sheet: 'peek',
};
let ui = (() => {
  const saved = readJSON(UI_KEY) ?? {};
  const out = { ...UI_DEFAULTS };
  for (const [k, v] of Object.entries(UI_DEFAULTS)) {
    if (saved[k] !== undefined && typeof saved[k] === typeof v) out[k] = saved[k];
  }
  return out;
})();

const tour = (() => {
  const saved = readJSON(TOUR_KEY);
  if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < STEPS.length) {
    return { index: saved.index, open: saved.open !== false };
  }
  return { index: 0, open: true }; // first visit: start the tour
})();
const saveTour = () => writeJSON(TOUR_KEY, tour);

let mode = (() => { try { return localStorage.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'simple'; } catch { return 'simple'; } })();

const stage = createStage($('#viewport'));

// ─── Mode: Simple or Advanced ─────────────────────────────────────────────
function setMode(next) {
  mode = next;
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  applyMode();
  renderAllPanels();
  // Back in Simple mid-tour: put the step's own picture (and its animation) back.
  if (mode === 'simple' && tour.open) goToStep(tour.index);
}
function applyMode() {
  document.documentElement.classList.toggle('simple', mode === 'simple');
  for (const btn of document.querySelectorAll('#mode button')) btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
  applyGlobalVis();
  current?.instance.setVis?.(pictureSettings());
  current?.instance.onParams?.(lab[lab.tab]);
  if (layoutReady) applyLayout();
  // "The problem" lives only in the tour: the lab opens on its first module instead.
  if (mode === 'advanced' && !LAB_TABS.includes(lab.tab)) {
    lab.tab = MODULE_ORDER[0];
    if (current) showTab(lab.tab);
  }
  if (mode !== 'simple') stopCycle();
}
let layoutReady = false; // the phone layout code further down sets this once it has loaded
for (const btn of document.querySelectorAll('#mode button')) btn.addEventListener('click', () => setMode(btn.dataset.mode));

/** Grid, axes, auto-rotate and bloom only apply in the lab; Simple mode keeps a clean picture. */
function applyGlobalVis() {
  const lab_ = mode === 'advanced';
  stage.setGrid(lab_ && ui.grid);
  stage.setAxes(lab_ && ui.axes);
  stage.setAutoRotate(lab_ && ui.autoRotate);
  stage.setBloomEnabled(!lab_ || ui.bloom);
}

// How the pictures look. The lab remembers your viewing choices (solo a harmonic, colours,
// angles…), but the Simple tour always uses the defaults: otherwise a choice made in the lab,
// like soloing harmonic 3, could silence the tour's string completely.
const pictureSettings = () => (mode === 'advanced' ? ui : UI_DEFAULTS);

function setUi(partial, { inspector = true } = {}) {
  ui = { ...ui, ...partial };
  writeJSON(UI_KEY, ui);
  applyGlobalVis();
  current?.instance.setVis?.(pictureSettings());
  current?.instance.onParams?.(lab[lab.tab]);
  renderToolbar();
  if (inspector) renderInspector();
  renderInfo();
}

// ─── Modules ──────────────────────────────────────────────────────────────
function showTab(key) {
  lab.tab = key;
  if (current) {
    stage.scene.remove(current.instance.group);
    disposeGroup(current.instance.group);
  }
  const view = VIEWS[key];
  const instance = view.create({ size: stage.size });
  instance.setVis?.(pictureSettings());
  stage.scene.add(instance.group);
  stage.lookFrom(view.camera);
  stage.setBloom(view.bloom ?? 0.8);
  current = { key, view, instance };
  elapsed = 0;
  instance.onParams?.(lab[key]);
  renderAllPanels();
  saveDraft();
}

function renderAllPanels() {
  renderTabs();
  renderControls();
  renderInfo();
  renderTour();
  renderMath(true);
  renderLabNav();
  renderPresets();
  renderInfocard();
  renderToolbar();
  renderTransport();
  mountGraphs();
}

/** Replace the whole lab (from a save, a preset or the tour) after validating it. */
function applyLab(next) {
  const r = validateLabState(next);
  if (!r.ok) { console.warn('Ignored invalid lab state', r.errors); return false; }
  const tabChanged = r.value.tab !== lab.tab;
  lab = r.value;
  if (tabChanged || !current) showTab(lab.tab);
  else { current.instance.onParams?.(lab[lab.tab]); renderAllPanels(); saveDraft(); }
  return true;
}

/** Change several settings of the current module at once. */
function setParams(partial, rerender = true) {
  const key = lab.tab;
  const r = checkFields({ ...lab[key], ...partial }, MODULES[key].SPEC, key);
  if (!r.ok) return false;
  lab[key] = r.value;
  current.instance.onParams?.(lab[key]);
  if (rerender) { renderControls(); renderInfocard(); renderTransport(); }
  renderInfo();
  renderMath(true);
  saveDraft();
  return true;
}

// ─── Simple mode: tabs, controls, caption ────────────────────────────────
// The top buttons in Simple mode are the four stops of the story:
// the problem, the idea, the cost and the catch. Tapping one jumps straight to it.
function renderTabs() {
  // Drawn as a numbered step bar: stops you've passed get a tick, the current one is lit.
  const here = tour.open && $('#welcome').hidden ? STEPS[tour.index].chapterIndex : -1;
  setChildren($('#tabs'), TOUR.map((chapter, i) => {
    const done = i < here;
    return el('button', {
      type: 'button', role: 'tab', class: done ? 'done' : undefined, 'aria-selected': String(i === here),
      onclick: () => { tour.open = true; goToStep(firstStepOfChapter(chapter.id)); },
    },
    el('span', { class: 'step-num', 'aria-hidden': 'true' }, done ? '✓' : String(i + 1)),
    el('span', { class: 'step-label' }, el('span', { class: 'step-the' }, 'The '), el('span', { class: 'step-word' }, chapter.title.replace(/^The /, ''))));
  }));
}

// Simple mode has no controls: each tour step sets the picture up by itself.
function renderControls() {
  if (mode === 'advanced') renderInspector();
}

function switchNode(id, label, checked, onChange) {
  return el('label', { class: 'switch', for: id },
    el('input', { id, type: 'checkbox', role: 'switch', checked, onchange: (e) => onChange(e.target.checked) }),
    el('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    el('span', {}, label));
}

// ─── Advanced mode: sidebar ──────────────────────────────────────────────
const MODULE_ICONS = {
  problem: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 9c4 0 6 6 10 6s6-6 10-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 5l1 1M18 5l1 1M12 2v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dimensions: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4V12M20 8v8l-8 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  calabiYau: '<svg viewBox="0 0 24 24"><path d="M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm0 4c-3 2-3 8 0 10m0-10c3 2 3 8 0 10M3.5 10c5 2 12 2 17 0M3.5 14c5-2 12-2 17 0" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  string: '<svg viewBox="0 0 24 24"><path d="M2 9c3-4 5-4 8 0s5 4 8 0 3-2 4-2M2 15c3-4 5-4 8 0s5 4 8 0 3-2 4-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  compactification: '<svg viewBox="0 0 24 24"><ellipse cx="6" cy="12" rx="3" ry="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 6h12M6 18h12" stroke="currentColor" stroke-width="1.6"/><ellipse cx="18" cy="12" rx="3" ry="6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>',
};

function renderLabNav() {
  setChildren($('#lab-nav'), MODULE_ORDER.map((key) => {
    const view = VIEWS[key];
    return el('button', {
      type: 'button', class: key === lab.tab ? 'nav-item on' : 'nav-item', 'aria-current': key === lab.tab ? 'page' : undefined,
      onclick: () => showTab(key),
    }, el('span', { class: 'nav-icon', 'aria-hidden': 'true', html: MODULE_ICONS[key] }),
    el('span', { class: 'nav-text' }, el('strong', {}, view.labTitle), el('small', {}, view.labSub)));
  }));
  renderModulePicker();
}

// On a phone the sidebar is hidden; one button at the top picks the module instead.
function renderModulePicker() {
  const view = VIEWS[lab.tab];
  setChildren($('#module-picker'),
    el('span', { class: 'nav-icon', 'aria-hidden': 'true', html: MODULE_ICONS[lab.tab] }),
    el('span', { class: 'picker-text' }, el('small', {}, 'Module'), el('strong', {}, view.labTitle)),
    el('span', { class: 'picker-chevron', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }));
  setChildren($('#module-menu'), MODULE_ORDER.map((key) => el('button', {
    type: 'button', role: 'menuitemradio', 'aria-checked': String(key === lab.tab), class: key === lab.tab ? 'nav-item on' : 'nav-item',
    onclick: () => { setPickerOpen(false); if (key !== lab.tab) showTab(key); },
  }, el('span', { class: 'nav-icon', 'aria-hidden': 'true', html: MODULE_ICONS[key] }),
  el('span', { class: 'nav-text' }, el('strong', {}, VIEWS[key].labTitle), el('small', {}, VIEWS[key].labSub)))));
}
function setPickerOpen(open) {
  $('#module-menu').hidden = !open;
  $('#module-picker').setAttribute('aria-expanded', String(open));
  if (open) $('#module-menu .on')?.focus();
}
$('#module-picker').addEventListener('click', () => setPickerOpen($('#module-menu').hidden));
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.module-picker')) setPickerOpen(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#module-menu').hidden) { setPickerOpen(false); $('#module-picker').focus(); }
});

function renderPresets() {
  const presets = current.view.presets ?? [];
  setChildren($('#presets'),
    presets.map((p) => el('button', { type: 'button', class: 'preset', onclick: () => applyLab({ ...lab, [lab.tab]: { ...lab[lab.tab], ...p.set } }) },
      el('strong', {}, p.label), el('small', {}, p.sub))),
    el('button', { type: 'button', class: 'ghost small reset-all', onclick: () => {
      setUi({ dimAngles: {} }, { inspector: false });
      applyLab({ ...lab, [lab.tab]: { ...MODULES[lab.tab].DEFAULTS } });
    } }, '↺ Reset this module'));
}

// ─── Advanced mode: info card and toolbar over the 3D view ──────────────
const BADGES = {
  result: ['Mathematical result', 'Computed exactly from the equations.'],
  analogy: ['Educational analogy', 'A simplified stand-in that teaches the idea; not the real thing.'],
  metaphor: ['Visual metaphor', 'A drawing to help intuition; not to scale.'],
};

function renderInfocard() {
  if (!current.view.displayed) return;
  const d = current.view.displayed(lab[lab.tab]);
  const card = $('#infocard');
  const open = card.classList.contains('open');
  // The head is a button: on a phone the card shrinks to a chip and tapping it shows the text.
  setChildren(card,
    el('button', { type: 'button', class: 'infocard-head', 'aria-expanded': String(open), 'aria-controls': 'infocard-text',
      onclick: (e) => { const now = card.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(now)); } },
      el('strong', {}, d.title),
      d.badges.map((b) => el('span', { class: `badge ${b}`, title: BADGES[b][1] },
        el('span', { class: 'desktop-label' }, BADGES[b][0]), el('span', { class: 'phone-label' }, BADGES[b][0].split(' ').pop()))),
      el('span', { class: 'chip-more', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' })),
    el('p', { id: 'infocard-text' }, el('span', { class: 'eyebrow inline' }, 'What is displayed '), d.text));
}

const ICONS = {
  grid: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  axes: '<svg viewBox="0 0 24 24"><path d="M5 19V4M5 19h15M5 19l9-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  bloom: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  panel: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 4v16" stroke="currentColor" stroke-width="1.6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function renderToolbar() {
  const toggle = (key, icon, label) => el('button', {
    type: 'button', class: 'tool', 'aria-pressed': String(Boolean(ui[key])), 'aria-label': label, title: label, html: ICONS[icon],
    onclick: () => setUi({ [key]: !ui[key] }, { inspector: false }),
  });
  setChildren($('#toolbar'),
    toggle('grid', 'grid', 'Grid (G)'),
    toggle('axes', 'axes', 'Coordinate axes (A)'),
    toggle('autoRotate', 'rotate', 'Automatic rotation (R)'),
    toggle('bloom', 'bloom', 'Glow (B)'),
    el('button', { type: 'button', class: 'tool', 'aria-label': 'Reset camera', title: 'Reset camera', html: ICONS.home, onclick: () => stage.resetCamera() }),
    el('button', {
      type: 'button', class: 'tool', 'aria-pressed': String(!document.body.classList.contains('no-inspector')), 'aria-label': 'Show or hide the inspector', title: 'Inspector',
      html: ICONS.panel, onclick: (e) => { document.body.classList.toggle('no-inspector'); e.currentTarget.setAttribute('aria-pressed', String(!document.body.classList.contains('no-inspector'))); },
    }));
}

// ─── Advanced mode: play bar ─────────────────────────────────────────────
function renderTransport() {
  const play = $('#play');
  play.innerHTML = playing ? ICONS.pause : ICONS.play;
  play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('#restart').innerHTML = ICONS.restart;
  const speed = lab[lab.tab].speed ?? 1;
  $('#timescale').value = speed;
  paintRange($('#timescale'));
  $('#timescale-out').textContent = `${speed.toFixed(2)}×`;
}
function togglePlay() { playing = !playing; renderTransport(); }
$('#play').addEventListener('click', togglePlay);
$('#restart').addEventListener('click', () => { elapsed = 0; current.instance.onParams?.(lab[lab.tab]); });
$('#timescale').addEventListener('input', (e) => {
  setParams({ speed: Number(e.target.value) }, false);
  $('#timescale-out').textContent = `${Number(e.target.value).toFixed(2)}×`;
});

// ─── Advanced mode: the inspector ─────────────────────────────────────────
function formatValue(c, v) {
  if (c.format) return c.format(v);
  if (c.unit === 'rad') return `${v.toFixed(2)} rad`;
  if (c.unit) return `${c.step >= 1 ? Math.round(v) : v.toFixed(2)} ${c.unit}`;
  return c.step >= 1 ? String(v) : v.toFixed(2);
}

function rangeNode(c, value, onInput, onDone) {
  const id = `insp-${(c.key ?? c.ui ?? c.label).replace(/\W+/g, '-')}`;
  const out = el('output', { for: id, class: 'mono' }, formatValue(c, value));
  return el('div', { class: 'insp-control' },
    el('label', { for: id }, el('span', {}, c.label), out),
    el('input', {
      id, type: 'range', min: c.min, max: c.max, step: c.step, value,
      oninput: (e) => { const v = Number(e.target.value); onInput(v); out.textContent = formatValue(c, v); },
      onchange: () => onDone?.(),
    }));
}

function segNode(label, options, isOn, onPick, compact) {
  return el('div', { class: 'insp-control' },
    label ? el('span', { class: 'insp-label' }, label) : null,
    el('div', { class: compact ? 'seg compact' : 'seg', role: 'group', 'aria-label': label || undefined },
      options.map((o) => el('button', { type: 'button', 'aria-pressed': String(isOn(o)), class: isOn(o) ? 'on' : '', onclick: () => onPick(o) }, o.label ?? o[1]))));
}

function planeCodesFromSpin(spin, dim) {
  if (spin === 'auto') return autoPlanes(dim).map(([i, j]) => AXES[i] + AXES[j]);
  return spin ? spin.split(',') : [];
}

function controlNode(c) {
  const p = lab[lab.tab];
  switch (c.type) {
    case 'choices':
      return segNode(c.label, c.options, (o) => Object.entries(o.set).every(([k, v]) => p[k] === v), (o) => setParams(o.set), c.compact);
    case 'range':
      return rangeNode(c, p[c.key], (v) => setParams({ [c.key]: v }, false), () => renderInspector());
    case 'select': {
      const id = `insp-${c.key}`;
      return el('div', { class: 'insp-control' }, el('label', { for: id }, c.label),
        el('select', { id, onchange: (e) => setParams({ [c.key]: e.target.value }) },
          c.options.map(([v, l]) => el('option', { value: v, selected: v === p[c.key] }, l))));
    }
    case 'toggle':
      return switchNode(`insp-${c.key}`, c.label, p[c.key] === c.on, (on) => setParams({ [c.key]: on ? c.on : c.off }));
    case 'ui-toggle':
      return switchNode(`insp-${c.ui}`, c.label, Boolean(ui[c.ui]), (on) => setUi({ [c.ui]: on }));
    case 'ui-range':
      return rangeNode(c, ui[c.ui], (v) => setUi({ [c.ui]: v }, { inspector: false }), () => renderInspector());
    case 'ui-choices':
      return segNode(c.label, c.options, (o) => ui[c.ui] === o[0], (o) => setUi({ [c.ui]: o[0] }));
    case 'value-range':
      return rangeNode(c, c.value, (v) => setParams(c.set(v), false), () => renderInspector());
    case 'readout':
      return el('dl', { class: 'readout' }, c.rows.map(([k, v]) => [el('dt', {}, k), el('dd', { class: 'mono' }, v)]));
    case 'note':
      return el('p', { class: 'insp-note' }, c.text);
    case 'buttons':
      return el('div', { class: 'row-buttons insp-control' }, c.buttons.map((b) => el('button', {
        type: 'button', class: 'small',
        onclick: () => {
          if (b.ui) setUi(b.ui);
          if (b.set) setParams(b.set);
          if (b.twin) setParams({ R: Math.min(4, Math.max(0.25, 1 / p.R)), n: p.w, w: p.n });
          renderInspector();
        },
      }, b.label)));
    case 'planes':
      return el('div', { class: 'planes', role: 'group', 'aria-label': 'Rotation planes' }, c.planes.map((pl) => el('button', {
        type: 'button', class: `plane${pl.selected ? ' on' : ''}${pl.spinning ? ' spinning' : ''}`, 'aria-pressed': String(pl.selected),
        title: pl.spinning ? `${pl.code} (spinning)` : pl.code, onclick: () => setUi({ dimPlane: pl.code }),
      }, pl.code)));
    case 'ui-angle':
      return rangeNode({ label: c.label, min: -Math.PI, max: Math.PI, step: 0.01, format: (v) => `${Math.round((v * 180) / Math.PI)}°` }, c.value,
        (v) => setUi({ dimAngles: { ...ui.dimAngles, [c.plane]: v } }, { inspector: false }));
    case 'toggle-plane':
      return switchNode(`insp-spin-${c.plane}`, c.label, c.on, (on) => {
        const codes = new Set(planeCodesFromSpin(p.spin, p.dim));
        if (on) codes.add(c.plane); else codes.delete(c.plane);
        setParams({ spin: [...codes].join(',') });
      });
    case 'mixer':
      return mixerNode(c);
    default:
      return null;
  }
}

/** The harmonics mixer: drag a bar up or down to set its amplitude; click to select it. */
function mixerNode(c) {
  const wrap = el('div', { class: 'mixer', role: 'group', 'aria-label': 'Harmonic amplitudes' });
  c.values.forEach((value, k) => {
    const fill = el('span', { class: 'mixer-fill', style: `height:${value * 100}%` });
    const bar = el('button', {
      type: 'button', class: k === c.selected ? 'mixer-bar on' : 'mixer-bar', 'aria-label': `Harmonic ${k + 1}, amplitude ${value.toFixed(2)}`,
    }, el('span', { class: 'mixer-track' }, fill), el('span', { class: 'mixer-num' }, String(k + 1)));
    const setFrom = (e) => {
      const r = bar.querySelector('.mixer-track').getBoundingClientRect();
      const a = Math.round(Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height)) * 100) / 100;
      fill.style.height = `${a * 100}%`;
      setParams(c.setValue(k, a), false);
      c.values[k] = a;
    };
    bar.addEventListener('pointerdown', (e) => {
      bar.setPointerCapture(e.pointerId);
      if (ui[c.setSelected] !== k) ui = { ...ui, [c.setSelected]: k };
      setFrom(e);
    });
    bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture(e.pointerId)) setFrom(e); });
    bar.addEventListener('pointerup', () => setUi({ [c.setSelected]: k }));
    bar.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const a = Math.max(0, Math.min(1, Math.round((c.values[k] + (e.key === 'ArrowUp' ? 0.05 : -0.05)) * 100) / 100));
        setParams(c.setValue(k, a), false);
        setUi({ [c.setSelected]: k });
      }
    });
    wrap.append(bar);
  });
  return wrap;
}

function renderInspector() {
  if (mode !== 'advanced' || !current) return;
  const view = current.view;
  const p = lab[lab.tab];
  const d = view.displayed?.(p);
  setChildren($('#inspector-head'),
    el('p', { class: 'eyebrow' }, view.labTitle),
    el('h2', {}, d?.title ?? view.title),
    d ? el('div', { class: 'badges' }, d.badges.map((b) => el('span', { class: `badge ${b}` }, BADGES[b][0]))) : null);
  const sections = view.inspector?.(p, ui) ?? [];
  setChildren($('#inspector-body'), sections.map((s) => el('section', { class: 'insp-section' },
    el('h3', { class: 'eyebrow' }, s.title),
    s.controls.map(controlNode))));
}

// ─── Readout (inspector) ─────────────────────────────────────────────────
function renderInfo() {
  if (!current) return;
  const info = current.instance.info(lab[lab.tab], elapsed);
  lastLive = info.live ?? {};
  lastInfoRows = info.rows;
  if (mode === 'simple') return;
  // Same rows as last time? Then only touch the values that changed (no rebuilding, no layout jank).
  const box = $('#info');
  const shape = `${info.rows.map((r) => r[0]).join('|')}#${(info.legend ?? []).map((l) => l.label + l.color).join(',')}#${info.note ?? ''}`;
  const dds = box.querySelectorAll('dd');
  if (shape === infoShape && dds.length === info.rows.length) {
    info.rows.forEach(([, value, status], i) => {
      if (dds[i].textContent !== String(value)) dds[i].textContent = value;
      const cls = status || '';
      if (dds[i].className !== cls) dds[i].className = cls;
    });
    return;
  }
  infoShape = shape;
  const dl = el('dl', { class: 'readout' });
  for (const [label, value, status] of info.rows) dl.append(el('dt', {}, label), el('dd', { class: status || undefined }, value));
  setChildren($('#info'), dl,
    info.legend ? el('div', { class: 'legend' }, info.legend.map((l) => el('span', { style: `--swatch: #${l.color.toString(16).padStart(6, '0')}` }, l.label))) : null,
    info.note ? el('p', { class: 'note' }, info.note) : null);
}

// ─── Dock: maths, graphs, diagnostics ─────────────────────────────
function setDock(name) {
  // A browser may remember a tab that no longer exists (the old AI tutor tab): fall back to maths.
  // "Controls" and "Presets" only exist in the phone sheet; on a big screen they have their own columns.
  if (!document.querySelector(`[data-dock="${name}"]`)) name = 'math';
  if (!phoneLab && (name === 'controls' || name === 'presets')) name = 'math';
  for (const b of document.querySelectorAll('[data-dock]')) b.setAttribute('aria-selected', String(b.dataset.dock === name));
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  if (ui.dock !== name) { ui = { ...ui, dock: name }; writeJSON(UI_KEY, ui); }
  mountGraphs();
  renderDiag();
}
for (const b of document.querySelectorAll('[data-dock]')) b.addEventListener('click', () => setDock(b.dataset.dock));

// ─── Phone lab: the dock becomes a bottom sheet ─────────────────────────
// On a narrow screen in Advanced mode we MOVE the existing panels (not copies) into the
// sheet, and put them back when the screen gets wider. Moving keeps every listener working.
const phoneQuery = matchMedia('(max-width: 760px)');
let phoneLab = false;
const homes = new Map(); // node -> [parent, next sibling] so we can put it back exactly
function moveInto(node, parent, before = null) {
  if (!homes.has(node)) homes.set(node, [node.parentNode, node.nextSibling]);
  parent.insertBefore(node, before);
}
function sendHome(node) {
  const home = homes.get(node);
  if (home) home[0].insertBefore(node, home[1]?.parentNode === home[0] ? home[1] : null);
}
function applyLayout() {
  const next = phoneQuery.matches && mode === 'advanced';
  const changed = next !== phoneLab;
  phoneLab = next;
  document.documentElement.classList.toggle('phone-lab', phoneLab);
  const moving = [
    [$('#inspector'), $('[data-panel="controls"]')],
    [$('#presets-section'), $('[data-panel="presets"]')],
    [$('#saves'), $('[data-panel="presets"]')],
    [$('#transport'), $('.viewport-wrap')],
  ];
  for (const [node, target] of moving) {
    if (phoneLab) moveInto(node, target); else sendHome(node);
  }
  if (!phoneLab) setPickerOpen(false);
  if (changed) setDock(phoneLab ? 'controls' : ui.dock);
  setSheet(ui.sheet ?? 'peek');
}
phoneQuery.addEventListener('change', applyLayout);

function setSheet(state) {
  const dock = $('#dock');
  dock.dataset.sheet = state;
  const handle = $('#sheet-handle');
  handle.setAttribute('aria-expanded', String(state === 'full'));
  handle.setAttribute('aria-label', state === 'full' ? 'Show less' : 'Show more settings');
  if (ui.sheet !== state) { ui = { ...ui, sheet: state }; writeJSON(UI_KEY, ui); }
}
// Tap the handle to toggle; or drag it up or down (40 px is enough to count as a drag).
{
  const handle = $('#sheet-handle');
  let startY = null;
  let dragged = false;
  handle.addEventListener('pointerdown', (e) => { startY = e.clientY; dragged = false; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    if (dy < -40) { setSheet('full'); dragged = true; startY = e.clientY; }
    else if (dy > 40) { setSheet('peek'); dragged = true; startY = e.clientY; }
  });
  const end = () => { startY = null; };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    setSheet($('#dock').dataset.sheet === 'full' ? 'peek' : 'full');
  });
}

// Typesetting formulas is the most expensive thing on the page, so we only redo the ones
// whose text actually changed, and (while animating) wait for an idle moment between frames.
let mathTab = '';
let mathItems = [];
let mathTimer = 0;
let mathVersion = 0;
function mathArticle(item, i) {
  return el('article', { class: 'math-item' },
    el('h3', {}, el('span', { class: 'math-num' }, String(i + 1)), item.title),
    mathNode(item.tex),
    el('p', {}, item.text));
}
function renderMath(force) {
  if (mode === 'simple') { mathTab = ''; return; }
  const now = performance.now();
  if (!force && now - mathTimer < 1500) return; // live numbers: refresh at a calm pace
  mathTimer = now;
  const items = formulas(lab.tab, lab[lab.tab], lastLive);
  const list = $('#math-list');
  const version = ++mathVersion;
  if (mathTab !== lab.tab || items.length !== mathItems.length || list.children.length !== items.length) {
    mathTab = lab.tab;
    mathItems = items;
    setChildren(list, items.map(mathArticle));
    return;
  }
  const changed = [];
  items.forEach((it, i) => {
    const old = mathItems[i];
    if (it.tex !== old.tex || it.text !== old.text || it.title !== old.title) changed.push(i);
  });
  if (!changed.length) return;
  mathItems = items;
  const apply = () => {
    if (version !== mathVersion) return; // a newer update already replaced these
    for (const i of changed) list.children[i]?.replaceWith(mathArticle(items[i], i));
  };
  if (force || !window.requestIdleCallback) apply();
  else window.requestIdleCallback(apply, { timeout: 600 });
}

function mountGraphs() {
  const graphs = current?.instance.graphs;
  const box = $('#graphs');
  if (!graphs) { box.replaceChildren(el('p', { class: 'muted' }, 'No graphs for this module.')); return; }
  if (box.firstChild !== graphs.el) box.replaceChildren(graphs.el);
  if (mode === 'advanced' && ui.dock === 'graphs') requestAnimationFrame(() => graphs.render(lab[lab.tab], elapsed, lastLive));
}

let fps = 0;
function renderDiag() {
  if (mode !== 'advanced' || ui.dock !== 'diag' || !current) return;
  const s = stage.stats();
  const canvas = $('#viewport canvas');
  const rows = [
    ['Frame rate', `${fps.toFixed(0)} fps`],
    ['Frame time', fps ? `${(1000 / fps).toFixed(1)} ms` : '—'],
    ['Draw calls per frame', String(s.calls)],
    ['Triangles drawn', s.triangles.toLocaleString()],
    ['Line segments drawn', s.lines.toLocaleString()],
    ['Points drawn', s.points.toLocaleString()],
    ['Canvas', `${canvas.width} × ${canvas.height} px`],
    ['Render scale (adaptive)', `${s.pixelRatio.toFixed(2)}× (range ${stage.pixelRatioRange.min}–${stage.pixelRatioRange.max})`],
    ['3D view', viewportVisible ? 'on screen, drawing' : 'off screen, paused'],
    ['Simulation time', `${elapsed.toFixed(2)} s`],
  ];
  setChildren($('#diag'), el('div', { class: 'diag-grid' },
    el('section', {}, el('h3', { class: 'eyebrow' }, 'Rendering'), el('dl', { class: 'readout' }, rows.map(([k, v]) => [el('dt', {}, k), el('dd', { class: 'mono' }, v)]))),
    el('section', {}, el('h3', { class: 'eyebrow' }, 'Physics checks'), el('dl', { class: 'readout' }, lastInfoRows.map(([k, v, st]) => [el('dt', {}, k), el('dd', { class: st || undefined }, v)])))));
}

// ─── Animation loop: runs about 60 times a second ─────────────────────────
let last = performance.now();
let infoTimer = 0;
let graphTimer = 0;
let diagTimer = 0;
let frames = 0;
let fpsTimer = 0;

// Pause all drawing while the 3D view is scrolled out of sight (saves battery, keeps the page responsive).
let viewportVisible = true;
new IntersectionObserver(([entry]) => { viewportVisible = entry.isIntersecting; }).observe($('#viewport'));

// Adaptive quality: if frames get slow, render at a slightly lower resolution; when there is
// headroom again, go back up. Small steps, and only after a few checks in a row, so it never flickers.
let slowChecks = 0;
let fastChecks = 0;
function adaptQuality() {
  const r = stage.pixelRatio();
  if (fps < 45) {
    fastChecks = 0;
    if (++slowChecks >= 2) { slowChecks = 0; stage.setPixelRatio(r - 0.25); }
  } else if (fps > 57) {
    slowChecks = 0;
    if (++fastChecks >= 8) { fastChecks = 0; stage.setPixelRatio(r + 0.25); }
  } else {
    slowChecks = 0;
    fastChecks = 0;
  }
}

function tick(now) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt); // cap, so a long pause doesn't make the animation jump
  last = now;
  if (!viewportVisible || document.hidden) { requestAnimationFrame(tick); return; }
  const params = lab[lab.tab];
  const step = playing ? dt * (params.speed ?? 1) : 0;
  elapsed += step;
  current.instance.update(params, elapsed, step);
  stage.render(dt);
  frames++;
  fpsTimer += realDt; // measure with real time, not the capped dt
  if (fpsTimer >= 0.5) { fps = frames / fpsTimer; frames = 0; fpsTimer = 0; adaptQuality(); }
  infoTimer += dt;
  if (infoTimer > 0.4 && playing) { infoTimer = 0; renderInfo(); renderMath(false); }
  if (mode === 'advanced') {
    $('#clock').textContent = `t = ${elapsed.toFixed(1)} s`;
    graphTimer += dt;
    if (ui.dock === 'graphs' && graphTimer > 0.1 && current.instance.graphs) { graphTimer = 0; current.instance.graphs.render(params, elapsed, lastLive); }
    diagTimer += dt;
    if (diagTimer > 0.5) { diagTimer = 0; renderDiag(); }
  }
  requestAnimationFrame(tick);
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); return; }
  if (mode !== 'advanced') return;
  const map = { g: 'grid', a: 'axes', r: 'autoRotate', b: 'bloom' };
  const key = map[e.key.toLowerCase()];
  if (key) setUi({ [key]: !ui[key] }, { inspector: false });
});

// ─── The guided tour (Simple mode) ────────────────────────────────────────
function goToStep(index) {
  tour.index = Math.max(0, Math.min(STEPS.length - 1, index));
  const step = STEPS[tour.index];
  saveTour();
  // Steps without a picture of their own show the nearest earlier step's picture, so the
  // screen always matches the words, whether you arrive by Next, Back or a stop button.
  let j = tour.index;
  while (j > 0 && !STEPS[j].state) j--;
  if (STEPS[j].state) applyLab(applyStep(lab, STEPS[j]));
  startCycle(step);
  renderTour();
}

// Some steps show a few variations by themselves (a string playing note 1, 2, 3…),
// so nobody has to find the right button: the picture does the demonstrating.
let cycleTimer = 0;
function stopCycle() { clearInterval(cycleTimer); cycleTimer = 0; }
function startCycle(step) {
  stopCycle();
  if (!step.cycle) return;
  let i = 0;
  applyLab(applyStep(lab, { state: step.cycle[0] }));
  cycleTimer = setInterval(() => {
    if (document.hidden) return; // don't change things nobody can see
    i = (i + 1) % step.cycle.length;
    applyLab(applyStep(lab, { state: step.cycle[i] }));
  }, step.cycleMs ?? 2800);
}

function renderTour() {
  if (mode !== 'simple') return;
  renderTabs(); // keep the highlighted stop in step with the tour
  const box = $('#tour');
  const view = VIEWS[lab.tab];
  if (!tour.open) {
    stopCycle();
    box.className = 'tour closed';
    setChildren(box,
      el('h2', {}, view.title),
      el('p', { class: 'intro' }, view.intro),
      el('button', { type: 'button', class: 'primary', onclick: () => { tour.open = true; saveTour(); goToStep(tour.index); } },
        tour.index > 0 ? 'Resume the guided tour' : 'Start the guided tour'));
    return;
  }
  const step = STEPS[tour.index];
  const chapter = step.chapter;
  const isLast = tour.index === STEPS.length - 1;
  const nextIsNewChapter = !isLast && STEPS[tour.index + 1].chapterIndex !== step.chapterIndex;
  box.className = `tour${step.takeaway ? ' takeaway' : ''}`;
  setChildren(box,
    el('div', { class: 'tour-head' },
      el('span', { class: 'tour-label' }, `Stop ${step.chapterIndex + 1} of ${TOUR.length}`),
      el('button', { type: 'button', class: 'ghost small', 'aria-label': 'Close the tour and explore freely', onclick: () => { tour.open = false; saveTour(); renderTour(); } }, 'Skip the tour')),
    el('p', { class: 'tour-chapter' }, chapter.title),
    el('h2', {}, step.title),
    step.body.map((para) => el('p', {}, para)),
    step.try ? el('p', { class: 'tour-try' }, el('strong', {}, 'Try this: '), step.try) : null,
    el('div', { class: 'tour-progress', 'aria-hidden': 'true' },
      chapter.steps.map((_, i) => el('span', { class: i === step.stepIndex ? 'on' : i < step.stepIndex ? 'done' : '' }))),
    el('div', { class: 'row-buttons tour-nav' },
      el('button', { type: 'button', disabled: tour.index === 0, onclick: () => goToStep(tour.index - 1) }, '← Back'),
      el('button', { type: 'button', class: 'primary', onclick: () => {
        if (isLast) { tour.open = false; tour.index = 0; saveTour(); renderTour(); } else goToStep(tour.index + 1);
      } }, isLast ? 'Finish' : nextIsNewChapter ? 'Next stop →' : 'Next →')));
}

// ─── Saved setups (kept in this browser) ──────────────────────────────────
// localStorage can be blocked (private windows), so reading never throws here.
const browserStorage = {
  getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
  setItem(key, value) { localStorage.setItem(key, value); },
};
const saveStore = createSaveStore(browserStorage, validateLabState);

function renderSaves() {
  const box = $('#saves');
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });
  const title = el('input', { type: 'text', id: 'save-title', maxlength: 80, placeholder: 'e.g. Self-dual circle' });
  const list = el('ul', { class: 'save-list' });
  const say = (cls, text) => { status.className = cls; status.textContent = text; };

  function drawList() {
    const saves = saveStore.list();
    if (!saves.length) { list.replaceChildren(el('li', { class: 'muted' }, 'Nothing saved yet.')); return; }
    setChildren(list, saves.map((s) => el('li', {},
      el('button', { type: 'button', class: 'small', title: `Load "${s.title}"`, onclick: () => {
        applyLab(s.state);
        say('success', `Loaded "${s.title}".`);
      } }, s.title),
      el('button', { type: 'button', class: 'danger small', 'aria-label': `Delete "${s.title}"`, onclick: () => {
        if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
        saveStore.remove(s.id);
        drawList();
      } }, 'Delete'))));
  }

  setChildren(box,
    el('h3', { class: 'eyebrow' }, 'Saved setups'),
    el('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      try {
        const item = saveStore.add(title.value.trim() || `${VIEWS[lab.tab].labTitle} setup`, lab);
        title.value = '';
        say('success', `Saved "${item.title}".`);
        drawList();
      } catch (err) { say('error', err.message); }
    } },
    el('label', { for: 'save-title', class: 'muted' }, 'Save all four modules as…'),
    el('div', { class: 'row-buttons' }, title, el('button', { type: 'submit', class: 'primary small' }, 'Save'))),
    status,
    list,
    el('p', { class: 'insp-note' }, 'Saved in this browser only. Nothing is sent anywhere.'));
  drawList();
}

// ─── Welcome screen (before the tour) ─────────────────────────────────────
// Shown on a first visit. The dancing string loop plays behind it. "Start the tour"
// begins at stop 1; "Explore the lab" opens Advanced mode. Tapping "String Lab" in the
// header brings it back.
const WELCOME_KEY = 'string-lab:welcomed';
const welcomed = () => { try { return localStorage.getItem(WELCOME_KEY) === 'yes'; } catch { return false; } };

function showWelcome() {
  if (mode !== 'simple') setMode('simple');
  stopCycle();
  applyLab(applyStep(lab, { state: WELCOME_PICTURE }));
  $('#welcome').hidden = false;
  renderTabs(); // no stop is lit until the tour starts
  // On a phone or small tablet the card covers the lower half: pan the view so the string shows above it.
  if (matchMedia('(max-width: 980px)').matches) {
    // Move the centre of the picture to the middle of the part the card leaves uncovered.
    const vp = $('#viewport').getBoundingClientRect();
    const covered = Math.max(0, vp.bottom - $('.welcome-card').getBoundingClientRect().top);
    const { camera, controls } = stage;
    const worldPerPixel = (2 * camera.position.distanceTo(controls.target) * Math.tan((camera.fov * Math.PI) / 360)) / vp.height;
    const shift = (covered / 2) * worldPerPixel;
    controls.target.y -= shift;
    camera.position.y -= shift;
  }
  $('#welcome-start').focus();
}
function closeWelcome() {
  $('#welcome').hidden = true;
  stage.resetCamera();
  try { localStorage.setItem(WELCOME_KEY, 'yes'); } catch { /* private window: show it again next time */ }
}
$('#welcome-start').addEventListener('click', () => {
  closeWelcome();
  tour.open = true;
  goToStep(0);
});
$('#welcome-lab').addEventListener('click', () => {
  closeWelcome();
  setMode('advanced');
});
$('#welcome').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#welcome-start').click(); return; }
  if (e.key !== 'Tab') return; // keep keyboard focus inside the welcome card
  const first = $('#welcome-start');
  const last = $('#welcome-lab');
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
{
  const brand = document.querySelector('.brand');
  brand.classList.add('reopen');
  brand.setAttribute('role', 'button');
  brand.setAttribute('tabindex', '0');
  brand.setAttribute('aria-label', 'String Lab: show the welcome screen');
  brand.addEventListener('click', showWelcome);
  brand.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showWelcome(); } });
}

// ─── Start ────────────────────────────────────────────────────────────────
// A handle for poking at the app from the browser's developer console.
window.stringLab = { get lab() { return lab; }, get view() { return current; }, stage, setMode, setUi, showWelcome };

layoutReady = true;
applyMode();
setDock(phoneLab ? 'controls' : ui.dock);
showTab(lab.tab);
if (mode === 'simple' && !welcomed()) showWelcome();
// Returning in the middle of the tour: show that step's picture, not the last one on screen.
else if (mode === 'simple' && tour.open) goToStep(tour.index);
requestAnimationFrame(tick);
renderSaves();
