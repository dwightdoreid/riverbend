import riverbend from './riverbend.js';
import switchback from './switchback.js';
import fernhill from './fernhill.js';
import calder from './calder.js';
import portcalder from './portcalder.js';
import tunnels from './tunnels.js';
import kelso from './kelso.js';
import viaduct from './viaduct.js';

export const LEVELS = Object.fromEntries([riverbend, switchback, fernhill, calder, portcalder, tunnels, kelso, viaduct].map(l => [l.id, l]));
