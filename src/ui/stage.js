import { scramble } from './shell.js';
import { TRACKS } from '../data.js';

// All the HTML that lives on top of the canvas during the intro: the hero text,
// the track info card, the track pips and the skip button. It only reads the
// sampled timeline state; it never decides what happens next.
export function createStage({ onPip, onSkip, onExplore, onHold }) {
  const $ = (id) => document.getElementById(id);
  const intro = $('intro'), air = $('lAir'), card = $('trackCard'), pips = $('pips');
  const tcNum = $('tcNum'), tcName = $('tcName'), tcBlurb = $('tcBlurb'), flash = $('flash');
  const n = TRACKS.length;
  let shown = -1, airOn = true, hidden = false;

  const buttons = TRACKS.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.n;
    b.title = t.name;
    b.setAttribute('aria-label', `Track ${t.n}: ${t.name}`);
    b.addEventListener('click', () => onPip(i));
    pips.appendChild(b);
    return b;
  });

  $('introSkip').addEventListener('click', onSkip);
  $('exploreBtn').addEventListener('click', onExplore);
  // reading time: hovering the card holds the current disk out
  card.addEventListener('pointerenter', () => onHold(true));
  card.addEventListener('pointerleave', () => onHold(false));

  const setAir = (a) => {
    air.style.opacity = a.toFixed(3);
    air.style.transform = `translateY(${((1 - a) * 40).toFixed(1)}px)`;
    const on = a > .01;
    if (on !== airOn) {
      airOn = on;
      air.classList.toggle('on', on);
      air.setAttribute('aria-hidden', String(!on));
      air.querySelectorAll('a,button').forEach(l => (on ? l.removeAttribute('tabindex') : l.setAttribute('tabindex', '-1')));
    }
  };

  return {
    update(S, ending = 0) {
      setAir(S.air);
      intro.style.setProperty('--scrim', (S.mode === 'room' ? S.air : 0).toFixed(3));

      const showPips = S.pips && !hidden;
      pips.hidden = !showPips;
      buttons.forEach((b, i) => {
        const on = i === S.index;
        if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
        if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });

      if (S.index >= 0 && S.index !== shown) {
        shown = S.index;
        const t = TRACKS[shown];
        tcNum.textContent = `Track ${t.n}`;
        scramble(tcName, t.name, 380);
        tcBlurb.textContent = t.blurb;
      }
      const a = hidden ? 0 : S.card;
      card.style.opacity = a.toFixed(3);
      card.style.visibility = a > .02 ? 'visible' : 'hidden';
      card.style.setProperty('--dy', `${((1 - a) * 16).toFixed(1)}px`);
      card.setAttribute('aria-hidden', String(a < .05));

      flash.style.opacity = Math.max(S.flash, ending).toFixed(3);
    },
    // called when the intro is being cut short
    hideUi() {
      hidden = true;
      $('introSkip').hidden = true;
      pips.hidden = true;
      card.style.visibility = 'hidden';
      setAir(0);
    },
    flash
  };
}
