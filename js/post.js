// t-4: cinematic grade pass — vignette, animated film grain, radial
// chromatic aberration (dispersion). Runs pre-OutputPass on linear HDR;
// gains are tuned so the horizon shadow stays black and disk survives.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.045 },
    uChroma: { value: 0.0016 },
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain; uniform float uChroma;',
    'varying vec2 vUv;',
    'float pHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main(){',
    '  vec2 d = vUv - 0.5; float r2 = dot(d, d);',
    '  float ab = uChroma * (0.6 + r2 * 6.0);',
    '  vec3 col;',
    '  col.r = texture2D(tDiffuse, vUv + d * ab).r;',
    '  col.g = texture2D(tDiffuse, vUv).g;',
    '  col.b = texture2D(tDiffuse, vUv - d * ab).b;',
    '  col *= 1.0 - uVignette * smoothstep(0.02, 0.55, r2 * 2.0);',
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  float gr = pHash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 61.7) - 0.5;',
    '  col += gr * uGrain * (0.35 + 0.65 * (1.0 - clamp(lum * 0.5, 0.0, 1.0)));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n'),
};
