// t-3: volumetric accretion disk — thickness, turbulence, Doppler, redshift.
// Density rho(r,y,t) uses a flared scale height H(r) for real thickness;
// emission follows a temperature ramp (white-hot inner to amber outer);
// velocity is Keplerian, feeding Doppler beam and gravitational redshift.
export const DISK = [
'uniform float uThick; uniform float uDensity; uniform float uTemp; uniform float uTurb; uniform float uFlow; uniform float uDopAmt; uniform float uGravAmt;',
'float dHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }',
'float dNoise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);',
'  float n000=dHash(i); float n100=dHash(i+vec3(1.,0.,0.)); float n010=dHash(i+vec3(0.,1.,0.));',
'  float n110=dHash(i+vec3(1.,1.,0.)); float n001=dHash(i+vec3(0.,0.,1.)); float n101=dHash(i+vec3(1.,0.,1.));',
'  float n011=dHash(i+vec3(0.,1.,1.)); float n111=dHash(i+vec3(1.,1.,1.));',
'  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z); }',
'float dFbm(vec3 p){ float s=0.0; float a=0.5; for(int k=0;k<4;k++){ s+=a*dNoise(p); p=p*2.03+vec3(1.7); a*=0.5; } return s; }',
'float scaleHeight(float r){ return (0.10*r + 0.012*r*r) * uThick; }',
'float diskDensity(vec3 p, float rIn, float rOut, float uTime){',
'  float r = length(p.xz); if(r<rIn||r>rOut) return 0.0;',
'  float H = scaleHeight(r);',
'  float vertical = exp(-(p.y*p.y)/(2.0*H*H));',
'  float profile = smoothstep(rIn, rIn+0.7, r)*(1.0-smoothstep(rOut*0.55, rOut, r));',
'  float ang = atan(p.z, p.x);',
'  float kepler = inversesqrt(max(r-1.0, 0.2));',
'  vec3 adv = vec3(cos(ang-kepler*uTime*uFlow)*r, p.y*2.0, sin(ang-kepler*uTime*uFlow)*r);',
'  float turbulence = dFbm(adv*0.55+vec3(0.0, uTime*0.07, uTime*0.03));',
'  return vertical*profile*mix(1.0, 0.25+1.6*turbulence, clamp(uTurb, 0.0, 1.5)) * uDensity; }',
'vec3 diskVelocity(vec3 p){ float r=max(length(p.xz),1.6); float vk=inversesqrt(2.0*max(r-1.0,0.3)); return vk*vec3(-p.z/r,0.0,p.x/r); }',
'float diskTemperature(float r, float rIn){ return clamp((1.6*sqrt(rIn/max(r,0.4))-0.25) * uTemp, 0.05, 3.0); }',
'vec3 temperatureColor(float T){ vec3 amber=vec3(1.0,0.45,0.12); vec3 white=vec3(1.0,0.98,0.92);',
'  vec3 hot=white*(0.6+0.9*T); return mix(amber*(0.35+0.65*T), hot, clamp(T-0.35,0.0,1.0)); }',
// Option (b): the march emits along a UNIT-MAX CHROMATICITY, so temperatureColor
// keeps carrying hue only and every lumen of disk brightness comes from optical
// depth. luminance = (1 - e^-tau) * dop * grs, with no baked radial trend (option
// (a) would freeze a ~1.66x inner-to-outer falloff nobody asked for). temperatureColor
// itself is left untouched so debug view 5 keeps reporting the raw ramp.
'vec3 diskTint(float T){ vec3 c=temperatureColor(T); return c/max(max(c.r,c.g),c.b); }',
'float dopplerBeam(vec3 rayDir, vec3 vel){ float beta=clamp(length(vel),0.0,0.85);',
'  vec3 vhat=vel/max(beta,1e-4); float mu=dot(normalize(rayDir),vhat);',
'  float dop=sqrt(max(1.0-beta*beta,0.02))/(1.0-beta*mu); return mix(1.0, dop*dop*dop, clamp(uDopAmt, 0.0, 1.5)); }',
'float gravityRedshift(float r, float rs){ float g=sqrt(max(1.0-rs/max(r,rs*1.001),0.0)); return mix(1.0, g*g*g*g, clamp(uGravAmt, 0.0, 1.0)); }',
].join('\n');
