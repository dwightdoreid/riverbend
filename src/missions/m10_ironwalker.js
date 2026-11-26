// Mission 10 — Ironwalker. Act II finale in the Port Calder freight yard.
// Introduces: the Ironwalker boss (knee weak points, kneel-and-expose cycles), Halvard's
// Tallymen as a second hostile faction that fights LODESTAR's machines as well as Kestrel.
const MARA = 'Mara · Ops', OKAFOR = 'Okafor · Relief train', HALVARD = 'Unknown · Halvard Security';
const tally = (x, z) => ({ type: 'tallyman', tag: 'tallyman', at: [x, z] });

export default {
  id: 'm10',
  number: '10',
  codename: 'IRONWALKER',
  title: 'Ironwalker',
  level: 'railyard',
  environment: 'dusk',
  loadout: ['rifle', 'dmr', 'shotgun'],
  smokes: 1,

  briefing: {
    eyebrow: 'Port Calder Freight / mission 10',
    title: 'IRON<span>WALKER.</span>',
    lede: 'A relief train full of generators is stuck in the freight yard, and something big is tearing up the tracks.',
    body: 'Okafor is bringing a relief train out of Port Calder Freight: generators and medical supplies for the north. LODESTAR has taken over the yard\'s construction walker and is wrecking the points. Set the route from the yard, then deal with the walker. Mara thinks Halvard will make its move tonight.',
    stages: [
      ['01 / ROUTE', 'Throw two points levers', 'Western throat'],
      ['02 / BRING IT DOWN', 'The Ironwalker', 'Knees first, then the core'],
      ['03 / ?', 'Expect company', 'Halvard is watching'],
    ],
    tip: 'The Ironwalker\'s armour stops almost everything. Shoot the two glowing knee actuators to bring it down, then hit the exposed core before it gets back up. Tallymen shoot everything, LODESTAR\'s machines included, so let them fight each other.',
    deploy: 'Into the yard',
  },
  intro: { text: 'Shoot the glowing knees to bring the Ironwalker down.', time: 6 },
  success: {
    eyebrow: 'Act II complete / relief train away',
    title: 'HALVARD<br><span>SHOWS ITS HAND.</span>',
    text: 'The relief train is rolling north, the Ironwalker is scrap, and Halvard has openly turned its own drones on Kestrel. There\'s no pretending anymore. Next: the north, where Halvard keeps its secrets.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'FLATTENED.', text: 'Keep moving so the debris rings miss you, never stand under it, and save the DMR for the knees.' },

  // Open ground just south of the relief train (clear of the container stack to the west).
  spawns: [[-31, 33, 0], [-29, 33, 0], [-31, 34.6, 0], [-29, 34.6, 0]],

  props: [
    { id: 'reliefTrain', type: 'train', at: [-26, 28.5], yaw: Math.PI / 2 },
    { id: 'leverA', type: 'lever', at: [-30, 20.5] },
    { id: 'leverB', type: 'lever', at: [-20, 12] },
    { id: 'yard', type: 'marker', at: [0, -4] },
  ],

  pickups: [[-34, 26, 'ammo'], [-14, 4, 'med'], [6, -14, 'ammo'], [-6, -20, 'med'], [20, 0, 'ammo'], [30, -12, 'med'], [-24, -4, 'ammo'], [2, 22, 'med']],

  enemies: [
    { type: 'sentry', at: [-24, 20], patrol: [-10, 20] },
    { type: 'sentry', at: [-10, 4], patrol: [-26, 4] },
    { type: 'skimmer', at: [0, 10], patrol: [-20, 12] },
    { type: 'bulwark', at: [6, -4], patrol: [-6, -4] },
    { type: 'sentry', at: [20, -12], patrol: [32, -4] },
  ],

  onStart: [
    { do: 'radio', who: OKAFOR, text: 'I\'m on the relief train at the west end. Two points levers to throw and I can get out.' },
    { do: 'radio', who: MARA, text: 'Something is moving in the north of the yard. Something heavy.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Throw the points', sub: 'Two levers · western throat',
      targets: ['leverA', 'leverB'], action: 'Throw the points', time: 1.5, collectStyle: 'reverse',
      onEach: [{ do: 'feed', text: 'Points {n}/{total} set' }],
      onComplete: [
        { do: 'checkpoint', name: 'Points set' },
        { do: 'radio', who: OKAFOR, text: 'Route\'s set. But that thing\'s heading straight for my train!' },
      ],
    },
    {
      type: 'kill', tag: 'ironwalker', name: '02 / Bring down the Ironwalker', sub: 'Knee actuators, then the core',
      onStart: [
        { do: 'spawn', feed: 'IRONWALKER', enemies: [{ type: 'ironwalker', tag: 'ironwalker', at: [4, -30], patrol: [-4, -30] }] },
        { do: 'radio', who: MARA, text: 'That\'s the yard\'s construction walker. LODESTAR is driving it. Bullets won\'t touch that armour. Take out the knees!' },
      ],
      onComplete: [
        { do: 'checkpoint', name: 'Ironwalker down' },
        { do: 'radio', who: MARA, text: 'It\'s down! Now finish the Tallymen before they reach the train.' },
      ],
    },
    {
      type: 'kill', tag: 'tallyman', name: '03 / Clear the Tallymen', sub: 'Halvard\'s security drones',
      onStart: [{ do: 'spawn', alert: 'yard', feed: 'More Tallymen inbound', enemies: [tally(42, 6), tally(42, -6)] }],
      onComplete: [
        { do: 'radio', who: OKAFOR, text: 'Track\'s clear. Relief train rolling north. Thank you, Kestrel.' },
        { do: 'wait', time: 2 },
        { do: 'radio', who: MARA, text: 'Halvard just sent its own machines after us in public. Whatever they\'re hiding in the north, it\'s worth this much to them.' },
        { do: 'wait', time: 2.5 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'tallymen', when: { enemyHp: ['ironwalker', .7] }, do: [
      { do: 'radio', who: HALVARD, text: 'Tallymen, sanitize the freight yard. All targets. The walker, and the Kestrel team.' },
      { do: 'spawn', alert: 'yard', feed: 'Halvard Tallymen entering the yard', enemies: [tally(43, -20), tally(43, -16), tally(43, 20), tally(43, 24)] },
      { do: 'radio', who: MARA, text: 'Halvard drones, shooting at everything. Let them hit the walker, and keep your head down.' },
    ] },
  ],
};
