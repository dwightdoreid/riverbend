// Reusable gameplay level pieces: they add geometry, a walk footprint and a solid volume.
import { box } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export function cover(w, x, z, wd = 4, d = 1.1, h = 1.35) {
  box(w, x, h / 2 + .15, z, wd, h, d, 'cover'); box(w, x, h + .12, z, wd, .12, d * .75, 'concrete');
  for (const a of [-1, 1]) box(w, x + a * wd * .35, .2, z, .6, .3, d * 1.6, 'edge');
  block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, h + .2, z + d / 2);
}

export function crate(w, x, z, wd = 2.6, h = 2.2) {
  box(w, x, h / 2 + .2, z, wd, h, 2.2, 'crate');
  for (const dx of [-wd / 2 + .1, wd / 2 - .1]) box(w, x + dx, h / 2 + .2, z, .12, h, 2.35, 'edge');
  box(w, x, h / 2 + .2, z + 1.12, wd * .9, .1, .06, 'amber');
  block(x, z, wd, 2.2); addSolid(x - wd / 2, 0, z - 1.1, x + wd / 2, h + .2, z + 1.1);
}
