// Player entities. All per-player state lives here so the host can simulate several players.
// A player is driven by its `input` struct: the local browser fills it from keyboard/touch,
// and in co-op the host fills remote players' structs from network messages.
import { THREE } from '../engine/three.js';
import { moveBlocked } from './world.js';
import { WEAPONS, fire } from './weapons.js';
import { alertNoise } from './combat.js';
import { sfxFor } from './fx.js';
import { updateHUD } from '../ui/hud.js';

export const STAND_EYE = 1.72, CROUCH_EYE = 1.12, MAX_HEALTH = 100, MAX_GRENADES = 3;

export function createPlayer({ id, name = 'Operator', local = false }) {
  const p = {
    id, name, local,
    pos: new THREE.Vector3(), yaw: 0, pitch: 0, eye: STAND_EYE, moving: 0, sprinting: false, bob: 0,
    input: { forward: 0, side: 0, sprint: false, use: false, trigger: false, semi: false },
    stats: { shots: 0, hits: 0, kills: 0, grenades: 0, damage: 0 },
    ammo: {},
  };
  resetPlayer(p, [0, 0, 0]);
  return p;
}

export function resetPlayer(p, spawn) {
  p.pos.set(spawn[0], 0, spawn[1]); p.yaw = spawn[2] ?? 0; p.pitch = 0; p.eye = STAND_EYE; p.bob = 0; p.moving = 0; p.sprinting = false;
  p.health = MAX_HEALTH; p.stamina = 100; p.alive = true;
  p.downed = false; p.bleed = 0; p.respawnAt = 0; p.reviveProgress = 0; p.stims = 1; p.protectUntil = 0;
  p.weapon = p.lastGun = 'rifle'; p.grenades = MAX_GRENADES;
  for (const [k, w] of Object.entries(WEAPONS)) p.ammo[k] = { mag: w.cap, reserve: w.reserveMax };
  p.aiming = p.crouched = false; p.aimBlend = 0; p.kick = p.weaponKick = 0; p.muzzleLeft = 0;
  p.reloadLeft = p.reloadTotal = p.fireDelay = p.swapLeft = 0;
  p.interactTime = 0; p.interaction = null;
  Object.assign(p.input, { forward: 0, side: 0, sprint: false, use: false, trigger: false, semi: false });
  for (const k in p.stats) p.stats[k] = 0;
}

export const eyeOf = p => new THREE.Vector3(p.pos.x, p.eye, p.pos.z);
/** Alive and not downed: can move, shoot, be targeted, revive others. */
export const isActive = p => p.alive && !p.downed;

export function aimDirection(p, spread = 0) {
  const d = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(p.pitch + p.kick, p.yaw, 0, 'YXZ'));
  if (spread) {
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)), up = new THREE.Vector3().crossVectors(right, d).normalize();
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    d.addScaledVector(right, Math.cos(angle) * r).addScaledVector(up, Math.sin(angle) * r).normalize();
  }
  return d;
}

export function spreadOf(p) {
  if (p.weapon === 'grenade') return .005;
  const w = WEAPONS[p.weapon];
  return w.spread * (1 + (p.moving ? 1.2 : 0) + (p.sprinting ? 3 : 0)) * (1 - p.aimBlend * .72) * (p.crouched ? .65 : 1) + p.weaponKick * .04;
}

export const DOWNED_EYE = .45;

export function updatePlayer(p, dt) {
  if (!p.alive || p.downed) {
    p.moving = 0; p.sprinting = false; p.aiming = false; p.input.trigger = p.input.semi = false; p.reloadLeft = 0;
    p.eye = THREE.MathUtils.damp(p.eye, DOWNED_EYE, 6, dt); p.aimBlend = THREE.MathUtils.damp(p.aimBlend, 0, 14, dt);
    return;
  }
  const { forward, side } = p.input, moving = forward !== 0 || side !== 0;
  p.sprinting = moving && forward > 0 && p.input.sprint && !p.crouched && !p.aiming && p.stamina > 2 && p.reloadLeft <= 0;
  p.moving = moving ? 1 : 0;
  const speed = p.sprinting ? 6.6 : p.crouched ? 2.1 : p.aiming ? 2.7 : 4.2;
  if (moving) {
    const len = Math.hypot(forward, side), f = forward / len, s = side / len;
    const dx = (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * speed * dt, dz = (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * speed * dt;
    if (!moveBlocked(p.pos.x + dx, p.pos.z)) p.pos.x += dx;
    if (!moveBlocked(p.pos.x, p.pos.z + dz)) p.pos.z += dz;
    p.bob += dt * (p.sprinting ? 12 : 8);
    if (p.sprinting) alertNoise(p.pos, 12);
  }
  p.stamina = THREE.MathUtils.clamp(p.stamina + (p.sprinting ? -23 : 14) * dt, 0, 100);
  p.eye = THREE.MathUtils.damp(p.eye, p.crouched ? CROUCH_EYE : STAND_EYE, 12, dt);
  p.aimBlend = THREE.MathUtils.damp(p.aimBlend, p.aiming && p.weapon !== 'grenade' && !p.sprinting && p.reloadLeft <= 0 ? 1 : 0, 14, dt);
  p.kick = THREE.MathUtils.damp(p.kick, 0, 9, dt);
  p.weaponKick = THREE.MathUtils.damp(p.weaponKick, 0, 15, dt);
  p.fireDelay = Math.max(0, p.fireDelay - dt);
  p.swapLeft = Math.max(0, p.swapLeft - dt);
  p.muzzleLeft = Math.max(0, p.muzzleLeft - dt);
  if (p.reloadLeft > 0) {
    p.reloadLeft = Math.max(0, p.reloadLeft - dt);
    if (p.reloadLeft === 0 && WEAPONS[p.weapon]) {
      const w = WEAPONS[p.weapon], a = p.ammo[p.weapon], n = Math.min(w.cap - a.mag, a.reserve);
      a.mag += n; a.reserve -= n; sfxFor(p, 'reload'); if (p.local) updateHUD();
    }
  }
  if (p.input.trigger && WEAPONS[p.weapon]?.auto) fire(p);
  if (p.input.semi) { fire(p); p.input.semi = false; }
}

export function healPlayer(p, amount) { p.health = Math.min(MAX_HEALTH, p.health + amount); }
export function resupplyPlayer(p) {
  for (const [k, w] of Object.entries(WEAPONS)) p.ammo[k].reserve = w.reserveMax;
  p.grenades = Math.min(MAX_GRENADES, p.grenades + 2);
}
export function needsAmmo(p) {
  return Object.entries(WEAPONS).some(([k, w]) => p.ammo[k].reserve < w.reserveMax) || p.grenades < MAX_GRENADES;
}
