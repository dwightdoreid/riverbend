// Campaign progress saved in this browser: which missions are unlocked and best times.
// Storage can be unavailable (private windows, blocked site data), so every access is guarded
// and the game works without it.
const KEY = 'riverbend.progress.v1';

function load() {
  try { return { unlocked: 1, best: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return { unlocked: 1, best: {} }; }
}
let progress = load();

function save() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* not persisted */ } }

export const unlockedCount = () => progress.unlocked;
export const bestTime = id => progress.best[id]?.time ?? null;

export function recordWin(index, missionId, time) {
  progress.unlocked = Math.max(progress.unlocked, index + 2);
  const prev = progress.best[missionId]?.time;
  if (prev === undefined || time < prev) progress.best[missionId] = { time };
  save();
}

/** For testing and for a future "unlock all" option. */
export function unlockAll(n) { progress.unlocked = Math.max(progress.unlocked, n); save(); }
