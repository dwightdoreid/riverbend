// Loads levels and missions and runs them: objectives, triggers, scripted events, checkpoints,
// and hold-to-interact for objectives and pickups. Mission files are pure data; every verb
// they can use is defined here (see EVENTS, objective types and trigger conditions).
import { THREE } from '../engine/three.js';
import { scene, applyEnvironment, ENV_PRESETS } from '../engine/render.js';
import { sound } from '../engine/audio.js';
import { G } from './state.js';
import { clearWorld, clearMovers } from './world.js';
import { buildNav } from './nav.js';
import { LEVELS } from '../levels/index.js';
import { spawnProps, spawnPickups, repairProp } from './props.js';
import { clearTurrets, snapshotTurrets, restoreTurrets } from './turrets.js';
import { clearBossFx } from './bosses.js';
import { resetBlackout, updateBlackout } from './blackout.js';
import { setupSwitching, breakerNear, operate, isClosed, goalReached } from './switching.js';
import { spawnEnemies, addEnemy, snapshotEnemies, restoreEnemies } from './bots.js';
import { resetPlayer, healPlayer, resupplyPlayer, needsAmmo, isActive, MAX_HEALTH } from './players.js';
import { alertNoise, clearCombat, revive, clearSmokes } from './combat.js';
import { fxAll, fxTo, onCheckpoint } from '../net/net.js';
import { sfxFor, tell } from './fx.js';
import { say, feed, radio, clearRadio, updateHUD } from '../ui/hud.js';
import { finish } from './flow.js';

const SPAWN_PROTECTION = 2.5;

// ---------------------------------------------------------------- loading

/** Builds the level's static geometry and batches it into instanced meshes. */
function loadLevel(level) {
  if (G.level === level) return;
  if (G.levelRoot) {
    G.levelRoot.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    G.levelRoot.removeFromParent();
  }
  clearWorld(level.bounds);
  const w = new THREE.Group();
  level.build(w);
  w.updateMatrixWorld(true);
  const batches = new Map();
  w.traverse(o => {
    if (!o.isMesh) return;
    const k = o.geometry.uuid + '|' + o.material.uuid + '|' + Number(o.castShadow);
    if (!batches.has(k)) batches.set(k, { geo: o.geometry, mat: o.material, cast: o.castShadow, items: [] });
    batches.get(k).items.push(o.matrixWorld.clone());
  });
  const root = new THREE.Group();
  // Lights placed by the level (fixed count per level, so no shader recompiles mid-mission).
  const lights = []; w.traverse(o => { if (o.isLight) lights.push(o); });
  for (const l of lights) { root.add(l); if (l.target) root.add(l.target); }
  for (const b of batches.values()) {
    const m = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
    m.castShadow = b.cast; m.receiveShadow = true;
    b.items.forEach((t, i) => m.setMatrixAt(i, t));
    root.add(m);
  }
  scene.add(root);
  buildNav();
  G.level = level; G.levelRoot = root;
}

/** (Re)builds everything a mission run needs. With a checkpoint, resumes from it. */
export function prepareMission(mission, checkpoint = null) {
  const level = LEVELS[mission.level];
  loadLevel(level);
  G.env = { ...level.environment, ...ENV_PRESETS[mission.environment ?? 'day'], ...(mission.environmentOverrides ?? {}) };
  applyEnvironment(G.env);
  clearCombat(); clearRadio(); clearTurrets(); clearBossFx(); resetBlackout(); clearSmokes();
  if (G.dynRoot) G.dynRoot.removeFromParent();
  G.dynRoot = new THREE.Group(); scene.add(G.dynRoot);
  clearMovers();
  G.mission = mission; G.elapsed = 0; G.protectUntil = SPAWN_PROTECTION;
  G.messages.length = 0; G.scripts = []; G.fired = new Set();
  G.objective = 0; G.objState = freshObjState(); G.objStartRan = false; G.missionStartRan = false;
  spawnProps(mission.props);
  setupEscort(mission.escort);
  setupSwitching();
  spawnPickups(mission.pickups ?? []);
  spawnEnemies(mission.enemies ?? []);
  G.players.forEach((p, i) => { resetPlayer(p, mission.spawns[i % mission.spawns.length], mission.loadout); p.flashlight = false; p.turrets = mission.turrets ?? 0; p.smokes = mission.smokes ?? 0; });
  if (checkpoint) applyCheckpoint(checkpoint); else G.checkpoint = null;
  updateBlackout();
  updateHUD();
}

/** Called when play actually begins (after the briefing or a checkpoint retry). */
export function beginPlay(fresh) {
  if (fresh && !G.missionStartRan) {
    G.missionStartRan = true;
    const intro = G.mission.intro;
    if (intro) say(intro.text, intro.time);
    runEvents(G.mission.onStart);
  }
  startObjectiveEvents();
}

// ---------------------------------------------------------------- escort
//
// Mission-level `escort: { prop, path: [[x, z]...], speed, radius, contactRadius, hp, onDestroyed }`.
// Escort objectives ({ type: 'escort', until: waypointIndex }) drive the vehicle along the path
// while a player stays within `radius`, pausing when machines are within `contactRadius`.

function setupEscort(cfg) {
  G.escort = null;
  if (!cfg) return;
  const pts = cfg.path.map(([x, z]) => new THREE.Vector2(x, z)), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  G.escort = { cfg, pts, cum, s: 0, hp: cfg.hp ?? 1500, maxHp: cfg.hp ?? 1500, status: 'waiting' };
  const prop = G.props[cfg.prop];
  prop.mover.onHit = (dmg, hostile) => { if (hostile) damageEscort(dmg); };
  poseEscort();
}

function pointAt(s) {
  const E = G.escort, { pts, cum } = E;
  s = THREE.MathUtils.clamp(s, 0, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  return pts[i - 1].clone().lerp(pts[i], t);
}

/** Places the escort prop at the current path distance (also used by co-op clients). */
export function poseEscort() {
  const E = G.escort; if (!E) return;
  const p = pointAt(E.s), a = pointAt(E.s - 2.5), b = pointAt(E.s + 2.5);
  const yaw = Math.atan2(-(b.x - a.x), -(b.y - a.y));
  G.props[E.cfg.prop].setPose(p.x, p.y, yaw);
}

function damageEscort(dmg) {
  const E = G.escort;
  if (!E || E.hp <= 0 || G.status !== 'playing') return;
  E.hp = Math.max(0, E.hp - dmg);
  if (E.hp === 0) {
    feed('The truck is destroyed');
    runEvents(E.cfg.onDestroyed ?? [{ do: 'fail' }]);
  } else if (E.hp < E.maxHp * .3 && !E.warned) {
    E.warned = true;
    radio('Mara · Ops', 'The truck can\'t take much more. Get those machines off it!');
  }
}

function updateEscort(dt, o) {
  const E = G.escort, prop = G.props[E.cfg.prop], target = E.cum[Math.min(o.until, E.cum.length - 1)];
  const near = G.players.filter(isActive).filter(p => flat(p.pos, prop.pos) < (E.cfg.radius ?? 10));
  const contact = G.enemies.some(e => !e.dead && flat(e.pos, prop.pos) < (E.cfg.contactRadius ?? 9));
  const ahead = pointAt(E.s + (E.cfg.blockAhead ?? 4.2)), blocked = G.players.some(p => isActive(p) && Math.hypot(p.pos.x - ahead.x, p.pos.z - ahead.y) < 1.9);
  E.status = !near.length ? 'waiting' : contact ? 'contact' : blocked ? 'blocked' : 'moving';
  if (E.status === 'moving') { E.s = Math.min(target, E.s + (E.cfg.speed ?? 2.4) * dt); poseEscort(); }
  if (E.s >= target - .01) completeObjective(near[0] ?? G.local);
}

const ESCORT_STATUS = { waiting: 'stopped · stay close', contact: 'stopped · machines nearby', blocked: 'stopped · move out of the way', moving: 'moving' };

// ---------------------------------------------------------------- objectives

const freshObjState = () => ({ collected: new Set(), hold: 0, t: 0 });
export const currentObjective = () => G.mission?.objectives[G.objective] ?? null;

const posOf = ref => typeof ref === 'string' ? G.props[ref].pos : new THREE.Vector3(ref[0], 1, ref[1]);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Prop ids the current objective points at (remaining ones, for collect objectives). */
export function objectiveTargets(o = currentObjective()) {
  if (!o) return [];
  if (o.type === 'collect') return o.targets.filter(t => !G.objState.collected.has(t));
  return o.target ? [o.target] : [];
}
export function objectivePositions() {
  const o = currentObjective();
  if (o?.type === 'kill') return G.enemies.filter(e => !e.dead && e.def.tag === o.tag).map(e => e.pos.clone().setY(e.type.centerY));
  return objectiveTargets().map(posOf);
}

/** The objective position nearest to player p (for the HUD marker). */
export function objectivePosFor(p) {
  let best = null, bestD = Infinity;
  for (const pos of objectivePositions()) { const d = flat(pos, p.pos); if (d < bestD) { best = pos; bestD = d; } }
  return best;
}

export function objectiveText() {
  const o = currentObjective(); if (!o) return null;
  let name = o.name, sub = o.sub ?? '';
  if (o.type === 'collect') name += ` (${G.objState.collected.size}/${o.targets.length})`;
  if (o.type === 'hold') sub += ` · ${Math.floor(Math.min(1, G.objState.hold / o.time) * 100)}%`;
  if (o.type === 'survive') {
    const left = Math.max(0, Math.ceil(o.time - G.objState.hold));
    sub = (o.sub ? o.sub + ' · ' : '') + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ' left';
  }
  if (o.type === 'switching') sub = Object.keys(G.mission.switching.breakers).map(id => id + (isClosed(id) ? ' ●' : ' ○')).join('   ') + (o.sub ? ' · ' + o.sub : '');
  if (o.timeLimit) {
    const left = Math.max(0, Math.ceil(o.timeLimit - G.objState.t));
    sub = '⏱ ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + (sub ? ' · ' + sub : '');
  }
  if (o.guard) sub += ' · ' + o.guard.map(id => {
    const p = G.props[id];
    return (p.label ?? id) + ' ' + (p.style === 'wrecked' ? 'LOST' : Math.ceil(p.hp / p.maxHp * 100) + '%');
  }).join(' · ');
  if (o.type === 'escort' && G.escort) {
    const E = G.escort;
    sub = 'Truck ' + ESCORT_STATUS[E.status] + ' · armour ' + Math.ceil(E.hp / E.maxHp * 100) + '%';
  }
  return { name, sub };
}

function startObjectiveEvents() {
  if (G.objStartRan) return;
  G.objStartRan = true;
  runEvents(currentObjective()?.onStart);
}

function completeObjective(by) {
  const obj = currentObjective();
  for (const p of G.players) { p.interactTime = 0; p.interaction = null; }
  sfxFor(by, 'objective');
  G.objective++; G.objState = freshObjState(); G.objStartRan = false;
  runEvents(obj.onComplete);
  if (G.status !== 'playing') return;
  if (G.objective >= G.mission.objectives.length) { finish(true); return; }
  startObjectiveEvents();
  updateHUD();
}

function collectTarget(p, id) {
  const o = currentObjective();
  G.objState.collected.add(id);
  G.props[id].setStyle(o.collectStyle ?? 'gone');
  sfxFor(p, 'objective');
  const n = G.objState.collected.size, total = o.targets.length;
  const fill = ev => Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, typeof v === 'string' ? v.replaceAll('{n}', n).replaceAll('{total}', total) : v]));
  runEvents([...(o.onEach ?? []), ...(o.onTarget?.[id] ?? [])].map(fill));
  if (G.status === 'playing' && n >= total) completeObjective(p);
  else updateHUD();
}

/** Per-step progress for objectives that aren't hold-to-interact. */
export function updateObjective(dt) {
  const o = currentObjective(); if (!o) return;
  // Optional time limit on any objective (e.g. escape before the tunnels seal).
  if (o.timeLimit) {
    G.objState.t += dt;
    if (G.objState.t >= o.timeLimit && !G.objState.timedOut) { G.objState.timedOut = true; runEvents(o.onTimeout ?? [{ do: 'fail' }]); if (G.status !== 'playing') return; }
  }
  const alive = G.players.filter(isActive);
  if (o.type === 'reach') {
    const p = alive.find(q => flat(q.pos, posOf(o.target)) < (o.radius ?? 3));
    if (p) completeObjective(p);
  } else if (o.type === 'hold') {
    const inside = alive.filter(q => flat(q.pos, posOf(o.target)) < (o.radius ?? 6));
    if (inside.length) {
      G.objState.hold += dt;
      if (G.objState.hold >= o.time) completeObjective(inside[0]);
    }
  } else if (o.type === 'switching') {
    if (goalReached()) completeObjective(alive[0] ?? G.local);
  } else if (o.type === 'survive') {
    G.objState.hold += dt;
    if (G.objState.hold >= o.time) completeObjective(alive[0] ?? G.local);
  } else if (o.type === 'escort') {
    updateEscort(dt, o);
  } else if (o.type === 'kill') {
    const tagged = G.enemies.filter(e => e.def.tag === o.tag);
    if (tagged.length && tagged.every(e => e.dead)) completeObjective(alive[0] ?? G.local);
  } else if (o.type === 'eliminate') {
    if (G.elapsed > 1 && !G.enemies.some(e => !e.dead)) completeObjective(G.local);
  }
}

// ---------------------------------------------------------------- events & triggers

/** Mission script verbs. Missions use these as { do: 'verb', ...args }. */
const EVENTS = {
  say: ev => { say(ev.text, ev.time ?? 3); fxAll({ t: 'say', text: ev.text, time: ev.time ?? 3 }); },
  feed: ev => feed(ev.text),
  radio: ev => radio(ev.who, ev.text, ev.time),
  noise: ev => alertNoise(posOf(ev.at), ev.radius),
  investigate: ev => {
    for (const e of G.enemies) if (!e.dead) { e.state = 'investigate'; e.memory = ev.memory ?? 8; e.lastKnown.copy(posOf(ev.at)); }
  },
  propStyle: ev => G.props[ev.prop].setStyle(ev.style),
  spawn: ev => {
    const alertAt = ev.alert ? posOf(ev.alert) : null;
    // Co-op: +50% wave size per extra player (copies offset slightly so they don't stack).
    const extra = Math.floor(ev.enemies.length * (G.players.length - 1) * .5);
    const defs = [...ev.enemies, ...Array.from({ length: extra }, (_, i) => {
      const d = ev.enemies[i % ev.enemies.length];
      return { ...d, at: [d.at[0] + 1.5 + i * .5, d.at[1] + 1] };
    })];
    for (const def of defs) addEnemy(def, alertAt);
    if (ev.feed) feed(ev.feed);
  },
  checkpoint: ev => takeCheckpoint(ev.name),
  giveTurrets: ev => { for (const p of G.players) p.turrets = (p.turrets ?? 0) + (ev.count ?? 1); feed('+' + (ev.count ?? 1) + ' turret' + ((ev.count ?? 1) > 1 ? 's' : '') + ' each'); updateHUD(); },
  win: () => finish(true),
  fail: () => finish(false),
};

/** Runs an event list. { do: 'wait', time } pauses that list; others keep running. */
export function runEvents(list) {
  if (!list?.length) return;
  const script = { list, i: 0, wait: 0 };
  if (!advance(script)) G.scripts.push(script);
}
function advance(script) {
  while (script.i < script.list.length) {
    const ev = script.list[script.i++];
    if (ev.do === 'wait') { script.wait = ev.time; return false; }
    if (!EVENTS[ev.do]) { console.warn('Unknown mission event', ev); continue; }
    EVENTS[ev.do](ev);
    if (G.status !== 'playing') return true;
  }
  return true;
}
export function updateScripts(dt) {
  for (let i = G.scripts.length - 1; i >= 0; i--) {
    const s = G.scripts[i]; s.wait -= dt;
    if (s.wait <= 0) { G.scripts.splice(i, 1); if (!advance(s)) G.scripts.push(s); }
    if (G.status !== 'playing') return;
  }
}

/** Trigger conditions. A trigger may also have `objective: n` to only arm during objective n. */
const CONDITIONS = {
  time: t => G.elapsed >= t,
  enter: ([x, z, r]) => G.players.some(p => isActive(p) && Math.hypot(p.pos.x - x, p.pos.z - z) < r),
  near: ([prop, r]) => G.players.some(p => isActive(p) && flat(p.pos, posOf(prop)) < r),
  hold: t => ['hold', 'survive'].includes(currentObjective()?.type) && G.objState.hold >= t,
  destroyed: ([ids, n]) => ids.filter(id => G.props[id]?.style === 'wrecked').length >= n,
  breaker: ([id, closed]) => !!G.mission.switching && isClosed(id) === closed,
  enemyHp: ([tag, frac]) => G.enemies.some(e => e.def.tag === tag && (e.dead || e.hp <= e.maxHp * frac)),
  collected: n => G.objState.collected.size >= n,
  enemiesLeft: n => G.elapsed > 1 && G.enemies.filter(e => !e.dead).length <= n,
  escort: i => !!G.escort && G.escort.s >= G.escort.cum[Math.min(i, G.escort.cum.length - 1)] - .01,
};
export function checkTriggers() {
  for (const t of G.mission.triggers ?? []) {
    if (G.fired.has(t.id)) continue;
    if (t.objective !== undefined && t.objective !== G.objective) continue;
    const [cond, arg] = Object.entries(t.when)[0];
    if (!CONDITIONS[cond]?.(arg)) continue;
    G.fired.add(t.id);
    runEvents(t.do);
    if (G.status !== 'playing') return;
  }
}

// ---------------------------------------------------------------- checkpoints

function takeCheckpoint(name = 'Checkpoint') {
  G.checkpoint = {
    name, objective: G.objective, startRan: G.objStartRan, elapsed: G.elapsed,
    objState: { collected: [...G.objState.collected], hold: G.objState.hold, t: G.objState.t },
    fired: [...G.fired],
    props: Object.fromEntries(Object.values(G.props).map(p => [p.id, p.style])),
    pickups: G.pickups.map(k => k.used),
    escort: G.escort ? { s: G.escort.s, hp: G.escort.hp } : null,
    propHp: Object.fromEntries(Object.values(G.props).filter(p => p.maxHp).map(p => [p.id, p.hp])),
    turrets: snapshotTurrets(),
    enemies: snapshotEnemies(),
    players: G.players.map(p => ({
      pos: [p.pos.x, p.pos.z], yaw: p.yaw, health: p.health, ammo: structuredClone(p.ammo),
      grenades: p.grenades, weapon: p.weapon, lastGun: p.lastGun, flashlight: p.flashlight, turrets: p.turrets, smokes: p.smokes,
    })),
  };
  for (const p of G.players) p.stims = 1;
  feed('Checkpoint · ' + name);
  sound('objective', .5);
  onCheckpoint();   // co-op: players waiting to drop in join now
}

function applyCheckpoint(c) {
  G.checkpoint = c;
  G.objective = c.objective; G.objStartRan = c.startRan; G.missionStartRan = true;
  G.objState = { collected: new Set(c.objState.collected), hold: c.objState.hold, t: c.objState.t ?? 0 };
  G.fired = new Set(c.fired);
  G.elapsed = c.elapsed; G.protectUntil = c.elapsed + SPAWN_PROTECTION;
  for (const [id, style] of Object.entries(c.props)) G.props[id]?.setStyle(style);
  c.pickups.forEach((used, i) => { G.pickups[i].used = used; G.pickups[i].g.visible = !used; });
  restoreEnemies(c.enemies);
  for (const [id, hp] of Object.entries(c.propHp ?? {})) if (G.props[id]) G.props[id].hp = G.props[id].style === 'wrecked' ? 0 : Math.max(hp, G.props[id].maxHp * .4);
  if (G.escort && c.escort) { G.escort.s = c.escort.s; G.escort.hp = Math.max(c.escort.hp, G.escort.maxHp * .5); poseEscort(); }
  G.players.forEach((p, i) => {
    const s = c.players[i % c.players.length];
    p.pos.set(s.pos[0], 0, s.pos[1]); p.yaw = s.yaw; p.health = Math.max(s.health, 60);
    p.ammo = structuredClone(s.ammo); p.grenades = s.grenades; p.weapon = s.weapon; p.lastGun = s.lastGun; p.flashlight = s.flashlight;
    p.turrets = Math.max(s.turrets ?? 0, 1) * (G.mission.turrets ? 1 : 0);
    p.smokes = Math.max(s.smokes ?? 0, G.mission.smokes ? 1 : 0);
  });
  restoreTurrets(c.turrets ?? []);
}

// ---------------------------------------------------------------- interaction

function interactionCandidate(p) {
  // Reviving a downed teammate takes priority over everything else.
  for (const q of G.players) {
    if (q !== p && q.downed && flat(q.pos, p.pos) < 2.2) return { type: 'revive', obj: q, name: 'Revive ' + q.name, time: 3 };
  }
  const o = currentObjective(), kind = o?.type ?? 'interact';
  if (kind === 'switching') {
    const id = breakerNear(p, o.reach ?? 2.6);
    if (id) return { type: 'breaker', obj: id, name: (isClosed(id) ? 'Open' : 'Close') + ' breaker ' + id, time: o.time ?? 1.4 };
  }
  if (o && (kind === 'interact' || kind === 'collect')) {
    for (const id of objectiveTargets(o)) {
      if (flat(p.pos, posOf(id)) < (o.reach ?? 2.6)) return { type: 'objective', obj: id, name: o.action, time: o.time };
    }
  }
  for (const q of Object.values(G.props)) {
    if (q.repairable && q.style !== 'wrecked' && q.hp < q.maxHp && flat(q.pos, p.pos) < 4) {
      return { type: 'repair', obj: q, name: 'Repair ' + (q.label ?? 'equipment') + ' (' + Math.ceil(q.hp / q.maxHp * 100) + '%)', time: 2.6 };
    }
  }
  for (const k of G.pickups) {
    if (k.used || flat(k.pos, p.pos) >= 2.1) continue;
    if (k.type === 'med' && p.health >= MAX_HEALTH) continue;
    if (k.type === 'ammo' && !(p.local ? needsAmmo(p) : p.netNeedAmmo)) continue;
    return { type: 'pickup', obj: k, name: k.type === 'med' ? 'Use medical kit (+45 health)' : 'Resupply magazines and grenades', time: .9 };
  }
  return null;
}

export function updateInteract(p, dt) {
  const c = isActive(p) ? interactionCandidate(p) : null;
  if (!c) { p.interaction = null; p.interactTime = 0; return; }
  if (!p.interaction || p.interaction.obj !== c.obj) p.interactTime = 0;
  p.interaction = c;
  if (!p.input.use) { p.interactTime = Math.max(0, p.interactTime - dt * 3); return; }
  p.interactTime += dt;
  if (p.interactTime < c.time) return;
  p.interactTime = 0;
  if (c.type === 'revive') { if (c.obj.downed) revive(c.obj, p); return; }
  if (c.type === 'breaker') { operate(c.obj, p); updateHUD(); return; }
  if (c.type === 'repair') { repairProp(c.obj); sfxFor(p, 'objective'); feed((p.local ? 'You' : p.name) + ' patched ' + (c.obj.label ?? 'equipment')); return; }
  if (c.type === 'objective') {
    if (currentObjective().type === 'collect') collectTarget(p, c.obj); else completeObjective(p);
    return;
  }
  const k = c.obj; k.used = true; k.g.visible = false;
  if (k.type === 'med') { healPlayer(p, 45); tell(p, 'Medical kit used.'); }
  else { if (p.local) resupplyPlayer(p); else fxTo(p.id, { t: 'resupply' }); tell(p, 'Reserve ammunition replenished.'); }
  sfxFor(p, 'objective');
  if (p.local) updateHUD();
}

/** Is player p standing in the current hold zone? (for the HUD) */
export function inHoldZone(p) {
  const o = currentObjective();
  return o?.type === 'hold' && isActive(p) && flat(p.pos, posOf(o.target)) < (o.radius ?? 6);
}
