// Level collision data and spatial queries. Walk collisions are 2D footprints (with a
// player margin baked in); solids are 3D boxes used for line of sight, bullets and grenades.
import { THREE } from '../engine/three.js';

export const world = {
  collisions: [],
  solids: [],
  bounds: { x: 42, z: 36.5 },
};

export function clearWorld(bounds) {
  world.collisions.length = 0; world.solids.length = 0;
  world.bounds = { ...bounds };
}

export function block(x, z, w, d) { world.collisions.push({ x, z, w: w + .8, d: d + .8 }); }

export function addSolid(minX, minY, minZ, maxX, maxY, maxZ) {
  const b = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
  world.solids.push(b); return b;
}

export function moveBlocked(x, z, r = .3) {
  if (Math.abs(x) > world.bounds.x || Math.abs(z) > world.bounds.z) return true;
  return world.collisions.some(b => Math.abs(x - b.x) < b.w / 2 + r - .3 && Math.abs(z - b.z) < b.d / 2 + r - .3);
}

const testRay = new THREE.Ray(), hitPoint = new THREE.Vector3();
export { testRay };

/** Nearest hit against solids or the ground plane, within maxDist. */
export function castSolid(origin, dir, maxDist) {
  testRay.set(origin, dir);
  let best = maxDist + 1, point = null, boxHit = null;
  for (const b of world.solids) {
    if (b.containsPoint(origin)) return { distance: .015, point: testRay.at(.015, new THREE.Vector3()), box: b };
    const h = testRay.intersectBox(b, hitPoint);
    if (h) { const d = h.distanceTo(origin); if (d < best && d <= maxDist) { best = d; point = h.clone(); boxHit = b; } }
  }
  if (dir.y < -.00001) {
    const d = (.18 - origin.y) / dir.y;
    if (d >= 0 && d < best && d <= maxDist) { best = d; point = origin.clone().addScaledVector(dir, d); boxHit = null; }
  }
  return point ? { distance: best, point, box: boxHit } : null;
}

export function los(a, b) {
  const d = b.clone().sub(a), distance = d.length();
  return !castSolid(a, d.divideScalar(distance), distance - .1);
}

/** Nearest walkable point to (x, z), searching outward in rings. */
export function freePoint(x, z) {
  for (let r = 0; r < 8; r += .65) for (let a = 0; a < 8; a++) {
    const xx = x + Math.cos(a * Math.PI / 4) * r, zz = z + Math.sin(a * Math.PI / 4) * r;
    if (!moveBlocked(xx, zz, .22)) return new THREE.Vector3(xx, 0, zz);
  }
  return new THREE.Vector3(x, 0, z);
}
