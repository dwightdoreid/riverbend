// Low-level mesh helpers shared by levels, props, enemies and the viewmodel.
import { THREE } from './three.js';

export const mats = {};
const geos = {};

export function mat(name, color, metal = 0, rough = .7) {
  return mats[name] = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}
mat('steel', 0x81949c, .65, .4); mat('edge', 0x445762, .55, .55); mat('dark', 0x293c46, .4, .65);
mat('tank', 0x819589, .4, .55); mat('tank2', 0x97a79a, .4, .5); mat('ceramic', 0x67513d, .15, .35);
mat('silicone', 0x62747b, .1, .6); mat('conductor', 0xc3ccc7, .8, .33); mat('concrete', 0xc0bfb2, .05, .91);
mat('road', 0x5c6668, 0, .98); mat('building', 0xd9d3bd, 0, .9); mat('roof', 0x67766e, .3, .7);
mat('glass', 0x2c5668, .4, .25); mat('white', 0xebe9da, 0, .7); mat('amber', 0xe4ad4a, .2, .6);
mat('red', 0xb85d48, .1, .6); mat('blue', 0x507f9e, .1, .6); mat('leaf', 0x536e54, 0, 1);
mat('leaf2', 0x6a8157, 0, 1); mat('trunk', 0x6d6051, 0, 1); mat('earth', 0x967254, .35, .7);
mat('green', 0x47726b, .2, .6); mat('cover', 0x848b7e, .05, .92); mat('crate', 0x4f635d, .4, .65);
mat('orange', 0xc47b42, .35, .55);
mat('rock', 0x7d756a, .05, .95); mat('rock2', 0x6a645c, .05, .95); mat('pine', 0x3e5a45, 0, 1); mat('pine2', 0x4b6a4c, 0, 1); mat('asphalt', 0x4a4f51, 0, .97);

export const glowMats = {
  amber: () => new THREE.MeshStandardMaterial({ color: 0xe4b55f, emissive: 0xf4a230, emissiveIntensity: .65, roughness: .45 }),
  teal: () => new THREE.MeshStandardMaterial({ color: 0x72d9bb, emissive: 0x3aaf9c, emissiveIntensity: .5 }),
};
export const glow = glowMats.amber();

export function geo(type, ...p) {
  const key = type + p.join(',');
  if (!geos[key]) geos[key] = type === 'box' ? new THREE.BoxGeometry(...p)
    : type === 'cyl' ? new THREE.CylinderGeometry(...p)
    : type === 'sphere' ? new THREE.SphereGeometry(...p)
    : type === 'cone' ? new THREE.ConeGeometry(...p)
    : new THREE.TorusGeometry(...p);
  return geos[key];
}
export function mesh(g, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, typeof material === 'string' ? mats[material] : material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
export function box(g, x, y, z, w, h, d, m = 'concrete') { const o = mesh(g, geo('box', 1, 1, 1), m, x, y, z); o.scale.set(w, h, d); return o; }
export function cyl(g, x, y, z, rt, rb, h, m = 'steel', n = 10) { const o = mesh(g, geo('cyl', rt, rb, 1, n), m, x, y, z); o.scale.y = h; return o; }
export function rod(g, a, b, r = .06, m = 'steel', n = 7) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), v = bv.clone().sub(av);
  const o = mesh(g, geo('cyl', 1, 1, 1, n), m, ...av.clone().add(bv).multiplyScalar(.5).toArray());
  o.scale.set(r, v.length(), r); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return o;
}
export function wire(g, a, b, sag = .15, r = .045) {
  const steps = 8; let p = a;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    rod(g, p, q, r, 'conductor', 6); p = q;
  }
}
export function ins(g, x, b, z, h = 1.8, r = .23, m = 'ceramic') {
  cyl(g, x, b + h / 2, z, r * .55, r * .65, h, m);
  const n = Math.max(4, Math.round(h / .19));
  for (let i = 0; i < n; i++) cyl(g, x, b + .1 + i * (h - .2) / n, z, r * .83, r, .09, m);
  cyl(g, x, b - .03, z, r * .62, r * .62, .13); cyl(g, x, b + h + .03, z, r * .6, r * .6, .13);
}
export function footing(g, x, z, w = 1.6, d = 1.6) { box(g, x, .13, z, w, .26, d, 'concrete'); }

// Deterministic RNG so level dressing is identical on every load.
let seed = 31;
export function setSeed(s) { seed = s >>> 0; }
export function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

export function noiseTex(base, spread, repeat = [36, 32]) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d'), im = ctx.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = (rand() - .5) * spread;
    im.data[i] = base[0] + v; im.data[i + 1] = base[1] + v; im.data[i + 2] = base[2] + v; im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function sign(g, x, y, z, text, w = 2.6, h = .6, bg = '#213b43', fg = '#e2e5d6') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#ffffff40'; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = fg; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return box(g, x, y, z, w, h, .06, new THREE.MeshStandardMaterial({ map: t, roughness: .9 }));
}
