import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, canvasTex, textures } from '../lib/utils.js';
import { remain, pad } from '../ui/countdown.js';

export const SCREEN = { x: -1.3, y: .15, z: 3.12, w: 6.4, h: 4.8 };
const BG = new THREE.Color('#0a0807');
const CHANNELS = 4;
const TRACKS = ['01 HEALTHCARE', '02 SMART CITIES', '03 EDUCATION', '04 FINTECH', '05 GREEN TECH', '06 CYBERSECURITY', '07 OPEN INNOVATION'];

function screenMaterial(channelTex, worldTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tCh: { value: channelTex }, tWorld: { value: worldTex },
      uMix: { value: 1 }, uStatic: { value: 0 }, uTime: { value: 0 }, uPower: { value: 1 }, uGlow: { value: 1.25 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        vec2 c = uv * 2.0 - 1.0;
        p.z += 0.32 * (1.0 - c.x*c.x*0.9) * (1.0 - c.y*c.y*0.9);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D tCh; uniform sampler2D tWorld;
      uniform float uMix; uniform float uStatic; uniform float uTime; uniform float uPower; uniform float uGlow;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main(){
        vec2 c = vUv * 2.0 - 1.0;
        float mask = 1.0 - smoothstep(-0.01, 0.01, rbox(c, vec2(0.97, 0.96), 0.22));
        vec2 cc = c * (1.0 + 0.07 * dot(c, c));
        vec2 uv = cc * 0.5 + 0.5;
        float sy = max(smoothstep(0.2, 0.75, uPower), 0.006), sx = max(smoothstep(0.0, 0.2, uPower), 0.004);
        vec2 q = (uv - 0.5) / vec2(sx, sy) + 0.5;
        float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
        float line = floor(q.y * 240.0);
        q.x += (h(vec2(line, floor(uTime * 12.0))) - 0.5) * 0.02 * uStatic;
        q.x += sin(q.y * 30.0 + uTime * 3.0) * 0.0015;
        vec3 chan = texture2D(tCh, q).rgb;
        vec3 wv = texture2D(tWorld, q).rgb;
        vec3 col = mix(wv * 1.15, chan, uMix);
        col *= 0.8 + 0.2 * sin(q.y * 768.0 * 1.5708);
        float rb = fract(q.y * 0.6 - uTime * 0.12);
        col += vec3(1.0, 0.45, 0.2) * 0.05 * smoothstep(0.0, 0.08, rb) * (1.0 - smoothstep(0.08, 0.2, rb));
        col *= 0.96 + 0.04 * sin(uTime * 55.0);
        float n = h(floor(vUv * vec2(320.0, 240.0)) + fract(uTime * 13.0) * 37.0);
        col = mix(col, vec3(n) * vec3(1.0, 0.78, 0.62), clamp(uStatic, 0.0, 1.0));
        col += (n - 0.5) * 0.04;
        col *= 1.0 - 0.45 * pow(dot(c, c) * 0.5, 1.5);
        col *= uGlow * inside * (1.0 + (1.0 - sy) * 3.0);
        col += vec3(1.0, 0.9, 0.85) * 0.05 * smoothstep(0.5, -0.6, c.x + c.y) * smoothstep(1.0, 0.2, length(c - vec2(-0.5, 0.5)));
        col += vec3(0.02, 0.016, 0.014);
        gl_FragColor = vec4(col * mask + vec3(0.006, 0.005, 0.004) * (1.0 - mask), 1.0);
      }`
  });
}

function drawChannel(ctx, channel) {
  const W = 1024, H = 768, r = remain();
  const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .62);
  bg.addColorStop(0, '#3a1708');
  bg.addColorStop(.6, '#1c0b04');
  bg.addColorStop(1, '#070302');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const glowText = (t, y, font, col, blur = 22) => {
    ctx.font = font;
    ctx.shadowColor = 'rgba(255,110,40,.9)';
    ctx.shadowBlur = blur;
    ctx.fillStyle = col;
    ctx.fillText(t, W / 2, y);
    ctx.shadowBlur = 0;
  };
  const blink = (Date.now() / 530 | 0) % 2 === 0;

  if (channel === 0) {
    glowText('IEEE-VIT × IEEE ComSoc', 250, '600 46px "IBM Plex Mono", monospace', '#f6dcc4', 14);
    ctx.font = '900 112px "Unbounded", "Arial Black", sans-serif';
    const a = 'SENSE HACK ', b = '’26';
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    const scale = Math.min(1, 900 / (wa + wb));
    ctx.save();
    ctx.translate(W / 2, 410);
    ctx.scale(scale, scale);
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(255,140,80,.95)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#fff3e6';
    ctx.fillText(a, -(wa + wb) / 2, 0);
    ctx.fillStyle = '#ff5a1f';
    ctx.fillText(b, -(wa + wb) / 2 + wa, 0);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    glowText('[ TUNING IN ]' + (blink ? ' █' : '  '), 540, '500 30px "IBM Plex Mono", monospace', '#ff7a33', 12);
  } else if (channel === 1) {
    glowText('CH 02 · LAUNCH WINDOW', 200, '600 32px "IBM Plex Mono", monospace', '#ff7a33', 10);
    glowText(`${pad(r.d)}:${pad(r.h)}:${pad(r.m)}:${pad(r.s)}`, 400, '700 120px "Unbounded", "Arial Black", sans-serif', '#fff3e6', 26);
    glowText('DAYS     HRS      MIN      SEC', 460, '500 26px "IBM Plex Mono", monospace', '#c8a58a', 6);
    glowText('DEC 9–10 · ANNA AUDITORIUM · VIT VELLORE', 580, '500 28px "IBM Plex Mono", monospace', '#ff7a33', 10);
  } else if (channel === 2) {
    glowText('CH 03 · NOW TUNING', 150, '600 32px "IBM Plex Mono", monospace', '#ff7a33', 10);
    glowText('7 TRACKS', 290, '900 110px "Unbounded", "Arial Black", sans-serif', '#fff3e6', 26);
    ctx.font = '500 30px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#f6dcc4';
    ctx.shadowColor = 'rgba(255,110,40,.8)';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'left';
    TRACKS.forEach((t, i) => ctx.fillText(t, i < 4 ? 150 : 540, 400 + (i % 4) * 56));
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
  } else {
    const bars = ['#f3eadf', '#ffb067', '#ff7a33', '#ff5a1f', '#c43d0c', '#7a260a', '#2a1208'];
    bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * W / 7, 0, W / 7 + 1, H * .68); });
    for (let i = 0; i < 7; i++) { ctx.fillStyle = bars[6 - i]; ctx.fillRect(i * W / 7, H * .68, W / 7 + 1, H * .08); }
    ctx.fillStyle = '#0a0807';
    ctx.fillRect(0, H * .76, W, H * .24);
    ctx.fillRect(W / 2 - 250, H * .3, 500, 110);
    glowText('NO SIGNAL · CH 04', H * .3 + 72, '700 44px "IBM Plex Mono", monospace', '#ff7a33', 10);
  }
}

export function createTV(envTex) {
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, 0.022);
  scene.environment = envTex;
  scene.add(new THREE.AmbientLight(0xffe8d8, 0.12));
  const key = new THREE.DirectionalLight(0xffe2c8, .55);
  key.position.set(-8, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a3a, .9);
  rim.position.set(9, 4, -6);
  scene.add(rim);
  const screenLight = new THREE.PointLight(0xff6a2a, 40, 0, 2);
  screenLight.position.set(-1.3, 0, 6);
  scene.add(screenLight);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  const tv = new THREE.Group();
  scene.add(tv);

  const plastic = new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: .48, metalness: .12, envMapIntensity: .8 });
  const plasticDark = new THREE.MeshStandardMaterial({ color: '#0e0b0a', roughness: .6, metalness: .1, envMapIntensity: .5 });
  const trim = new THREE.MeshStandardMaterial({ color: '#3a322d', roughness: .35, metalness: .55, envMapIntensity: 1 });

  tv.add(new THREE.Mesh(new RoundedBoxGeometry(10.2, 7.6, 6, 5, .5), plastic));
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(7.6, 6.0, .2, 4, .35), trim);
  bezel.position.set(SCREEN.x, SCREEN.y, 2.98);
  tv.add(bezel);
  const recess = new THREE.Mesh(new RoundedBoxGeometry(7.0, 5.4, .24, 4, .4), plasticDark);
  recess.position.set(SCREEN.x, SCREEN.y, 3.0);
  tv.add(recess);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(2.3, 6.6, .16, 3, .12), plasticDark);
  panel.position.set(3.6, .05, 2.98);
  tv.add(panel);

  const knobs = [];
  for (const [y, dir] of [[1.75, 1], [.05, -1]]) {
    const k = new THREE.Group();
    k.position.set(3.6, y, 3.12);
    k.add(new THREE.Mesh(new THREE.TorusGeometry(.66, .05, 12, 48), trim));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.56, .6, .5, 40), new THREE.MeshStandardMaterial({ color: '#141110', roughness: .35, metalness: .25, envMapIntensity: .9 }));
    body.rotation.x = Math.PI / 2;
    body.position.z = .25;
    k.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 40), trim);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = .52;
    k.add(cap);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(.08, .34, .04), new THREE.MeshStandardMaterial({ color: '#ff5a1f', emissive: '#ff5a1f', emissiveIntensity: .6 }));
    notch.position.set(0, .2, .56);
    k.add(notch);
    for (let i = 0; i < 12; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(.03, .1, .02), trim);
      const a = i / 12 * Math.PI * 2;
      tick.position.set(Math.sin(a) * .8, Math.cos(a) * .8, .02);
      tick.rotation.z = -a;
      k.add(tick);
    }
    k.userData = { dir, rot: 0, target: 0, label: dir > 0 ? 'Channel ▸ · click' : 'Channel ◂ · click', action: 'channel' };
    tv.add(k);
    knobs.push(k);
  }

  const grilleMat = new THREE.MeshStandardMaterial({ color: '#050404', roughness: .9 });
  for (let i = 0; i < 9; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, .07, .05), grilleMat);
    slat.position.set(3.6, -1.15 - i * .17, 3.07);
    tv.add(slat);
  }

  const led = new THREE.Mesh(new THREE.SphereGeometry(.08, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff5a1f', emissive: '#ff5a1f', emissiveIntensity: 2 }));
  led.position.set(4.25, -2.9, 3.08);
  tv.add(led);

  const power = new THREE.Group();
  power.position.set(3.2, -2.9, 3.08);
  const powerBtn = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .14, 24), trim);
  powerBtn.rotation.x = Math.PI / 2;
  power.add(powerBtn);
  power.userData = { label: 'Power · click', action: 'power' };
  tv.add(power);

  const brandTex = canvasTex(256, 48, () => {});
  const drawBrand = () => {
    const x = brandTex.image.getContext('2d');
    x.clearRect(0, 0, 256, 48);
    x.fillStyle = '#9d9186';
    x.font = '600 26px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillText('SENSE·26', 128, 34);
    brandTex.needsUpdate = true;
  };
  drawBrand();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .26), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true }));
  plate.position.set(3.6, 2.95, 3.08);
  tv.add(plate);

  for (const x of [-4.2, 4.2]) {
    for (const z of [-2.2, 2.2]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, .4, 16), plasticDark);
      foot.position.set(x, -3.95, z);
      tv.add(foot);
    }
  }

  const antenna = new THREE.Group();
  antenna.position.set(-.6, 3.75, -.6);
  antenna.add(new THREE.Mesh(new THREE.SphereGeometry(.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), plasticDark));
  const rodMat = new THREE.MeshStandardMaterial({ color: '#b9b2ac', metalness: .9, roughness: .25 });
  for (const a of [-.48, .5]) {
    const dir = V(Math.sin(a), Math.cos(a), -.18).normalize();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 5.4, 10), rodMat);
    rod.position.copy(dir.clone().multiplyScalar(2.9));
    rod.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    antenna.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), trim);
    tip.position.copy(dir.clone().multiplyScalar(5.6));
    antenna.add(tip);
  }
  tv.add(antenna);

  const cablePath = new THREE.CatmullRomCurve3([V(4.6, -2.6, -2.6), V(5.6, -3.4, -2.2), V(6.2, -4.05, 0), V(8.5, -4.05, 3.5), V(13, -4.05, 5)]);
  tv.add(new THREE.Mesh(new THREE.TubeGeometry(cablePath, 64, .07, 8, false), plasticDark));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: '#070504', roughness: .9, metalness: 0, envMapIntensity: .05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.15;
  scene.add(floor);

  const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ map: textures.soft, color: '#ff5a1f', transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-1.3, -4.13, 6);
  scene.add(pool);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.soft, color: '#ff5a1f', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.set(34, 24, 1);
  halo.position.set(0, 0, -6);
  scene.add(halo);

  const dustPos = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) dustPos.set([(Math.random() - .5) * 30, Math.random() * 14 - 4, Math.random() * 16 - 2], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: .06, map: textures.dot, color: '#ffb38a', transparent: true, opacity: .5, depthWrite: false }));
  scene.add(dust);

  const worldTarget = new THREE.WebGLRenderTarget(1024, 768, { samples: 2 });
  const channelCanvas = document.createElement('canvas');
  channelCanvas.width = 1024;
  channelCanvas.height = 768;
  const channelTex = new THREE.CanvasTexture(channelCanvas);
  channelTex.colorSpace = THREE.SRGBColorSpace;
  let channel = 0;
  const redraw = () => {
    drawChannel(channelCanvas.getContext('2d'), channel);
    channelTex.needsUpdate = true;
  };
  redraw();
  const redrawTimer = setInterval(redraw, 500);

  const screenMat = screenMaterial(channelTex, worldTarget.texture);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h, 40, 30), screenMat);
  screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
  screen.userData = { label: 'Click to enter the set', action: 'screen' };
  tv.add(screen);

  const state = { power: 1, powerT: 0, burst: 0 };

  return {
    scene, camera, tv, knobs, led, pool, halo, screenLight, dust, screenMat, worldTarget, state,
    hoverables: [...knobs, power, screen],
    setChannel(d) {
      channel = (channel + d + CHANNELS) % CHANNELS;
      state.burst = .35;
      redraw();
    },
    refreshText() {
      redraw();
      drawBrand();
    },
    dispose() {
      clearInterval(redrawTimer);
      worldTarget.dispose();
      channelTex.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
      });
    }
  };
}
