// Level: Calder Dam. The dam crest above the reservoir (north), the turbine hall (middle,
// entered through doors the mission controls), and the spillway apron with three gate hoists
// (south), where the Spillway Warden fights. The spillway channel drops away beyond the apron.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, sign, noiseTex, rand, setSeed } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';
import { cover, crate } from './kit.js';

export default {
  id: 'calder',
  name: 'Calder Dam',
  bounds: { x: 40, z: 34 },
  environment: { sky: '#3c4750', fog: [30, 140], shadowExtent: 70, shadowFar: 220 },
  menuCamera: { radius: 85, height: 55 },
  map: {
    min: [-43, -37], max: [43, 37], outline: [[-40, -34], [40, 34]],
    lines: [[-30, -20, 30, -20], [30, -20, 30, 2], [-30, -20, -30, -10], [-30, -6, -30, 2], [-30, 2, 21, 2], [27, 2, 30, 2]], lineWidth: 2,
  },
  build,
};

const HALL = { x0: -30, x1: 30, z0: -20, z1: 2, h: 9 };

function wall(w, x0, z0, x1, z1, h = HALL.h, m = 'building') {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = Math.abs(x1 - x0) || .8, d = Math.abs(z1 - z0) || .8;
  box(w, cx, h / 2, cz, wd, h, d, m); block(cx, cz, wd, d); addSolid(cx - wd / 2, 0, cz - d / 2, cx + wd / 2, h, cz + d / 2);
}

function turbine(w, x, z) {
  cyl(w, x, .3, z, 3.4, 3.4, .6, 'concrete', 24);
  cyl(w, x, 1.9, z, 2.8, 3, 2.6, 'tank', 24);
  cyl(w, x, 3.35, z, 2.2, 2.8, .3, 'tank2', 24);
  cyl(w, x, 4.2, z, .9, 1.1, 1.4, 'steel', 14);
  for (let a = 0; a < 8; a++) rod(w, [x + Math.cos(a * .785) * 3.6, .6, z + Math.sin(a * .785) * 3.6], [x + Math.cos(a * .785) * 3.6, 1.6, z + Math.sin(a * .785) * 3.6], .04, 'amber', 5);
  sign(w, x, 2.4, z + 3.02, 'UNIT ' + (x < -5 ? '1' : x > 5 ? '3' : '2') + '  ·  42 MW', 3, .5);
  block(x, z, 6.4, 6.4); addSolid(x - 3, 0, z - 3, x + 3, 3.4, z + 3);
}

function hoistHouse(w, x, z) {
  wall(w, x - 3, z, x + 3, z + .01, 4.2, 'building');
  box(w, x, 2.1, z + 2, 6, 4.2, 4, 'building'); block(x, z + 2, 6, 4); addSolid(x - 3, 0, z, x + 3, 4.2, z + 4);
  box(w, x, 4.4, z + 2, 6.4, .3, 4.4, 'roof');
  for (const s of [-1, 1]) rod(w, [x + s * 2.4, 4.5, z + 2], [x + s * 2.4, 9, z + 3.2], .14, 'steel', 8);
  rod(w, [x - 2.4, 9, z + 3.2], [x + 2.4, 9, z + 3.2], .16, 'steel', 8);
  cyl(w, x, 7.5, z + 3.5, .08, .08, 3, 'conductor', 6);
}

function build(w) {
  setSeed(5150);
  const deck = new THREE.MeshStandardMaterial({ color: 0xa9a79c, map: noiseTex([150, 148, 138], 30, [30, 24]), roughness: .95 });
  const water = new THREE.MeshStandardMaterial({ color: 0x2c5566, roughness: .12, metalness: .25 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xd8e6e8, roughness: .6 });
  const hill = new THREE.MeshStandardMaterial({ color: 0x55604f, map: noiseTex([84, 96, 78], 30, [40, 40]), roughness: 1 });

  box(w, 0, -.12, 0, 84, .24, 72, deck).castShadow = false;
  // Reservoir to the north, behind the parapet.
  box(w, 0, -1.4, -150, 600, .2, 230, water).castShadow = false;
  box(w, 0, .6, -35, 84, 1.2, .6, 'concrete'); for (let x = -40; x <= 40; x += 4) box(w, x, 1.3, -35, .3, .3, .7, 'concrete');
  // Valley walls east/west, beyond the dam's abutments.
  for (const s of [-1, 1]) { box(w, s * 75, 6, 0, 60, 14, 400, hill); box(w, s * 50, 3, -10, 14, 8, 60, 'rock2'); }
  // Spillway channel to the south: stepped concrete falling away, with white water.
  for (let i = 0; i < 8; i++) {
    box(w, 0, -1.5 - i * 1.6, 38 + i * 4.2, 60, 1.2, 4.4, 'concrete').castShadow = false;
    box(w, 0, -1.05 - i * 1.6, 38.6 + i * 4.2, 56, .2, 2, foam).castShadow = false;
  }
  for (const s of [-1, 1]) box(w, s * 31, -3, 52, 2, 10, 36, 'concrete');
  box(w, 0, .5, 34.8, 84, 1, .5, 'concrete');

  // Dam crest: lamp posts, a maintenance truck, barriers.
  for (let x = -36; x <= 36; x += 12) { cyl(w, x, 3, -33.6, .1, .12, 6, 'steel', 6); box(w, x, 6.1, -33.1, .25, .15, 1, 'edge'); block(x, -33.6, .4, .4); }
  for (const [x, z, wd] of [[24, -27, 4], [6, -29, 4], [-12, -26, 4], [-28, -29, 4]]) cover(w, x, z, wd, 1.1, 1.2);
  box(w, 14, 1.2, -24.2, 5.5, 1.6, 2.2, 'amber'); box(w, 16, 2.1, -24.2, 1.8, 1.4, 2.1, 'amber'); block(14.5, -24.2, 6, 2.4); addSolid(11.5, 0, -25.4, 17.5, 2.8, -23);
  sign(w, -36, 2.2, -21.5, 'CALDER DAM  ·  TURBINE HALL', 4.5, .6);

  // Turbine hall: walls with door gaps (the mission's door props fill them), roof, crane.
  wall(w, HALL.x0, HALL.z0, HALL.x1, HALL.z0);                   // north
  wall(w, HALL.x1, HALL.z0, HALL.x1, HALL.z1);                   // east
  wall(w, HALL.x0, HALL.z0, HALL.x0, -10);                       // west, north of the door
  wall(w, HALL.x0, -6, HALL.x0, HALL.z1);                        // west, south of the door
  wall(w, HALL.x0, HALL.z1, 21, HALL.z1);                        // south, west of the big door
  wall(w, 27, HALL.z1, HALL.x1, HALL.z1);                        // south, east of the big door
  box(w, 0, HALL.h + .2, -9, 61.5, .4, 23.5, 'roof');
  for (let x = -26; x <= 26; x += 6.5) box(w, x, HALL.h - 2, -19.55, 3.5, 1.2, .1, 'glass');
  for (const z of [-15, -3]) rod(w, [-29, 7.6, z], [29, 7.6, z], .22, 'amber', 8);
  box(w, 4, 7.3, -9, 1.2, .5, 12.4, 'amber'); box(w, 4, 6.2, -9, .6, 1.6, .6, 'dark');
  for (let x = -24; x <= 24; x += 12) for (const z of [-19.4, 1.4]) box(w, x, 4.5, z, .7, 9, .7, 'edge');
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffe0a8, emissiveIntensity: 1.2 });
  for (let x = -22; x <= 22; x += 11) box(w, x, HALL.h - .2, -9, 1.6, .12, .5, lamp);
  for (const x of [-16, 0, 16]) {
    turbine(w, x, -10);
    const l = new THREE.PointLight(0xffd9a0, 40, 24, 1.4); l.position.set(x, 7.6, -9); w.add(l);
  }

  // Control room (east end): low partition with glazing, consoles.
  wall(w, 22, -20, 22, -10, 1.2, 'edge');
  box(w, 22, 2.6, -15, .1, 2.6, 10, 'glass');
  for (const z of [-18, -15.5]) { box(w, 27.5, .55, z, 3.5, 1.1, .9, 'dark'); box(w, 27.5, 1.25, z - .2, 3.4, .6, .1, lamp); block(27.5, z, 3.5, .9); addSolid(25.75, 0, z - .45, 29.25, 1.1, z + .45); }
  crate(w, -24, -16, 2.6, 1.8); crate(w, 8, -1, 2.4, 1.6);

  // Spillway apron: gate hoist houses, cover, bollards.
  for (const x of [-20, 0, 20]) hoistHouse(w, x, 29.5);
  for (const [x, z, wd] of [[-28, 9, 4], [28, 9, 4], [-12, 14, 4], [12, 14, 4], [-30, 20, 3], [30, 20, 3], [-8, 24, 3], [8, 24, 3]]) cover(w, x, z, wd, 1.1, 1.3);
  for (let x = -36; x <= 36; x += 6) { cyl(w, x, .5, 5.5, .2, .2, 1, 'amber', 8); }
  crate(w, -36, 26, 2.6, 2); crate(w, 36, 25, 2.6, 2);
  // West yard: a small switchgear kiosk and drums.
  box(w, -36, 1.4, -12, 4, 2.8, 3, 'tank2'); block(-36, -12, 4, 3); addSolid(-38, 0, -13.5, -34, 2.8, -10.5);
  for (let i = 0; i < 5; i++) { const x = -38 + rand() * 6, z = 0 + rand() * 8; cyl(w, x, .5, z, .35, .35, 1, i % 2 ? 'blue' : 'red', 10); block(x, z, .7, .7); addSolid(x - .35, 0, z - .35, x + .35, 1, z + .35); }
}
