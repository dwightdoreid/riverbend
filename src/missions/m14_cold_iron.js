// Mission 14 — Cold Iron. A snowbound freight yard: couple three battery wagons into a train
// for the forward base while LODESTAR's Haulers and Halvard's Tallymen fight over the yard.
// Introduces: snow (preset + snowfall), the Hauler (armoured, rear-radiator weak spot), battery
// wagons that are shunted onto the train when coupled.
const MARA = 'Mara · Ops', OKAFOR = 'Okafor · Locomotive', HALVARD = 'Unknown · Halvard Security';

export default {
  id: 'm14',
  number: '14',
  codename: 'COLD IRON',
  title: 'Cold Iron',
  level: 'railyardSnow',
  environment: 'snow',
  weather: { snow: true, wind: { dir: 1.2, base: 3, gust: 5 } },
  loadout: ['rifle', 'shotgun', 'arc'],
  smokes: 1,
  emps: 1,

  briefing: {
    eyebrow: 'Kelda Junction / mission 14',
    title: 'COLD<br><span>IRON.</span>',
    lede: 'Three wagons of stored power, buried in snow, and every machine in the north wants them.',
    body: 'Kelda Junction holds LODESTAR\'s reserve battery wagons. Coupled to Okafor\'s locomotive, they\'re a mobile power station for the push north. Couple all three, start the loco, and hold the yard while it builds pressure. Halvard\'s Tallymen are already on their way to take them first.',
    stages: [
      ['01 / COUPLE', 'Three battery wagons', 'Spread across the sidings'],
      ['02 / START', 'Okafor\'s locomotive', 'West end'],
      ['03 / HOLD', 'While pressure builds', 'Haulers and Tallymen'],
    ],
    tip: 'New: Haulers are armoured everywhere except the glowing radiator on their back. Flank them (in co-op, one of you draws its fire). Grenades and the ARC still hurt from any side. Snow muffles everything; machines see a little less far.',
    deploy: 'Into the snow',
  },
  intro: { text: 'Haulers: shoot the glowing radiator on the back.', time: 6 },
  success: {
    eyebrow: 'Mission complete / power train rolling',
    title: 'IRON<br><span>ON THE MOVE.</span>',
    text: 'Three battery wagons and a locomotive rolling north: enough power to run the forward base for a month. Juno has decoded part of the Blackbox log. It points to a Halvard regional office in Kelda Town.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'FROZEN<br><span>OUT.</span>', text: 'Never trade shots with a Hauler head-on. Get behind it, or let the Tallymen keep it busy.' },

  spawns: [[-31, 33, 0], [-29, 33, 0], [-31, 34.6, 0], [-29, 34.6, 0]],

  props: [
    { id: 'loco', type: 'train', at: [-30, 24], yaw: Math.PI / 2 },
    { id: 'cab', type: 'panel', at: [-38, 26.4], facing: 1 },
    { id: 'batA', type: 'battery', at: [6, -8], to: [-15.2, 24] },
    { id: 'batB', type: 'battery', at: [30, 0], to: [-3.9, 24] },
    { id: 'batC', type: 'battery', at: [-8, 8], to: [7.4, 24] },
    { id: 'yard', type: 'marker', at: [-10, 18] },
  ],

  pickups: [[-34, 28, 'ammo'], [-20, 14, 'med'], [4, -2, 'ammo'], [14, -12, 'med'], [24, 4, 'ammo'], [-6, 2, 'med'], [-24, -4, 'ammo'], [36, -6, 'med']],

  enemies: [
    { type: 'hauler', at: [10, -18], patrol: [-12, -18] },
    { type: 'sentry', at: [-20, 2], patrol: [-34, 2] },
    { type: 'sentry', at: [20, -6], patrol: [34, -6] },
    { type: 'skimmer', at: [0, 12], patrol: [-16, 12] },
    { type: 'tallyman', at: [40, 18], patrol: [40, -10] },
  ],

  onStart: [
    { do: 'radio', who: OKAFOR, text: 'Loco\'s warm, Kestrel. Couple those three battery wagons and the yard shunter will drag them up to me.' },
    { do: 'radio', who: MARA, text: 'There\'s a Hauler on the yard. Don\'t fight it from the front. Its radiator is on the back.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Couple the battery wagons', sub: 'Coupler cabinets on each wagon',
      targets: ['batA', 'batB', 'batC'], action: 'Couple the battery wagon', time: 2.5, collectStyle: 'coupled',
      onEach: [{ do: 'feed', text: 'Battery wagon {n}/{total} coupled' }],
      onTarget: {
        batA: [{ do: 'spawn', alert: 'batA', feed: 'Second Hauler from the north sidings', enemies: [{ type: 'hauler', at: [20, -34] }] }],
        batB: [
          { do: 'radio', who: HALVARD, text: 'They\'re taking the battery train. Tallymen, recover the wagons.' },
          { do: 'spawn', alert: 'batB', feed: 'Tallymen over the east fence', enemies: [{ type: 'tallyman', at: [43, 10] }, { type: 'tallyman', at: [43, 14] }, { type: 'tallyman', at: [43, -2] }] },
        ],
        batC: [{ do: 'spawn', alert: 'batC', feed: 'Skimmers and a Lineman', enemies: [{ type: 'skimmer', at: [-43, -10] }, { type: 'skimmer', at: [-43, -14] }, { type: 'lineman', at: [-43, -4] }] }],
      },
      onComplete: [
        { do: 'checkpoint', name: 'Batteries coupled' },
        { do: 'radio', who: OKAFOR, text: 'All three on! Get to my cab and kick the loco into gear.' },
      ],
    },
    {
      name: '02 / Start the locomotive', sub: 'Cab panel · west end', target: 'cab', action: 'Start the locomotive', time: 2,
      onComplete: [
        { do: 'propStyle', prop: 'cab', style: 'on' },
        { do: 'radio', who: OKAFOR, text: 'Pressure\'s building. Forty-five seconds and we roll. Keep them off the wagons!' },
        { do: 'checkpoint', name: 'Loco started' },
      ],
    },
    {
      type: 'survive', name: '03 / Hold the yard', sub: 'Locomotive building pressure', time: 45,
      onStart: [{ do: 'spawn', alert: 'yard', feed: 'Haulers converging on the train', enemies: [{ type: 'hauler', at: [40, 30] }, { type: 'sentry', at: [36, 30] }, { type: 'sentry', at: [30, 32] }] }],
      onComplete: [
        { do: 'radio', who: OKAFOR, text: 'Rolling! Climb aboard!' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'tally-wave', when: { hold: 15 }, do: [
      { do: 'spawn', alert: 'yard', feed: 'Tallymen from the south', enemies: [{ type: 'tallyman', at: [-10, -34] }, { type: 'tallyman', at: [0, -34] }, { type: 'tallyman', at: [10, -34] }] },
    ] },
    { id: 'last-hauler', when: { hold: 28 }, do: [
      { do: 'spawn', alert: 'yard', feed: 'A Hauler at the east throat', enemies: [{ type: 'hauler', at: [43, 4] }, { type: 'skimmer', at: [43, 8] }, { type: 'skimmer', at: [43, 0] }] },
      { do: 'radio', who: OKAFOR, text: 'Nearly there!' },
    ] },
  ],
};
