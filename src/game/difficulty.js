// Difficulty: Recruit, Operator (the tuned default) and Lineman. Saved in this browser; in co-op
// the host's choice applies to everyone (sent with the briefing and the start message).
import { G } from './state.js';

export const DIFFICULTIES = {
  recruit:  { label: 'Recruit',  dmg: .6,  hp: .8,   stims: 2, spread: 1.35, note: 'Machines hit softer and miss more. Two auto-stims per checkpoint.' },
  operator: { label: 'Operator', dmg: 1,   hp: 1,    stims: 1, spread: 1,    note: 'The intended balance. One auto-stim per checkpoint.' },
  lineman:  { label: 'Lineman',  dmg: 1.4, hp: 1.25, stims: 0, spread: .8,   note: 'Machines hit harder, aim better and take more punishment. No stims.' },
};
const ORDER = ['recruit', 'operator', 'lineman'];
const KEY = 'riverbend.difficulty';

function stored() { try { return localStorage.getItem(KEY); } catch { return null; } }
G.difficulty = DIFFICULTIES[stored()] ? stored() : 'operator';

export const diff = () => DIFFICULTIES[G.difficulty] ?? DIFFICULTIES.operator;
export function setDifficulty(key) {
  if (!DIFFICULTIES[key]) return;
  G.difficulty = key;
  try { localStorage.setItem(KEY, key); } catch { /* not persisted */ }
}
export const nextDifficulty = () => ORDER[(ORDER.indexOf(G.difficulty) + 1) % ORDER.length];
