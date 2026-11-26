// Deployable auto-turrets. Players carry a mission-defined number (T to deploy); a turret
// tracks the nearest visible machine and fires until its ammo runs out or it is destroyed.
// Simulated on the host; co-op clients draw them from snapshots.
import { THREE } from '../engine/three.js';
import { box, cyl } from '../engine/builders.js';
import { G } from './state.js';
import { addMover, moveBlocked, los } from './world.js';
import { projectile, burst } from './combat.js';
import { tell, sfxAt, sfxFor } from './fx.js';
import { feed, updateHUD } from '../ui/hud.js';
import { isClient, sendDeploy } from '../net/net.js';

export const TURRET = { hp: 240, ammo: 120, range: 22, interval: .3, damage: 12, speed: 210 };
let nextId = 1;

function buildModel(t) {
  const root = new THREE.Group(), head = new THREE.Group(); root.add(head); G.dynRoot.add(root);
  root.position.set(t.pos.x, 0, t.pos.z);
  for (const a of [0, 2.1, 4.2]) { const leg = box(root, Math.sin(a) * .35, .3, Math.cos(a) * .35, .08, .6, .08, 'dark'); leg.rotation.x = .35; leg.rotation.y = a; }
  cyl(root, 0, .68, 0, .12, .16, .22, 'edge', 10);
  head.position.y = .92;
  box(head, 0, 0, 0, .42, .3, .5, 'green'); box(head, 0, .02, -.45, .07, .07, .5, 'dark');
  const eye = box(head, 0, .09, -.26, .16, .06, .02, new THREE.MeshStandardMaterial({ color: 0x9ff0c8, emissive: 0x4fe0a0, emissiveIntensity: 1.6 }));
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, head, eye };
}

/** Creates a turret entity (host: with collision + damage; client: visual only). */
export function makeTurret({ id, owner, x, z, yaw, hp = TURRET.hp, ammo = TURRET.ammo }, visualOnly = false) {
  const t = { id: id ?? nextId++, owner, pos: new THREE.Vector3(x, 0, z), yaw, hp, ammo, shot: .6, dead: false };
  Object.assign(t, buildModel(t));
  t.head.rotation.y = yaw;
  if (!visualOnly) {
    t.mover = addMover({
      circles: [{ x, z, r: .55 }],
      // Kept below the gun (muzzle at 1.02 m) so the turret's own line of sight starts outside it.
      box: new THREE.Box3(new THREE.Vector3(x - .35, 0, z - .35), new THREE.Vector3(x + .35, .85, z + .35)),
      onHit: (dmg, hostile) => { if (hostile) damageTurret(t, dmg); },
    });
  }
  G.turrets.push(t);
  return t;
}

export function deployTurret(p) {
  if (G.status !== 'playing' || !p.alive || p.downed) return;
  if ((p.turrets ?? 0) <= 0) { tell(p, 'No turrets left.', 1.5); return; }
  const x = p.pos.x - Math.sin(p.yaw) * 1.7, z = p.pos.z - Math.cos(p.yaw) * 1.7;
  if (isClient()) { sendDeploy(x, z, p.yaw); return; }
  if (moveBlocked(x, z, .5)) { tell(p, 'No room to deploy here.', 1.5); return; }
  p.turrets--;
  makeTurret({ owner: p, x, z, yaw: p.yaw });
  feed(p.name === 'You' ? 'Turret deployed' : p.name + ' deployed a turret');
  sfxFor(p, 'reload'); if (p.local) updateHUD();
}

function damageTurret(t, dmg) {
  if (t.dead) return;
  t.hp -= dmg;
  if (t.hp <= 0) destroyTurret(t);
}

function destroyTurret(t) {
  t.dead = true; t.root.visible = false; if (t.mover) t.mover.enabled = false;
  burst(t.pos.clone().setY(.9), 0x9fb5a8, 12, 3);
  feed('Turret destroyed');
}

export function updateTurrets(dt) {
  for (const t of G.turrets) {
    if (t.dead) continue;
    t.shot -= dt;
    const muzzle = new THREE.Vector3(t.pos.x, 1.02, t.pos.z);
    let best = null, bestD = TURRET.range;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const c = e.pos.clone().setY(e.type.centerY), d = c.distanceTo(muzzle);
      if (d < bestD && los(muzzle, c)) { best = c; bestD = d; }
    }
    t.eye.material.emissiveIntensity = t.ammo > 0 ? (best ? 2.4 : 1.2) : .1;
    if (!best || t.ammo <= 0) continue;
    const want = Math.atan2(-(best.x - t.pos.x), -(best.z - t.pos.z));
    let diff = ((want - t.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    t.yaw += THREE.MathUtils.clamp(diff, -6 * dt, 6 * dt); t.head.rotation.y = t.yaw;
    if (Math.abs(diff) < .12 && t.shot <= 0) {
      t.shot = TURRET.interval; t.ammo--;
      const dir = best.clone().sub(muzzle).normalize();
      dir.x += (Math.random() - .5) * .05; dir.y += (Math.random() - .5) * .03; dir.normalize();
      projectile(muzzle.clone().addScaledVector(dir, .55), dir, TURRET.speed, TURRET.damage, t.owner, false, true);
      sfxAt(t.pos, 'pistol', .5, 70);
      if (t.ammo === 0) feed('A turret is out of ammo');
    }
  }
}

export function clearTurrets() {
  for (const t of G.turrets ?? []) t.root.removeFromParent();
  G.turrets = [];
}

// Serialization for checkpoints and co-op snapshots.
export const snapshotTurrets = () => G.turrets.filter(t => !t.dead).map(t => ({ id: t.id, owner: t.owner?.id ?? 0, x: t.pos.x, z: t.pos.z, yaw: t.yaw, hp: t.hp, ammo: t.ammo }));
export function restoreTurrets(list, visualOnly = false) {
  clearTurrets();
  for (const s of list) makeTurret({ ...s, owner: G.players.find(p => p.id === s.owner) ?? G.local }, visualOnly);
}

/** Co-op client: mirror the host's turret list. */
export function syncTurretVisuals(rows) {
  const keep = new Set(rows.map(r => r[0]));
  for (const t of G.turrets) if (!keep.has(t.id)) t.root.removeFromParent();
  G.turrets = G.turrets.filter(t => keep.has(t.id));
  for (const [id, x, z, yaw, ammo] of rows) {
    let t = G.turrets.find(q => q.id === id);
    if (!t) t = makeTurret({ id, owner: null, x, z, yaw }, true);
    t.yaw = yaw; t.head.rotation.y = yaw; t.ammo = ammo;
    t.eye.material.emissiveIntensity = ammo > 0 ? 1.6 : .1;
  }
}
