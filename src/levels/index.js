import riverbend from './riverbend.js';
import switchback from './switchback.js';

export const LEVELS = Object.fromEntries([riverbend, switchback].map(l => [l.id, l]));
