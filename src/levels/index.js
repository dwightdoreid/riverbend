import riverbend from './riverbend.js';
import switchback from './switchback.js';
import fernhill from './fernhill.js';
import calder from './calder.js';
import portcalder from './portcalder.js';
import tunnels from './tunnels.js';
import kelso from './kelso.js';
import viaduct from './viaduct.js';
import railyard, { snowYard } from './railyard.js';
import galeline from './galeline.js';
import ridge from './ridge.js';
import office from './office.js';
import peaker from './peaker.js';
import caverns from './caverns.js';

export const LEVELS = Object.fromEntries([riverbend, switchback, fernhill, calder, portcalder, tunnels, kelso, viaduct, railyard, snowYard, galeline, ridge, office, peaker, caverns].map(l => [l.id, l]));
