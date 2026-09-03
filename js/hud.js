// t-5: custom HUD panel — 21 sliders, 4 view presets, quality tiers,
// 10 debug views (buttons + keyboard shortcuts 0-9). No vendor widgets.
import { PARAM_NAMES, QUALITY_NAMES, PRESETS, VIEWS, RANGES } from './params.js';

const STEPS = {
  mass: 0.01, innerRadius: 0.1, outerRadius: 0.5,
  thickness: 0.01, density: 0.01, temperature: 0.01,
  turbulence: 0.01, flowSpeed: 0.01, doppler: 0.01,
  gravRedshift: 0.01, exposure: 0.01, bloomStrength: 0.01,
  bloomRadius: 0.01, bloomThreshold: 0.01, vignette: 0.01,
  grain: 0.001, aberration: 0.0001, marchSteps: 1,
  fov: 1, timeScale: 0.01, starDensity: 0.01,
};

export function createHUD(api) {
  const root = document.getElementById('hud');
  root.hidden = false;
  const narrow = window.innerWidth < 700;
  if (narrow) root.hidden = true;
  const toggle = document.createElement('button');
  toggle.id = 'hudToggle';
  toggle.type = 'button';
  toggle.textContent = '\u2630';
  toggle.title = 'show/hide parameters';
  toggle.style.cssText = 'display:none;position:fixed;top:10px;right:10px;z-index:11;background:#0a0e16;color:#cfd6e4;border:1px solid #2a3348;border-radius:8px;padding:6px 10px;font:14px system-ui,sans-serif;cursor:pointer;';
  toggle.addEventListener('click', () => {
    root.hidden = !root.hidden;
    const t = document.getElementById('title');
    if (t && window.innerWidth < 700) t.hidden = root.hidden;
  });
  document.body.appendChild(toggle);
  root.style.cssText = 'top:10px;right:10px;width:232px;max-height:92vh;overflow:auto;background:rgba(8,10,16,.82);color:#cfd6e4;font:12px/1.4 system-ui,sans-serif;padding:10px 12px;border:1px solid #2a3348;border-radius:10px;';
  const el = (tag, text, parent) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; (parent || root).appendChild(n); return n; };
  const head = el('div', 'GARGANTUA params (H hides)');
  head.style.cssText = 'font-weight:700;margin-bottom:6px;';
  const vals = {};
  for (const key of PARAM_NAMES) {
    const rg = RANGES[key];
    const row = el('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0;';
    const lab = el('label', key, row); lab.style.cssText = 'flex:0 0 90px;opacity:.85;';
    const inp = el('input', undefined, row);
    inp.type = 'range'; inp.min = rg[0]; inp.max = rg[1]; inp.step = STEPS[key]; inp.value = api.get(key);
    inp.style.cssText = 'flex:1;';
    const val = el('span', String(api.get(key)), row); val.style.cssText = 'flex:0 0 46px;text-align:right;';
    vals[key] = { inp, val };
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); val.textContent = inp.value; api.onParam(key, v); });
  }
  const row2 = (title, items, fn) => {
    const t = el('div', title); t.style.cssText = 'margin:8px 0 3px;font-weight:700;';
    const box = el('div'); box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    const btns = [];
    items.forEach((name, i) => { const b = el('button', name, box); b.addEventListener('click', () => fn(i)); btns.push(b); });
    return btns;
  };
  row2('view presets (Shift+1-4)', PRESETS.map((p) => p.name), (i) => api.onPreset(i));
  row2('quality (T cycles)', QUALITY_NAMES, (i) => api.onTier(i));
  const viewBtns = row2('debug views (0-9)', VIEWS, (i) => { api.onDebug(i); markView(i); });
  function markView(i) { viewBtns.forEach((b, j) => { b.style.border = j === i ? '2px solid #7fd4ff' : ''; }); }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') { root.hidden = !root.hidden; const t = document.getElementById('title'); if (t) t.hidden = !t.hidden; return; }
    if (/^Digit[0-9]$/.test(e.code)) {
      const n = Number(e.code.slice(5));
      if (e.shiftKey && n >= 1 && n <= 4) { api.onPreset(n - 1); return; }
      api.onDebug(n); markView(n); return;
    }
    if (e.code === 'KeyC') api.onCruise();
    else if (e.code === 'KeyT') api.onTierNext();
    else if (e.code === 'KeyR') api.onReset();
  });
  const help = el('div', 'keys: 0-9 debug views, Shift+1-4 presets, C cruise, T tier, R reset params, H hide');
  help.style.cssText = 'margin-top:8px;opacity:.7;';
  return { refresh(p) { for (const k of PARAM_NAMES) { vals[k].inp.value = p[k]; vals[k].val.textContent = String(p[k]); } markView(0); } };
}
