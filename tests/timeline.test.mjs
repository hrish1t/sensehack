import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, layout, sample, createIntro, diskOut } from '../src/intro/timeline.js';

const N = 7;
const L = layout(N);
const eps = 1e-6;

test('total length is the sum of its parts', () => {
  const slot = CFG.out + CFG.hold + CFG.inn + CFG.gap;
  assert.ok(Math.abs(L.tEnd - (CFG.zoom + CFG.fly + N * slot + CFG.exit)) < eps);
});

test('phases occur in order and never go backwards', () => {
  const order = ['room', 'fly', 'rack', 'exit', 'done'];
  let last = 0;
  for (let t = 0; t <= L.tEnd + 1; t += 0.01) {
    const i = order.indexOf(sample(t, N).phase);
    assert.ok(i >= last, `phase went backwards at t=${t}`);
    last = i;
  }
  assert.equal(order[last], 'done');
});

test('q is monotonic non-decreasing and continuous', () => {
  let prev = sample(0, N).q;
  for (let t = 0.005; t <= L.tEnd + 0.5; t += 0.005) {
    const q = sample(t, N).q;
    assert.ok(q >= prev - eps, `q decreased at t=${t}`);
    assert.ok(q - prev < 0.01, `q jumped ${q - prev} at t=${t}`);
    prev = q;
  }
  assert.ok(Math.abs(sample(L.tFly, N).q) < 1e-9, 'world q starts at 0 (matches TV screen camera)');
  assert.ok(Math.abs(sample(L.tRack - 1e-9, N).q - CFG.qRack0) < 1e-6, 'fly ends where rack starts');
  assert.ok(Math.abs(sample(L.tExit - 1e-9, N).q - CFG.qRack1) < 1e-6, 'rack ends where exit starts');
});

test('every track gets exactly one out→hold→in cycle, strictly one after another', () => {
  const seen = [];
  let prevKey = null;
  for (let t = L.tRack; t < L.tExit; t += 0.005) {
    const s = sample(t, N);
    const key = `${s.active}:${s.slotPhase}`;
    if (key !== prevKey) { seen.push(key); prevKey = key; }
  }
  const expected = [];
  for (let i = 0; i < N; i++) expected.push(`${i}:out`, `${i}:hold`, `${i}:in`, `${i}:gap`);
  assert.deepEqual(seen, expected);
});

test('at most one disk wants to be out at any moment', () => {
  for (let t = 0; t <= L.tEnd; t += 0.01) {
    const s = sample(t, N);
    let n = 0;
    for (let i = 0; i < N; i++) if (diskOut(s, i)) n++;
    assert.ok(n <= 1, `${n} disks out at t=${t}`);
  }
});

test('a disk is told to go back in before the next one is told to come out', () => {
  for (let i = 0; i < N - 1; i++) {
    const slotStart = L.tRack + i * L.slot;
    const sIn = slotStart + CFG.out + CFG.hold;           // target flips to 0
    const nextOut = L.tRack + (i + 1) * L.slot;           // next target flips to 1
    // the disk needs `inn` seconds to tween home, so it must be home by nextOut
    assert.ok(nextOut - sIn >= CFG.inn - eps, `track ${i}: only ${(nextOut - sIn).toFixed(2)}s to slide in`);
    assert.equal(diskOut(sample(sIn + 0.01, N), i), false);
    assert.equal(diskOut(sample(nextOut + 0.01, N), i), false);
    assert.equal(diskOut(sample(nextOut + 0.01, N), i + 1), true);
  }
});

test('info card is only visible while its disk is out, and is fully on during hold', () => {
  for (let t = L.tRack; t < L.tExit; t += 0.005) {
    const s = sample(t, N);
    assert.ok(s.card >= 0 && s.card <= 1);
    if (s.slotPhase === 'in' || s.slotPhase === 'gap') {
      assert.ok(s.card < 1e-6 || s.slotPhase === 'in' && s.card >= 0, 'card hidden when disk is going home');
    }
  }
  for (let i = 0; i < N; i++) {
    const mid = L.tRack + i * L.slot + CFG.out + CFG.hold / 2 - 0.3;
    assert.ok(sample(mid, N).card > 0.99, `card not fully visible mid-hold for track ${i}`);
    assert.ok(sample(L.tRack + i * L.slot + CFG.out + CFG.hold + 0.01, N).card < 1e-6, `card lingers into slide-in for track ${i}`);
    assert.ok(sample(L.tRack + i * L.slot + 0.001, N).card < 1e-6, `card visible before disk moves for track ${i}`);
  }
});

test('hero overlay is fully visible before start and gone by 1s', () => {
  assert.equal(sample(0, N).air, 1);
  assert.equal(sample(1, N).air, 0);
});

test('flash only rises in the exit and is 1 at the end', () => {
  assert.equal(sample(L.tExit - 0.01, N).flash, 0);
  assert.equal(sample(L.tEnd, N).flash, 1);
  assert.equal(sample(L.tEnd, N).done, true);
  assert.equal(sample(L.tEnd - 0.01, N).done, false);
});

test('controller: does not advance until started, honours pause, clamps at end', () => {
  const it = createIntro(N);
  it.update(5);
  assert.equal(it.t, 0);
  it.start();
  it.update(1);
  assert.equal(it.t, 1);
  it.pause(true);
  it.update(5);
  assert.equal(it.t, 1);
  it.pause(false);
  it.update(1000);
  assert.equal(it.t, L.tEnd);
  assert.equal(it.sample().done, true);
});

test('controller: seekTrack lands at the start of that track\'s slot', () => {
  const it = createIntro(N);
  for (let i = 0; i < N; i++) {
    it.seekTrack(i);
    const s = it.sample();
    assert.equal(s.phase, 'rack');
    assert.equal(s.active, i);
    assert.equal(s.slotPhase, 'out');
  }
  it.seekTrack(-5); assert.equal(it.sample().active, 0);
  it.seekTrack(99); assert.equal(it.sample().active, N - 1);
});

test('works for other track counts', () => {
  for (const n of [1, 3, 7, 10]) {
    const l = layout(n);
    const mid = sample(l.tRack + (n - 0.5) * l.slot, n);
    assert.equal(mid.active, n - 1);
    assert.equal(sample(l.tEnd, n).done, true);
  }
});
