// t-5: central parameter store — 21 HUD params, quality tiers, 4 view
// presets (buttons + Shift+1-4), debug views 0-9. Identity defaults keep
// the t-4 look; main.js applies them live, hud.js edits them.
// touch: OrbitControls one-finger rotate / two-finger dolly on mobile.
export const STORE_KEY = 'gargantua.v1';
export const DEFAULTS = {
  mass: 1.0, innerRadius: 6.0, outerRadius: 24.0,
  thickness: 0.7, density: 1.0, temperature: 1.15, turbulence: 1.0,
  flowSpeed: 1.0, doppler: 1.0, gravRedshift: 1.0,
  exposure: 1.0, bloomStrength: 0.6, bloomRadius: 0.4, bloomThreshold: 0.82,
  vignette: 0.32, grain: 0.045, aberration: 0.0016,
  marchSteps: 160, fov: 55, timeScale: 1.0, starDensity: 1.0,
};
export const PARAM_NAMES = Object.keys(DEFAULTS);
export const RANGES = {
  mass: [0.2, 3], innerRadius: [2, 12], outerRadius: [10, 40],
  thickness: [0.2, 2.5], density: [0, 3], temperature: [0.2, 2.5],
  turbulence: [0, 1.5], flowSpeed: [0, 2], doppler: [0, 1.5],
  gravRedshift: [0, 1], exposure: [0.2, 2.5], bloomStrength: [0, 2],
  bloomRadius: [0, 1], bloomThreshold: [0.5, 1.2], vignette: [0, 0.8],
  grain: [0, 0.15], aberration: [0, 0.006], marchSteps: [32, 256],
  fov: [20, 90], timeScale: [0, 3], starDensity: [0, 2.5],
};
export const QUALITY = {
  Standard: { dpr: 1, marchSteps: 96, bloom: true },
  High: { dpr: 1.5, marchSteps: 160, bloom: true },
  Cinematic: { dpr: 2, marchSteps: 224, bloom: true },
};
export const QUALITY_NAMES = Object.keys(QUALITY);
export const PRESETS = [
  { name: 'Edge-On', pos: [0, 0.7, 13.5] },
  { name: 'Top-Down', pos: [0.01, 15, 0.01] },
  { name: 'ISCO', pos: [-4.5, 1.4, 6.8] },
  { name: 'Cinematic', pos: [7.5, 4.2, 10.5], cinematic: true },
];
export const VIEWS = ['Composite', 'Bend', 'Capture', 'Ring', 'Density',
  'Temperature', 'Doppler', 'Redshift', 'Sky', 'Absorbed'];
const _mem = {};
function backend() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* private-mode fallback below */ }
  return {
    getItem: (k) => (_mem[k] !== undefined ? _mem[k] : null),
    setItem: (k, v) => { _mem[k] = String(v); },
    removeItem: (k) => { delete _mem[k]; },
  };
}
export function load() {
  try {
    const raw = backend().getItem(STORE_KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw);
    const p = { ...DEFAULTS };
    for (const k of PARAM_NAMES) {
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        const r = RANGES[k];
        p[k] = r ? Math.min(r[1], Math.max(r[0], v)) : v;
      }
    }
    return p;
  } catch { return { ...DEFAULTS }; }
}
export function save(p) {
  try {
    const o = {};
    for (const k of PARAM_NAMES) o[k] = p[k];
    backend().setItem(STORE_KEY, JSON.stringify(o));
  } catch { /* storage unavailable: session-only */ }
}
