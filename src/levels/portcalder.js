// Level: Port Calder, a city grid at night. Three districts (west Market, central Civic,
// east Harbour) each have their own street-lamp, window and area lights, so missions can run
// rolling blackouts (src/game/blackout.js). Avenues at x = -30, 0, 30 and streets at
// z = -30, 0, 30; buildings fill the blocks between, with an alley, a plaza and a market hall.
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, rod, sign, noiseTex, rand, setSeed } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

const DISTRICTS = [
  { id: 'market', label: 'Market', rect: [-60, -60, -10, 60] },
  { id: 'civic', label: 'Civic', rect: [-10, -60, 10, 60] },
  { id: 'harbour', label: 'Harbour', rect: [10, -60, 60, 60] },
];
const districtOf = x => x < -10 ? 'market' : x < 10 ? 'civic' : 'harbour';

// Per-district switchable things, filled in by build().
const lightsBy = { market: [], civic: [], harbour: [] };
const windowMats = { market: [], civic: [], harbour: [] };
const lampMats = {};

export default {
  id: 'portcalder',
  name: 'Port Calder',
  bounds: { x: 45, z: 45 },
  environment: { sky: '#0a121b', fog: [18, 95], shadowExtent: 70, shadowFar: 220 },
  menuCamera: { radius: 90, height: 70 },
  map: {
    min: [-48, -48], max: [48, 48], outline: [[-45, -45], [45, 45]], lineWidth: 6,
    lines: [[-30, -45, -30, 45], [0, -45, 0, 45], [30, -45, 30, 45], [-45, -30, 45, -30], [-45, 0, 45, 0], [-45, 30, 45, 30]],
  },
  districts: DISTRICTS,
  setDistrictLit(id, on) {
    for (const l of lightsBy[id]) l.intensity = on ? l.userData.on : 0;
    for (const m of windowMats[id]) m.emissiveIntensity = on ? .95 : 0;
    if (lampMats[id]) lampMats[id].emissiveIntensity = on ? 2.4 : 0;
  },
  build,
};

// ---------------------------------------------------------------- facade textures

let facade = null, windowsLit = null;
function makeTextures() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8b8378'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#6f685f'; x.fillRect(0, 60, 128, 6);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = '#1d2a31'; x.fillRect(14 + i * 64, 12 + j * 64, 36, 38); x.fillStyle = '#3a4a52'; x.fillRect(14 + i * 64, 12 + j * 64, 36, 5); }
  facade = new THREE.CanvasTexture(c); facade.colorSpace = THREE.SRGBColorSpace; facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
  const e = document.createElement('canvas'); e.width = e.height = 256;
  const y = e.getContext('2d'); y.fillStyle = '#000'; y.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (rand() < .55) { y.fillStyle = rand() < .3 ? '#ffe3a0' : '#f7c77a'; y.fillRect(14 + i * 64, 12 + j * 64, 36, 38); }
  windowsLit = new THREE.CanvasTexture(e); windowsLit.colorSpace = THREE.SRGBColorSpace; windowsLit.wrapS = windowsLit.wrapT = THREE.RepeatWrapping;
}

function building(w, x0, z0, x1, z1, h, tint = 0xffffff, solid = true) {
  const wd = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, district = districtOf(cx);
  const map = facade.clone(), em = windowsLit.clone();
  const rx = Math.max(wd, d) / 4, ry = h / 4;
  map.repeat.set(rx, ry); em.repeat.set(rx / 2, ry / 2); em.offset.set(rand(), rand()); map.needsUpdate = em.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ color: tint, map, emissiveMap: em, emissive: 0xffd9a0, emissiveIntensity: .95, roughness: .9 });
  windowMats[district].push(m);
  box(w, cx, h / 2, cz, wd, h, d, m);
  box(w, cx, h + .25, cz, wd + .4, .5, d + .4, 'roof');
  if (solid) { block(cx, cz, wd, d); addSolid(x0, 0, z0, x1, h, z1); }
}

function car(w, x, z, yaw, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; w.add(g);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .35 });
  box(g, 0, .62, 0, 1.85, .7, 4.2, paint); box(g, 0, 1.2, .25, 1.65, .55, 2.1, paint);
  box(g, 0, 1.2, -.83, 1.55, .45, .05, 'glass');
  for (const [wx, wz] of [[-.92, -1.35], [.92, -1.35], [-.92, 1.35], [.92, 1.35]]) { const t = cyl(g, wx, .33, wz, .33, .33, .24, 'dark', 10); t.rotation.z = Math.PI / 2; }
  const side = Math.abs(Math.sin(yaw)) > .7;
  block(x, z, side ? 4.2 : 1.85, side ? 1.85 : 4.2);
  addSolid(x - (side ? 2.1 : .93), 0, z - (side ? .93 : 2.1), x + (side ? 2.1 : .93), 1.5, z + (side ? .93 : 2.1));
}

function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function lamp(w, x, z) {
  const id = districtOf(x);
  cyl(w, x, 3, z, .08, .11, 6, 'dark', 6); box(w, x, 6.05, z, .7, .12, .3, 'dark');
  box(w, x, 5.95, z, .5, .06, .22, lampMats[id]);
  block(x, z, .4, .4); addSolid(x - .15, 0, z - .15, x + .15, 6, z + .15);
}

function build(w) {
  setSeed(6060);
  for (const id of Object.keys(lightsBy)) { lightsBy[id].length = 0; windowMats[id].length = 0; }
  for (const id of ['market', 'civic', 'harbour']) lampMats[id] = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffdca0, emissiveIntensity: 2.4 });
  makeTextures();
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x4a4f52, map: noiseTex([78, 82, 86], 18, [40, 40]), roughness: .95 });
  const pavement = new THREE.MeshStandardMaterial({ color: 0x8d8a82, map: noiseTex([140, 137, 128], 26, [40, 40]), roughness: .95 });
  box(w, 0, -.3, 0, 400, .6, 400, pavement).castShadow = false;
  // Streets (slightly lower than the kerbed blocks) with centre lines and crossings.
  for (const c of [-30, 0, 30]) {
    box(w, c, .005, 0, 10, .02, 120, asphalt).castShadow = false;
    box(w, 0, .006, c, 120, .02, 10, asphalt).castShadow = false;
    for (let t = -44; t < 44; t += 6) { box(w, c, .02, t, .15, .01, 2.6, 'amber').castShadow = false; box(w, t, .02, c, 2.6, .01, .15, 'amber').castShadow = false; }
  }
  for (const cx of [-30, 0, 30]) for (const cz of [-30, 0, 30]) for (let k = -3; k <= 3; k++) {
    box(w, cx + k * 1.2, .02, cz - 6.2, .6, .01, 2, 'white').castShadow = false;
    box(w, cx - 6.2, .02, cz + k * 1.2, 2, .01, .6, 'white').castShadow = false;
  }

  // Edge blocks: tall facades all round (the city continues beyond them).
  const spans = [[-58, -35], [-25, -5], [5, 25], [35, 58]];
  for (const [x0, x1] of spans) for (const [z0, z1] of spans) {
    const edge = x0 < -30 || x1 > 30 || z0 < -30 || z1 > 30;
    if (!edge) continue;
    if (x0 === -58 && z1 === 58) continue;          // south-west: open lot where Kestrel arrives
    if (x1 === 58 && z0 === -58) continue;          // north-east: tram depot
    const h = 14 + Math.floor(rand() * 4) * 4;
    building(w, x0, z0, x1, z1, h, [0xffffff, 0xd8c8b8, 0xc4ccd4, 0xe0d4c0][Math.floor(rand() * 4)]);
  }
  // Fill in the far city beyond the play area so streets don't end in void.
  for (const [x, z] of [[-75, 0], [75, 0], [0, -75], [0, 75], [-75, -75], [75, 75], [-75, 75], [75, -75], [-30, -75], [30, 75], [75, -30], [-75, 30], [30, -75], [-30, 75], [75, 30], [-75, -30]]) {
    const h = 18 + rand() * 20; building(w, x - 10, z - 10, x + 10, z + 10, h, 0xaab2b8, false);
  }

  // Centre blocks.
  building(w, -25, -25, -5, -16.5, 16, 0xd8c8b8);                    // NW: two buildings with an alley
  building(w, -25, -13.5, -5, -5, 12, 0xc4ccd4);
  building(w, 5, -25, 25, -5, 22, 0xb8c4cc);                         // NE: Halvard grid annex
  sign(w, 15, 7, -4.85, 'HALVARD ENERGY  ·  GRID DISPATCH', 10, .9, '#1d3a4a', '#e9efe4');
  building(w, 5, 5, 13.5, 25, 8, 0xe0d4c0);                          // SE: market hall split by an alley
  building(w, 16.5, 5, 25, 25, 8, 0xe0d4c0);
  sign(w, 9.25, 5, 4.85, 'MARKET HALL', 4, .6, '#7d4a3a', '#f4e8d0');

  // SW centre block: Civic plaza with fountain, trees, benches and kiosks.
  box(w, -15, .08, 15, 20, .16, 20, 'concrete').castShadow = false;
  cyl(w, -15, .45, 15, 3.2, 3.4, .9, 'concrete', 24); cyl(w, -15, .82, 15, 2.8, 2.8, .1, new THREE.MeshStandardMaterial({ color: 0x2c5566, roughness: .15 }), 24);
  cyl(w, -15, 1.6, 15, .25, .35, 1.6, 'concrete', 10);
  block(-15, 15, 6.4, 6.4); addSolid(-18.2, 0, 11.8, -11.8, 1, 18.2);
  for (const [x, z] of [[-22, 8], [-8, 8], [-22, 22], [-8, 22]]) {
    cyl(w, x, 1.6, z, .2, .28, 3.2, 'trunk', 6); mesh(w, geo('sphere', 1.8, 8, 6), 'leaf', x, 4, z);
    block(x, z, .6, .6); addSolid(x - .3, 0, z - .3, x + .3, 3, z + .3);
  }
  for (const [x, z, r] of [[-15, 9.5, 0], [-15, 20.5, 0], [-9.5, 15, 1], [-20.5, 15, 1]]) {
    const bw = r ? .7 : 2.6, bd = r ? 2.6 : .7; solid(w, x, .45, z, bw, .9, bd, 'trunk');
  }
  solid(w, -23, 1.3, 23, 2.4, 2.6, 2.4, 'green'); solid(w, -7, 1.3, 6.5, 2.4, 2.6, 2.4, 'red');      // kiosks

  // Street furniture: lamps, parked cars, bus shelters, dumpsters, barriers.
  for (const c of [-30, 0, 30]) for (let t = -40; t <= 40; t += 13) {
    if (Math.abs(t - 30) < 6 || Math.abs(t) < 6 || Math.abs(t + 30) < 6) continue;
    lamp(w, c + 4.4, t); lamp(w, t, c - 4.4);
  }
  const colors = [0x7d4a3a, 0x47606e, 0x8a8268, 0x5b6b4d, 0x2f3a44, 0xb8b2a4, 0x6d2f2f];
  let ci = 0;
  for (const c of [-30, 0, 30]) for (let t = -42; t <= 42; t += 7) {
    if (Math.abs(t - 30) < 8 || Math.abs(t) < 8 || Math.abs(t + 30) < 8) continue;
    if (rand() < .5) car(w, c - 3.6, t + (rand() - .5), (rand() - .5) * .1, colors[ci++ % 7]);
    if (rand() < .4) car(w, t + (rand() - .5), c + 3.6, Math.PI / 2 + (rand() - .5) * .1, colors[ci++ % 7]);
  }
  for (const [x, z] of [[2, 12], [-28, -12], [32, -14]]) {
    const sx = Math.abs(x) < 5 || Math.abs(x - 30) < 5 || Math.abs(x + 30) < 5;
    box(w, x + (sx ? 2.6 : 0), 2.4, z, sx ? .1 : 3.6, .1, sx ? 3.6 : .1, 'roof');
    box(w, x + (sx ? 3.2 : 0), 1.2, z + (sx ? 0 : -.6), sx ? .05 : 3.4, 2.2, sx ? 3.4 : .05, 'glass');
  }
  for (const [x, z] of [[-12, -15], [-7, -15], [12, 13], [15, 22], [-33, 18], [27, -20], [-26, 34]]) solid(w, x, .7, z, 1.8, 1.4, 1.1, 'green');
  for (const [x, z, r] of [[0, -18, 0], [-30, 8, 1], [30, 18, 1], [-18, 30, 0], [18, -30, 0]]) solid(w, x, .5, z, r ? 1.1 : 4, 1, r ? 4 : 1.1, 'concrete');

  // South-west arrival lot and north-east tram depot.
  box(w, -40, .06, 40, 12, .12, 12, 'concrete').castShadow = false;
  solid(w, -42, 1.2, 36, 3, 2.4, 2.2, 'crate'); solid(w, -37, 1, 43, 2.6, 2, 2.2, 'crate');
  box(w, 40, .06, -40, 12, .12, 12, 'concrete').castShadow = false;
  for (const x of [36, 40, 44]) rod(w, [x, .1, -46], [x, .1, -34], .06, 'steel', 6);
  box(w, 40, 5.2, -40, 12, .3, 9, 'roof'); for (const [x, z] of [[35, -44], [45, -44], [35, -36], [45, -36]]) { cyl(w, x, 2.6, z, .15, .15, 5.2, 'steel', 8); block(x, z, .4, .4); }
  sign(w, 40, 4.2, -35.4, 'PORT CALDER TRAM DEPOT', 6, .7, '#2f5a3a', '#e9efe4');
  solid(w, 37, .7, -38, 2.2, 1.4, 1.1, 'concrete'); solid(w, 43, .7, -42, 2.2, 1.4, 1.1, 'concrete');

  // District lights: one wide area light per district (switched by blackouts), placed high.
  for (const [id, x] of [['market', -28], ['civic', 0], ['harbour', 28]]) for (const z of [-22, 22]) {
    const l = new THREE.PointLight(0xffd9a0, 0, 46, 1.2); l.userData.on = 55; l.position.set(x, 13, z); w.add(l); lightsBy[id].push(l);
  }
}
