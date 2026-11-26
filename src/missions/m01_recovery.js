// Mission 01 — Recovery. The original Riverbend mission, now described as data.
//
// Mission format (see docs/ARCHITECTURE.md):
//   level       id from src/levels
//   spawns      [[x, z, yaw], ...] one per co-op slot
//   props       named interactive objects; objectives point at them via `target`
//   pickups     [x, z, 'ammo' | 'med']
//   enemies     { type, at: [x, z], patrol: [x, z] }
//   objectives  { name, sub, target, action, time, onComplete: [events] }
//   events      see EVENTS in src/game/mission.js (say, radio, spawn, checkpoint, wait, win...)
const MARA = 'Mara · Ops';

export default {
  id: 'm01',
  number: '01',
  codename: 'RECOVERY',
  title: 'Operation Recovery',
  level: 'riverbend',

  briefing: {
    eyebrow: 'Riverbend / mission 01',
    title: 'OPERATION<br><span>RECOVERY.</span>',
    lede: 'One yard. One data core. Get in, recover it, get out.',
    body: 'LODESTAR, the valley\'s automated grid-defence system, has locked every operator out and turned its sentries on anyone who approaches. Recover an access token from the western service crate, pull LODESTAR\'s data core from the control-building console, and get it out through the gate.',
    stages: [
      ['01 / ACCESS', 'Find the token', 'Western service crate'],
      ['02 / RECOVER', 'Retrieve the core', 'Control-building console'],
      ['03 / EXTRACT', 'Return to the gate', 'Southern entrance'],
    ],
    tip: 'Use cover, manage your magazines, and watch your flanks. Moving widens your fire; aiming and crouching steady it. Grenades bounce and can hurt you.',
    deploy: 'Deploy to yard',
  },
  intro: { text: 'Move west for the access token. Hold E near objectives.', time: 5 },
  success: { eyebrow: 'Mission complete / data recovered', title: 'CORE<br><span>SECURED.</span>', text: 'You recovered the core and reached extraction.' },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'SIGNAL<br><span>LOST.</span>', text: 'Use the barriers and buildings, watch the map, and keep a second weapon ready.' },

  onStart: [
    { do: 'radio', who: MARA, text: 'Kestrel, this is Mara. LODESTAR locked us out of Riverbend an hour ago and won\'t say why.' },
    { do: 'radio', who: MARA, text: 'Its logs are on a data core in the control building. You\'ll need the access token from the western service crate first.' },
  ],

  spawns: [[0, 35, 0], [2.5, 35, 0], [-2.5, 35, 0], [5, 35, 0]],

  props: [
    { id: 'token', type: 'terminal', at: [-32, 8], style: 'amber' },
    { id: 'core', type: 'terminal', at: [7.7, 24], style: 'teal' },
    { id: 'gate', type: 'extraction', at: [0, 35] },
  ],

  pickups: [[-7, 33, 'ammo'], [36, 29, 'med'], [-35, -26, 'med'], [32, -29, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-23, 11], patrol: [-31, 18] },
    { type: 'sentry', at: [-31, -15], patrol: [-25, -24] },
    { type: 'sentry', at: [-17, -29], patrol: [-8, -25] },
    { type: 'sentry', at: [20, -26], patrol: [28, -21] },
    { type: 'sentry', at: [31, -1], patrol: [35, 7] },
    { type: 'sentry', at: [21, 12], patrol: [28, 18] },
    { type: 'sentry', at: [11, 20], patrol: [12, 13] },
    { type: 'sentry', at: [-10, -1], patrol: [-10, -11] },
  ],

  objectives: [
    {
      name: '01 / Collect the access token', sub: 'Service crate · western yard',
      target: 'token', action: 'Collect access token', time: 1.15,
      onComplete: [
        { do: 'propStyle', prop: 'token', style: 'teal' },
        { do: 'radio', who: MARA, text: 'Token\'s live. The core console is on the east side of the control building.' },
        { do: 'noise', at: 'token', radius: 17 },
      ],
    },
    {
      name: '02 / Recover the data core', sub: 'Console · east side of control building',
      target: 'core', action: 'Recover data core', time: 1.8,
      onComplete: [
        { do: 'propStyle', prop: 'core', style: 'amber' },
        { do: 'checkpoint', name: 'Core secured' },
        { do: 'radio', who: MARA, text: 'Got it. Every sentry in the yard just turned toward you. Get to the south gate.' },
        { do: 'investigate', at: 'core' },
        { do: 'feed', text: 'Sentries are investigating the control building.' },
      ],
    },
    {
      name: '03 / Reach extraction', sub: 'Southern gate · return with the core',
      target: 'gate', action: 'Confirm extraction', time: 1.5,
      onComplete: [{ do: 'win' }],
    },
  ],
};
