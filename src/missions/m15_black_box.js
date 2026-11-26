// Mission 15 — Black Box. Act III finale: a stealth infiltration of Halvard's Kelda Town office
// to copy the Blackbox order logs. They reveal Halvard's plan to overload LODESTAR.
// Introduces: stealth (security cameras, detection meter, alarm and reinforcement waves),
// silent takedowns (hold E behind an unaware machine), the suppressed P12-S, usable props.
const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch', HALVARD = 'Unknown · Halvard Security';
const guard = (x, z, px, pz) => ({ type: 'tallyman', guard: true, at: [x, z], patrol: [px, pz] });
const cam = (id, x, z, yaw, phase = 0) => ({ id, type: 'camera', at: [x, z], yaw, phase });
const CAMS = ['camCorW', 'camCorE', 'camLobby', 'camServer', 'camOffices'];

export default {
  id: 'm15',
  number: '15',
  codename: 'BLACK BOX',
  title: 'Black Box',
  level: 'office',
  environment: 'night',
  loadout: ['spistol', 'rifle', 'shotgun'],
  smokes: 2,
  emps: 1,
  stealth: {
    onAlarm: [
      { do: 'radio', who: HALVARD, text: 'Intruder in the Kelda office. Lock it down. Security teams to the building.' },
      { do: 'spawn', alert: 'blackbox', feed: 'Tallyman response team at the main entrance', enemies: [{ type: 'tallyman', at: [0, 28] }, { type: 'tallyman', at: [-3, 29] }, { type: 'tallyman', at: [3, 29] }] },
    ],
    waves: { every: 30, events: [{ do: 'spawn', alert: 'exit', feed: 'More Tallymen arriving', enemies: [{ type: 'tallyman', at: [36, 28] }, { type: 'tallyman', at: [-36, -28] }] }] },
  },

  briefing: {
    eyebrow: 'Kelda Town / mission 15',
    title: 'BLACK<br><span>BOX.</span>',
    lede: 'One word on every line of the order log. Tonight we find out what it means.',
    body: 'The Blackbox logs live on a server in Halvard\'s Kelda Town office. Get in through the west side door, reach the server room in the north-east and copy them. Cameras and Tallyman guards cover the building; an alarm brings response teams. Copying will trip intrusion detection whatever you do, so plan your way out.',
    stages: [
      ['01 / ENTER', 'West side door', 'Bypass the lock'],
      ['02 / COPY', 'Blackbox server', 'North-east server room'],
      ['03 / OUT', 'Back to the yard', 'Before they seal it'],
    ],
    tip: 'New: stealth. Cameras sweep (red cones); the readout top-right fills while you\'re seen. Hold E behind an unaware guard for a silent takedown. The P12-S (key 1) is suppressed. The security room terminal can loop every camera. Crouch in the dark to stay unseen.',
    deploy: 'Go quiet',
  },
  intro: { text: 'Stay out of the red cones. Hold E behind a guard for a takedown.', time: 7 },
  success: {
    eyebrow: 'Act III complete / Blackbox exposed',
    title: 'THEY MEAN<br><span>TO BURN IT.</span>',
    text: 'The Blackbox logs are a plan: overload LODESTAR\'s core, destroy every record of the lockdown and the export deal, and leave the valley dark for a month. It is scheduled for the coming week. Act IV: get to LODESTAR first.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'CAUGHT<br><span>ON CAMERA.</span>', text: 'Loop the cameras from the security room, take guards from behind, and crouch in the dark. If the alarm goes, don\'t stay to fight.' },

  spawns: [[-37, 10, Math.PI / 2], [-37, 8, Math.PI / 2], [-38.5, 10, Math.PI / 2], [-38.5, 8, Math.PI / 2]],

  props: [
    { id: 'sideDoor', type: 'door', at: [-30, 9], yaw: Math.PI / 2, width: 4, height: 3.6 },
    { id: 'blackbox', type: 'terminal', at: [24, -14.5], style: 'teal' },
    { id: 'secTerm', type: 'terminal', at: [15, 15], style: 'amber',
      use: { action: 'Loop the security cameras', time: 2.5, events: [...CAMS.map(id => ({ do: 'propStyle', prop: id, style: 'off' })), { do: 'feed', text: 'Cameras looped' }, { do: 'propStyle', prop: 'secTerm', style: 'teal' }] } },
    cam('camCorW', -29.4, 0, -Math.PI / 2), cam('camCorE', 29.4, 0, Math.PI / 2, 1.5),
    cam('camLobby', 0, 19.4, 0, .8), cam('camServer', 11, -19.4, -Math.PI * .75, 2.2), cam('camOffices', -29.4, 19.4, -Math.PI / 4, .4),
    { id: 'exit', type: 'marker', at: [-36, 9] },
  ],

  pickups: [[-36, 4, 'ammo'], [-22, 18, 'med'], [16, 7, 'ammo'], [26, 12, 'med'], [-6, -6, 'ammo'], [28, -6, 'med']],

  enemies: [
    guard(12, 27, 32, 27),                     // outside, south-east yard (away from the start)
    guard(-24, 10, -14, 16),
    guard(-24, 0, 24, 0),
    guard(-6, 12, 6, 12),
    guard(14, -8, 26, -8),
    guard(-24, -10, -14, -16),
  ],

  onStart: [
    { do: 'radio', who: JUNO, text: 'Side door\'s on the west wall. Server room is the far north-east corner. The security room by the lobby controls the cameras.' },
  ],

  objectives: [
    {
      name: '01 / Get inside', sub: 'West side door · bypass the lock',
      target: 'sideDoor', action: 'Bypass the lock', time: 2.5, reach: 3,
      onComplete: [{ do: 'propStyle', prop: 'sideDoor', style: 'open' }, { do: 'radio', who: MARA, text: 'You\'re in. Quiet now.' }],
    },
    {
      name: '02 / Copy the Blackbox logs', sub: 'Server room · north-east',
      target: 'blackbox', action: 'Copy the Blackbox logs', time: 6,
      onComplete: [
        { do: 'propStyle', prop: 'blackbox', style: 'amber' },
        { do: 'alarm', reason: 'Intrusion detection: Blackbox server' },
        { do: 'radio', who: JUNO, text: 'Got it, and it\'s worse than we thought. They\'re going to overload LODESTAR\'s core to burn the records. The whole valley goes dark for a month.' },
        { do: 'checkpoint', name: 'Logs copied' },
        { do: 'radio', who: MARA, text: 'They know you\'re there. Out the way you came, now!' },
      ],
    },
    {
      type: 'reach', name: '03 / Get out', sub: 'West side door, back to the yard', target: 'exit', radius: 3, timeLimit: 75,
      onTimeout: [{ do: 'radio', who: MARA, text: 'They\'ve sealed the yard…' }, { do: 'wait', time: 1 }, { do: 'fail' }],
      onComplete: [
        { do: 'radio', who: MARA, text: 'You\'re clear. Get to the truck. We have a week.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],
};
