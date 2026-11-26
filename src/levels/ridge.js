// Level: the relay ridge. A long, exposed ridge-top running east-west, with three relay pads
// (west, centre, east), an old radar dome, low walls and boulders for cover, and the ground
// falling away on both sides. Missions place the relay masts as props.
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, rod, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export const PADS = { west: [-40, -2], centre: [0, 3], east: [40, -2] };

export default {
  id: 'ridge',
  name: 'Relay Ridge',
  bounds: { x: 58, z: 26 },
  environment: { sky: '#a9bccb', fog: [70, 260], shadowExtent: 80, shadowFar: 240 },
  menuCamera: { radius: 95, height: 60 },
  map: { min: [-61, -29], max: [61, 29], outline: [[-58, -26], [58, 26]], lineWidth: 4, lines: [[-58, 0, 58, 0]] },
  build,
};

function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function build(w) {
  setSeed(1212);
  const grass = new THREE.MeshStandardMaterial({ color: 0x7b8360, map: noiseTex([118, 126, 92], 38, [60, 30]), roughness: 1 });
  const track = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, map: noiseTex([150, 146, 132], 50, [40, 2]), roughness: 1 });
  box(w, 0, -.42, 0, 140, .6, 60, grass).castShadow = false;
  // The slopes falling away north and south, and valleys far below.
  for (const s of [-1, 1]) {
    const slope = box(w, 0, -9, s * 44, 200, 2, 40, grass); slope.rotation.x = s * .42; slope.castShadow = false;
    box(w, 0, -22, s * 120, 600, 1, 120, grass).castShadow = false;
  }
  const t = box(w, 0, .02, 0, 118, .06, 4, track); t.castShadow = false;
  // Relay pads with low walls around three sides.
  for (const [x, z] of Object.values(PADS)) {
    box(w, x, .05, z, 12, .1, 12, 'concrete').castShadow = false;
    for (const [dx, dz, wd, d] of [[0, -6, 8, .7], [-6, -1, .7, 6], [6, -1, .7, 6]]) solid(w, x + dx, .6, z + dz, wd, 1.2, d, 'concrete');
  }
  // Radar dome between the centre and east pads.
  cyl(w, 20, 2.5, 10, 6, 6, 5, 'building', 24); mesh(w, geo('sphere', 6, 20, 12), 'white', 20, 5, 10).scale.y = .7;
  block(20, 10, 11, 11); addSolid(14.5, 0, 4.5, 25.5, 8, 15.5);
  sign(w, 20, 3.4, 3.95, 'RIDGE RADAR · DECOMMISSIONED', 5, .5);
  // A crashed Halvard dropship (cover) and boulders along the crest.
  box(w, -20, 1.2, -12, 9, 2.4, 3.5, new THREE.MeshStandardMaterial({ color: 0xe3e6e8, roughness: .5 })); box(w, -20, 1.25, -12, 9.05, .3, 3.55, new THREE.MeshStandardMaterial({ color: 0x2f6fb0 }));
  box(w, -25, 1.6, -12, 1.4, .3, 8, 'dark'); block(-20, -12, 9, 3.5); addSolid(-24.5, 0, -13.75, -15.5, 2.4, -10.25);
  for (const [x, z, r] of [[-52, 10, 2], [-30, 14, 1.6], [-12, -18, 2], [10, -16, 1.8], [30, -18, 2.2], [52, 12, 2], [-48, -16, 1.6], [46, -14, 1.8], [-6, 18, 1.5]]) {
    const o = mesh(w, geo('sphere', 1, 6, 4), rand() > .5 ? 'rock' : 'rock2', x, r * .45, z); o.scale.set(r * 1.2, r * .9, r);
    block(x, z, r * 2, r * 2); addSolid(x - r, 0, z - r, x + r, r * 1.1, z + r);
  }
  // Cable trench linking the pads (visual) and a few marker posts.
  for (const [ax, bx] of [[-40, 0], [0, 40]]) rod(w, [ax, .12, 1.5], [bx, .12, 1.5], .12, 'dark', 6);
  for (let x = -55; x <= 55; x += 11) { cyl(w, x, .6, -3, .08, .08, 1.2, 'amber', 6); }
  // Distant peaks.
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, d = 160 + rand() * 40, m = mesh(w, geo('cone', 1, 1, 7), 'rock2', Math.sin(a) * d, -10, Math.cos(a) * d); m.scale.set(40, 40 + rand() * 30, 40); }
}
