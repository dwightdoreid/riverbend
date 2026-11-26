// Level: the Gale Line wind farm on the northern moor. Open, exposed ground cut by dry-stone
// walls (the only real cover), rock outcrops, gravel tracks out to the turbine pads, a met mast,
// and the collector substation in the middle. Turbines themselves are mission props (they spin).
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, rod, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export const PADS = { t1: [-30, -30], t2: [2, -36], t3: [32, -28], t4: [-34, 14], t5: [34, 16], t6: [-4, 36] };

export default {
  id: 'galeline',
  name: 'Gale Line Wind Farm',
  bounds: { x: 47, z: 47 },
  environment: { sky: '#3c4750', fog: [30, 160], shadowExtent: 80, shadowFar: 240 },
  menuCamera: { radius: 100, height: 70 },
  map: { min: [-50, -50], max: [50, 50], outline: [[-47, -47], [47, 47]], lineWidth: 4, lines: Object.values(PADS).map(([x, z]) => [0, 2, x, z]) },
  build,
};

function wall(w, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2.2);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const s = box(w, x, .55, z, 2.3, 1.1, .8, rand() > .5 ? 'rock' : 'rock2'); s.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2 + (rand() - .5) * .08;
    block(x, z, 1.6, 1.6); addSolid(x - .8, 0, z - .8, x + .8, 1.15, z + .8);
  }
}

function build(w) {
  setSeed(1111);
  const moor = new THREE.MeshStandardMaterial({ color: 0x6f7552, map: noiseTex([110, 116, 82], 40, [60, 60]), roughness: 1 });
  const gravel = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, map: noiseTex([150, 146, 132], 50, [4, 30]), roughness: 1 });
  box(w, 0, -.42, 0, 700, .6, 700, moor).castShadow = false;
  // Gravel tracks from the substation to every turbine pad.
  for (const [x, z] of Object.values(PADS)) {
    const len = Math.hypot(x, z - 2), t = box(w, x / 2, .02, (z + 2) / 2, 4, .06, len, gravel); t.rotation.y = Math.atan2(x, z - 2); t.castShadow = false;
    box(w, x, .03, z, 9, .06, 9, gravel).castShadow = false;
  }
  // Dry-stone walls: field boundaries with gaps.
  for (const [ax, az, bx, bz] of [[-46, -12, -20, -12], [-14, -12, -6, -12], [8, -14, 24, -14], [30, -14, 46, -14], [-46, 24, -18, 24], [-10, 22, 6, 22], [14, 26, 40, 26],
    [-20, -46, -20, -20], [-20, -4, -20, 10], [20, -46, 20, -22], [22, 0, 22, 14], [-8, 30, -8, 46], [10, 30, 10, 46]]) wall(w, ax, az, bx, bz);
  // Rock outcrops.
  for (const [x, z, r] of [[-12, -26, 2.4], [16, -2, 2], [-28, 0, 2.6], [28, 40, 2.2], [40, -6, 1.8], [-40, -40, 2.4], [6, 18, 1.6], [-24, 36, 2]]) {
    for (let k = 0; k < 3; k++) { const o = mesh(w, geo('sphere', 1, 6, 4), rand() > .5 ? 'rock' : 'rock2', x + (rand() - .5) * r, r * .4, z + (rand() - .5) * r); o.scale.set(r * (.7 + rand() * .5), r * (.6 + rand() * .4), r * (.7 + rand() * .5)); }
    block(x, z, r * 2, r * 2); addSolid(x - r, 0, z - r, x + r, r * 1.1, z + r);
  }
  // Heather and tussocks (no collision).
  const heather = new THREE.MeshStandardMaterial({ color: 0x6b4e5c, roughness: 1 }), tussock = new THREE.MeshStandardMaterial({ color: 0x8a8a5a, roughness: 1 });
  for (let i = 0; i < 220; i++) { const x = (rand() - .5) * 94, z = (rand() - .5) * 94, c = mesh(w, geo('cone', 1, 1, 5), rand() > .5 ? heather : tussock, x, .25, z); c.scale.set(.5 + rand() * .5, .5 + rand() * .4, .5 + rand() * .5); c.castShadow = false; }
  // Collector substation: fenced compound, transformer, control building.
  box(w, 0, .05, 2, 18, .1, 14, 'concrete').castShadow = false;
  for (const s of [-1, 1]) { rod(w, [-9, 1.2, 2 + s * 7], [9, 1.2, 2 + s * 7], .02, 'steel', 4); rod(w, [s * 9, 1.2, -5], [s * 9, 1.2, 9], .02, 'steel', 4); }
  for (const [x, z] of [[-9, -5], [9, -5], [-9, 9], [9, 9]]) cyl(w, x, 1.2, z, .06, .06, 2.4, 'steel', 6);
  box(w, -3, 1.6, 0, 4.4, 3.2, 3.2, 'tank'); for (const dx of [-1, 0, 1]) cyl(w, -3 + dx, 3.6, 0, .12, .16, .9, 'ceramic', 8);
  block(-3, 0, 4.4, 3.2); addSolid(-5.2, 0, -1.6, -.8, 3.2, 1.6);
  box(w, 4.5, 1.6, 5, 6, 3.2, 4, 'building'); box(w, 4.5, 3.35, 5, 6.4, .3, 4.4, 'roof'); block(4.5, 5, 6, 4); addSolid(1.5, 0, 3, 7.5, 3.2, 7);
  sign(w, 4.5, 2.5, 2.95, 'GALE LINE  ·  33 kV COLLECTOR', 5, .5);
  // Met mast and a ruined bothy for cover.
  for (const dx of [-.3, .3]) for (const dz of [-.3, .3]) rod(w, [-14 + dx, 0, -12 + dz], [-14 + dx * .3, 40, -12 + dz * .3], .05, 'steel', 5);
  block(-14, -12, .8, .8); addSolid(-14.3, 0, -12.3, -13.7, 40, -11.7);
  for (const [x, z, wd, d] of [[30, 6, 6, .7], [27.35, 3, .7, 6.7], [32.65, 3, .7, 6.7]]) { box(w, x, 1.1, z, wd, 2.2, d, 'rock2'); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, 2.2, z + d / 2); }
  // Distant hills.
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = 120 + rand() * 40, m = mesh(w, geo('cone', 1, 1, 7), moor, Math.sin(a) * d, -4, Math.cos(a) * d); m.scale.set(40 + rand() * 30, 18 + rand() * 20, 40 + rand() * 30); }
}
