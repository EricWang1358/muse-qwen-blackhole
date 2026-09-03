// t-6: procedural ambient — detuned drone + filtered noise wash,
// mulberry32 seeded, zero assets or fetches. Starts only on a user
// gesture (button click), never autoplay; mute persisted in localStorage.
export const MUTE_KEY = 'gargantua.mute';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAmbient(opts) {
  const seed = (opts && opts.seed) || 1337;
  const rnd = mulberry32(seed);
  const detune = [(rnd() - 0.5) * 8, (rnd() - 0.5) * 8, (rnd() - 0.5) * 8];
  const state = {
    on: false,
    ctx: null, master: null,
    muted: false,
    detune, seed,
  };
  try {
    state.muted = backend().getItem(MUTE_KEY) === '1';
  } catch { state.muted = false; }
  function backend() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch { /* fall through */ }
    return { getItem: () => null, setItem: () => {} };
  }
  function buildGraph() {
    const AC = state.ctx;
    state.master = AC.createGain();
    state.master.gain.value = state.muted ? 0 : 1;
    state.master.connect(AC.destination);
    const droneG = AC.createGain(); droneG.gain.value = 0.05; droneG.connect(state.master);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.connect(droneG);
    [[55, 'sine'], [82.5, 'triangle'], [110.3, 'sine']].forEach(([f, ty], i) => {
      const o = AC.createOscillator(); o.type = ty; o.frequency.value = f; o.detune.value = detune[i];
      o.connect(lp); o.start();
    });
    const len = 2 * AC.sampleRate;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const noise = AC.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
    const ng = AC.createGain(); ng.gain.value = 0.016;
    noise.connect(bp); bp.connect(ng); ng.connect(state.master); noise.start();
  }
  function label() { return state.on ? (state.muted ? 'mute' : 'playing') : 'ambient: off'; }
  const api = {
    state,
    toggle() {
      // User gesture entry: create/resume the context only here.
      if (typeof AudioContext === 'undefined') { state.on = !state.on; paint(); return state.on; }
      if (!state.ctx) {
        const AC = AudioContext;
        state.ctx = new AC();
        buildGraph();
      }
      if (state.ctx.state === 'suspended') state.ctx.resume();
      state.on = !state.on;
      if (state.master) state.master.gain.value = (state.on && !state.muted) ? 1 : 0;
      paint(); return state.on;
    },
    setMuted(m) {
      state.muted = !!m;
      try { backend().setItem(MUTE_KEY, state.muted ? '1' : '0'); } catch { /* session-only */ }
      if (state.master) state.master.gain.value = (state.on && !state.muted) ? 1 : 0;
      paint();
    },
  };
  let btn = null;
  function paint() { if (btn) btn.textContent = '♪ ' + label(); }
  if (opts && opts.mount && typeof document !== 'undefined') {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:11;opacity:.85;background:#0a0e16;color:#cfd6e4;border:1px solid #2a3348;border-radius:8px;padding:4px 10px;font:12px system-ui,sans-serif;cursor:pointer;';
    btn.title = 'click: play/stop, right-click: mute';
    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); api.setMuted(!state.muted); });
    paint();
    btn.addEventListener('click', () => api.toggle());
    opts.mount.appendChild(btn);
  }
  return api;
}
