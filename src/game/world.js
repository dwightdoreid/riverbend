// Level collision data and spatial queries. Walk collisions are 2D footprints (with a
// player margin baked in); solids are 3D boxes used for line of sight, bullets and grenades.
import { THREE } from '../engine/three.js';

export const world = {
  collisions: [],
  solids: [],
  bounds: { x: 42, z: 36.5 },
  // Moving or removable obstacles (escort vehicles, barricades). Each mover has walk-blocking
  // circles [{x, z, r}], a Box3 for bullets/line of sight, an `enabled` flag and an optional
  // onHit(damage, hostile) callback for projectiles that strike it.
  movers: [],
};

export function clearWorld(bounds) {
  world.collisions.length = 0; world.solids.length = 0; world.movers.length = 0;
  world.bounds = { ...bounds };
}

export function addMover(m) { m.enabled ??= true; world.movers.push(m); return m; }
export function clearMovers() { world.movers.length = 0; }

/** Is (x, z) inside any enabled mover (with clearance r)? */
export function moverBlocked(x, z, r = .3, ignore = null) {
  for (const m of world.movers) {
    if (!m.enabled || m === ignore) continue;
    for (const c of m.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return m;
  }
  return null;
}

export function block(x, z, w, d) { world.collisions.push({ x, z, w: w + .8, d: d + .8 }); }

export function addSolid(minX, minY, minZ, maxX, maxY, maxZ) {
  const b = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
  world.solids.push(b); return b;
}

export function moveBlocked(x, z, r = .3, ignoreMovers = false) {
  if (Math.abs(x) > world.bounds.x || Math.abs(z) > world.bounds.z) return true;
  if (world.collisions.some(b => Math.abs(x - b.x) < b.w / 2 + r - .3 && Math.abs(z - b.z) < b.d / 2 + r - .3)) return true;
  return !ignoreMovers && !!moverBlocked(x, z, r);
}

const testRay = new THREE.Ray(), hitPoint = new THREE.Vector3();
export { testRay };

/** Nearest hit against solids or the ground plane, within maxDist. */
export function castSolid(origin, dir, maxDist) {
  testRay.set(origin, dir);
  let best = maxDist + 1, point = null, boxHit = null;
  let mover = null;
  const test = (b, m) => {
    if (b.containsPoint(origin)) { best = .015; point = testRay.at(.015, new THREE.Vector3()); boxHit = b; mover = m; return true; }
    const h = testRay.intersectBox(b, hitPoint);
    if (h) { const d = h.distanceTo(origin); if (d < best && d <= maxDist) { best = d; point = h.clone(); boxHit = b; mover = m; } }
    return false;
  };
  for (const b of world.solids) if (test(b, null)) return { distance: best, point, box: boxHit, mover };
  for (const m of world.movers) if (m.enabled && m.box && test(m.box, m)) return { distance: best, point, box: boxHit, mover };
  if (dir.y < -.00001) {
    const d = (.18 - origin.y) / dir.y;
    if (d >= 0 && d < best && d <= maxDist) { best = d; point = origin.clone().addScaledVector(dir, d); boxHit = null; mover = null; }
  }
  return point ? { distance: best, point, box: boxHit, mover } : null;
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
