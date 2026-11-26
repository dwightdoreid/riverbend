export const $ = id => document.getElementById(id);
export const coarse = matchMedia('(pointer:coarse)').matches;
export const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
