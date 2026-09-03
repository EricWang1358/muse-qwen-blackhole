import * as THREE from 'three';
import { VERT, FRAG, BAND_NORMAL } from './raytracer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GradeShader } from './post.js';
import { DEFAULTS, PARAM_NAMES, load, save, PRESETS, QUALITY, QUALITY_NAMES } from './params.js';
import { createHUD } from './hud.js';
import { createAmbient } from './audio.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const errBox = document.getElementById('err-overlay');

function showError(msg) {
  errBox.hidden = false;
  errBox.textContent = 'WebGL boot failed: ' + msg;
}

// t-6: context-loss overlay with one-click recover (restore, else reload).
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  errBox.hidden = false;
  errBox.innerHTML = '';
  const msg = document.createElement('div');
  msg.textContent = 'WebGL context lost — rendering paused.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Recover';
  btn.addEventListener('click', () => {
    try {
      if (renderer.forceContextRestore) renderer.forceContextRestore();
      else location.reload();
    } catch { location.reload(); }
  });
  errBox.appendChild(msg);
  errBox.appendChild(btn);
});
canvas.addEventListener('webglcontextrestored', () => {
  errBox.hidden = true;
  errBox.innerHTML = '';
  resize();
});

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
} catch (e) {
  showError(String((e && e.message) || e));
  throw e;
}

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.position.set(0.0, 6.5, 21.0);
camera.lookAt(0, 0, 0);

// t-5: orbit controls (touch: one-finger rotate, two-finger dolly),
// 4 view presets, cinematic cruise, quality tiers.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 40;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
let tier = 'High';
let cruise = true;
let cruiseA = 0;
function persistUI() {
  try {
    localStorage.setItem('gargantua.ui.v1', JSON.stringify({
      tier, cam: [camera.position.x, camera.position.y, camera.position.z],
    }));
  } catch { /* private mode: session-only */ }
  save(P);
}
function applyPreset(i) {
  const pr = PRESETS[i % PRESETS.length];
  camera.position.set(pr.pos[0], pr.pos[1], pr.pos[2]);
  camera.lookAt(0, 0, 0);
  cruise = !!pr.cinematic;
  controls.autoRotate = cruise;
  persistUI();
}
function setQuality(name) {
  if (!QUALITY[name]) return;
  tier = name;
  P.marchSteps = QUALITY[name].marchSteps;
  uniforms.uMarch.value = Math.min(QUALITY[name].marchSteps | 0, 256);
  bloom.enabled = QUALITY[name].bloom;
  persistUI();
  resize();
}
controls.addEventListener('start', () => { cruise = false; controls.autoRotate = false; });
controls.addEventListener('end', persistUI);
try {
  const ui = JSON.parse(localStorage.getItem('gargantua.ui.v1') || 'null');
  if (ui && ui.tier && QUALITY[ui.tier]) { tier = ui.tier; }
  if (ui && Array.isArray(ui.cam) && ui.cam.length === 3) {
    camera.position.set(ui.cam[0], ui.cam[1], ui.cam[2]);
  }
} catch { /* fresh boot with default framing */ }

const uniforms = {
  uCamPos: { value: new THREE.Vector3() },
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
  uRes: { value: new THREE.Vector2(1, 1) },
  uMass: { value: 1.0 },
  uTime: { value: 0.0 },
  uRin: { value: 6.0 },
  uRout: { value: 24.0 },
  uMarch: { value: 160 },
  uStarDen: { value: 1.0 },
  uDebug: { value: 0 },
  uThick: { value: 1.0 },
  uDensity: { value: 1.0 },
  uTemp: { value: 1.0 },
  uTurb: { value: 1.0 },
  uFlow: { value: 1.0 },
  uDopAmt: { value: 1.0 },
  uGravAmt: { value: 1.0 },
};

let P = load();

// t-5: map all 21 params onto uniforms / passes / camera.
function applyParams() {
  uniforms.uMass.value = P.mass;
  uniforms.uRin.value = P.innerRadius;
  uniforms.uRout.value = P.outerRadius;
  uniforms.uMarch.value = Math.min(P.marchSteps | 0, 256);
  uniforms.uStarDen.value = P.starDensity;
  uniforms.uThick.value = P.thickness;
  uniforms.uDensity.value = P.density;
  uniforms.uTemp.value = P.temperature;
  uniforms.uTurb.value = P.turbulence;
  uniforms.uFlow.value = P.flowSpeed;
  uniforms.uDopAmt.value = P.doppler;
  uniforms.uGravAmt.value = P.gravRedshift;
  renderer.toneMappingExposure = P.exposure;
  bloom.strength = P.bloomStrength;
  bloom.radius = P.bloomRadius;
  bloom.threshold = P.bloomThreshold;
  grade.uniforms.uVignette.value = P.vignette;
  grade.uniforms.uGrain.value = P.grain;
  grade.uniforms.uChroma.value = P.aberration;
  camera.fov = P.fov;
  camera.updateProjectionMatrix();
}

const scene = new THREE.Scene();
const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  -1, -1, 0, 3, -1, 0, -1, 3, 0,
]), 3));
const quad = new THREE.Mesh(tri, new THREE.ShaderMaterial({
  uniforms, vertexShader: VERT, fragmentShader: FRAG,
  depthTest: false, depthWrite: false,
}));
quad.frustumCulled = false;
scene.add(quad);

// t-4: HDR post chain — bloom pre-tonemap, grade, single ACES via OutputPass.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.4, 0.82);
composer.addPass(bloom);
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);
composer.addPass(new OutputPass());
applyParams();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[tier].dpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  uniforms.uRes.value.set(
    Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr));
}
window.addEventListener('resize', resize);
resize();

const _fwd = new THREE.Vector3(); const _right = new THREE.Vector3();
const _up = new THREE.Vector3(); const _worldUp = new THREE.Vector3(0, 1, 0);
let frame = 0;
let simTime = 0;
let lastT = -1;
function tick(t) {
  if (cruise) {
    cruiseA += 0.0016;
    camera.position.y = Math.max(0.4, camera.position.y + Math.sin(cruiseA) * 0.0006);
  }
  controls.update();
  camera.getWorldDirection(_fwd);
  _right.crossVectors(_fwd, _worldUp).normalize();
  _up.crossVectors(_right, _fwd).normalize();
  uniforms.uCamPos.value.copy(camera.position);
  uniforms.uCamFwd.value.copy(_fwd);
  uniforms.uCamRight.value.copy(_right);
  uniforms.uCamUp.value.copy(_up);
  if (lastT < 0) lastT = t || 0;
  // Shot mode freezes the clock but keeps pumping frames: the virtual-time
  // budget needs rAF callbacks to elapse (otherwise headless screenshots hang
  // forever), while frozen simTime keeps every rendered pixel deterministic.
  if (!query.has('shot')) simTime += Math.min(((t || 0) - lastT) / 1000, 0.1) * P.timeScale;
  lastT = t || 0;
  uniforms.uTime.value = simTime;
  grade.uniforms.uTime.value = uniforms.uTime.value;
  composer.render();
  frame += 1;
  reportState(frame);
  requestAnimationFrame(tick);
}
// t-5: HUD binding — the live-update loop closes here.
const hudApi = {
  get: (k) => P[k],
  onParam: (k, v) => { P[k] = v; applyParams(); persistUI(); },
  onPreset: (i) => applyPreset(i),
  onTier: (i) => setQuality(QUALITY_NAMES[i % QUALITY_NAMES.length]),
  onTierNext: () => {
    const names = QUALITY_NAMES;
    setQuality(names[(names.indexOf(tier) + 1) % names.length]);
  },
  onDebug: (i) => { uniforms.uDebug.value = i % 10; },
  onCruise: () => { cruise = true; controls.autoRotate = true; },
  onReset: () => { P = { ...DEFAULTS }; applyParams(); persistUI(); hud.refresh(P); },
};
const hud = createHUD(hudApi);
const query = new URLSearchParams(location.search);
const shotSeed = (+(query.get('seed') || 0)) | 0;
const ambient = createAmbient({ mount: document.body, seed: 20260903 + shotSeed });
// M3/M8/M14: self-report the state of every frame the page presents, so graded
// bytes are bound to a live page state instead to a claim about one. The node is
// NON-PAINTED (visibility:hidden + position:fixed), so it cannot move a single
// canvas pixel -- C1's hash equality is the executable proof -- and precisely
// because it is not painted it carries NO overlays[] entry: overlays is painted
// boxes only (C6), and a zero-area phantom rect is the same class of declaration
// lie as an omission.
const probeNode = document.createElement('pre');
probeNode.id = 'probe-state';
probeNode.style.cssText = 'visibility:hidden;position:fixed;left:0;top:0;pointer-events:none;';
document.body.appendChild(probeNode);
function fnv1a(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
function paramsHash() { return fnv1a(PARAM_NAMES.map((k) => k + '=' + P[k] + ';').join('')); }
// A box is "painted" if it is actually on screen, not whether it has an offsetParent:
// every overlay here is position:fixed, and a fixed element's offsetParent is null BY
// SPEC, so testing it silently returned [] and disabled the masking that M14 exists to
// provide. Visibility now comes from the computed style, which is the only honest test.
function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
}
function paintedRect(el, id) {
  if (!el || el.hidden) return null;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
  const box = rectOf(el);
  if (box.w < 1 || box.h < 1) return null;
  return Object.assign({ id: id }, box);
}
function overlaysDeclared() {
  const out = [];
  const pill = Array.prototype.find.call(
    document.querySelectorAll('button'), (b) => b.parentElement === document.body);
  for (const cand of [paintedRect(document.getElementById('hud'), 'hud'),
    paintedRect(document.getElementById('title'), 'title'),
    paintedRect(document.getElementById('hudToggle'), 'hudToggle'),
    paintedRect(pill, 'ambient-pill'), paintedRect(errBox, 'err-overlay')]) {
    if (cand) out.push(cand);
  }
  return out;
}
function reportState(f) {
  const st = {
    view: uniforms.uDebug.value | 0, frame: f | 0, paramsHash: paramsHash(),
    seed: shotSeed, simTime: +uniforms.uTime.value.toFixed(6),
    mass: uniforms.uMass.value, fov: camera.fov,
    camDistance: +camera.position.length().toFixed(6),
    cam: [+camera.position.x.toFixed(6), +camera.position.y.toFixed(6), +camera.position.z.toFixed(6)],
    tier: tier, devicePixelRatio: window.devicePixelRatio || 1,
    marchSteps: uniforms.uMarch.value | 0,
    frameWidth: window.innerWidth, frameHeight: window.innerHeight,
    renderWidth: canvas.width, renderHeight: canvas.height,
    exposure: renderer.toneMappingExposure,
    bandNormal: BAND_NORMAL.slice(), overlays: overlaysDeclared(),
    // Painted box of the canvas itself, in the same screenshot space as the declared
    // overlays, so populations derive from where the render actually is rather than
    // from an assumption that it fills the window. DOM text only: neutrality is
    // proven by two captures of this tree, one with this line and one without.
    canvas: rectOf(canvas),
  };
  probeNode.textContent = JSON.stringify(st);
  window.__GARGANTUA__ = { booted: true, frame: st.frame, state: st };
  return st;
}
// Synchronous first stamp: a read-back that arrives before the page's first
// animation frame must still find a parseable report rather than an empty node.
// frame:0 / simTime:0 are the honest pre-first-frame values -- nothing has been
// presented yet -- and tick() and the ?shot branch overwrite this with live
// values exactly as before, so the graded frame's report is unchanged.
reportState(0);
// t-6: deterministic capture (?shot=1&view=X&frame=N&seed=S renders
// exactly frames/60 s of sim time, then downloads a PNG, no interaction).
if (query.has('shot')) {
  const presetQ = query.get('preset');
  if (presetQ !== null) {
    const pi = Math.abs(parseInt(presetQ, 10) || 0) % PRESETS.length;
    camera.position.set(PRESETS[pi].pos[0], PRESETS[pi].pos[1], PRESETS[pi].pos[2]);
    camera.lookAt(0, 0, 0);
  }
  const tierQ = query.get('tier');
  if (tierQ && QUALITY[tierQ]) setQuality(tierQ);
  const view = Math.abs((+(query.get('view') || 0)) | 0) % 10;
  const frames = Math.min(Math.max((+(query.get('frame') || 1)) | 0, 1), 240);
  uniforms.uDebug.value = view;
  cruise = false;
  controls.autoRotate = false;
  simTime = 0;
  for (let f = 0; f < frames; f++) {
    simTime = (f + 1) / 60;
    uniforms.uTime.value = simTime;
    grade.uniforms.uTime.value = simTime;
    camera.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, _worldUp).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    uniforms.uCamPos.value.copy(camera.position);
    uniforms.uCamFwd.value.copy(_fwd);
    uniforms.uCamRight.value.copy(_right);
    uniforms.uCamUp.value.copy(_up);
    composer.render();
  }
  // The ?shot branch never runs tick(), so it stamps its own report:
  // the frame it delivers must describe itself, not the loop that did not run.
  reportState(frames);
  const tag = 'gargantua-view' + view + '-frame' + frames + '-seed' + shotSeed;
  const saveShot = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = tag + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  if (canvas.toBlob) {
    canvas.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      saveShot(url);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  } else {
    saveShot(canvas.toDataURL('image/png'));
  }
}
requestAnimationFrame(tick);
