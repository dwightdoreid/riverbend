// Mission 03 — Switchback. Escort a mobile substation up the pass to Fernhill General.
// Introduces: escort objectives, raiders that attack the vehicle, the SG-8 shotgun, dusk.
const MARA = 'Mara · Ops', ROOK = 'Rook · Driver';

// Truck route: the road centreline, with an extra stop just short of the barricade (index 4).
const ROUTE = [[0, 74], [0, 52], [-18, 40], [-20, 18], [-14.3, 15.4], [0, 6], [18, -6], [20, -30], [2, -44], [-14, -56], [-8, -72], [0, -79]];

export default {
  id: 'm03',
  number: '03',
  codename: 'SWITCHBACK',
  title: 'Switchback',
  level: 'switchback',
  environment: 'dusk',
  loadout: ['rifle', 'shotgun', 'pistol'],

  briefing: {
    eyebrow: 'Ridge Road / mission 03',
    title: 'SWITCH<span>BACK.</span>',
    lede: 'Fernhill General has four hours of generator fuel left.',
    body: 'LODESTAR has islanded the hospital on the ridge. Riverbend\'s mobile substation can feed it straight off the mountain line, if it gets up the pass. Rook drives; you keep the machines off the truck. It only rolls while you stay close and the road ahead is clear.',
    stages: [
      ['01 / ESCORT', 'Stay with the truck', 'Lower switchbacks'],
      ['02 / BREACH', 'Clear the roadblock', 'Hairpin at the ridge'],
      ['03 / ARRIVE', 'Reach Fernhill', 'Hospital gate'],
    ],
    tip: 'New: SG-8 shotgun (key 2): eight pellets, deadly up close, perfect for Skimmers. Raiders shoot the truck when they can\'t see you, so engage them early. The truck stops when machines are near it.',
    deploy: 'Roll out',
  },
  intro: { text: 'Stay within 10 m of the truck to keep it moving.', time: 6 },
  success: { eyebrow: 'Mission complete / Fernhill powered', title: 'LIGHTS<br><span>ON THE RIDGE.</span>', text: 'The substation is coupled to the mountain line and Fernhill\'s wards are back on grid power. LODESTAR noticed.' },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'STALLED<br><span>ON THE PASS.</span>', text: 'Keep the raiders busy so they shoot at you, not the truck, and clear each bend before the truck rolls into it.' },

  spawns: [[3.5, 78, 0], [-3.5, 78, 0], [5.5, 76, 0], [-5.5, 76, 0]],

  props: [
    { id: 'truck', type: 'truck', at: [0, 74] },
    { id: 'roadblock', type: 'barricade', at: [-10, 12], yaw: -1.03, width: 10 },
  ],
  escort: { prop: 'truck', path: ROUTE, speed: 2.3, radius: 10, contactRadius: 9, hp: 1600 },

  pickups: [[7, 70, 'ammo'], [-26, 36, 'med'], [-17, 8, 'ammo'], [27, -12, 'med'], [-9, -46, 'ammo'], [-15, -66, 'med']],

  enemies: [
    { type: 'sentry', at: [12, 44], patrol: [24, 46] },
    { type: 'sentry', at: [-29, 25], patrol: [-29, 8] },
    { type: 'sentry', at: [10, 0], patrol: [27, 3] },
    { type: 'sentry', at: [28, -38], patrol: [12, -37] },
    { type: 'sentry', at: [-21, -44], patrol: [-27, -62] },
    { type: 'skimmer', at: [6, -64], patrol: [-20, -68] },
    { type: 'skimmer', at: [8, -61], patrol: [-18, -64] },
  ],

  onStart: [
    { do: 'radio', who: ROOK, text: 'Rook here. Forty tonnes of transformer on a mountain road. I\'ll drive, you keep me alive.' },
    { do: 'radio', who: MARA, text: 'Stay close to the truck. Rook won\'t roll into a bend with machines in it.' },
  ],

  objectives: [
    {
      type: 'escort', name: '01 / Escort the truck', target: 'truck', until: 4,
      onComplete: [
        { do: 'radio', who: ROOK, text: 'Hold up. Barriers across the hairpin. Somebody wanted this road closed.' },
      ],
    },
    {
      name: '02 / Clear the roadblock', sub: 'Drag the barriers off the hairpin',
      target: 'roadblock', action: 'Clear the roadblock', time: 3.5, reach: 4.5,
      onStart: [
        { do: 'spawn', alert: 'roadblock', feed: 'Ambush at the roadblock', enemies: [
          { type: 'sentry', at: [8, 14], harass: 'truck' }, { type: 'skimmer', at: [-2, -2], harass: 'truck' },
        ] },
      ],
      onComplete: [
        { do: 'propStyle', prop: 'roadblock', style: 'gone' },
        { do: 'checkpoint', name: 'Roadblock cleared' },
        { do: 'radio', who: ROOK, text: 'That\'s clear. Rolling again.' },
      ],
    },
    {
      type: 'escort', name: '03 / Get the truck to Fernhill', target: 'truck', until: 11,
      onComplete: [
        { do: 'radio', who: ROOK, text: 'At the gate. Coupling to the hospital feeder now.' },
        { do: 'wait', time: 2.5 },
        { do: 'radio', who: MARA, text: 'Fernhill is on grid power. Well done, Kestrel.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'skimmers-low', when: { escort: 2 }, do: [
      { do: 'spawn', alert: 'truck', feed: 'Skimmers diving on the truck', enemies: [
        { type: 'skimmer', at: [-30, 52], harass: 'truck' }, { type: 'skimmer', at: [-28, 46], harass: 'truck' },
      ] },
      { do: 'radio', who: ROOK, text: 'Skimmers on the left! They\'re going for the tank!' },
    ] },
    { id: 'ridge-sentries', when: { escort: 7 }, do: [
      { do: 'spawn', alert: 'truck', feed: 'Sentries dropping off the ridge', enemies: [
        { type: 'sentry', at: [30, -18], harass: 'truck' }, { type: 'sentry', at: [29, -26], harass: 'truck' },
      ] },
    ] },
    { id: 'halfway', when: { escort: 8 }, do: [
      { do: 'checkpoint', name: 'Upper switchbacks' },
      { do: 'radio', who: MARA, text: 'Halfway. LODESTAR is pulling everything it has toward the hospital road.' },
    ] },
    { id: 'last-stand', when: { escort: 9 }, do: [
      { do: 'spawn', alert: 'truck', feed: 'Skimmer flight from Fernhill', enemies: [
        { type: 'skimmer', at: [-12, -76], harass: 'truck' }, { type: 'skimmer', at: [12, -76], harass: 'truck' }, { type: 'skimmer', at: [0, -74], harass: 'truck' },
      ] },
      { do: 'radio', who: ROOK, text: 'I can see the hospital. And a lot of rotors between us and it.' },
    ] },
    { id: 'gate', when: { escort: 10 }, do: [
      { do: 'radio', who: MARA, text: 'Fernhill\'s gate is open. Bring it home.' },
    ] },
  ],
};
