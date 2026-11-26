// Loads levels and missions, runs objectives and their scripted events, and handles
// hold-to-interact for objectives and pickups.
import { THREE } from '../engine/three.js';
import { scene, applyEnvironment } from '../engine/render.js';
import { G } from './state.js';
import { clearWorld } from './world.js';
import { LEVELS } from '../levels/index.js';
import { spawnProps, spawnPickups } from './props.js';
import { spawnEnemies } from './bots.js';
import { resetPlayer, healPlayer, resupplyPlayer, needsAmmo, MAX_HEALTH } from './players.js';
import { alertNoise, clearCombat } from './combat.js';
import { sfxFor, tell } from './fx.js';
import { say, feed, updateHUD } from '../ui/hud.js';
import { finish } from './flow.js';

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
  applyEnvironment(level.environment);
  G.level = level; G.levelRoot = root;
}

/** (Re)builds everything a mission run needs: level, props, pickups, enemies, players. */
export function prepareMission(mission) {
  loadLevel(LEVELS[mission.level]);
  clearCombat();
  if (G.dynRoot) G.dynRoot.removeFromParent();
  G.dynRoot = new THREE.Group(); scene.add(G.dynRoot);
  G.mission = mission; G.objective = 0; G.elapsed = 0; G.messages.length = 0;
  spawnProps(mission.props);
  spawnPickups(mission.pickups);
  spawnEnemies(mission.enemies);
  G.players.forEach((p, i) => resetPlayer(p, mission.spawns[i % mission.spawns.length]));
  updateHUD();
}

export const currentObjective = () => G.mission?.objectives[G.objective] ?? null;
export const objectivePos = o => G.props[o.target].pos;

/** Mission script events. Add new verbs here as missions need them. */
const EVENTS = {
  say: ev => say(ev.text, ev.time ?? 3),
  feed: ev => feed(ev.text),
  noise: ev => alertNoise(G.props[ev.at].pos, ev.radius),
  investigate: ev => {
    for (const e of G.enemies) if (!e.dead) { e.state = 'investigate'; e.memory = 8; e.lastKnown.copy(G.props[ev.at].pos); }
  },
  propStyle: ev => G.props[ev.prop].setStyle(ev.style),
  win: () => finish(true),
};

export function runEvents(list = []) {
  for (const ev of list) {
    if (!EVENTS[ev.do]) { console.warn('Unknown mission event', ev); continue; }
    EVENTS[ev.do](ev);
    if (G.status !== 'playing') return;
  }
}

function completeObjective(by) {
  const obj = currentObjective();
  for (const p of G.players) { p.interactTime = 0; p.interaction = null; }
  sfxFor(by, 'objective');
  G.objective++;
  runEvents(obj.onComplete);
  if (G.status === 'playing' && G.objective >= G.mission.objectives.length) finish(true);
  updateHUD();
}

function interactionCandidate(p) {
  const obj = currentObjective();
  if (obj) {
    const pos = objectivePos(obj);
    if (Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 2.6) return { type: 'objective', obj, name: obj.action, time: obj.time };
  }
  for (const k of G.pickups) {
    if (k.used || Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z) >= 2.1) continue;
    if (k.type === 'med' && p.health >= MAX_HEALTH) continue;
    if (k.type === 'ammo' && !needsAmmo(p)) continue;
    return { type: 'pickup', obj: k, name: k.type === 'med' ? 'Use medical kit (+45 health)' : 'Resupply magazines and grenades', time: .9 };
  }
  return null;
}

export function updateInteract(p, dt) {
  const c = p.alive ? interactionCandidate(p) : null;
  if (!c) { p.interaction = null; p.interactTime = 0; return; }
  if (!p.interaction || p.interaction.obj !== c.obj) p.interactTime = 0;
  p.interaction = c;
  if (!p.input.use) { p.interactTime = Math.max(0, p.interactTime - dt * 3); return; }
  p.interactTime += dt;
  if (p.interactTime < c.time) return;
  if (c.type === 'objective') { completeObjective(p); return; }
  const k = c.obj; k.used = true; k.g.visible = false;
  if (k.type === 'med') { healPlayer(p, 45); tell(p, 'Medical kit used.'); }
  else { resupplyPlayer(p); tell(p, 'Reserve ammunition replenished.'); }
  sfxFor(p, 'objective'); p.interactTime = 0;
  if (p.local) updateHUD();
}
