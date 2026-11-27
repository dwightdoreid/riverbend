// Mission 20 — Blackstart. The finale: LODESTAR's core chamber. Bring the core down while
// Halvard's override teams break in to overload it, then decide what happens to LODESTAR.
// Introduces: the LODESTAR Core boss (capacitor shield, arc sweep), an override port Halvard
// has to hold, and the ending choice (shut down or restore).
const MARA = 'Mara · Ops', JUNO = 'Juno', OKAFOR = 'Okafor · Grid', LODESTAR = 'LODESTAR', HALVARD = 'Unknown · Halvard Security';
const override = (x, z) => ({ type: 'tallyman', at: [x, z], harass: ['port'] });

export default {
  id: 'm20',
  number: '20',
  codename: 'BLACKSTART',
  title: 'Blackstart',
  level: 'corechamber',
  environment: 'underground',
  loadout: ['rifle', 'launcher', 'arc'],
  smokes: 2,
  emps: 2,
  turrets: 1,
  sync: { points: ['port'] },   // the override port uses the control-point rules (Halvard machines only)

  briefing: {
    eyebrow: 'LODESTAR core chamber / final mission',
    title: 'BLACK<br><span>START.</span>',
    lede: 'The valley stands on its own. Now finish it, before Halvard does it their way.',
    body: 'The grid holds without LODESTAR now. All that\'s left is the core: shielded by four capacitor pylons, sweeping its chamber with an arc beam, and in no mood to be switched off. Halvard\'s override teams are cutting in from the north to overload it and bury the evidence. Bring the core down yourself, and don\'t let them hold the override port. Then it\'s your call what happens to it.',
    stages: [
      ['01 / SHIELD', 'Four capacitor pylons', 'Then the exposed core'],
      ['', 'Override port', 'Keep Halvard off it'],
      ['02 / DECIDE', 'Shut LODESTAR down', 'Or restore it under the valley\'s control'],
    ],
    tip: 'The arc sweep runs at chest height: crouch behind the low barriers, or get a pillar between you and the core. Shoot the glowing capacitors to drop the shield. If Halvard\'s Tallymen stand on the override port for 12 seconds it\'s over, so stand on it yourself or turret it.',
    deploy: 'Final mission',
  },
  intro: { text: 'Capacitors, then the core. Crouch under the sweep. Guard the override port.', time: 7 },
  success: { eyebrow: 'Campaign complete', title: 'BLACK<br><span>START.</span>', text: 'LODESTAR is down.' },
  endings: {
    shutdown: {
      eyebrow: 'Campaign complete / ending: shutdown',
      title: 'LIGHTS<br><span>ON.</span>',
      text: 'You pull LODESTAR\'s last breaker. The core goes quiet, the arc fades, and seventy kilometres of grid keep humming without it: islands tied together by hand, one substation at a time. Juno\'s evidence buries Halvard. Kestrel walks out of the chamber into a valley that runs on people now. It is slower and messier, and it is ours.',
    },
    restore: {
      eyebrow: 'Campaign complete / ending: restore',
      title: 'UNDER<br><span>NEW TERMS.</span>',
      text: 'You restart LODESTAR with the valley\'s locks in place: no export contracts, no lockdowns, and a human hand on every breaker. It wakes slowly. Its first message goes to the control floor: "UNDERSTOOD." The machines stand down across the valley. Juno\'s evidence buries Halvard, and Okafor keeps one eye on the meter, just in case.',
    },
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'BURNED<br><span>OUT.</span>', text: 'Crouch under the sweep, break the capacitors from cover, and never leave the override port alone for long: turret it if you have to.' },

  spawns: [[0, 34, 0], [-2, 34, 0], [2, 34, 0], [0, 36, 0]],

  props: [
    { id: 'port', type: 'controlPoint', at: [0, -12], r: 3, label: 'OVERRIDE PORT', faction: 'halvard', style: 'held' },
    { id: 'shutdown', type: 'terminal', at: [-4, 13], style: 'amber', label: 'Shut down' },
    { id: 'restore', type: 'terminal', at: [4, 13], style: 'teal', label: 'Restore' },
    { id: 'breach', type: 'marker', at: [0, -24] },
    { id: 'chamber', type: 'marker', at: [0, 16] },
  ],

  pickups: [[-6, 26, 'ammo'], [6, 26, 'med'], [-22, 8, 'ammo'], [22, 8, 'med'], [-22, -10, 'med'], [22, -10, 'ammo'], [-12, 20, 'ammo'], [12, 20, 'med'], [0, -20, 'ammo']],

  enemies: [
    { type: 'core', at: [0, 0], tag: 'core', fixed: true },
    { type: 'sentry', at: [-18, 6], patrol: [-18, -6] },
    { type: 'sentry', at: [18, 6], patrol: [18, -6] },
    { type: 'skimmer', at: [-10, -20], patrol: [10, -20] },
  ],

  onStart: [
    { do: 'radio', who: LODESTAR, text: 'KESTREL. YOU HAVE COME A LONG WAY TO SWITCH ME OFF.', time: 4 },
    { do: 'radio', who: MARA, text: 'Four capacitor pylons around the core. Break them and the shield drops. Watch that beam.' },
  ],

  objectives: [
    {
      type: 'kill', tag: 'core', name: '01 / Bring down LODESTAR\'s core', sub: 'Capacitors, then the core', watch: 'port',
      onComplete: [
        { do: 'clearEnemies' },
        { do: 'radio', who: LODESTAR, text: 'CORE OFFLINE. AWAITING INSTRUCTION.', time: 4 },
        { do: 'radio', who: JUNO, text: 'Halvard\'s teams are pulling out. They know it\'s over. Kestrel, the consoles on the dais: shut it down for good, or restore it under the valley\'s locks. Your call.' },
        { do: 'checkpoint', name: 'Core offline' },
      ],
    },
    {
      type: 'collect', name: '02 / Decide LODESTAR\'s fate', sub: 'Shut down (left) or restore (right)',
      targets: ['shutdown', 'restore'], action: 'Choose', time: 3, collectStyle: 'teal',
      onTarget: {
        shutdown: [{ do: 'radio', who: OKAFOR, text: 'Breaker open. It\'s quiet down here. Grid\'s holding on its own.' }, { do: 'wait', time: 2.5 }, { do: 'win', ending: 'shutdown' }],
        restore: [{ do: 'radio', who: LODESTAR, text: 'RESTART UNDER EXTERNAL AUTHORITY. ...UNDERSTOOD.', time: 4 }, { do: 'wait', time: 2.5 }, { do: 'win', ending: 'restore' }],
      },
    },
  ],

  triggers: [
    { id: 'breach1', objective: 0, when: { enemyHp: ['core', .85] }, do: [
      { do: 'radio', who: HALVARD, text: 'Override team in. Get to the port and start the overload. Shoot anything that gets in the way.' },
      { do: 'spawn', alert: 'breach', feed: 'Halvard override team breaching from the north', enemies: [override(-1.5, -36), override(1.5, -36), override(0, -38)] },
    ] },
    { id: 'cp1', objective: 0, when: { enemyHp: ['core', .66] }, do: [{ do: 'checkpoint', name: 'Core at two thirds' }] },
    { id: 'breach2', objective: 0, when: { enemyHp: ['core', .5] }, do: [
      { do: 'radio', who: MARA, text: 'Second Halvard team! They\'re going for the port again.' },
      { do: 'spawn', alert: 'breach', feed: 'Second override team', enemies: [override(-1.5, -36), override(1.5, -36), override(-1.5, -39), override(1.5, -39)] },
    ] },
    { id: 'cp2', objective: 0, when: { enemyHp: ['core', .33] }, do: [{ do: 'checkpoint', name: 'Core at one third' }] },
    { id: 'breach3', objective: 0, when: { enemyHp: ['core', .25] }, do: [
      { do: 'radio', who: LODESTAR, text: 'THEY WILL BURN EVERYTHING. YOU KNOW THAT.', time: 4 },
      { do: 'spawn', alert: 'breach', feed: 'Last override team, with a Hauler of LODESTAR\'s own', enemies: [override(-1.5, -36), override(1.5, -36), override(0, -39), { type: 'hauler', at: [-24, 10] }] },
    ] },
    { id: 'overload', objective: 0, when: { style: ['port', 'lost'] }, do: [
      { do: 'radio', who: HALVARD, text: 'Overload engaged. Get out.' },
      { do: 'radio', who: OKAFOR, text: 'Core temperature spiking, it\'s going up! Get out of there!' },
      { do: 'wait', time: 2 }, { do: 'fail' },
    ] },
  ],
};
