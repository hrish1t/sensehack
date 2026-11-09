// The whole opening sequence as a pure function of time. No DOM, no three.js.
//
//   room  : TV zooms in, its screen takes over            (r: 0 → 1)
//   fly   : camera flies down the tunnel to the disk rack (q: 0 → qRack0)
//   rack  : one slot per track. Disk slides out of the container, holds while
//           the info card is on screen, slides back, then the next one goes.
//   exit  : quick warp + flash, then the normal site takes over
//
// `q` is the same "world progress" value the old scroll system produced, so the
// camera path, tunnel shader and glitch windows in main.js / world.js are reused.

import { clamp, sstep } from '../lib/math.js';

export const CFG = {
  zoom: 3.0,    // seconds, TV room → screen takeover
  fly: 4.0,     // seconds, tunnel flight to the rack
  out: 0.85,    // disk slides out
  hold: 1.5,    // disk shown + info card readable
  inn: 0.85,    // disk slides back in
  gap: 0.1,     // breath between disks
  exit: 2.2,    // warp out
  qRack0: 0.47, // camera position (in old-q units) when the rack comes into view
  qRack1: 0.57, // slow push-in while the rack plays
  qExit: 0.82   // where the warp ends (flash covers the swap)
};

const ease = (u) => u * u * (3 - 2 * u);

export function layout(n, cfg = CFG) {
  const slot = cfg.out + cfg.hold + cfg.inn + cfg.gap;
  const tFly = cfg.zoom;
  const tRack = tFly + cfg.fly;
  const tExit = tRack + n * slot;
  const tEnd = tExit + cfg.exit;
  return { slot, tFly, tRack, tExit, tEnd };
}

export function sample(t, n = 7, cfg = CFG) {
  const L = layout(n, cfg);
  const s = {
    t, phase: 'room', mode: 'room', r: 0, q: 0,
    air: 1 - sstep(0.05, 0.9, t),     // hero text layer
    pips: false, index: -1, active: -1, slotPhase: 'none', card: 0,
    flash: 0, done: false
  };

  if (t < L.tFly) {
    s.r = clamp(t / cfg.zoom);
    return s;
  }

  s.mode = 'world';
  s.r = 1;

  if (t < L.tRack) {
    const u = (t - L.tFly) / cfg.fly;
    s.phase = 'fly';
    s.q = cfg.qRack0 * ease(clamp(u));
    s.pips = true;
    return s;
  }

  if (t < L.tExit) {
    const local = t - L.tRack;
    const idx = Math.min(n - 1, Math.floor(local / L.slot));
    const k = local - idx * L.slot;
    s.phase = 'rack';
    s.q = cfg.qRack0 + (cfg.qRack1 - cfg.qRack0) * clamp(local / (n * L.slot));
    s.pips = true;
    s.index = idx;
    s.active = idx;
    s.slotPhase = k < cfg.out ? 'out' : k < cfg.out + cfg.hold ? 'hold' : k < cfg.out + cfg.hold + cfg.inn ? 'in' : 'gap';
    s.card = sstep(cfg.out * 0.45, cfg.out, k) * (1 - sstep(cfg.out + cfg.hold - 0.25, cfg.out + cfg.hold, k));
    return s;
  }

  if (t < L.tEnd) {
    const u = clamp((t - L.tExit) / cfg.exit);
    s.phase = 'exit';
    s.q = cfg.qRack1 + (cfg.qExit - cfg.qRack1) * u * u;
    s.flash = sstep(0.72, 1, u);
    return s;
  }

  s.phase = 'done';
  s.q = cfg.qExit;
  s.flash = 1;
  s.done = true;
  return s;
}

// Does this disk want to be out of the container right now?
export const diskOut = (s, i) => s.active === i && (s.slotPhase === 'out' || s.slotPhase === 'hold');

export function createIntro(n = 7, cfg = CFG) {
  const L = layout(n, cfg);
  let t = 0, started = false, paused = false;
  return {
    L,
    get t() { return t; },
    get started() { return started; },
    get paused() { return paused; },
    start() { started = true; },
    pause(v) { paused = !!v; },
    update(dt) { if (started && !paused) t = Math.min(L.tEnd, t + dt); },
    seekTrack(i) {
      started = true;
      t = L.tRack + clamp(Math.round(i), 0, n - 1) * L.slot + 0.001;
    },
    seek(x) { started = true; t = clamp(x, 0, L.tEnd); },
    // jump to the end of the sequence (used by "skip")
    finish() { started = true; t = L.tEnd; },
    sample() { return sample(t, n, cfg); }
  };
}
