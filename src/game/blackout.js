// Rolling blackouts. A level can define districts (rectangles) and how to switch their lights;
// a mission can schedule them: blackout: { period, litFraction, offsets: { districtId: seconds } }.
// A lit district exposes players at full sight range; a dark one uses the night sight scale.
// State is derived from mission time, so co-op clients stay in step with no extra network data.
import { G } from './state.js';

const state = {};   // districtId -> { lit, left }

const districts = () => G.level?.districts ?? [];

export function districtAt(pos) {
  return districts().find(d => pos.x >= d.rect[0] && pos.x < d.rect[2] && pos.z >= d.rect[1] && pos.z < d.rect[3]) ?? null;
}

export function districtState(d) { return d ? state[d.id] : null; }

/** Is this position inside a district whose power is currently on? */
export function districtLit(pos) {
  const d = districtAt(pos);
  return !!(d && state[d.id]?.lit);
}

export function updateBlackout() {
  if (!districts().length) return;
  const cfg = G.mission?.blackout;
  for (const d of districts()) {
    let lit = true, left = 0;
    if (cfg) {
      const phase = ((G.elapsed + (cfg.offsets?.[d.id] ?? 0)) % cfg.period + cfg.period) % cfg.period, on = cfg.period * (cfg.litFraction ?? .5);
      lit = phase < on; left = lit ? on - phase : cfg.period - phase;
    }
    const s = state[d.id] ??= { lit: null, left: 0 };
    s.left = left;
    if (s.lit !== lit) { s.lit = lit; G.level.setDistrictLit(d.id, lit); }
  }
}

/** Reset so the next update re-applies every district's lights (new mission / level). */
export function resetBlackout() { for (const k in state) delete state[k]; }
