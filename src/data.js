// Single source of truth for track content. Used by the 3D floppy labels, the
// info card in the intro, and the Tracks section of the site.
//
// `short` / `sub` are what is printed on the physical floppy label.
// `blurb` is the one-liner shown on the info card and in the Tracks section.
// TODO: the blurbs are placeholder copy: replace with the official track briefs.

export const TRACKS = [
  { n: '01', name: 'Smart Healthcare', short: 'healthcare', blurb: 'Sensing, monitoring and assistive systems that bring care closer to the patient.' },
  { n: '02', name: 'Smart Cities', short: 'smart cities', blurb: 'Connected infrastructure for mobility, utilities, safety and everyday urban life.' },
  { n: '03', name: 'Digital Education', short: 'education', blurb: 'Tools and platforms that make learning more accessible, adaptive and engaging.' },
  { n: '04', name: 'Fintech', short: 'fintech', blurb: 'Secure, inclusive and intelligent ways to move, manage and understand money.' },
  { n: '05', name: 'Green Tech', short: 'green tech', blurb: 'Energy, sustainability and climate solutions built to measure real impact.' },
  { n: '06', name: 'Cybersecurity', short: 'cybersecurity', blurb: 'Defending systems, data and people across networks, devices and applications.' },
  { n: '07', name: 'Open Innovation', short: 'open innovation', blurb: 'Your problem, your pick: anything bold that does not fit a box.' }
];

// Colours of the 7 floppies: [body, label stripe]
export const DISK_COLORS = [
  ['#141110', '#ff5a1f'], ['#ff5a1f', '#141110'], ['#e9e1d6', '#ff5a1f'], ['#2a2522', '#ffa24a'],
  ['#ff7a33', '#141110'], ['#6f6862', '#ff5a1f'], ['#1a1715', '#ffa24a']
];

// TODO: set the real registration link.
export const REGISTER_URL = '#register';
