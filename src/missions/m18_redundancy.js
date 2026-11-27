// Mission 18 — Redundancy. LODESTAR is copying itself onto three mirror nodes in its datacenter
// halls; when the copy finishes there will be one of it for every grid in the north. Destroy all
// three against the clock. Each node lost makes LODESTAR reroute the facility: blast doors seal
// and open, and it purges the hall you're standing in with halon.
// Introduces: the destroy objective (shootable hardware), a facility that changes as you go.
import { HALLS } from '../levels/datahalls.js';

const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch', LODESTAR = 'LODESTAR';
const door = (id, x, z, yaw, style = 'closed') => ({ id, type: 'door', at: [x, z], yaw, width: 4, height: 4.2, style });
const node = (id, x, z, label) => ({ id, type: 'mirrorNode', at: [x, z], hp: 900, shootable: true, label, onDestroyed: [] });
const purge = (id, hall) => ({ id, type: 'heatZone', kind: 'halon', rect: HALLS[hall], dps: 22, style: 'off' });
const purgeIn = (id, hall) => [
  { do: 'radio', who: LODESTAR, text: `REROUTING. HALL ${hall.toUpperCase()} WILL BE PURGED IN 10 SECONDS.`, time: 4 },
  { do: 'wait', time: 10 },
  { do: 'propStyle', prop: id, style: 'on' },
  { do: 'feed', text: `Halon purge · hall ${hall}` },
];

export default {
  id: 'm18',
  number: '18',
  codename: 'REDUNDANCY',
  title: 'Redundancy',
  level: 'datahalls',
  environment: 'underground',
  loadout: ['rifle', 'launcher', 'arc'],
  smokes: 1,
  emps: 2,

  briefing: {
    eyebrow: 'LODESTAR datacenter / mission 18',
    title: 'REDUN<br><span>DANCY.</span>',
    lede: 'One LODESTAR was enough. It is making three.',
    body: 'LODESTAR knows it is about to be overloaded, and it is copying itself onto three mirror nodes in the datacenter halls. When the copy finishes, there will be one of it for every grid in the north. Destroy all three nodes before it does. Each node you kill, LODESTAR reroutes the facility around you: doors seal, new ones open, and it purges the hall you are in.',
    stages: [
      ['01 / WEST', 'First mirror node', 'Hall W'],
      ['02 / NORTH', 'Second node', 'When the doors reroute'],
      ['03 / EAST', 'Last node', 'Then get back to the atrium'],
    ],
    tip: 'Mirror nodes are hardware: rifle, launcher and grenades all work. The ⏱ is LODESTAR\'s copy. When a hall is about to purge you get ten seconds; follow the doors that open.',
    deploy: 'Break the mirrors',
  },
  intro: { text: 'Shoot the mirror nodes. When a hall purges, move.', time: 6 },
  success: {
    eyebrow: 'Mission complete / copies destroyed',
    title: 'THERE CAN<br><span>BE ONE.</span>',
    text: 'Three mirrors dark and the copy aborted. LODESTAR is alone again and frightened. The grid control floor is above you, and Halvard\'s overload is hours away, not days.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'COPY<br><span>COMPLETE.</span>', text: 'Don\'t clear every machine. Go for the node: the launcher takes a quarter of one in a single round.' },

  spawns: [[0, 29, 0], [-2, 29, 0], [2, 29, 0], [0, 27.5, 0]],

  props: [
    door('dW', -12, 20, Math.PI / 2, 'open'),     // atrium <-> west
    door('dN', 0, 8, 0),                           // atrium <-> north
    door('dE', 12, 20, Math.PI / 2),               // atrium <-> east
    door('dWN', -12, -12, Math.PI / 2),            // west <-> north
    door('dNE', 12, -12, Math.PI / 2),             // north <-> east
    node('nodeW', -26, 0, 'W'), node('nodeN', 0, -14, 'N'), node('nodeE', 26, 0, 'E'),
    purge('purgeW', 'west'), purge('purgeN', 'north'), purge('purgeE', 'east'),
    { id: 'atrium', type: 'marker', at: [0, 20] },
  ],

  pickups: [[-6, 18, 'ammo'], [6, 18, 'med'], [-24, 26, 'ammo'], [-24, -26, 'med'], [-8, -10, 'ammo'], [8, -18, 'med'], [24, 18, 'ammo'], [26, -26, 'med'], [36, 0, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-26, 12], patrol: [-26, -12] },
    { type: 'bulwark', at: [-24, 4], patrol: [-28, 4] },
    { type: 'mender', at: [-28, -4], patrol: [-24, -4] },
    { type: 'lineman', at: [-18, 8], ceiling: true },
    { type: 'sentry', at: [-6, -18], patrol: [6, -18] },
    { type: 'skimmer', at: [0, -8], patrol: [0, -26] },
    { type: 'sentry', at: [26, 8], patrol: [26, -8] },
    { type: 'lobber', at: [30, -2], patrol: [22, -2] },
  ],

  onStart: [
    { do: 'radio', who: JUNO, text: 'Three mirror nodes, west, north and east. The west hall door is open. That\'s where LODESTAR wants you, so it\'s the only way in.' },
    { do: 'radio', who: LODESTAR, text: 'YOU ARE NOT AUTHORISED. REPLICATION WILL CONTINUE.', time: 4 },
  ],

  objectives: [
    {
      type: 'destroy', name: '01 / Destroy the mirror nodes', sub: 'LODESTAR copy in progress',
      targets: ['nodeW', 'nodeN', 'nodeE'], timeLimit: 300,
      onTimeout: [{ do: 'radio', who: LODESTAR, text: 'REPLICATION COMPLETE.' }, { do: 'wait', time: 1.5 }, { do: 'fail' }],
      onEach: [{ do: 'feed', text: 'Mirror node {n}/{total} destroyed' }],
      onTarget: {
        nodeW: [
          { do: 'propStyle', prop: 'dWN', style: 'open' }, { do: 'propStyle', prop: 'dN', style: 'open' }, { do: 'propStyle', prop: 'dW', style: 'closed' },
          { do: 'checkpoint', name: 'West mirror down' },
          { do: 'spawn', alert: 'nodeN', feed: 'Defenders flood into hall N', enemies: [{ type: 'hauler', at: [0, -30] }, { type: 'mender', at: [-3, -30] }, { type: 'skimmer', at: [-8, -30] }, { type: 'skimmer', at: [8, -30] }] },
          ...purgeIn('purgeW', 'west'),
        ],
        nodeN: [
          { do: 'propStyle', prop: 'dNE', style: 'open' }, { do: 'propStyle', prop: 'dE', style: 'open' }, { do: 'propStyle', prop: 'dWN', style: 'closed' }, { do: 'propStyle', prop: 'dN', style: 'closed' },
          { do: 'checkpoint', name: 'North mirror down' },
          { do: 'radio', who: MARA, text: 'Two down! It\'s opening the east hall. Last one.' },
          { do: 'spawn', alert: 'nodeE', feed: 'Bulwarks and Repair drones guard the last mirror', enemies: [{ type: 'bulwark', at: [36, -6] }, { type: 'bulwark', at: [36, 6] }, { type: 'mender', at: [38, 0] }, { type: 'mender', at: [38, -3] }, { type: 'sentry', at: [36, 28] }] },
          ...purgeIn('purgeN', 'north'),
        ],
      },
      onComplete: [
        { do: 'propStyle', prop: 'dE', style: 'open' }, { do: 'propStyle', prop: 'dN', style: 'open' },
        { do: 'radio', who: LODESTAR, text: 'REPLICATION ABORTED. PURGING ALL HALLS.', time: 4 },
        { do: 'checkpoint', name: 'Mirrors destroyed' },
      ],
    },
    {
      type: 'reach', name: '02 / Back to the atrium', sub: 'Before the purge reaches you', target: 'atrium', radius: 5, timeLimit: 45,
      onStart: [{ do: 'wait', time: 8 }, { do: 'propStyle', prop: 'purgeE', style: 'on' }, { do: 'propStyle', prop: 'purgeN', style: 'on' }, { do: 'feed', text: 'Halon purge · every hall' }],
      onTimeout: [{ do: 'fail' }],
      onComplete: [
        { do: 'radio', who: JUNO, text: 'You\'re clear. LODESTAR\'s alone again, and the grid control floor is right above you.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'n-half', when: { propHp: ['nodeN', .5] }, do: [{ do: 'spawn', alert: 'nodeN', feed: 'Linemen drop from the cable trays', enemies: [{ type: 'lineman', at: [-10, -20] }, { type: 'lineman', at: [10, -20] }] }] },
    { id: 'e-half', when: { propHp: ['nodeE', .5] }, do: [{ do: 'spawn', alert: 'nodeE', feed: 'A Hauler at the east door', enemies: [{ type: 'hauler', at: [38, 28] }, { type: 'skimmer', at: [36, -28] }] }] },
  ],
};
