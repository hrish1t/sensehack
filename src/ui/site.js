import { TRACKS, REGISTER_URL } from '../data.js';
import { REDUCE } from './shell.js';

// Content for the normal site. Everything here runs once; nothing listens to scroll.
export function initSite() {
  // Tracks section is generated from the same data as the floppy labels.
  const grid = document.getElementById('trackGrid');
  grid.innerHTML = TRACKS.map(t =>
    `<li class="track-item"><span class="tn">Track ${t.n}</span><h3>${t.name}</h3><p>${t.blurb}</p></li>`
  ).join('');

  // Registration link: in-page until a real URL is set in data.js.
  if (!REGISTER_URL.startsWith('#')) {
    const b = document.getElementById('registerBtn');
    b.href = REGISTER_URL;
    b.target = '_blank';
    b.rel = 'noopener';
  }

  // Gallery tiles show a labelled placeholder until the real photo file exists.
  document.querySelectorAll('.shot img').forEach(img => {
    img.addEventListener('error', () => img.closest('.shot').classList.add('missing'));
  });

  const counts = [...document.querySelectorAll('[data-count]')].map(el => ({
    el, n: +el.dataset.count, plus: el.hasAttribute('data-plus')
  }));
  const paint = (k) => counts.forEach(c => { c.el.textContent = Math.round(c.n * k) + (c.plus && k >= 1 ? '+' : ''); });
  paint(0);

  return {
    // Time-based count-up, started once when the intro hands over to the site.
    runCounters() {
      if (REDUCE) { paint(1); return; }
      const t0 = performance.now(), dur = 1600;
      (function step(now) {
        const u = Math.min(1, (now - t0) / dur);
        paint(1 - Math.pow(1 - u, 3));
        if (u < 1) requestAnimationFrame(step);
      })(t0);
    }
  };
}
