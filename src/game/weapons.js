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
  // Close-range pump shotgun: 8 pellets per shell, devastating against Skimmers.
  shotgun: { name: 'SG-8 / SHOTGUN', short: 'shotgun', mode: 'PUMP · 8 PELLETS', cap: 6, reserveMax: 30, interval: .78, reload: 2.6, damage: 15, pellets: 8, pelletSpread: .055, spread: .012, kick: .045, speed: 190, auto: false, sound: 'shotgun' },
  // Marksman rifle: hard-hitting semi-auto with a strong zoom (zoom = degrees of FOV removed when aiming).
  dmr: { name: 'DMR-14 / MARKSMAN', short: 'dmr', mode: 'SEMI · ZOOM', cap: 10, reserveMax: 40, interval: .34, reload: 2.4, damage: 70, spread: .0025, kick: .034, speed: 320, auto: false, sound: 'dmr', zoom: 46 },
  // Arc carbine: electric bolts that stun a machine and chain to up to two more nearby.
  arc: { name: 'ARC-3 / ARC CARBINE', short: 'arc', mode: 'SEMI · STUN + CHAIN', cap: 16, reserveMax: 64, interval: .27, reload: 2.2, damage: 24, spread: .006, kick: .02, speed: 150, auto: false, sound: 'arc', arc: { chains: 2, range: 7, stun: 1.4 } },
};
export const DEFAULT_LOADOUT = ['rifle', 'pistol'];

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
  const origin = eyeOf(p);
  for (let i = 0; i < (w.pellets ?? 1); i++) {
    const dir = aimDirection(p, spreadOf(p) + (w.pelletSpread ?? 0) * (w.pellets ? Math.random() : 0));
    const kind = w.arc ? 'arc' : null;
    if (isClient()) { sendShot(origin, dir, w.speed, w.damage, kind); projectile(origin, dir, w.speed, 0, p, true, false, null, kind); }
    else projectile(origin, dir, w.speed, w.damage, p, false, false, null, kind);
  }
  alertNoise(p.pos, 35);
  p.kick = Math.min(.14, p.kick + w.kick * (p.aiming ? .72 : 1));
  p.yaw += (Math.random() - .5) * w.kick * .3;
  p.weaponKick = Math.min(.13, p.weaponKick + .07); p.muzzleLeft = .065;
  sfxFor(p, w.sound); hud(p);
}

export function switchWeapon(p, next) {
  if (G.status !== 'playing' || p.swapLeft > 0) return;
  if (next !== 'grenade' && !p.loadout.includes(next)) return;
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

/** kind: 'frag' (G) or 'smoke' (V, when the mission provides smoke grenades). */
export function throwGrenade(p, kind = 'frag') {
  const smoke = kind === 'smoke', emp = kind === 'emp';
  if (G.status !== 'playing' || !p.alive || p.downed || p.swapLeft > 0 || p.fireDelay > .15) return;
  if (smoke ? !p.smokes : emp ? !p.emps : p.grenades === 0) { if (smoke || emp) tell(p, emp ? 'No EMP grenades.' : 'No smoke grenades.', 1.2); return; }
  if (p.reloadLeft > 0) p.reloadLeft = 0;
  if (smoke) p.smokes--; else if (emp) p.emps--; else p.grenades--;
  const d = aimDirection(p), pos = eyeOf(p).addScaledVector(d, .35), vel = d.multiplyScalar(12).add(new THREE.Vector3(0, 2.7, 0));
  if (isClient()) { if (!smoke && !emp) p.stats.grenades++; sendGrenade(pos, vel, kind); }   // the host simulates it; we see it via snapshots
  else { if (!smoke && !emp) p.stats.grenades++; spawnBomb(pos, vel, p, kind); }
  p.fireDelay = .55; p.weaponKick = .16; alertNoise(p.pos, 8);
  if (p.weapon === 'grenade' && p.grenades === 0) p.weapon = p.lastGun;
  tell(p, smoke ? 'Smoke out.' : emp ? 'EMP out.' : 'Grenade away.', 1); sfxFor(p, 'reload'); hud(p);
}

/** Creates a live grenade (host/solo only). */
export function spawnBomb(pos, vel, owner, kind = 'frag') {
  const g = new THREE.Group(); cyl(g, 0, 0, 0, .07, .085, .18, kind === 'smoke' ? 'white' : kind === 'emp' ? 'blue' : 'green', 9); box(g, 0, .11, 0, .09, .04, .05, 'edge');
  g.position.copy(pos); G.dynRoot.add(g);
  G.bombs.push({ g, pos: pos.clone(), vel: vel.clone(), fuse: kind === 'smoke' ? 1.4 : kind === 'emp' ? 1.6 : 2.5, spin: Math.random() * 4 + 2, owner, kind });
}
