// Mission medals, awarded on a win and kept in campaign progress:
//   Swift      finish under the mission's par time
//   Marksman   hit accuracy of 50% or better (at least 20 shots fired)
//   Untouched  take less than 100 damage over the mission
//   Hardened   complete it on Lineman difficulty
// Par times are estimates for a first-time-careful player; balancing (phase 4e) tunes them.
import { G } from './state.js';

export const MEDALS = [
  { id: 'swift', label: 'Swift', hint: p => 'Under ' + Math.floor(p / 60) + ':' + String(p % 60).padStart(2, '0') },
  { id: 'marksman', label: 'Marksman', hint: () => '50%+ accuracy' },
  { id: 'untouched', label: 'Untouched', hint: () => 'Under 100 damage taken' },
  { id: 'hardened', label: 'Hardened', hint: () => 'Win on Lineman' },
];
export const PAR = {
  m01: 300, m02: 420, m03: 480, m04: 480, m05: 540, m06: 480, m07: 420, m08: 480, m09: 540, m10: 600,
  m11: 480, m12: 540, m13: 480, m14: 480, m15: 420, m16: 540, m17: 480, m18: 240, m19: 420, m20: 480,
};
export const parFor = m => m.par ?? PAR[m.id] ?? 480;

/** Medals earned by player p for the mission just won. */
export function earnedMedals(p = G.local) {
  const s = p.stats, out = [];
  if (G.elapsed <= parFor(G.mission)) out.push('swift');
  if (s.shots >= 20 && s.hits / s.shots >= .5) out.push('marksman');
  if (s.damage < 100) out.push('untouched');
  if (G.difficulty === 'lineman') out.push('hardened');
  return out;
}
