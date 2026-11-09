import * as THREE from 'three';
import { canvasTex } from '../lib/utils.js';

function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}

function fbm(x, y, z, o = 5) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < o; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a;
    f *= 2.03;
    a *= .5;
  }
  return s / n;
}

function ramp(hexes) {
  const cs = hexes.map(h => new THREE.Color(h));
  return (t) => {
    t = Math.min(.9999, Math.max(0, t)) * (cs.length - 1);
    const i = Math.floor(t), f = t - i;
    return cs[i].clone().lerp(cs[i + 1], f);
  };
}

const PAINT = {
  gas: {
    r: ramp(['#f3d9bf', '#ff8a4a', '#a8380e', '#ffc79a', '#4a1a0c', '#ff6a2a', '#e8b48a', '#f3d9bf']),
    f(p, R) { const w = fbm(p.x * 2.2 + 7, p.y * 2.2, p.z * 2.2); return R((p.y * .5 + .5) + (w - .5) * .55 + Math.sin(p.y * 22 + w * 6) * .03); }
  },
  copper: {
    r: ramp(['#ffd9b0', '#c06a2c', '#5a2412', '#e89a5c', '#8a4a22', '#ffd9b0']),
    f(p, R) { const w = fbm(p.x * 2 + 3, p.y * 2 + 1, p.z * 2); return R((p.y * .5 + .5) + (w - .5) * .7); }
  },
  mars: {
    r: ramp(['#3a0f05', '#8a2a0c', '#ff5a1f', '#ffa24a', '#ffd9a8']),
    f(p, R) {
      const n = fbm(p.x * 2.6 + 11, p.y * 2.6, p.z * 2.6, 6), m = fbm(p.x * 7, p.y * 7, p.z * 7 + 4, 3);
      const c = R(n * 1.35 - .12);
      if (m > .6) c.multiplyScalar(.7);
      return c;
    }
  },
  lava: {
    o: ramp(['#0e0b0a', '#211915', '#33261f']),
    l: ramp(['#c43d0c', '#ff5a1f', '#ffa24a', '#ffe2c4']),
    f(p) { const n = fbm(p.x * 2.1 + 5, p.y * 2.1, p.z * 2.1, 6); return n > .55 ? this.l((n - .55) * 3.4) : this.o(n * 1.7); }
  },
  moon: {
    r: ramp(['#1a1715', '#4a4440', '#8a837c', '#d8d0c6']),
    f(p, R) { return R(fbm(p.x * 3 + 2, p.y * 3, p.z * 3 + 8, 5) * 1.4 - .2); }
  }
};

const TINT = { gas: '#ff8a4a', copper: '#c06a2c', mars: '#ff5a1f', lava: '#33261f', moon: '#8a837c' };
const NAME = { gas: 'Gas giant', copper: 'Ringed world', mars: 'Red planet', lava: 'Lava world', moon: 'Small moon' };
const planetTextures = {};

function paintPlanet(kind) {
  if (planetTextures[kind]) return planetTextures[kind];
  const W = 320, H = 160, P = PAINT[kind];
  planetTextures[kind] = canvasTex(W, H, (ctx) => {
    const img = ctx.createImageData(W, H), d = img.data, p = new THREE.Vector3();
    for (let y = 0; y < H; y++) {
      const th = (y + .5) / H * Math.PI, sr = Math.sin(th), cy = Math.cos(th);
      for (let x = 0; x < W; x++) {
        const ph = x / W * Math.PI * 2;
        p.set(Math.cos(ph) * sr, cy, Math.sin(ph) * sr);
        const c = P.f(p, P.r), g = (Math.random() - .5) * .07, i = (y * W + x) * 4;
        d[i] = Math.max(0, Math.min(255, (c.r + g) * 255));
        d[i + 1] = Math.max(0, Math.min(255, (c.g + g) * 255));
        d[i + 2] = Math.max(0, Math.min(255, (c.b + g) * 255));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return planetTextures[kind];
}

export function makePlanet(scene, kind, radius, pos) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.MeshStandardMaterial({ color: TINT[kind], roughness: 1, metalness: 0, envMapIntensity: .25 })
  );
  m.position.copy(pos);
  m.rotation.z = (Math.random() - .5) * .5;
  m.userData = {
    base: pos.clone(), spin: .02 + Math.random() * .05, bob: .2 + Math.random() * .3, ph: Math.random() * 6,
    kind, kick: 0, label: NAME[kind] + ' · uncharted · click'
  };
  scene.add(m);
  return m;
}

export async function paintPlanets(list) {
  for (const m of list) {
    await new Promise(r => setTimeout(r, 25));
    m.material.map = paintPlanet(m.userData.kind);
    m.material.color.set('#ffffff');
    m.material.needsUpdate = true;
  }
}

export const LABELS = ["sense hack '26", 'track ??', 'do not erase', 'firmware_v2', 'hello, world', 'backup · 1987', 'pitch_deck', 'signal_26', 'ideas_v2', 'final_FINAL'];

const metalMat = new THREE.MeshStandardMaterial({ color: '#c9c4c0', metalness: .9, roughness: .32 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#141110', roughness: .8 });
const labelJobs = [];

function drawLabel(ctx, w, h, text, stripe, sub) {
  ctx.fillStyle = '#efe6da';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, w, 34);
  ctx.strokeStyle = 'rgba(255,90,31,.28)';
  ctx.lineWidth = 2;
  for (let y = 96; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w - 18, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a1210';
  ctx.font = '600 20px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText('MF2HD  1.44 MB', 20, 66);
  ctx.save();
  ctx.translate(30, 168);
  ctx.rotate(-.045);
  ctx.fillStyle = '#2a140a';
  ctx.font = 'italic 64px "Instrument Serif", Georgia, serif';
  ctx.fillText(text, 0, 0);
  if (sub) {
    ctx.font = 'italic 38px "Instrument Serif", Georgia, serif';
    ctx.fillText(sub, 4, 56);
  }
  ctx.restore();
}

export function redrawLabels() {
  labelJobs.forEach(job => job());
}

export function makeFloppy(scene, color, label, stripe, sub) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.7, .14), new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: 0, envMapIntensity: .6 })));

  const shutter = new THREE.Group();
  shutter.position.set(.2, 1.24, 0);
  shutter.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.22, .16), metalMat));
  for (const z of [.082, -.082]) {
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(.42, .78), darkMat);
    slot.position.set(.42, .06, z);
    if (z < 0) slot.rotation.y = Math.PI;
    shutter.add(slot);
  }
  g.add(shutter);

  const tex = canvasTex(512, 300, (c, w, h) => drawLabel(c, w, h, label, stripe, sub));
  labelJobs.push(() => { drawLabel(tex.image.getContext('2d'), 512, 300, label, stripe, sub); tex.needsUpdate = true; });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.64), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }));
  lab.position.set(0, -.78, .072);
  g.add(lab);

  const hub = new THREE.Mesh(new THREE.CircleGeometry(.44, 40), metalMat);
  hub.position.set(0, -.2, -.072);
  hub.rotation.y = Math.PI;
  g.add(hub);

  const wp = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), darkMat);
  wp.position.set(-1.46, -1.58, .072);
  g.add(wp);

  g.userData.shutter = shutter;
  g.userData.label = '3.5" floppy · 1.44 MB · click';
  scene.add(g);
  return g;
}

function discMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec2 d = vUv - 0.5; float r = length(d) * 2.0; float ang = atan(d.y, d.x);
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        float facing = abs(dot(n, normalize(-vV)));
        float hh = 0.5 + 0.5 * cos(6.2831853 * (ang / 3.14159265 + facing * 1.4 + uTime * 0.04 + uSeed));
        vec3 sp = mix(vec3(0.75, 0.08, 0.01), vec3(1.0, 0.55, 0.22), hh);
        float wedge = pow(abs(cos(ang + facing * 2.5 + uSeed * 6.0)), 2.0);
        vec3 silver = vec3(0.32, 0.30, 0.29) * (0.5 + 0.5 * facing);
        vec3 col = mix(silver, sp, 0.3 + 0.6 * wedge);
        col += 0.02 * sin(r * 420.0);
        float hub = 1.0 - smoothstep(0.34, 0.36, r);
        col = mix(col, vec3(0.5, 0.48, 0.47) * (0.5 + 0.5 * facing), hub);
        col *= 1.0 - 0.35 * smoothstep(0.96, 1.0, r);
        float fogF = 1.0 - exp(-0.016 * 0.016 * dot(vV, vV));
        col = mix(col, vec3(0.003, 0.0025, 0.002), fogF);
        gl_FragColor = vec4(col, mix(1.0, 0.62, hub));
      }`,
    side: THREE.DoubleSide,
    transparent: true
  });
}

export function makeDisc(scene) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.16, 1, 96, 1), discMaterial(Math.random()));
  m.userData.label = 'Compact disc · 700 MB · click';
  scene.add(m);
  return m;
}
