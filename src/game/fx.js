// Routes feedback (sounds, toasts) to whichever player it concerns. On the host, events for
// remote players are forwarded to that player's browser over the network.
import { sound } from '../engine/audio.js';
import { G } from './state.js';
import { say } from '../ui/hud.js';
import { fxTo } from '../net/net.js';

/** A sound made by player p: full volume for themselves, attenuated for everyone else. */
export function sfxFor(p, kind, level = 1) {
  if (p.local) { sound(kind, level); return; }
  fxTo(p.id, { t: 'snd', k: kind, l: level });
  if (G.local) sound(kind, level * Math.max(.05, 1 - G.local.pos.distanceTo(p.pos) / 60));
}

/** A sound at a world position, attenuated by distance to the local player. */
export function sfxAt(pos, kind, level = 1, falloff = 85, floor = .02) {
  if (!G.local) return;
  sound(kind, level * Math.max(floor, 1 - G.local.pos.distanceTo(pos) / falloff));
}

/** A toast shown only to player p. */
export function tell(p, text, time) { if (p.local) say(text, time); else fxTo(p.id, { t: 'say', text, time }); }
