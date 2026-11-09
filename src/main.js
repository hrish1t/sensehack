import './styles.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { V, sstep, bump, monotone, fontsReady } from './lib/utils.js';
import { createShell, REDUCE } from './ui/shell.js';
import { startCountdown } from './ui/countdown.js';
import { startBoot } from './ui/boot.js';
import { createCursor } from './ui/cursor.js';
import { createStage } from './ui/stage.js';
import { initSite } from './ui/site.js';
import { createTV, SCREEN } from './scene/tv.js';
import { createWorld, pathPoint, WORLD_Z0 } from './scene/world.js';
import { createPost } from './scene/post.js';
import { redrawLabels } from './scene/props.js';
import { createIntro, diskOut } from './intro/timeline.js';
import { TRACKS } from './data.js';

// ── page-level wiring ──────────────────────────────────────────────────────
const html = document.documentElement;
const shell = createShell();
startCountdown();
const site = initSite();
const boot = startBoot();

let introActive = true;
let skipIntro = (after) => { after && after(); };   // replaced once the 3D intro is running

// A nav click during the intro first ends it, then scrolls.
shell.setNavGate((run) => {
  if (!introActive) return false;
  skipIntro(run);
  return true;
});

// Hand over from the intro to the normal site: native scrolling, no 3D, no
// scroll-driven anything.
function revealSite() {
  html.classList.remove('intro-on');
  html.classList.add('site-on');
  document.getElementById('intro')?.remove();
  document.querySelector('.fallback')?.remove();
  window.scrollTo(0, 0);
  site.runCounters();
}

// ── WebGL ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gl');
let renderer = null;
if (!REDUCE) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    renderer = null;
  }
}

if (renderer) {
  run(renderer);
} else {
  // No WebGL, or the visitor prefers reduced motion: go straight to the site.
  introActive = false;
  canvas.remove();
  revealSite();
  boot.ready();
}

function run(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const world = createWorld(envTex);
  const tv = createTV(envTex);
  const post = createPost(renderer, tv.scene, tv.camera);
  const cursor = createCursor();
  const intro = createIntro(TRACKS.length);

  const ac = new AbortController();
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ac.signal });

  let raf = 0, finished = false, ending = null, booted = boot.isDone();
  let autoAt = Infinity;

  // ── intro control ────────────────────────────────────────────────────────
  const startIntro = () => {
    if (!booted || intro.started || ending) return;
    intro.start();
  };
  const jumpTo = (i) => {
    if (ending || !booted) return;
    intro.seekTrack(i);
    tv.state.burst = Math.max(tv.state.burst, .2);
  };
  const stage = createStage({
    onPip: jumpTo,
    onSkip: () => skip(),
    onExplore: startIntro,
    onHold: (v) => intro.pause(v)
  });

  // `after` runs once the site is up (used for nav clicks like "FAQ").
  function skip(after) {
    if (finished) { after && after(); return; }
    if (ending) { ending.after = after || ending.after; return; }
    ending = { t0: performance.now(), after };
    stage.hideUi();
  }
  skipIntro = skip;

  function finish() {
    if (finished) return;
    finished = true;
    introActive = false;
    const after = ending && ending.after;
    cancelAnimationFrame(raf);
    ac.abort();
    cursor.destroy();

    revealSite();

    tv.dispose();
    world.dispose();
    post.composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();

    // flash is still fully on; fade it away over the site
    const f = stage.flash;
    f.style.transition = 'opacity .9s ease';
    requestAnimationFrame(() => { f.style.opacity = '0'; });
    setTimeout(() => f.remove(), 1000);

    after && after();
  }

  fontsReady.then(() => {
    redrawLabels();
    tv.refreshText();
    world.rack.refresh();
  });

  const zDiskCam = world.diskPos.z + 6.2;
  const depthAt = monotone([[0, WORLD_Z0], [.10, 3.5], [.40, -58], [.47, zDiskCam], [.62, zDiskCam - .8], [.73, -101], [.80, -128], [1, -156]]);

  let W = 0, H = 0, portrait = false, baseFov = 50;
  function resize() {
    W = innerWidth;
    H = innerHeight;
    portrait = W / H < .8;
    const dpr = Math.min(devicePixelRatio || 1, W < 760 ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    post.setSize(W, H, dpr);
    world.camera.aspect = W / H;
    tv.camera.aspect = W / H;
    baseFov = portrait ? 64 : 50;
    tv.camera.fov = portrait ? 52 : 40;
    tv.camera.updateProjectionMatrix();
  }
  on(window, 'resize', resize);
  resize();

  function roomPose(r) {
    const cam = tv.camera;
    const tf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const fitH = 6.4 / tf, fitW = (portrait ? 5.5 : 6.8) / (tf * cam.aspect);
    const dist = Math.max(fitH, fitW) * (portrait ? 1.0 : 1.1);
    const start = V(-.2, 1.4, 3 + dist), startLook = V(-.2, .3, 0);
    const endDist = Math.max(2.5 / tf, 3.3 / (tf * cam.aspect)) * .9;
    const end = V(SCREEN.x, SCREEN.y, SCREEN.z + .3 + endDist), endLook = V(SCREEN.x, SCREEN.y, SCREEN.z);
    const e = r * r * r * (r * (6 * r - 15) + 10);
    return { pos: start.lerp(end, e), look: startLook.lerp(endLook, e), e };
  }

  // ── pointer picking ──────────────────────────────────────────────────────
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, ndc: new THREE.Vector2(9, 9), moved: false };
  const ray = new THREE.Raycaster();
  let mode = 'room';
  let hovered = null;

  const rootOf = (o, list) => { while (o && !list.includes(o)) o = o.parent; return o; };
  function pick() {
    if (mode === 'room') {
      ray.setFromCamera(mouse.ndc, tv.camera);
      const hit = ray.intersectObjects(tv.hoverables, true);
      return hit.length ? rootOf(hit[0].object, tv.hoverables) : null;
    }
    ray.setFromCamera(mouse.ndc, world.camera);
    const visible = world.hoverables.filter(o => o.visible);
    const hit = ray.intersectObjects(visible, true);
    return hit.length ? rootOf(hit[0].object, visible) : null;
  }

  on(window, 'pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth * 2 - 1;
    mouse.ty = e.clientY / innerHeight * 2 - 1;
    mouse.ndc.set(mouse.tx, -mouse.ty);
    mouse.moved = true;
  }, { passive: true });

  on(canvas, 'pointerdown', (e) => {
    if (ending) return;
    mouse.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
    const hit = pick();
    if (!hit) { startIntro(); return; }
    const u = hit.userData;
    if (u.action === 'channel') {
      u.target += .8 * u.dir;
      tv.state.power = 1;
      tv.setChannel(u.dir);
      autoAt = performance.now() + 6000;          // they're playing with the TV: don't hurry them
    } else if (u.action === 'power') {
      tv.state.power = tv.state.power > .5 ? 0 : 1;
      shell.say(tv.state.power ? 'Tube warming up.' : 'Off. Press any key to switch it back on.');
      autoAt = performance.now() + 6000;
    } else if (u.action === 'screen') {
      startIntro();
    } else if (u.trackIndex !== undefined) {
      jumpTo(u.trackIndex);
    } else {
      u.kick = 9;
      if (u.fall) u.fall.speed += 3;
    }
  });

  // First wheel / swipe / key press starts the show (it also auto-starts shortly after boot).
  const wake = () => startIntro();
  on(window, 'wheel', wake, { passive: true });
  on(window, 'touchmove', wake, { passive: true });
  on(window, 'keydown', (e) => {
    if (!booted) return;
    if (e.key === 'Escape') { skip(); return; }
    const S = intro.sample();
    if (S.phase === 'rack' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      jumpTo(Math.max(0, Math.min(TRACKS.length - 1, S.index + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if ([' ', 'Enter', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.key) && !intro.started) {
      if (e.target.closest && e.target.closest('a,button')) return;   // don't steal from focused controls
      e.preventDefault();
      startIntro();
    }
  });

  on(window, 'boot:done', () => { booted = true; autoAt = performance.now() + 3600; });
  if (booted) autoAt = performance.now() + 3600;

  // ── frame loop ───────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  let time = 0, frameN = 0, prevZ = null, warp = 0, first = true;

  function frame() {
    if (finished) return;
    raf = requestAnimationFrame(frame);

    const dt = Math.min(clock.getDelta(), .05);
    const motion = 1;
    time += dt;
    frameN++;

    if (!intro.started && booted && performance.now() > autoAt) startIntro();
    if (!ending) intro.update(dt);
    const S = intro.sample();
    if (S.done && !ending) skip();

    let endK = 0;
    if (ending) {
      endK = Math.min(1, (performance.now() - ending.t0) / 350);
      if (endK >= 1) { finish(); return; }
    }

    const q = S.q;
    const ease = 1 - Math.exp(-dt * 3);
    mouse.x += (mouse.tx - mouse.x) * ease;
    mouse.y += (mouse.ty - mouse.y) * ease;

    if (S.mode !== mode) {
      mode = S.mode;
      hovered = null;
      cursor.cold();
      tv.state.burst = Math.max(tv.state.burst, .3);
    }

    world.update({ time, dt, q, motion });
    tv.state.burst = Math.max(0, tv.state.burst - dt);

    let z = WORLD_Z0;

    if (mode === 'room') {
      const r = S.r;
      const cam = tv.camera;
      const { pos, look: target, e } = roomPose(r);
      const amp = (1 - e) * .9;
      cam.position.copy(pos).add(tmp.set(mouse.x * amp, -mouse.y * amp * .5, 0));
      cam.lookAt(target.add(tmp.set(mouse.x * amp * .15, 0, 0)));
      cam.setViewOffset(W, H, 0, H * (portrait ? .1 : .07) * (1 - e), W, H);
      tv.tv.rotation.y = mouse.x * .07 * (1 - e) + Math.sin(time * .3) * .015 * (1 - e);
      post.show(tv.scene, cam);

      const s = tv.state;
      if (intro.started) s.power = 1;
      const want = booted ? s.power : 0;
      s.powerT += (want - s.powerT) * (1 - Math.exp(-dt * (want ? 2.4 : 6)));
      const u = tv.screenMat.uniforms;
      u.uPower.value = s.powerT;
      u.uMix.value = 1 - sstep(.18, .62, r);
      u.uStatic.value = .015 + s.burst * 2.2 + bump(.15, .25, .35, .5, r) * .35 + sstep(.95, 1, r) * .7;
      u.uTime.value = time;
      tv.screenLight.intensity = (30 + Math.sin(time * 9) * 3 + Math.random() * 4) * s.powerT;
      tv.led.material.emissiveIntensity = s.power ? 2 : .2;
      tv.pool.material.opacity = .32 * s.powerT;
      tv.halo.material.opacity = .16 * (.3 + .7 * s.powerT);
      for (const k of tv.knobs) {
        k.userData.rot += (k.userData.target - k.userData.rot) * (1 - Math.exp(-dt * 10));
        k.rotation.z = -k.userData.rot;
      }
      tv.dust.rotation.y += dt * .01 * motion;

      world.screenCamera.position.set(mouse.x * .5, -mouse.y * .3, WORLD_Z0);
      world.screenCamera.lookAt(0, 0, WORLD_Z0 - 10);
      world.camLight.position.copy(world.screenCamera.position);
      if (u.uMix.value < .999 || frameN % 6 === 0) {
        world.glow.visible = true;
        renderer.setRenderTarget(tv.worldTarget);
        renderer.render(world.scene, world.screenCamera);
        renderer.setRenderTarget(null);
      }

      post.retro.uCRT.value = 0;
      post.retro.uGlitch.value = sstep(.9, 1, r) * .5 + s.burst * .8;
      post.retro.uAb.value = .006 + sstep(.7, 1, r) * .01;
      prevZ = null;
      warp = 0;
    } else {
      const cam = world.camera;
      z = depthAt(q);
      const speed = prevZ === null ? 0 : Math.abs(z - prevZ) / Math.max(dt, 1e-3);
      prevZ = z;
      warp += (Math.min(1, speed / 45) - warp) * (1 - Math.exp(-dt * 4));

      const pos = pathPoint(z);
      const inside = sstep(2, -8, z), outside = sstep(-121, -132, z);
      const amp = (1 - inside) * .5 + inside * .22 + outside * .6;
      cam.position.copy(pos).add(tmp.set(mouse.x * amp, -mouse.y * amp * .6, 0));
      look.copy(pathPoint(z - 10));
      look.lerp(world.diskPos, bump(.43, .47, .61, .65, q));
      look.add(tmp.set(mouse.x * amp * .3, -mouse.y * amp * .2 + outside * Math.sin(time * .2) * 1.2, 0));
      cam.lookAt(look);
      const ahead = pathPoint(z - 4);
      cam.rotateZ(-mouse.x * .04 - inside * (1 - outside) * (ahead.x - pos.x) * .9 + warp * Math.sin(time * 1.3) * .03);
      world.camLight.position.copy(cam.position);

      // the rack sits to one side so the info card has room
      const shift = bump(.42, .47, .6, .64, q);
      cam.fov = baseFov + warp * 16;
      cam.setViewOffset(W, H, portrait ? 0 : -W * .2 * shift, portrait ? H * .17 * shift : 0, W, H);
      post.show(world.scene, cam);
      world.glow.visible = z > -123;
      world.glow.scale.setScalar(46 + sstep(-90, -122, z) * 40);

      const glitch = bump(.635, .665, .71, .745, q) + warp * .08 + tv.state.burst * 1.2;
      world.tunnel.uniforms.uAlt.value = bump(.63, .66, .72, .76, q);
      world.tunnel.uniforms.uWarp.value = warp;
      post.retro.uGlitch.value = glitch;
      post.retro.uAb.value = .006 + warp * .02;
      post.retro.uCRT.value = 1 - sstep(0, .08, q);

      // one disk out at a time: the timeline says which, the rack animates it
      for (let i = 0; i < TRACKS.length; i++) world.rack.setTarget(i, diskOut(S, i) ? 1 : 0, time);
      world.rack.update(time, dt);
    }

    if (cursor.fine && frameN % 2 === 0 && mouse.moved) {
      const h = pick();
      if (h !== hovered) {
        hovered = h;
        if (h) cursor.hot(h.userData.label);
        else cursor.cold();
      }
    }
    cursor.update(dt);

    stage.update(S, endK);

    post.retro.uTime.value = time;
    post.render();
    if (first) {
      first = false;
      html.classList.add('gl-ready');
      boot.ready();
    }
  }
  raf = requestAnimationFrame(frame);

  // Test/debug hook: open the page with ?debug to drive the timeline by hand.
  if (location.search.includes('debug')) window.__sh = { intro, world, tv, skip, get time() { return time; } };
}
