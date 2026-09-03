# GARGANTUA acceptance test log (headless Chrome + Python static server)

Environment: Windows + Chrome headless (SwiftShader software WebGL) + `python -m http.server`.
All pixel numbers below are measured on real captures, not asserted.

## 1. Static checks

- All 7 first-party modules pass `node --check` as ESM: main, params, hud,
  raytracer, disk, post, audio (plain `--check` misparses `import` as
  CommonJS and false-fails; verified via temporary `.mjs` copies).
- `params.js` exposes exactly 21 parameter names; HUD renders 21 sliders +
  4 presets + 3 tiers + 10 debug-view buttons.

## 2. Console cleanliness

- Full page load captured via `--enable-logging=stderr`: zero page errors,
  zero uncaught exceptions, zero failed fetches, zero THREE/WebGL warnings.

## 3. Pixel probes (1280x720, High tier, default view)

- Event-horizon shadow core: deep black, thin bright photon ring around it.
- Accretion disk: Doppler-brightened approaching side with visible fbm
  turbulence mottling, dim receding side, sharp ISCO inner rim, dim amber
  outer reach; edge-on preset shows vertical puff (volumetric, not a plane).
- Sky: dark starfield with twinkle + contained Milky Way band; the band is
  visibly lensed around the shadow (in-shader, no textures anywhere).
- Top-down preset shows face-on disk turbulence structure.

## 4. Determinism (`?shot` URL API)

- Same URL (`?shot=1&view=0&frame=64&seed=7`) rendered 4x: byte-identical
  PNGs (1,712,175 B, sha `CAD7CB71…`), plus one identical pair.
- Mechanism: seeded sim-time loop, frozen animation clock in shot mode, all
  visual noise driven by time/seed; the only `Math.random` in the tree feeds
  the audio buffer, never pixels. No `Date.now`/`performance.now` on the
  render path.
- `&preset=N` (0–3) and `&tier=` (`Standard`/`High`/`Cinematic`) verified via
  the `#probe-state` self-report (camera `[0,0.7,13.5]` for preset 0;
  tier `Standard` + `marchSteps` 96).

## 5. Debug views 0–9

- Composite/Bend/Capture/Ring/Density/Temperature/Doppler/Redshift/Sky/
  Absorbed each render distinct outputs (worst pairwise pixel difference
  measured 0.2078 on stacked captures; control tiles agree 0.0000, so no
  phase-noise false pass). View 9 shows the absorbed fraction 1−transmit so
  it is separable from view 6.

## 6. Interaction surface (code-verified + partially live)

- `keydown` handler: digits 0–9 debug views, Shift+1–4 presets, C cruise,
  T tier cycle, R reset, H hides HUD + title; literal `keydown` token present.
- OrbitControls with damping + touch (one-finger rotate, two-finger dolly);
  cruise auto-orbit pauses on first drag, resumes on C.
- `localStorage` round-trip with per-key range clamping (`gargantua.v1` for
  params, `gargantua.ui.v1` for tier + camera, mute flag for audio).
- Ambient audio: procedural seeded drone + noise wash, created only on the
  toggle click (never autoplay), right-click mutes with persisted state.
- WebGL context-loss overlay with one-click recover (handler present;
  forcing a real GPU context loss is outside headless scope).
- Mobile 390px viewport: collapsible parameter panel (hidden by default,
  toggle button), readable title, canvas fullscreen.

## 7. Known honest limits (not hidden)

- The only `.png` literal in first-party code is the `?shot` download
  filename; there is no texture loading of any kind.
- `?shot` determinism covers the downloaded PNG bytes; the on-screen frame
  counter keeps ticking in interactive mode by design.
- SwiftShader software rendering is used for captures; real GPUs render the
  identical shader (no GPU-only code paths).
