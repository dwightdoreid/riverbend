// Mission 04 — Hold Fast. Defend Fernhill's generators while the hospital syncs to the grid.
// Introduces: deployable turrets, survive objectives, props with health, repairing equipment.
const MARA = 'Mara · Ops', ADE = 'Ade · Facilities';
const GENS = ['genA', 'genB', 'genC'];

// Attack lanes: west gap (hits Gen A), south gate (Gen B), east gap (Gen C).
const W = (type, n = 0) => ({ type, at: [-32, 9 + n * 3], harass: 'genA' });
const S = (type, n = 0) => ({ type, at: [(n % 2 ? 1 : -1) * (2 + n * 2.5), 28], harass: 'genB' });
const E = (type, n = 0) => ({ type, at: [32, -3 + n * 3], harass: 'genC' });
const wave = (feed, enemies) => ({ do: 'spawn', alert: 'genB', feed, enemies });

const lost = (label, line) => [
  { do: 'feed', text: label + ' destroyed' },
  { do: 'radio', who: ADE, text: line },
];

export default {
  id: 'm04',
  number: '04',
  codename: 'HOLD FAST',
  title: 'Hold Fast',
  level: 'fernhill',
  environment: 'night',
  loadout: ['rifle', 'shotgun', 'pistol'],
  turrets: 2,

  briefing: {
    eyebrow: 'Fernhill General / mission 04',
    title: 'HOLD<br><span>FAST.</span>',
    lede: 'The hospital has power. LODESTAR wants it back.',
    body: 'Fernhill can\'t take mains power from the substation until its switchgear is re-synchronised, and that takes time. Until then three diesel generators keep the wards alive. Every machine LODESTAR has left in the valley is coming for them. Lose two and the hospital goes dark.',
    stages: [
      ['01 / SET UP', 'Deploy turrets', 'Generator yard'],
      ['02 / HOLD', 'Survive the waves', 'Three attack lanes'],
      ['03 / SYNC', 'Hold until the switch', 'Then one final push'],
    ],
    tip: 'New: auto-turrets (T) track and shoot the nearest machine; place them to cover the fence gaps. Hold E next to a damaged generator to patch it. The yard is floodlit, so you\'re visible in it; the machines come out of the dark.',
    deploy: 'Take positions',
  },
  intro: { text: 'T deploys a turret. Hold E at a damaged generator to repair it.', time: 7 },
  success: { eyebrow: 'Mission complete / hospital synced', title: 'STILL<br><span>STANDING.</span>', text: 'Fernhill is on mains power and the generators are spinning down. Ade wants to know why the machines tried so hard to stop it.' },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'WARDS<br><span>DARK.</span>', text: 'Put turrets where the lanes meet the yard, patch generators between waves, and don\'t let all three lanes push at once.' },

  spawns: [[-2, -2, Math.PI], [2, -2, Math.PI], [-4, 0, Math.PI], [4, 0, Math.PI]],

  props: [
    { id: 'genA', type: 'generator', at: [-11, -15], hp: 1400, label: 'Gen A', onDestroyed: lost('Gen A', 'We\'ve lost Gen A! Two left. Don\'t lose another!') },
    { id: 'genB', type: 'generator', at: [0, -15], hp: 1400, label: 'Gen B', onDestroyed: lost('Gen B', 'Gen B is gone! We can\'t lose another one!') },
    { id: 'genC', type: 'generator', at: [11, -15], hp: 1400, label: 'Gen C', onDestroyed: lost('Gen C', 'Gen C is down! Hold the other two!') },
    { id: 'switch', type: 'panel', at: [20, -20.5], facing: 1, style: 'on' },
    { id: 'floodW', type: 'floodlight', at: [-18, -4], aim: [-10, -12], radius: 10, style: 'on' },
    { id: 'floodE', type: 'floodlight', at: [18, -4], aim: [10, -12], radius: 10, style: 'on' },
    { id: 'floodC', type: 'floodlight', at: [0, 3], aim: [0, -9], radius: 9, style: 'on', height: 8 },
    { id: 'floodS', type: 'floodlight', at: [-8, 24], aim: [0, 14], radius: 10, style: 'on' },
  ],

  pickups: [[-6, -24, 'ammo'], [6, -24, 'ammo'], [-24, -18, 'med'], [24, -15, 'med'], [-17, 1, 'ammo'], [17, 1, 'ammo']],
  enemies: [],

  onStart: [
    { do: 'radio', who: ADE, text: 'You\'re Kestrel? Ade, facilities. Come to the switchgear house, east side. I\'ll show you what we\'re protecting.' },
  ],

  objectives: [
    {
      name: '01 / Check in with Ade', sub: 'Switchgear house · east side of the yard',
      target: 'switch', action: 'Talk to Ade', time: 1,
      onComplete: [
        { do: 'radio', who: ADE, text: 'Three generators, A, B and C. I need about five minutes to sync us to the substation. They have to survive that long.' },
        { do: 'radio', who: MARA, text: 'Machines inbound on three lanes: the west gap, the south gate and the east gap. You have two turrets each. Place them now.' },
      ],
    },
    {
      type: 'survive', name: '02 / Get ready', sub: 'Deploy turrets (T)', time: 25,
      onComplete: [{ do: 'radio', who: MARA, text: 'Here they come.' }],
    },
    {
      type: 'survive', name: '03 / Hold the generator yard', time: 75, guard: GENS,
      onStart: [wave('Sentries at the south gate', [S('sentry', 0), S('sentry', 1), S('skimmer', 2)])],
    },
    {
      name: '04 / Reset the transfer switch', sub: 'The surge tripped it · switchgear house',
      target: 'switch', action: 'Reset transfer switch', time: 3, guard: GENS,
      onStart: [
        { do: 'propStyle', prop: 'switch', style: 'off' },
        { do: 'radio', who: ADE, text: 'Surge tripped the transfer switch! Someone get to the switchgear and reset it!' },
        wave('Raiders on the flanks', [E('skimmer', 0), E('skimmer', 1), W('sentry', 0)]),
      ],
      onComplete: [
        { do: 'propStyle', prop: 'switch', style: 'on' },
        { do: 'checkpoint', name: 'Switch reset' },
        { do: 'giveTurrets', count: 1 },
        { do: 'radio', who: ADE, text: 'Switch is back. Sync at sixty percent. Keep them off the gensets.' },
      ],
    },
    {
      type: 'survive', name: '05 / Hold until the sync', time: 90, guard: GENS,
      onStart: [wave('South gate: mixed wave', [S('sentry', 0), S('sentry', 1), S('skimmer', 2), S('skimmer', 3)])],
      onComplete: [
        { do: 'checkpoint', name: 'Sync at ninety percent' },
        { do: 'radio', who: MARA, text: 'LODESTAR is throwing everything it has left at you. One more push.' },
      ],
    },
    {
      type: 'survive', name: '06 / Final push', time: 60, guard: GENS,
      onStart: [wave('Everything at once', [S('skimmer', 0), S('skimmer', 1), S('skimmer', 2), E('sentry', 0), W('sentry', 0)])],
      onComplete: [
        { do: 'radio', who: ADE, text: 'Synced! We\'re on the grid! Gensets spinning down!' },
        { do: 'wait', time: 2.5 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    // Losing two generators blacks out the hospital.
    { id: 'blackout', when: { destroyed: [GENS, 2] }, do: [
      { do: 'radio', who: ADE, text: 'That\'s two! We can\'t carry the load. The wards are going dark…' },
      { do: 'wait', time: 1.5 },
      { do: 'fail' },
    ] },
    // Phase 1 (objective 2, 75 s).
    { id: 'p1-west', objective: 2, when: { hold: 20 }, do: [wave('Skimmers at the west gap', [W('skimmer', 0), W('skimmer', 1)])] },
    { id: 'p1-east', objective: 2, when: { hold: 40 }, do: [wave('Sentries at the east gap', [E('sentry', 0), E('sentry', 1)])] },
    { id: 'p1-south', objective: 2, when: { hold: 58 }, do: [wave('Skimmer flight, south gate', [S('skimmer', 0), S('skimmer', 1), S('skimmer', 2)])] },
    // Phase 2 (objective 4, 90 s).
    { id: 'p2-east', objective: 4, when: { hold: 25 }, do: [wave('Sentry squad, east gap', [E('sentry', 0), E('sentry', 1), E('sentry', 2)])] },
    { id: 'p2-west', objective: 4, when: { hold: 50 }, do: [wave('West and south together', [W('skimmer', 0), W('skimmer', 1), W('skimmer', 2), S('sentry', 0)])] },
    { id: 'p2-all', objective: 4, when: { hold: 70 }, do: [wave('All three lanes', [S('sentry', 0), S('sentry', 1), E('skimmer', 0), W('skimmer', 0)])] },
    // Phase 3 (objective 5, 60 s).
    { id: 'p3-south', objective: 5, when: { hold: 25 }, do: [wave('Sentries at the gate', [S('sentry', 0), S('sentry', 1), S('sentry', 2)])] },
    { id: 'p3-flanks', objective: 5, when: { hold: 42 }, do: [
      wave('Last flight', [E('skimmer', 0), E('skimmer', 1), W('skimmer', 0)]),
      { do: 'radio', who: ADE, text: 'Ninety-eight percent… almost there!' },
    ] },
  ],
};
