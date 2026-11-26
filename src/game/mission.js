// Loads levels and missions and runs them: objectives, triggers, scripted events, checkpoints,
// and hold-to-interact for objectives and pickups. Mission files are pure data; every verb
// they can use is defined here (see EVENTS, objective types and trigger conditions).
import { THREE } from '../engine/three.js';
import { scene, applyEnvironment, ENV_PRESETS } from '../engine/render.js';
import { sound } from '../engine/audio.js';
import { G } from './state.js';
import { clearWorld } from './world.js';
import { buildNav } from './nav.js';
import { LEVELS } from '../levels/index.js';
import { spawnProps, spawnPickups } from './props.js';
import { spawnEnemies, addEnemy, snapshotEnemies, restoreEnemies } from './bots.js';
import { resetPlayer, healPlayer, resupplyPlayer, needsAmmo, isActive, MAX_HEALTH } from './players.js';
import { alertNoise, clearCombat, revive } from './combat.js';
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
  clearCombat(); clearRadio();
  if (G.dynRoot) G.dynRoot.removeFromParent();
  G.dynRoot = new THREE.Group(); scene.add(G.dynRoot);
  G.mission = mission; G.elapsed = 0; G.protectUntil = SPAWN_PROTECTION;
  G.messages.length = 0; G.scripts = []; G.fired = new Set();
  G.objective = 0; G.objState = freshObjState(); G.objStartRan = false; G.missionStartRan = false;
  spawnProps(mission.props);
  spawnPickups(mission.pickups ?? []);
  spawnEnemies(mission.enemies ?? []);
  G.players.forEach((p, i) => { resetPlayer(p, mission.spawns[i % mission.spawns.length]); p.flashlight = false; });
  if (checkpoint) applyCheckpoint(checkpoint); else G.checkpoint = null;
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

// ---------------------------------------------------------------- objectives

const freshObjState = () => ({ collected: new Set(), hold: 0 });
export const currentObjective = () => G.mission?.objectives[G.objective] ?? null;

const posOf = ref => typeof ref === 'string' ? G.props[ref].pos : new THREE.Vector3(ref[0], 1, ref[1]);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Prop ids the current objective points at (remaining ones, for collect objectives). */
export function objectiveTargets(o = currentObjective()) {
  if (!o) return [];
  if (o.type === 'collect') return o.targets.filter(t => !G.objState.collected.has(t));
  return o.target ? [o.target] : [];
}
export const objectivePositions = () => objectiveTargets().map(posOf);

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
  hold: t => currentObjective()?.type === 'hold' && G.objState.hold >= t,
  collected: n => G.objState.collected.size >= n,
  enemiesLeft: n => G.elapsed > 1 && G.enemies.filter(e => !e.dead).length <= n,
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
    objState: { collected: [...G.objState.collected], hold: G.objState.hold },
    fired: [...G.fired],
    props: Object.fromEntries(Object.values(G.props).map(p => [p.id, p.style])),
    pickups: G.pickups.map(k => k.used),
    enemies: snapshotEnemies(),
    players: G.players.map(p => ({
      pos: [p.pos.x, p.pos.z], yaw: p.yaw, health: p.health, ammo: structuredClone(p.ammo),
      grenades: p.grenades, weapon: p.weapon, lastGun: p.lastGun, flashlight: p.flashlight,
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
  G.objState = { collected: new Set(c.objState.collected), hold: c.objState.hold };
  G.fired = new Set(c.fired);
  G.elapsed = c.elapsed; G.protectUntil = c.elapsed + SPAWN_PROTECTION;
  for (const [id, style] of Object.entries(c.props)) G.props[id]?.setStyle(style);
  c.pickups.forEach((used, i) => { G.pickups[i].used = used; G.pickups[i].g.visible = !used; });
  restoreEnemies(c.enemies);
  G.players.forEach((p, i) => {
    const s = c.players[i % c.players.length];
    p.pos.set(s.pos[0], 0, s.pos[1]); p.yaw = s.yaw; p.health = Math.max(s.health, 60);
    p.ammo = structuredClone(s.ammo); p.grenades = s.grenades; p.weapon = s.weapon; p.lastGun = s.lastGun; p.flashlight = s.flashlight;
  });
}

// ---------------------------------------------------------------- interaction

function interactionCandidate(p) {
  // Reviving a downed teammate takes priority over everything else.
  for (const q of G.players) {
    if (q !== p && q.downed && flat(q.pos, p.pos) < 2.2) return { type: 'revive', obj: q, name: 'Revive ' + q.name, time: 3 };
  }
  const o = currentObjective(), kind = o?.type ?? 'interact';
  if (o && (kind === 'interact' || kind === 'collect')) {
    for (const id of objectiveTargets(o)) {
      if (flat(p.pos, posOf(id)) < (o.reach ?? 2.6)) return { type: 'objective', obj: id, name: o.action, time: o.time };
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
