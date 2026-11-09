import * as THREE from 'three';
import { V, sstep, textures } from '../lib/utils.js';
import { makePlanet, makeFloppy, makeDisc, paintPlanets, LABELS } from './props.js';
import { createRack } from './rack.js';
import { TRACKS } from '../data.js';

export const TUNNEL_LENGTH = 120;
const R_MOUTH = 6.4, R_CORRIDOR = 1.75, FLARE = 16;
export const T_DISK = .6;
export const WORLD_Z0 = 18;
const BEAM_Z = -186;
const BG = new THREE.Color('#0a0807');

export function centerAt(t) {
  if (t >= 1) return V(0, 0, -t * TUNNEL_LENGTH);
  const s = sstep(0.04, 0.3, t);
  return V(1.1 * Math.sin(Math.PI * 2 * t) * s, 0.7 * Math.sin(Math.PI * 3 * t) * s, -t * TUNNEL_LENGTH);
}

export function radiusAt(t) {
  return (R_CORRIDOR + (R_MOUTH - R_CORRIDOR) * Math.exp(-FLARE * t)) * (1 + 1.1 * Math.exp(-Math.pow((t - T_DISK) * 13, 2)));
}

export const pathPoint = (z) => (z >= 0 ? V(0, 0, z) : centerAt(-z / TUNNEL_LENGTH));

function tunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPulse: { value: 0 }, uWarp: { value: 0 }, uAlt: { value: 0 },
      uLine: { value: new THREE.Color('#ff5a1f') }, uHot: { value: new THREE.Color('#ffe2c4') }
    },
    vertexShader: `
      uniform float uTime; uniform float uWarp;
      attribute vec2 aParam;
      varying float vT; varying float vA; varying float vDist;
      vec3 tunnelPoint(float t, float a){
        float s = smoothstep(0.04, 0.3, t);
        vec2 c = vec2(1.1*sin(6.2831853*t), 0.7*sin(9.4247780*t)) * s;
        float r = ${R_CORRIDOR.toFixed(3)} + ${(R_MOUTH - R_CORRIDOR).toFixed(3)} * exp(-${FLARE.toFixed(1)}*t);
        r *= 1.0 + 1.1*exp(-pow((t - ${T_DISK.toFixed(2)})*13.0, 2.0));
        float amp = 0.3 + 0.7*exp(-t*9.0);
        float w = 0.16*sin(2.0*a + 1.3 + uTime*0.23) + 0.11*sin(3.0*a - 0.7 - uTime*0.17) + 0.06*sin(5.0*a + t*18.0 + uTime*0.37);
        r *= 1.0 + amp*w + (0.035 + uWarp*0.05)*sin(t*70.0 - uTime*(1.6 + uWarp*6.0));
        return vec3(c + vec2(cos(a)*1.08, sin(a))*r, -t*${TUNNEL_LENGTH.toFixed(1)});
      }
      void main(){
        vec3 p = tunnelPoint(aParam.x, aParam.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDist = -mv.z; vT = aParam.x; vA = aParam.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uPulse; uniform vec3 uLine; uniform vec3 uHot; uniform float uAlt; uniform float uWarp;
      varying float vT; varying float vA; varying float vDist;
      float h1(float x){ return fract(sin(x*91.7)*43758.5453); }
      void main(){
        float fade = 1.0 - smoothstep(26.0, 150.0, vDist);
        float near = smoothstep(0.15, 1.2, vDist);
        float band = exp(-pow((vT - uPulse)*(50.0 - uWarp*30.0), 2.0));
        vec3 col = mix(uLine, uHot, min(1.0, band + uWarp*0.3));
        col = mix(col, vec3(1.0, 0.64, 0.29), uAlt);
        float flick = mix(1.0, step(0.35, h1(floor(uTime*20.0) + floor(vT*40.0))), uAlt);
        float a = (0.78 + band*0.4 + uWarp*0.15) * fade * near * flick;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false
  });
}

function buildTunnel(material) {
  const NR = 150, RS = 96, NL = 40, LS = 320;
  const count = NR * RS * 2 + NL * LS * 2;
  const prm = new Float32Array(count * 2);
  const tt = (u) => Math.pow(u, 1.12);
  let k = 0;
  for (let i = 0; i < NR; i++) {
    const t = tt(i / (NR - 1));
    for (let j = 0; j < RS; j++) {
      prm[k++] = t; prm[k++] = j / RS * Math.PI * 2;
      prm[k++] = t; prm[k++] = (j + 1) / RS * Math.PI * 2;
    }
  }
  for (let j = 0; j < NL; j++) {
    const a = j / NL * Math.PI * 2;
    for (let i = 0; i < LS; i++) {
      prm[k++] = tt(i / LS); prm[k++] = a;
      prm[k++] = tt((i + 1) / LS); prm[k++] = a;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aParam', new THREE.BufferAttribute(prm, 2));
  const lines = new THREE.LineSegments(g, material);
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  return lines;
}

function buildStars() {
  const N = 2800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const tints = ['#f3eadf', '#f3eadf', '#ffffff', '#ffc9a3', '#ff8a50', '#ffb067'].map(h => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 50 + Math.random() * 200, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r - 90], i * 3);
    const c = tints[(Math.random() * tints.length) | 0], b = .35 + Math.random() * .65;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: .8, map: textures.dot, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
}

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uOn; varying vec2 vUv;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        vec3 c = mix(vec3(1.0, 0.86, 0.7), vec3(1.0, 0.35, 0.08), smoothstep(0.0, 0.45, x));
        c = mix(c, vec3(0.45, 0.06, 0.01), smoothstep(0.45, 1.0, x));
        float edge = 1.0 - smoothstep(0.55, 1.0, x);
        float streak = 0.8 + 0.2 * sin(vUv.x * 90.0 + vUv.y * 4.0 - uTime * 0.6);
        float vfade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        gl_FragColor = vec4(c * streak, edge * vfade * 0.85 * uOn);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

const FLOPPY_COLORS = [
  ['#141110', '#ff5a1f'], ['#ff5a1f', '#141110'], ['#e9e1d6', '#ff5a1f'], ['#2a2522', '#ffa24a'],
  ['#ff7a33', '#141110'], ['#6f6862', '#ff5a1f'], ['#1a1715', '#ffa24a'], ['#c43d0c', '#f3eadf']
];

export function createWorld(envTex) {
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, 0.016);
  scene.environment = envTex;
  scene.add(new THREE.AmbientLight(0xfff1dd, 0.3));
  const key = new THREE.DirectionalLight(0xffe2c8, 2.3);
  key.position.set(-6, 9, 10);
  scene.add(key);
  const camLight = new THREE.PointLight(0xffc49a, 14, 0, 2);
  scene.add(camLight);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  const screenCamera = new THREE.PerspectiveCamera(50, 4 / 3, 0.05, 600);

  const tunnel = tunnelMaterial();
  scene.add(buildTunnel(tunnel));

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.copy(centerAt(1));
  glow.scale.setScalar(46);
  glow.renderOrder = 3;
  scene.add(glow);

  scene.add(buildStars());

  const sparkles = [];
  ['#ffffff', '#f3eadf', '#ff5a1f', '#ffa24a', '#ffd2a8'].forEach(hex => {
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.spark, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 30;
      s.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * .8, -10 - Math.random() * 190);
      s.userData = { b: .9 + Math.random() * 2.2, sp: .6 + Math.random() * 1.6, ph: Math.random() * 6 };
      scene.add(s);
      sparkles.push(s);
    }
  });

  const planets = [];
  const discs = [];
  const drifters = [];
  const hoverables = [];

  const planet = (kind, r, pos) => {
    const m = makePlanet(scene, kind, r, pos);
    planets.push(m);
    hoverables.push(m);
    return m;
  };
  const disc = () => {
    const d = makeDisc(scene);
    discs.push(d);
    return d;
  };
  const floppy = (ci, li) => makeFloppy(scene, FLOPPY_COLORS[ci][0], LABELS[li % LABELS.length], FLOPPY_COLORS[ci][1]);
  const drift = (o, pos, rot, scale, spin) => {
    o.position.copy(pos);
    o.rotation.set(...rot);
    o.scale.setScalar(scale);
    Object.assign(o.userData, { base: pos.clone(), spin, bob: .3 + Math.random() * .5, ph: Math.random() * 6, kick: 0 });
    drifters.push(o);
    hoverables.push(o);
  };

  planet('gas', 1.75, V(6.2, 4.3, -3));
  planet('mars', 1.05, V(-7.4, 1.6, -1.5));
  planet('lava', 1.2, V(-9.6, -2.6, -2.5));
  const ringed = planet('copper', .75, V(-2.6, 6.2, -9));
  planet('moon', .5, V(4.2, -5.3, 3.5));
  planet('mars', .45, centerAt(.3).add(V(1.0, .9, 0)));
  planet('moon', .38, centerAt(.45).add(V(-1.0, -.7, 0)));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.5, 96), new THREE.MeshBasicMaterial({ color: '#ffa24a', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
  ring.rotation.x = 1.25;
  ring.rotation.y = .35;
  ringed.add(ring);

  drift(floppy(1, 0), V(3.6, -3.1, 7.5), [-.35, .5, .3], .42, V(.12, .18, .05));
  drift(floppy(2, 3), V(-3.4, 3.5, 6), [.4, -.6, -.4], .38, V(-.1, .14, .08));
  drift(floppy(0, 1), V(7.8, -1.2, 3.5), [.2, -.9, .6], .4, V(.08, -.16, .06));
  drift(floppy(4, 4), V(-10.5, 3.2, -1.5), [-.3, .8, -.2], .36, V(.1, .12, -.07));
  drift(disc(), V(1.9, 3.2, 9.5), [1.1, .3, 0], 1.05, V(0, .25, .1));
  drift(disc(), V(-5.6, .4, 9.8), [-.8, -.6, .2], .9, V(.15, -.2, 0));
  drift(disc(), V(8.6, 3.0, 0), [.5, -1.1, .3], 1.3, V(.05, .18, .1));

  const inTunnel = [
    [.07, .55, 4, 'f'], [.11, .6, 6, 'd'], [.16, .55, 5, 'f'], [.21, .6, 2, 'd'], [.26, .55, 7, 'f'], [.31, .6, 0, 'd'], [.37, .55, 6, 'f'],
    [.43, .6, 1, 'f'], [.5, .55, 3, 'd'], [.68, .55, 2, 'f'], [.74, .6, 4, 'd'], [.8, .55, 7, 'f'], [.86, .55, 1, 'd'], [.92, .55, 5, 'f']
  ];
  inTunnel.forEach(([t, rf, ci, type], i) => {
    const c = centerAt(t), ang = i * 2.4 + .6, r = radiusAt(t) * rf;
    const pos = V(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r * .9, c.z);
    const rot = [Math.random() * 2, Math.random() * 2, Math.random() * 2];
    const spin = V((Math.random() - .5) * .5, (Math.random() - .5) * .5, (Math.random() - .5) * .3);
    drift(type === 'f' ? floppy(ci, i + 2) : disc(), pos, rot, type === 'f' ? .27 : .55, spin);
  });

  // The container of track disks sits where the old hero disk was. The rack's
  // origin is its floor, so drop it below the camera's look-at point.
  const diskPos = centerAt(T_DISK);
  const rack = createRack(scene, TRACKS, diskPos.clone().add(V(0, -2.35, 0)));
  rack.hoverables.forEach(o => hoverables.push(o));

  const beam = new THREE.Mesh(new THREE.PlaneGeometry(13, 120), beamMaterial());
  beam.position.set(0, 0, BEAM_Z);
  scene.add(beam);
  const beamGlow = new THREE.Mesh(new THREE.PlaneGeometry(32, 120), beamMaterial());
  beamGlow.position.set(0, 0, BEAM_Z - 1);
  scene.add(beamGlow);

  const fallers = [];
  const kinds = ['gas', 'mars', 'lava', 'moon', 'copper'];
  for (let i = 0; i < 26; i++) {
    const type = i % 3 === 2 ? 'p' : i % 3 === 1 ? 'd' : 'f';
    let o;
    if (type === 'f') { o = floppy(i % FLOPPY_COLORS.length, i + 1); o.scale.setScalar(.42 + Math.random() * .2); }
    else if (type === 'd') { o = disc(); o.scale.setScalar(.8 + Math.random() * .5); }
    else { o = planet(kinds[i % 5], .5 + Math.random() * .9, V(0, 0, 0)); }
    const x = (Math.random() - .5) * (type === 'p' ? 16 : 8);
    o.position.set(x, (Math.random() - .5) * 60, BEAM_Z + 3 + Math.random() * 8);
    o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    o.userData.fall = { speed: .9 + Math.random() * 1.6, spin: V(Math.random() - .5, Math.random() - .5, Math.random() - .5), x };
    if (type !== 'p') hoverables.push(o);
    fallers.push(o);
  }

  paintPlanets(planets);

  function update({ time, dt, q, motion }) {
    for (const d of discs) d.material.uniforms.uTime.value = time;

    for (const o of drifters) {
      const u = o.userData, kick = 1 + u.kick;
      u.kick *= Math.exp(-dt * 1.8);
      o.rotation.x += u.spin.x * dt * motion * kick;
      o.rotation.y += u.spin.y * dt * motion * kick;
      o.rotation.z += u.spin.z * dt * motion * kick;
      o.position.y = u.base.y + Math.sin(time * u.bob + u.ph) * .22;
    }

    for (const m of planets) {
      const u = m.userData;
      if (u.fall) continue;
      u.kick *= Math.exp(-dt * 1.5);
      m.rotation.y += (u.spin + u.kick * .6) * dt * motion;
      m.position.y = u.base.y + Math.sin(time * u.bob + u.ph) * .15;
    }

    for (const s of sparkles) {
      const u = s.userData;
      s.scale.setScalar(u.b * (.7 + .3 * Math.sin(time * u.sp + u.ph)));
    }

    const beamOn = sstep(.76, .84, q);
    for (const o of fallers) {
      const f = o.userData.fall;
      f.speed += (1.3 - f.speed) * (1 - Math.exp(-dt * .6));
      o.position.y -= f.speed * dt * motion * (beamOn > .01 ? 1 : 0);
      if (o.position.y < -32) o.position.y += 64;
      o.rotation.x += f.spin.x * dt * motion;
      o.rotation.y += f.spin.y * dt * motion;
      o.position.x = f.x + Math.sin(time * .4 + f.speed) * .3;
    }

    tunnel.uniforms.uTime.value = time;
    tunnel.uniforms.uPulse.value = (time * .085) % 1.15;
    beam.material.uniforms.uOn.value = beamOn;
    beam.material.uniforms.uTime.value = time;
    beamGlow.material.uniforms.uOn.value = beamOn * .35;
    beamGlow.material.uniforms.uTime.value = time;
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
    });
  }

  return { scene, camera, screenCamera, camLight, tunnel, glow, hoverables, rack, diskPos, update, dispose };
}
