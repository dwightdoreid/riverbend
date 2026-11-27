// Heat hazards (host only): steam vents scald anything standing in them while they blast, and
// heat zones (superheated passages) scald players in proportion to how many of their valves
// are still closed. Damage ticks four times a second so hurt() feedback isn't spammed.
import { G } from './state.js';
import { isActive } from './players.js';
import { hurt, damageEnemy } from './combat.js';
import { isClient } from '../net/net.js';
import { tell } from './fx.js';

const TICK = .25, VENT_DPS = 36, VENT_MACHINE_DPS = 26;
let acc = 0;

const inRect = (p, [x0, z0, x1, z1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;

export function updateHeat(dt) {
  if (isClient() || G.status !== 'playing') return;
  acc += dt; if (acc < TICK) return;
  const step = acc; acc = 0;
  for (const v of Object.values(G.props)) {
    if (v.type === 'vent' && v.phase() === 'blast') {
      for (const p of G.players) if (isActive(p) && Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z) < v.r) {
        hurt(p, VENT_DPS * step, v.pos); tell(p, 'Scalding steam! Time the vents.', 1.2);
      }
      for (const e of G.enemies) if (!e.dead && !e.type.boss && Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < v.r) damageEnemy(e, VENT_MACHINE_DPS * step, false, null, { explosive: true });
    } else if (v.type === 'heatZone') {
      const k = v.heat(); if (!k) continue;
      for (const p of G.players) if (isActive(p) && inRect(p.pos, v.rect)) {
        const def = G.mission.props.find(d => d.id === v.id);
        hurt(p, (def.dps ?? 30) * k * step, null); tell(p, def.kind === 'halon' ? 'Halon purge! Get out of the hall.' : 'Superheated air! Open the bypass valves.', 1.2);
      }
    }
  }
}
