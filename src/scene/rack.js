import * as THREE from 'three';
import { canvasTex } from '../lib/utils.js';
import { easeInOutCubic, clamp } from '../lib/math.js';
import { makeFloppy } from './props.js';
import { DISK_COLORS } from '../data.js';

// A floppy-disk file box holding one disk per track.
//
// Disks stand side by side inside the box. The rack is yawed so the camera sees
// the stack at an angle. One disk at a time slides up out of its slot, turns to
// face the camera and opens its shutter. When told to go home it does all of
// that in reverse.
//
// The timeline decides WHICH disk wants to be out (setTarget). This module only
// handles how it looks getting there: each disk owns a fixed-duration tween, so
// seeking or skipping mid-slide never snaps.

const SCALE = .78;
const YAW = -.82;            // rack rotation: how much of the stack's side we see
const PITCH = .5;            // spacing between disks along the stack
const FLOOR = .12;           // box floor thickness
const WALL_H = 2.05;         // height of box walls (disks stand taller than this)
const DISK_H = 3.7;
const RISE = 2.35;           // how far a disk travels up to clear the box
const PULL = 1.05;           // how far it comes forward toward the camera
const TWEEN = .85;           // seconds, must match CFG.out / CFG.inn in the timeline

const plastic = new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: .5, metalness: .1, envMapIntensity: .8 });
const trim = new THREE.MeshStandardMaterial({ color: '#3a322d', roughness: .35, metalness: .55, envMapIntensity: 1 });
const hot = new THREE.MeshStandardMaterial({ color: '#ff5a1f', emissive: '#ff5a1f', emissiveIntensity: .55, roughness: .4 });

function drawPlate(c, w, h, n) {
  c.fillStyle = '#efe6da';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#ff5a1f';
  c.fillRect(0, 0, 14, h);
  c.fillStyle = '#1a1210';
  c.font = '600 22px "IBM Plex Mono", ui-monospace, monospace';
  c.fillText('SENSE HACK \u201926  \u00b7  TRACK DISKS', 36, 46);
  c.font = 'italic 54px "Instrument Serif", Georgia, serif';
  c.fillText(`${n} tracks`, 34, 100);
}

export function createRack(scene, tracks, anchor) {
  const n = tracks.length;
  const depth = n * PITCH + .5;
  const root = new THREE.Group();
  root.position.copy(anchor);
  root.rotation.y = YAW;
  root.scale.setScalar(SCALE);
  scene.add(root);

  // --- the box -------------------------------------------------------------
  const innerW = 3.7;
  const wallT = .14;
  const box = new THREE.Group();
  root.add(box);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(innerW + wallT * 2, FLOOR, depth + wallT * 2), plastic);
  floor.position.y = FLOOR / 2;
  box.add(floor);

  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(wallT, WALL_H, depth + wallT * 2), plastic);
    w.position.set(sx * (innerW / 2 + wallT / 2), WALL_H / 2, 0);
    box.add(w);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(wallT + .06, .08, depth + wallT * 2 + .06), trim);
    rail.position.set(sx * (innerW / 2 + wallT / 2), WALL_H + .02, 0);
    box.add(rail);
  }
  for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(innerW + wallT * 2, WALL_H, wallT), plastic);
    w.position.set(0, WALL_H / 2, sz * (depth / 2 + wallT / 2));
    box.add(w);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(innerW + wallT * 2 + .06, .08, wallT + .06), trim);
    rail.position.set(0, WALL_H + .02, sz * (depth / 2 + wallT / 2));
    box.add(rail);
  }
  // orange accent line under the rim and the name plate on the front wall
  const accent = new THREE.Mesh(new THREE.BoxGeometry(innerW + wallT * 2 + .02, .07, .02), hot);
  accent.position.set(0, WALL_H - .3, depth / 2 + wallT + .005);
  box.add(accent);
  const plateTex = canvasTex(512, 128, (c, w, h) => drawPlate(c, w, h, String(n).padStart(2, '0')));
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, .72),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: .85 })
  );
  plate.position.set(0, WALL_H / 2 - .12, depth / 2 + wallT + .012);
  box.add(plate);

  // --- the disks -----------------------------------------------------------
  const disks = tracks.map((t, i) => {
    const [body, stripe] = DISK_COLORS[i % DISK_COLORS.length];
    const g = makeFloppy(scene, body, t.short, stripe, `track ${t.n} / ${String(n).padStart(2, '0')}`);
    root.add(g);
    const z = (i - (n - 1) / 2) * PITCH;
    const restY = FLOOR + DISK_H / 2;
    g.position.set(0, restY, z);
    g.userData.label = `Track ${t.n} · ${t.name} · click`;
    g.userData.trackIndex = i;
    return { g, i, z, restY, s: 0, from: 0, to: 0, t0: 0, open: 0 };
  });

  const hoverables = disks.map(d => d.g);

  function apply(d) {
    const rise = easeInOutCubic(clamp(d.s / .68));
    const turn = easeInOutCubic(clamp((d.s - .32) / .68));
    d.g.position.set(0, d.restY + RISE * rise, d.z + PULL * turn);
    // turn from the rack's yaw to face the camera; a little tilt keeps it alive
    d.g.rotation.set(-.06 * turn, -YAW * turn, .03 * turn);
    d.g.scale.setScalar(1 + .1 * turn);
  }

  function setTarget(i, v, time) {
    const d = disks[i];
    if (d.to === v) return;
    d.from = d.s;
    d.to = v;
    d.t0 = time;
  }

  function update(time, dt) {
    for (const d of disks) {
      const k = clamp((time - d.t0) / TWEEN);
      d.s = d.from + (d.to - d.from) * k;
      apply(d);
      // shutter opens once the disk has mostly turned to face us
      const want = d.s > .9 ? 1 : 0;
      d.open += (want - d.open) * (1 - Math.exp(-dt * 8));
      d.g.userData.shutter.position.x = .2 - d.open * .95;
    }
  }

  // park everything at rest immediately
  disks.forEach(apply);

  const refresh = () => {
    drawPlate(plateTex.image.getContext('2d'), 512, 128, String(n).padStart(2, '0'));
    plateTex.needsUpdate = true;
  };

  return { root, disks, hoverables, setTarget, update, refresh, depth };
}
