import { REDUCE } from './shell.js';

export function createCursor() {
  const fine = matchMedia('(pointer: fine)').matches && !REDUCE;
  const el = document.getElementById('cur');
  const label = document.getElementById('curLbl');
  let x = -100, y = -100, tx = -100, ty = -100;

  const onMove = (e) => { tx = e.clientX; ty = e.clientY; };
  if (fine) {
    document.documentElement.classList.add('has-cursor');
    addEventListener('pointermove', onMove, { passive: true });
  }

  return {
    fine,
    hot(text) {
      el.classList.add('hot');
      label.textContent = text || '';
    },
    cold() {
      el.classList.remove('hot');
    },
    grab(on) {
      el.classList.toggle('grab', on);
    },
    destroy() {
      removeEventListener('pointermove', onMove);
      document.documentElement.classList.remove('has-cursor');
      el.style.display = 'none';
    },
    update(dt) {
      if (!fine) return;
      const k = 1 - Math.exp(-dt * 18);
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  };
}
