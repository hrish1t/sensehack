import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export { sstep, bump } from './math.js';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function radial(size, stops) {
  return canvasTex(size, size, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });
}

export const textures = {
  glow: radial(256, [[0, 'rgba(255,240,220,1)'], [.12, 'rgba(255,200,150,.85)'], [.38, 'rgba(255,110,40,.25)'], [1, 'rgba(0,0,0,0)']]),
  soft: radial(256, [[0, 'rgba(255,255,255,1)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]),
  dot: radial(64, [[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]),
  spark: canvasTex(128, 128, (x) => {
    const c = 64;
    const g = x.createRadialGradient(c, c, 0, c, c, 22);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    x.globalCompositeOperation = 'lighter';
    for (const [dx, dy, len, wd] of [[1, 0, 62, 2.2], [0, 1, 62, 2.2], [.707, .707, 26, 1.2], [.707, -.707, 26, 1.2]]) {
      const gr = x.createLinearGradient(c - dx * len, c - dy * len, c + dx * len, c + dy * len);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.5, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.strokeStyle = gr;
      x.lineWidth = wd;
      x.beginPath();
      x.moveTo(c - dx * len, c - dy * len);
      x.lineTo(c + dx * len, c + dy * len);
      x.stroke();
    }
  })
};

export function monotone(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : 3 * (d[i - 1] + d[i]) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  }
  for (let i = 1; i < n - 1; i++) {
    if (Math.abs(d[i - 1]) < 6 || Math.abs(d[i]) < 6) m[i] = Math.min(Math.abs(m[i]), 6) * Math.sign(m[i]);
  }
  return (x) => {
    x = Math.min(1, Math.max(0, x));
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const hh = xs[i + 1] - xs[i], t = (x - xs[i]) / hh, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * m[i + 1];
  };
}

export const fontsReady = document.fonts
  ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve();
