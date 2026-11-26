// Routes feedback (sounds, toasts) to whichever player it concerns. On the host, events for
// remote players will later be forwarded over the network; for now they are simply skipped.
import { sound } from '../engine/audio.js';
import { G } from './state.js';
import { say } from '../ui/hud.js';

/** A sound made by player p: full volume for themselves, attenuated for everyone else. */
export function sfxFor(p, kind, level = 1) {
  if (p.local) sound(kind, level);
  else if (G.local) sound(kind, level * Math.max(.05, 1 - G.local.pos.distanceTo(p.pos) / 60));
}

/** A sound at a world position, attenuated by distance to the local player. */
export function sfxAt(pos, kind, level = 1, falloff = 85, floor = .02) {
  if (!G.local) return;
  sound(kind, level * Math.max(floor, 1 - G.local.pos.distanceTo(pos) / falloff));
}

/** A toast shown only to player p. */
export function tell(p, text, time) { if (p.local) say(text, time); }
