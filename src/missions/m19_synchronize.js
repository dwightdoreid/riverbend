// Mission 19 — Synchronize. The grid control floor: tie the valley's power islands into one grid
// so that whatever happens to LODESTAR's core, the lights stay on. Hold three control points while
// the islands come in; every point lost drags the frequency down, and too low collapses it all.
// LODESTAR's machines and Halvard's Tallymen both want it to fail.
// Introduces: capture-and-hold control points, the grid frequency meter, load steps.
const MARA = 'Mara · Ops', OKAFOR = 'Okafor · Grid', JUNO = 'Juno · Halvard dispatch', HALVARD = 'Unknown · Halvard Security';
const POINTS = ['cpW', 'cpC', 'cpE'];
const raid = (type, x, z) => ({ type, at: [x, z], harass: POINTS });
const tally = (x, z) => ({ type: 'tallyman', at: [x, z], harass: POINTS });

export default {
  id: 'm19',
  number: '19',
  codename: 'SYNCHRONIZE',
  title: 'Synchronize',
  level: 'control',
  environment: 'underground',
  loadout: ['rifle', 'dmr', 'launcher'],
  smokes: 1,
  emps: 2,
  turrets: 2,
  sync: {
    points: POINTS, band: .2, failBelow: 48.8,
    onCollapse: [{ do: 'radio', who: OKAFOR, text: 'Under-frequency! The islands are tripping out. We\'ve lost the valley.' }, { do: 'wait', time: 1.5 }, { do: 'fail' }],
  },

  briefing: {
    eyebrow: 'Grid control floor / mission 19',
    title: 'SYNCHRO<br><span>NIZE.</span>',
    lede: 'Five islands, one frequency. Hold the floor while they find each other.',
    body: 'Before anyone touches LODESTAR\'s core, the valley has to stand on its own feet. Okafor will tie Harrow Point and the other power islands into one grid from this floor. Hold the three control points so the dispatch, the master console and the protection relays stay ours. Every point we lose drops the grid frequency, and if it sags below 48.8 Hz, the whole valley trips out.',
    stages: [
      ['01 / TAKE', 'Three control points', 'Dispatch · master console · relays'],
      ['02 / SYNC', 'Hold them while islands join', 'Keep the frequency near 50 Hz'],
      ['03 / TIE', 'Close the tie-line breaker', 'Master console'],
    ],
    tip: 'New: stand in a control point\'s ring to capture it; machines standing in it with nobody there take it back. The meter at the top shows the grid frequency: sync only progresses inside the green band with all three points held. Two turrets (T): give them the points you can\'t stand on.',
    deploy: 'Take the floor',
  },
  intro: { text: 'Stand in the rings. Keep all three to keep 50 Hz.', time: 6 },
  success: {
    eyebrow: 'Mission complete / valley synchronised',
    title: 'ONE<br><span>GRID.</span>',
    text: 'Five islands, one frequency, and the valley carries its own load. Whatever happens below, the lights stay on. Halvard\'s override teams are already in the building, heading for LODESTAR\'s core. So are we.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'UNDER<br><span>FREQUENCY.</span>', text: 'Turrets on two points, you on the third, and move the moment a ring flashes. One point lost is recoverable; two is a countdown.' },

  spawns: [[0, 25, 0], [-2, 25, 0], [2, 25, 0], [0, 26.5, 0]],

  props: [
    { id: 'cpW', type: 'controlPoint', at: [-28, 1], label: 'DISPATCH' },
    { id: 'cpC', type: 'controlPoint', at: [0, -4], label: 'MASTER' },
    { id: 'cpE', type: 'controlPoint', at: [28, 1], label: 'RELAYS' },
    { id: 'tie', type: 'panel', at: [0, 12.6], facing: 1, label: 'Tie-line breaker' },
    { id: 'floor', type: 'marker', at: [0, 4] },
  ],

  pickups: [[-6, 22, 'ammo'], [6, 22, 'med'], [-28, 14, 'ammo'], [28, 14, 'med'], [-12, -4, 'ammo'], [12, -4, 'med'], [-30, -14, 'ammo'], [30, -14, 'med'], [0, 6, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-28, 6], patrol: [-28, -4] },
    { type: 'bulwark', at: [0, -6], patrol: [0, -2] },
    { type: 'mender', at: [0, -12], patrol: [4, -12] },
    { type: 'sentry', at: [28, -4], patrol: [28, 6] },
    { type: 'skimmer', at: [-10, -22], patrol: [10, -22] },
  ],

  onStart: [
    { do: 'radio', who: OKAFOR, text: 'Three control points: dispatch on the west, the master console in the middle, protection relays east. Take all three and I\'ll start bringing the islands in.' },
  ],

  objectives: [
    {
      type: 'capture', name: '01 / Take the control points', sub: 'Stand in each ring',
      onComplete: [
        { do: 'checkpoint', name: 'Floor secured' },
        { do: 'radio', who: OKAFOR, text: 'All three are ours. Bringing Harrow Point in first. Watch the meter.' },
      ],
    },
    {
      type: 'sync', name: '02 / Synchronise the islands', time: 80,
      onStart: [{ do: 'spawn', alert: 'floor', feed: 'Machines pour in from the north corridors', enemies: [raid('skimmer', -34, -18), raid('skimmer', 34, -18), raid('sentry', -34, -16.5), raid('sentry', 34, -16.5)] }],
      onComplete: [
        { do: 'checkpoint', name: 'Islands synchronised' },
        { do: 'radio', who: OKAFOR, text: 'Five islands, fifty hertz, rock steady. Close the tie-line breaker at the master console and it\'s one grid.' },
      ],
    },
    {
      name: '03 / Close the tie-line breaker', sub: 'Master console, on the dais', target: 'tie', action: 'Close the tie-line breaker', time: 2.5,
      onComplete: [
        { do: 'propStyle', prop: 'tie', style: 'on' },
        { do: 'radio', who: JUNO, text: 'It\'s holding. The valley is one grid. Halvard can\'t black it out any more.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'step1', objective: 1, when: { hold: 12 }, do: [{ do: 'loadStep', amount: .35, feed: 'Port Calder island joins · frequency dips' }] },
    { id: 'halvard', objective: 1, when: { hold: 22 }, do: [
      { do: 'radio', who: HALVARD, text: 'They\'re synchronising the valley. Tallymen: take that floor. Make it trip.' },
      { do: 'spawn', alert: 'floor', feed: 'Tallymen at the south entrance', enemies: [tally(-2, 26.5), tally(2, 26.5), tally(0, 27)] },
    ] },
    { id: 'step2', objective: 1, when: { hold: 36 }, do: [{ do: 'loadStep', amount: .4, feed: 'Kelda island joins · frequency dips' }] },
    { id: 'half', objective: 1, when: { hold: 40 }, do: [{ do: 'checkpoint', name: 'Half synchronised' }] },
    { id: 'heavy', objective: 1, when: { hold: 48 }, do: [
      { do: 'spawn', alert: 'floor', feed: 'A Hauler and a Repair drone push the relays', enemies: [raid('hauler', 34, -18), raid('mender', 34, -16.5), raid('skimmer', -34, -18), raid('skimmer', -34, -16.5)] },
    ] },
    { id: 'step3', objective: 1, when: { hold: 62 }, do: [{ do: 'loadStep', amount: .45, feed: 'Riverbend island joins · frequency dips' }, { do: 'spawn', alert: 'floor', feed: 'Last push from both sides', enemies: [tally(-34, -18), tally(34, -18), raid('bulwark', 0, 27)] }] },
  ],
};
