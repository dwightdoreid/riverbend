// Level: Kelso Street Switching Station, Port Calder. A square yard split by four bus sections:
// west and east lanes (full height of the yard) and north and south strips across the middle.
// Missions energize them through breakers (src/game/switching.js); the geometry leaves routes
// between the four equipment quadrants that open and close as sections go live.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, ins, footing, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';
import { cover } from './kit.js';

export const SECTIONS = {
  west: [-32, -30, -18, 30],
  east: [18, -30, 32, 30],
  north: [-18, -16, 18, -8],
  south: [-18, 8, 18, 16],
};

export default {
  id: 'kelso',
  name: 'Kelso Street Switching Station',
  bounds: { x: 32, z: 32 },
  environment: { sky: '#0a121b', fog: [20, 100], shadowExtent: 50, shadowFar: 160 },
  menuCamera: { radius: 62, height: 48 },
  map: {
    min: [-34, -34], max: [34, 34], outline: [[-32, -32], [32, 32]], lineWidth: 1,
    rects: [[-32, -32, 32, 32]],
    lines: Object.values(SECTIONS).flatMap(([x0, z0, x1, z1]) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]),
  },
  build,
};

function post(w, x, z, h) { footing(w, x, z, 1, 1); box(w, x, h / 2 + .25, z, .2, h, .2, 'steel'); block(x, z, .5, .5); addSolid(x - .2, 0, z - .2, x + .2, h, z + .2); }

function breakerBay(w, x, z) {
  for (const dx of [-1.6, 0, 1.6]) {
    footing(w, x + dx, z, 1.2, 1.4); box(w, x + dx, 1.1, z, .22, 2, .22, 'steel');
    ins(w, x + dx, 2.1, z, 1.3, .25, 'silicone'); ins(w, x + dx, 3.4, z, 1.4, .32, 'silicone');
  }
  box(w, x, .9, z + 1.3, 3.6, 1.4, .7, 'dark');
  block(x, z, 4.4, 1.6); addSolid(x - 2.2, 0, z - .8, x + 2.2, 4.8, z + .8);
}

function transformer(w, x, z) {
  box(w, x, .25, z, 4.4, .5, 3.4, 'concrete'); box(w, x, 1.6, z, 3.4, 2.4, 2.4, 'tank');
  for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) box(w, x + s * 2, 1.6, z + k * .7, .3, 2, .1, 'tank2');
  for (const dx of [-.8, 0, .8]) ins(w, x + dx, 2.8, z, .9, .2);
  block(x, z, 4.4, 3.4); addSolid(x - 2.2, 0, z - 1.7, x + 2.2, 3.2, z + 1.7);
}

function build(w) {
  setSeed(8080);
  const gravel = new THREE.MeshStandardMaterial({ color: 0x8b8a80, map: noiseTex([150, 148, 136], 55, [30, 30]), roughness: 1 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x4b5a46, map: noiseTex([76, 92, 70], 30, [50, 50]), roughness: 1 });
  box(w, 0, -.42, 0, 500, .6, 500, grass).castShadow = false;
  box(w, 0, -.02, 0, 66, .28, 66, gravel).castShadow = false;

  // Section markings: yellow hatched borders on the ground around each bus section.
  for (const [x0, z0, x1, z1] of Object.values(SECTIONS)) {
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      const len = Math.hypot(bx - ax, bz - az), m = box(w, (ax + bx) / 2, .14, (az + bz) / 2, Math.abs(bx - ax) || .25, .02, Math.abs(bz - az) || .25, 'amber');
      m.castShadow = false; void len;
    }
  }

  // Overhead busbars above each section, on insulator posts: what the live zones hang from.
  for (const [x0, z0, x1, z1] of Object.values(SECTIONS)) {
    const lengthwise = z1 - z0 > x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const o of [-1.6, 0, 1.6]) {
      if (lengthwise) rod(w, [cx + o, 7, z0 + 1], [cx + o, 7, z1 - 1], .1, 'conductor', 10);
      else rod(w, [x0 + 1, 7, cz + o], [x1 - 1, 7, cz + o], .1, 'conductor', 10);
    }
    const ends = lengthwise ? [[cx, z0 + 1], [cx, cz], [cx, z1 - 1]] : [[x0 + 1, cz], [cx, cz], [x1 - 1, cz]];
    for (const [px, pz] of ends) {
      post(w, px + (lengthwise ? 3.4 : 0), pz + (lengthwise ? 0 : 3.4), 5.5);
      ins(w, px + (lengthwise ? 3.4 : 0), 5.75, pz + (lengthwise ? 0 : 3.4), 1.2, .24);
      rod(w, [px + (lengthwise ? 3.4 : 0), 7, pz + (lengthwise ? 0 : 3.4)], [px, 7, pz], .07, 'steel', 6);
    }
  }

  // Equipment quadrants (cover and obstacles; routes between them stay open).
  breakerBay(w, -8, -21); breakerBay(w, 8, -21); breakerBay(w, -9, 27); breakerBay(w, 7, 27.5);
  transformer(w, -14, -28.5); transformer(w, 14, -28.5);
  for (const [x, z, wd] of [[-8, 20, 4], [-15, 25, 3], [6, 19.5, 3], [16, 27, 3], [-15, -19.5, 3], [15, -19.5, 3], [-6, -27, 3], [5, -27, 3]]) cover(w, x, z, wd, 1.1, 1.25);

  // Control building in the middle, with paths left free on either side.
  box(w, 0, 2, 0, 10, 4, 6, 'building'); box(w, 0, 4.2, 0, 10.6, .4, 6.6, 'roof');
  box(w, 0, 1.3, 3.05, 1.2, 2.4, .1, 'dark');
  for (const x of [-3, 3]) box(w, x, 2.6, 3.04, 1.6, 1, .06, new THREE.MeshStandardMaterial({ color: 0xf2dfb0, emissive: 0xf2cf8a, emissiveIntensity: .7 }));
  sign(w, 0, 3.6, 3.08, 'KELSO ST  ·  132/11 kV', 5, .5);
  block(0, 0, 10, 6); addSolid(-5, 0, -3, 5, 4, 3);
  for (const [x, z] of [[-12, -3], [12, 3], [-11, 4.5], [11, -4.5]]) cover(w, x, z, 3, 1.1, 1.25);

  // Perimeter fence and the city beyond.
  for (const s of [-1, 1]) {
    rod(w, [-32.5, 2.4, s * 32.5], [32.5, 2.4, s * 32.5], .02); rod(w, [s * 32.5, 2.4, -32.5], [s * 32.5, 2.4, 32.5], .02);
    for (let t = -32; t <= 32; t += 4) { cyl(w, t, 1.25, s * 32.5, .05, .05, 2.5, 'steel', 6); cyl(w, s * 32.5, 1.25, t, .05, .05, 2.5, 'steel', 6); }
  }
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, d = 60 + rand() * 20, h = 14 + rand() * 22;
    box(w, Math.sin(a) * d, h / 2, Math.cos(a) * d, 16, h, 16, 'building');
    box(w, Math.sin(a) * d, h * .6, Math.cos(a) * d + 8.05, 12, h * .5, .1, new THREE.MeshStandardMaterial({ color: 0x1d2a31, emissive: 0xf2cf8a, emissiveIntensity: rand() < .5 ? 0 : .25 }));
  }
  // A few fixed yard lights.
  for (const [x, z] of [[-24, 0], [24, 0], [0, -24], [0, 24]]) { const l = new THREE.PointLight(0xffe2b0, 30, 30, 1.3); l.position.set(x, 9, z); w.add(l); }
}
