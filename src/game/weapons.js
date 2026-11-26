// Weapon definitions and the actions a player can take with them.
import { THREE } from '../engine/three.js';
import { cyl, box } from '../engine/builders.js';
import { G } from './state.js';
import { eyeOf, aimDirection, spreadOf } from './players.js';
import { projectile, alertNoise } from './combat.js';
import { sfxFor, tell } from './fx.js';
import { updateHUD } from '../ui/hud.js';
import { isClient, sendShot, sendGrenade } from '../net/net.js';

export const WEAPONS = {
  rifle: { name: 'AR-30 / ASSAULT RIFLE', short: 'rifle', mode: 'AUTO', cap: 30, reserveMax: 120, interval: .105, reload: 2.15, damage: 31, spread: .009, kick: .011, speed: 240, auto: true, sound: 'shot' },
  pistol: { name: 'P12 / SIDEARM', short: 'pistol', mode: 'SEMI-AUTO', cap: 12, reserveMax: 48, interval: .23, reload: 1.5, damage: 43, spread: .011, kick: .024, speed: 205, auto: false, sound: 'pistol' },
};

const hud = p => { if (p.local) updateHUD(); };

export function fire(p) {
  if (G.status !== 'playing' || !p.alive || p.downed || p.reloadLeft > 0 || p.swapLeft > 0 || p.fireDelay > 0) return;
  if (p.weapon === 'grenade') { throwGrenade(p); return; }
  const w = WEAPONS[p.weapon], a = p.ammo[p.weapon];
  if (p.sprinting) { tell(p, 'Release sprint to fire.', .7); return; }
  if (a.mag <= 0) {
    p.fireDelay = .25; sfxFor(p, 'reload', .6);
    tell(p, a.reserve ? 'Empty magazine — R to reload.' : 'Empty — switch weapon or find supplies.', 1.6); return;
  }
  a.mag--; p.stats.shots++; p.fireDelay = w.interval;
  const origin = eyeOf(p), dir = aimDirection(p, spreadOf(p));
  if (isClient()) { sendShot(origin, dir, w.speed, w.damage); projectile(origin, dir, w.speed, 0, p, true); }
  else projectile(origin, dir, w.speed, w.damage, p);
  alertNoise(p.pos, 35);
  p.kick = Math.min(.14, p.kick + w.kick * (p.aiming ? .72 : 1));
  p.yaw += (Math.random() - .5) * w.kick * .3;
  p.weaponKick = Math.min(.13, p.weaponKick + .07); p.muzzleLeft = .065;
  sfxFor(p, w.sound); hud(p);
}

export function switchWeapon(p, next) {
  if (G.status !== 'playing' || p.swapLeft > 0) return;
  if (next === 'grenade' && p.grenades === 0) { tell(p, 'No grenades remaining.'); return; }
  if (p.weapon === next) return;
  if (next !== 'grenade') p.lastGun = next;
  p.weapon = next; p.reloadLeft = 0; p.swapLeft = .26; p.input.trigger = p.input.semi = false; p.aiming = false;
  sfxFor(p, 'reload'); hud(p);
}

export function reload(p) {
  if (G.status !== 'playing' || p.weapon === 'grenade' || p.reloadLeft > 0) return;
  const w = WEAPONS[p.weapon], a = p.ammo[p.weapon];
  if (a.mag === w.cap) return;
  if (a.reserve <= 0) { tell(p, 'Reserve empty. Switch weapon or find a supply crate.'); return; }
  p.reloadLeft = p.reloadTotal = w.reload; p.input.trigger = p.input.semi = false; p.aiming = false;
  sfxFor(p, 'reload'); tell(p, 'Reloading ' + w.short + '…', w.reload);
}

export function throwGrenade(p) {
  if (G.status !== 'playing' || !p.alive || p.downed || p.grenades === 0 || p.swapLeft > 0 || p.fireDelay > .15) return;
  if (p.reloadLeft > 0) p.reloadLeft = 0;
  p.grenades--;
  const d = aimDirection(p), pos = eyeOf(p).addScaledVector(d, .35), vel = d.multiplyScalar(12).add(new THREE.Vector3(0, 2.7, 0));
  if (isClient()) { p.stats.grenades++; sendGrenade(pos, vel); }   // the host simulates it; we see it via snapshots
  else { p.stats.grenades++; spawnBomb(pos, vel, p); }
  p.fireDelay = .55; p.weaponKick = .16; alertNoise(p.pos, 8);
  if (p.weapon === 'grenade' && p.grenades === 0) p.weapon = p.lastGun;
  tell(p, 'Grenade away.', 1); sfxFor(p, 'reload'); hud(p);
}

/** Creates a live grenade (host/solo only). */
export function spawnBomb(pos, vel, owner) {
  const g = new THREE.Group(); cyl(g, 0, 0, 0, .07, .085, .18, 'green', 9); box(g, 0, .11, 0, .09, .04, .05, 'edge');
  g.position.copy(pos); G.dynRoot.add(g);
  G.bombs.push({ g, pos: pos.clone(), vel: vel.clone(), fuse: 2.5, spin: Math.random() * 4 + 2, owner });
}
