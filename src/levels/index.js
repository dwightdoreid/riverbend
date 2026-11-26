import riverbend from './riverbend.js';
import switchback from './switchback.js';
import fernhill from './fernhill.js';

export const LEVELS = Object.fromEntries([riverbend, switchback, fernhill].map(l => [l.id, l]));
