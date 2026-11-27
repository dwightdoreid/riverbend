// Stealth: security cameras, a detection meter and the alarm. Missions opt in with
//   stealth: { onAlarm: [events], waves: { every: seconds, events: [events] } }
// Detection builds while a camera watches an active player, or while a guard (an enemy with
// def.guard) is engaging one; it drains otherwise. A full meter raises the alarm (one-way):
// onAlarm runs once, then the wave events repeat every `every` seconds.
import { THREE } from '../engine/three.js';
import { G } from './state.js';
import { los } from './world.js';
import { eyeOf, isActive } from './players.js';
import { litAt } from './props.js';
import { sound } from '../engine/audio.js';
import { feed } from '../ui/hud.js';
import { runEvents } from './mission.js';
import { isClient } from '../net/net.js';
import { stinger } from './soundtrack.js';

export const DETECT_FULL = 1.2;
const cfg = () => G.mission?.stealth;

export function setupStealth() { G.stealth = cfg() ? { meter: 0, alarm: false, waveT: 0, seenBy: 0 } : null; }

/** Is camera prop c looking at player p right now? */
export function cameraSees(c, p) {
  if (c.style !== 'on') return false;
  const eye = eyeOf(p), d = eye.distanceTo(c.eye);
  const range = p.crouched && !litAt(p.pos) && !p.flashlight ? 7 : 13;
  if (d > range) return false;
  const dir = eye.clone().sub(c.eye).setY(0).normalize(), fwd = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
  return dir.dot(fwd) > Math.cos(.5) && los(c.eye, eye);
}

export function raiseAlarm(reason = 'Alarm raised!') {
  const S = G.stealth; if (!S || S.alarm) return;
  S.alarm = true; S.meter = DETECT_FULL; S.waveT = cfg().waves?.every ?? 30;
  feed('ALARM · ' + reason); sound('hurt', 1.2); stinger('alarm');
  runEvents(cfg().onAlarm);
  for (const e of G.enemies) if (!e.dead && e.def.guard) { e.hunt = true; e.memory = Math.max(e.memory, 10); }
}

export function updateStealth(dt) {
  const S = G.stealth; if (!S || isClient() || G.status !== 'playing') return;
  if (G.elapsed < G.protectUntil + 1) return;                 // a moment to get your bearings
  if (S.alarm) {
    S.waveT -= dt;
    if (S.waveT <= 0 && cfg().waves) { S.waveT = cfg().waves.every; runEvents(cfg().waves.events); }
    return;
  }
  let watching = 0;
  for (const c of Object.values(G.props)) if (c.type === 'camera') for (const p of G.players) if (isActive(p) && cameraSees(c, p)) watching++;
  const guards = G.enemies.filter(e => !e.dead && e.def.guard && e.state === 'engage' && e.visible && e.target && !e.target.isEnemy).length;
  S.seenBy = watching + guards;
  S.meter = S.seenBy ? S.meter + dt * (watching * 1 + guards * .8) : Math.max(0, S.meter - dt * .3);
  if (S.meter >= DETECT_FULL) raiseAlarm(watching ? 'Spotted on camera' : 'A guard raised the alarm');
}
