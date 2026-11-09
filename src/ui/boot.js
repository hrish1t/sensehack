import { REDUCE } from './shell.js';

const LINES = [
  'SENSE-BIOS v26.0  (c) IEEE-VIT × IEEE ComSoc',
  'MEMORY TEST ........ 640K OK',
  'DETECTING DISPLAY .. CRT 14" COLOUR',
  'WARMING TUBE ....... OK',
  'TUNING CHANNEL 26',
  'LOADING TUNNEL.SYS',
  'READY.'
];

export function startBoot() {
  const boot = document.getElementById('boot');
  const log = document.getElementById('bootLog');
  const bar = document.getElementById('bootBar');
  const pct = document.getElementById('bootPct');
  const minTime = REDUCE ? 0 : 1700;
  const t0 = performance.now();
  let done = false;
  let sceneReady = false;

  const finish = () => {
    if (done) return;
    done = true;
    boot.classList.add('done');
    setTimeout(() => { boot.hidden = true; }, 700);
    window.dispatchEvent(new Event('boot:done'));
  };

  (function tick() {
    if (done) return;
    const k = Math.min(1, (performance.now() - t0) / Math.max(1, minTime));
    const target = sceneReady ? k : Math.min(k, .86);
    bar.style.width = (target * 100).toFixed(1) + '%';
    pct.textContent = String(Math.round(target * 100)).padStart(3, '0') + '%';
    log.textContent = LINES.slice(0, Math.max(1, Math.ceil(target * LINES.length))).join('\n');
    if (target >= 1) setTimeout(finish, 250);
    else requestAnimationFrame(tick);
  })();

  document.getElementById('bootSkip').addEventListener('click', finish);
  addEventListener('keydown', (e) => {
    if (!done && (e.key === 'Escape' || e.key === 'Enter')) finish();
  });
  setTimeout(() => { sceneReady = true; }, 6000);

  return {
    ready() { sceneReady = true; },
    isDone: () => done
  };
}
