export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

const GLYPHS = '▓▒░#%&@$01<>/\\';

export function scramble(el, text, dur = 420) {
  if (REDUCE) {
    el.textContent = text;
    return;
  }
  const t0 = performance.now();
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      out += (i / text.length < k || text[i] === ' ') ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

// Header, mobile menu, toast and anchor navigation. Scrolling is the browser's own
// (CSS `scroll-behavior: smooth` + scroll-margin on sections): nothing here
// hijacks the wheel.
export function createShell() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const toast = document.getElementById('toast');
  let toastTimer;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const menu = document.getElementById('menu');
  const menuBtn = document.getElementById('menuBtn');
  const setMenu = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // While the intro is playing, a nav click first has to end it. `gate(run)`
  // returns true if it took over (it will call run() itself once the site is up).
  let gate = null;
  const setNavGate = (fn) => { gate = fn; };

  const scrollToHash = (hash) => {
    if (!hash || hash === '#top') {
      window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
      return;
    }
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
  };

  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const hash = a.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;   // external link (e.g. the real registration URL)
    e.preventDefault();
    setMenu(false);
    const run = () => {
      scrollToHash(hash);
      if (hash && hash !== '#top') history.replaceState(null, '', hash);
    };
    if (gate && gate(run)) return;
    run();
  }));

  document.querySelectorAll('[data-scramble]').forEach(a => {
    const t = a.textContent;
    a.addEventListener('mouseenter', () => scramble(a, t));
  });

  return { say, setNavGate, scrollToHash };
}
