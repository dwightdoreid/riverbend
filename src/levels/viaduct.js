// Level: the Port Calder elevated line. The playable area is the viaduct deck (y = 0), running
// north-south high above the city. Two tracks, edge walkways behind railings, and three
// stations (south terminus at the start, Market Street in the middle, Harbour terminus north).
// The city sprawls below: rooftops, lit streets and towers rising past the deck.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export const TRACK_X = -3.5;            // the stalled commuter train's track
export const STATIONS = { south: 74, market: 8, harbour: -74 };

export default {
  id: 'viaduct',
  name: 'Port Calder Elevated',
  bounds: { x: 9.4, z: 84 },
  environment: { sky: '#0a121b', fog: [25, 150], shadowExtent: 95, shadowFar: 260 },
  menuCamera: { radius: 110, height: 60 },
  map: {
    min: [-12, -88], max: [12, 88], outline: [[-10, -84], [10, 84]], lineWidth: 2,
    rects: [[-10, -84, 10, 84]],
    lines: [[TRACK_X, -84, TRACK_X, 84], [3.5, -84, 3.5, 84], ...Object.values(STATIONS).map(z => [-10, z, 10, z])],
  },
  build,
};

function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function station(w, z, name) {
  // Island platforms on both sides, canopy, benches, signs, ticket machines.
  for (const x of [-8.2, 8.2]) box(w, x, .15, z, 3.2, .3, 26, 'concrete');
  for (const x of [-8.6, 8.6]) for (const dz of [-10, -3, 4, 11]) { cyl(w, x, 2.2, z + dz, .12, .12, 4.4, 'steel', 8); block(x, z + dz, .4, .4); addSolid(x - .15, 0, z + dz - .15, x + .15, 4.4, z + dz + .15); }
  for (const s of [-1, 1]) box(w, s * 8.2, 4.5, z, 3.8, .2, 27, 'roof');
  for (const [x, dz] of [[-8.4, -6], [-8.4, 6], [8.4, -6], [8.4, 6]]) solid(w, x, .55, z + dz, .7, .5, 2.6, 'trunk');
  for (const x of [-8.6, 8.6]) { solid(w, x, 1, z + 1, .8, 2, .7, 'blue'); box(w, x, 1.4, z + .62, .5, .3, .04, new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x3f8fd0, emissiveIntensity: 1 })); }
  for (const s of [-1, 1]) sign(w, s * 8.2, 3.8, z - 13.3, name, 4, .6, '#2f5a3a', '#e9efe4');
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffdca0, emissiveIntensity: 1.6 });
  for (const s of [-1, 1]) for (let dz = -11; dz <= 11; dz += 5.5) box(w, s * 8.2, 4.35, z + dz, .3, .06, 1.4, lamp);
  const l = new THREE.PointLight(0xffe2b0, 26, 26, 1.4); l.position.set(0, 4.2, z); w.add(l);
}

function build(w) {
  setSeed(9090);
  const deck = new THREE.MeshStandardMaterial({ color: 0x8b8a84, map: noiseTex([146, 144, 138], 26, [6, 60]), roughness: .95 });
  const ballast = new THREE.MeshStandardMaterial({ color: 0x6a6660, map: noiseTex([110, 106, 100], 60, [4, 60]), roughness: 1 });
  const street = new THREE.MeshStandardMaterial({ color: 0x2a2e30, roughness: 1 });

  // The deck and its underside: piers down to the street 28 m below.
  box(w, 0, -.3, 0, 20.5, .6, 172, deck).castShadow = false;
  box(w, 0, -1.6, 0, 18, 2, 172, 'concrete').castShadow = false;
  for (let z = -84; z <= 84; z += 14) { box(w, -6, -15, z, 2.4, 28, 2.4, 'concrete'); box(w, 6, -15, z, 2.4, 28, 2.4, 'concrete'); }
  box(w, 0, -29, 0, 600, .4, 600, street).castShadow = false;

  // Tracks: ballast, sleepers, rails, and a conductor rail on each.
  for (const tx of [TRACK_X, 3.5]) {
    box(w, tx, .06, 0, 3.2, .12, 170, ballast).castShadow = false;
    for (let z = -83.5; z <= 83.5; z += 1.2) box(w, tx, .14, z, 2.6, .08, .22, 'trunk').castShadow = false;
    for (const s of [-.72, .72]) box(w, tx + s, .24, 0, .1, .14, 170, 'steel').castShadow = false;
    box(w, tx + 1.3, .2, 0, .14, .1, 170, 'amber').castShadow = false;
  }
  // Edge railings (the bounds stop players a little inside them).
  for (const s of [-1, 1]) {
    box(w, s * 10.1, .6, 0, .12, 1.2, 172, 'steel'); box(w, s * 10.1, 1.15, 0, .2, .1, 172, 'edge');
    for (let z = -84; z <= 84; z += 2) box(w, s * 10.1, .55, z, .06, 1.1, .06, 'steel');
  }
  // Overhead catenary masts every 14 m.
  for (let z = -80; z <= 80; z += 14) {
    for (const s of [-1, 1]) { cyl(w, s * 9.4, 3.2, z, .14, .18, 6.4, 'steel', 8); block(s * 9.4, z, .5, .5); addSolid(s * 9.4 - .2, 0, z - .2, s * 9.4 + .2, 6.4, z + .2); }
    rod(w, [-9.4, 6.2, z], [9.4, 6.2, z], .08, 'steel', 6);
  }
  for (const tx of [TRACK_X, 3.5]) rod(w, [tx, 5.6, -84], [tx, 5.6, 84], .03, 'conductor', 5);

  station(w, STATIONS.south, 'SOUTH TERMINUS');
  station(w, STATIONS.market, 'MARKET STREET');
  station(w, STATIONS.harbour, 'HARBOUR TERMINUS');

  // A stalled freight consist on the east track: long cover with gaps between wagons.
  for (const z of [-50, -36, -22, 40, 54]) {
    solid(w, 3.5, 1.6, z, 2.8, 2.6, 11, 'crate');
    box(w, 3.5, 3, z, 2.9, .2, 11.2, 'edge');
  }
  // Maintenance carts and cable drums on the walkways.
  for (const [x, z] of [[-8, 34], [8, -10], [-8, -36], [8, 26], [-8, -58]]) solid(w, x, .7, z, 1.8, 1.4, 1.4, 'concrete');

  // The city below: rooftops at varied depths, lit windows, and towers rising past the deck.
  // Lit facades: a window grid (some lit, some dark) rather than a flat glowing slab.
  const wc = document.createElement('canvas'); wc.width = wc.height = 128;
  const wx = wc.getContext('2d'); wx.fillStyle = '#000'; wx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (rand() < .45) { wx.fillStyle = rand() < .3 ? '#ffe3a0' : '#e8b86a'; wx.fillRect(i * 16 + 4, j * 16 + 4, 8, 9); }
  const winTex = new THREE.CanvasTexture(wc); winTex.colorSpace = THREE.SRGBColorSpace; winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.repeat.set(2, 4);
  const lit = new THREE.MeshStandardMaterial({ color: 0x141c21, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .9, roughness: .9 });
  for (let i = 0; i < 70; i++) {
    const side = rand() > .5 ? 1 : -1, x = side * (20 + rand() * 70), z = -120 + rand() * 240, top = -6 - rand() * 18;
    const wd = 10 + rand() * 12, d = 10 + rand() * 12, h = top + 29;
    box(w, x, top - h / 2, z, wd, h, d, 'building');
    if (rand() < .7) box(w, x - side * (wd / 2 + .05), top - h * .4, z, .1, h * .5, d * .8, lit);
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, x = side * (24 + rand() * 30), z = -90 + i * 20, h = 30 + rand() * 30;
    box(w, x, -29 + h / 2, z, 12, h, 12, 'building'); box(w, x - side * 6.05, -29 + h * .55, z, .1, h * .7, 10, lit);
  }
  // Street lamps far below.
  const glowLamp = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc060, emissiveIntensity: 2.4 });
  for (let z = -110; z <= 110; z += 12) for (const x of [-16, 16]) box(w, x, -26.5, z, .5, .2, .5, glowLamp);
}
