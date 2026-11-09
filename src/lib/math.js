// Tiny math helpers with no dependencies, so they can run in node tests.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const bump = (a, b, c, d, x) => sstep(a, b, x) * (1 - sstep(c, d, x));

export const easeInOutCubic = (u) => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
