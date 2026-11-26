// Switching-station puzzle. A mission defines breakers (each on a panel prop) that feed live
// zones, interlocks that make some operations unsafe, and a goal state:
//
//   switching: {
//     breakers: { A: { panel: 'panelA', feeds: 'west' }, ... },
//     zones: { west: { rect: [x0, z0, x1, z1] }, ... },
//     interlocks: [{ close: 'B', whileClosed: 'A' }],   // closing B while A is closed = fault
//     goal: { B: true, D: true, A: false },              // breaker states that complete it
//     dps: 30,                                          // damage per second inside a live zone
//   }
//
// Breaker state lives in the panel props' styles ('on' = closed), so checkpoints and co-op sync
// already carry it. Live zones hurt players and machines alike.
import { THREE } from '../engine/three.js';
import { G } from './state.js';
import { hurt, damageEnemy, explosionFx, burst } from './combat.js';
import { isActive } from './players.js';
import { sfxAt } from './fx.js';
import { feed, radio } from '../ui/hud.js';
import { fxAll, isClient } from '../net/net.js';

const cfg = () => G.mission?.switching;
export const isClosed = id => G.props[cfg().breakers[id].panel]?.style === 'on';
const inRect = (pos, [x0, z0, x1, z1]) => pos.x >= x0 && pos.x < x1 && pos.z >= z0 && pos.z < z1;

/** Zones currently energized (fed by a closed breaker). */
export function liveZones() {
  const c = cfg(); if (!c) return [];
  return Object.entries(c.breakers).filter(([id]) => isClosed(id)).map(([, b]) => b.feeds);
}
export function liveAt(pos) {
  const c = cfg(); if (!c) return false;
  return liveZones().some(z => inRect(pos, c.zones[z].rect));
}

export const goalReached = () => Object.entries(cfg().goal).every(([id, want]) => isClosed(id) === want);

/** The breaker whose panel is next to player p, for the hold-E prompt. */
export function breakerNear(p, reach = 2.6) {
  const c = cfg(); if (!c) return null;
  for (const [id, b] of Object.entries(c.breakers)) {
    const panel = G.props[b.panel];
    if (panel && Math.hypot(panel.pos.x - p.pos.x, panel.pos.z - p.pos.z) < reach) return id;
  }
  return null;
}

/** Operate a breaker. Unsafe closes (interlocks) cause an arc flash and trip the breaker. */
export function operate(id, by) {
  const c = cfg(), panel = G.props[c.breakers[id].panel], closing = !isClosed(id);
  const bad = closing && c.interlocks?.find(l => l.close === id && isClosed(l.whileClosed));
  if (bad) {
    const at = panel.pos.clone();
    explosionFx(at); fxAll({ t: 'boom', p: [at.x, at.y, at.z] });
    burst(at.clone().setY(2), 0x9fd6ff, 40, 7);
    for (const p of G.players) if (isActive(p) && p.pos.distanceTo(at) < 5) hurt(p, 35, at);
    feed('FAULT · breaker ' + id + ' closed onto live section ' + bad.whileClosed);
    radio('Juno · Halvard dispatch', bad.hint ?? ('Arc flash! ' + bad.whileClosed + ' was still closed. Open it before closing ' + id + '.'));
    panel.setStyle('off');
    return false;
  }
  panel.setStyle(closing ? 'on' : 'off');
  feed('Breaker ' + id + (closing ? ' closed' : ' opened'));
  sfxAt(panel.pos, 'reload', 1.2, 40);
  G.switchOps = (G.switchOps ?? 0) + 1;
  return true;
}

// ---------------------------------------------------------------- live-zone visuals and damage

let visuals = null;
export function setupSwitching() {
  visuals = null;
  const c = cfg(); if (!c) return;
  visuals = {};
  for (const [name, z] of Object.entries(c.zones)) {
    const [x0, z0, x1, z1] = z.rect, w = x1 - x0, d = z1 - z0;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6fc4ff, emissive: 0x3f9cff, emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, .04, d), mat); floor.position.set((x0 + x1) / 2, .12, (z0 + z1) / 2); G.dynRoot.add(floor);
    const arcs = [];
    for (let i = 0; i < Math.max(3, Math.round(w * d / 60)); i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(.06, 1, .06), new THREE.MeshBasicMaterial({ color: 0xd8f0ff }));
      a.visible = false; G.dynRoot.add(a); arcs.push(a);
    }
    visuals[name] = { floor, mat, arcs, rect: z.rect };
  }
}

export function updateSwitching(dt) {
  const c = cfg(); if (!c || !visuals) return;
  const live = new Set(liveZones());
  for (const [name, v] of Object.entries(visuals)) {
    const on = live.has(name), [x0, z0, x1, z1] = v.rect;
    v.mat.opacity = on ? .42 + Math.random() * .12 : 0; v.mat.emissiveIntensity = on ? 2.6 : 0;
    for (const a of v.arcs) {
      a.visible = on && Math.random() < .35;
      if (a.visible) { const h = 2 + Math.random() * 5; a.position.set(x0 + Math.random() * (x1 - x0), h / 2, z0 + Math.random() * (z1 - z0)); a.scale.y = h; a.rotation.z = (Math.random() - .5) * .5; }
    }
  }
  if (isClient()) return;
  // Damage ticks (host): players and machines standing in live zones.
  G.zoneTick = (G.zoneTick ?? 0) - dt;
  if (G.zoneTick > 0) return;
  G.zoneTick = .25;
  const dps = c.dps ?? 30;
  for (const p of G.players) if (isActive(p) && liveAt(p.pos)) { hurt(p, dps * .25, p.pos.clone().add(new THREE.Vector3(0, -1, 0))); sfxAt(p.pos, 'hit', .5, 20); }
  for (const e of G.enemies) if (!e.dead && liveAt(e.pos)) damageEnemy(e, dps * 1.5 * .25, false, null, { explosive: true });
}
