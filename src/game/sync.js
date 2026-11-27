// Grid synchronisation (mission 19). Missions opt in with
//   sync: { points: [prop ids], band: .2, failBelow: 48.8, onCollapse: [events] }
// Control points are captured by players standing in them (4 s) and taken back by machines
// standing in them with no player present (6 s to neutral, 6 more to lost). While a 'sync'
// objective runs, the grid frequency drifts down for every point not held and recovers when
// all are held; progress only builds inside the band around 50 Hz, and staying under
// failBelow for 3 s collapses the grid. Host only; clients get G.grid in snapshots.
import { G } from './state.js';
import { isActive } from './players.js';
import { runEvents } from './mission.js';
import { feed } from '../ui/hud.js';

export const NOMINAL = 50;
const CAPTURE_S = 4, LOSE_S = 6;

const cfg = () => G.mission?.sync;
export const syncPoints = () => (cfg()?.points ?? []).map(id => G.props[id]).filter(Boolean);
export const allHeld = () => syncPoints().every(p => p.style === 'held');

export function setupSync() { G.grid = cfg() ? { f: NOMINAL, low: 0, active: false, inBand: true, collapsed: false } : null; }

/** Capture logic for every control point (runs whenever the mission has sync points). */
export function stepPoints(dt) {
  for (const p of syncPoints()) {
    const inside = q => Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) < p.r;
    const players = G.players.filter(q => isActive(q) && inside(q)).length;
    const machines = G.enemies.filter(e => !e.dead && (e.elev ?? 0) < 1 && inside(e)).length;
    p.contested = players > 0 && machines > 0;
    const before = p.style;
    if (players && !machines) p.cap = Math.min(1, p.cap + dt / CAPTURE_S);
    else if (machines && !players) p.cap = Math.max(-1, p.cap - dt / LOSE_S);
    else continue;
    const next = p.cap >= 1 ? 'held' : p.cap <= -1 ? 'lost' : before === 'held' && p.cap < 0 ? 'neutral' : before === 'lost' && p.cap > 0 ? 'neutral' : before;
    if (next !== before) {
      p.setStyle(next);
      feed('Control point ' + (p.label ?? p.id) + (next === 'held' ? ' secured' : next === 'lost' ? ' LOST' : ' contested'));
    }
  }
}

/** Frequency dynamics for a running sync objective. Returns true while in band. */
export function stepGrid(o, dt) {
  const g = G.grid, c = cfg(); if (!g || g.collapsed) return false;
  g.active = true;
  const deficit = syncPoints().filter(p => p.style !== 'held').length;
  // Each missing point is lost generation; the governors pull back toward 50 Hz (harder with all held).
  g.f += dt * (-.05 * deficit + (deficit ? .06 : .3) * (NOMINAL - g.f));
  g.inBand = Math.abs(g.f - NOMINAL) <= (c.band ?? .2) && deficit === 0;
  g.low = g.f < (c.failBelow ?? 48.8) ? g.low + dt : 0;
  if (g.low >= 3) { g.collapsed = true; runEvents(c.onCollapse ?? [{ do: 'fail' }]); }
  return g.inBand;
}

/** A load step (an island reconnecting): frequency dips instantly. */
export function loadStep(amount) { if (G.grid) G.grid.f -= amount; }
