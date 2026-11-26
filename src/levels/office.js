// Level: Halvard Energy's Kelda Town regional office, at night. One storey under a ceiling, with
// a central east-west corridor. South of it: west offices, lobby (main entrance), security room
// and break room. North of it: executive suite, archive and server room. Outside: a fenced yard
// with the west side door. Doors that missions control (side door) are props filling wall gaps.
import { THREE } from '../engine/three.js';
import { box, cyl, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

const H = 4;
// Wall segments [x0, z0, x1, z1] (gaps are left out on purpose).
const WALLS = [
  [-30, -20, 30, -20],                                 // north
  [-30, 20, -2, 20], [2, 20, 30, 20],                  // south (main entrance gap x -2..2)
  [-30, -20, -30, 7], [-30, 11, -30, 20],              // west (side door gap z 7..11)
  [30, -20, 30, 20],                                   // east
  ...[4, -4].flatMap(z => [[-30, z, -22, z], [-18, z, -2, z], [2, z, 18, z], [22, z, 30, z]]),   // corridor walls, three doorways each
  [-10, -20, -10, -4], [10, -20, 10, -4],              // north rooms
  [-10, 4, -10, 10], [-10, 14, -10, 20],               // west offices | lobby (gap z 10..14)
  [10, 4, 10, 10], [10, 14, 10, 20],                   // lobby | security (gap z 10..14)
  [20, 4, 20, 6], [20, 9, 20, 20],                     // security | break room (gap z 6..9)
];

export default {
  id: 'office',
  name: 'Halvard Kelda Town Office',
  bounds: { x: 40, z: 31 },
  environment: { sky: '#0a121b', fog: [18, 90], shadowExtent: 50, shadowFar: 160 },
  menuCamera: { radius: 60, height: 55 },
  map: { min: [-42, -33], max: [42, 33], outline: [[-40, -31], [40, 31]], lineWidth: 2, lines: WALLS },
  build,
};

function wall(w, [x0, z0, x1, z1], m) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = Math.abs(x1 - x0) || .5, d = Math.abs(z1 - z0) || .5;
  box(w, cx, H / 2, cz, wd, H, d, m); block(cx, cz, wd, d); addSolid(cx - wd / 2, 0, cz - d / 2, cx + wd / 2, H, cz + d / 2);
}
function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }
const desk = (w, x, z) => { solid(w, x, .38, z, 1.8, .76, .9, 'trunk'); box(w, x, .95, z - .2, .6, .4, .05, 'dark'); };

function build(w) {
  setSeed(1515);
  const carpet = new THREE.MeshStandardMaterial({ color: 0x5c6a72, map: noiseTex([96, 108, 116], 14, [30, 20]), roughness: 1 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: .9 });
  const yard = new THREE.MeshStandardMaterial({ color: 0x3e4447, map: noiseTex([70, 76, 80], 20, [20, 20]), roughness: 1 });
  const panel = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: .7 });
  box(w, 0, -.42, 0, 300, .6, 300, yard).castShadow = false;
  box(w, 0, .01, 0, 60, .04, 40, carpet).castShadow = false;
  box(w, 0, H + .2, 0, 61, .4, 41, 'roof');
  for (const s of WALLS) wall(w, s, wallMat);
  // Ceiling light panels (dim at night) and a few real lights.
  for (let x = -26; x <= 26; x += 8) for (const z of [-12, 0, 12]) box(w, x, H - .02, z, 2, .04, .6, panel);
  for (const [x, z] of [[0, 0], [0, 12], [20, -12], [-20, 12], [-20, -12]]) { const l = new THREE.PointLight(0xfff0d8, 9, 14, 1.6); l.position.set(x, H - .3, z); w.add(l); }

  // West offices: rows of desks.
  for (let x = -26; x <= -14; x += 4) for (const z of [7.5, 12, 16.5]) desk(w, x, z);
  // Lobby: reception desk, planters, Halvard sign.
  solid(w, 0, .55, 8, 6, 1.1, 1.2, 'building'); box(w, 0, 1.15, 8, 6.2, .1, 1.4, 'roof');
  for (const x of [-7, 7]) { solid(w, x, .45, 18, 1.2, .9, 1.2, 'concrete'); cyl(w, x, 1.3, 18, .5, .1, .9, 'leaf', 6); }
  sign(w, 0, 2.8, 4.3, 'HALVARD ENERGY  ·  KELDA TOWN', 6, .6, '#1d3a4a', '#e9efe4');
  // Security room: monitor wall and desk.
  box(w, 15, 2, 19.7, 9, 2, .2, 'dark');
  for (let x = 11.5; x <= 18.5; x += 1.75) for (const y of [1.5, 2.5]) box(w, x, y, 19.55, 1.5, .8, .05, new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x3f6f90, emissiveIntensity: .8 }));
  solid(w, 15, .4, 16, 5, .8, 1, 'trunk');
  // Break room tables.
  for (const [x, z] of [[24, 9], [27, 15], [23, 17]]) solid(w, x, .4, z, 1.6, .8, 1.6, 'white');
  // Executive suite: big desk, sofas.
  solid(w, -20, .45, -14, 4, .9, 1.6, 'trunk'); solid(w, -25, .35, -8, 3, .7, 1, 'red'); solid(w, -15, .35, -8, 3, .7, 1, 'red');
  // Archive: shelving rows.
  for (const x of [-6, -2, 2, 6]) solid(w, x, 1.1, -13, .8, 2.2, 10, 'edge');
  // Server room: racks with blinking lights.
  const blink = new THREE.MeshStandardMaterial({ color: 0x5ce08a, emissive: 0x5ce08a, emissiveIntensity: 1.4 });
  for (const z of [-17, -11]) for (let x = 13; x <= 21; x += 2.2) { solid(w, x, 1.1, z, 1.6, 2.2, 1, 'dark'); for (let y = .5; y < 2; y += .35) box(w, x - .5 + rand() * .9, y, z + .51, .08, .04, .02, blink); }

  // Outside: fence, parked security car, lamp posts.
  for (const s of [-1, 1]) { box(w, s * 40, 1.1, 0, .1, 2.2, 62, 'steel'); box(w, 0, 1.1, s * 31, 80, 2.2, .1, 'steel'); }
  solid(w, -35, .7, -6, 1.9, 1.4, 4.2, new THREE.MeshStandardMaterial({ color: 0xe3e6e8, roughness: .5 }));
  for (const [x, z] of [[-36, 18], [-36, -18], [0, 26], [20, 26]]) { cyl(w, x, 3, z, .1, .12, 6, 'dark', 6); box(w, x, 6.1, z, .6, .15, .3, panel); block(x, z, .4, .4); addSolid(x - .15, 0, z - .15, x + .15, 6, z + .15); }
  for (const [x, z] of [[-34, 26], [34, 26], [-36, -26], [34, -26]]) solid(w, x, .5, z, 2.4, 1, 1.4, 'concrete');
}
