import riverbend from './riverbend.js';
import switchback from './switchback.js';
import fernhill from './fernhill.js';
import calder from './calder.js';
import portcalder from './portcalder.js';
import tunnels from './tunnels.js';
import kelso from './kelso.js';
import viaduct from './viaduct.js';
import railyard from './railyard.js';
import galeline from './galeline.js';
import ridge from './ridge.js';

export const LEVELS = Object.fromEntries([riverbend, switchback, fernhill, calder, portcalder, tunnels, kelso, viaduct, railyard, galeline, ridge].map(l => [l.id, l]));
