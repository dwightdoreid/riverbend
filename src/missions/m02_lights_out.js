// Mission 02 — Lights Out. Riverbend at night, hours after Kestrel stole the core.
// Introduces: darkness and the flashlight, Skimmer drones, collect / hold objectives,
// radio dialogue, triggered waves and checkpoints.
const MARA = 'Mara · Ops';

export default {
  id: 'm02',
  number: '02',
  codename: 'LIGHTS OUT',
  title: 'Lights Out',
  level: 'riverbend',
  environment: 'night',

  briefing: {
    eyebrow: 'Riverbend / mission 02',
    title: 'LIGHTS<br><span>OUT.</span>',
    lede: 'LODESTAR answered the theft by switching off the valley.',
    body: 'A Halvard line crew was inside the Riverbend yard when the lockdown hit. Three linemen are hiding in the dark between the busbars. Find them, restore the gate floodlights so the evac van can find you, and hold the gate until it arrives.',
    stages: [
      ['01 / SEARCH', 'Find three linemen', 'Somewhere in the yard'],
      ['02 / SIGNAL', 'Restore the floodlights', 'Breaker at the control building'],
      ['03 / HOLD', 'Defend the gate', 'Until the van arrives'],
    ],
    tip: 'Darkness shortens how far machines can see you. Your flashlight (F) and the floodlights cancel that. Sensor cones show where each machine is looking. Skimmers are fast and fragile; shoot them before they close in.',
    deploy: 'Cut through the fence',
  },
  intro: { text: 'F toggles your flashlight. Light makes you visible.', time: 6 },
  success: { eyebrow: 'Mission complete / crew evacuated', title: 'CREW<br><span>CLEAR.</span>', text: 'The line crew is out. Halvard\'s people are asking why Kestrel got there before their own security did.' },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'IN THE<br><span>DARK.</span>', text: 'Keep your light off while you search, use the sensor cones to slip between patrols, and fight from cover at the gate.' },

  // Kestrel enters through a cut in the south-west fence.
  spawns: [[-40, 34, 0], [-38, 34, 0], [-40, 32, 0], [-38, 32, 0]],

  props: [
    { id: 'teo', type: 'survivor', at: [-37, -20], facing: 1.2 },
    { id: 'ines', type: 'survivor', at: [37, -33], facing: -2.4 },
    { id: 'dale', type: 'survivor', at: [31, 6], facing: -1.6 },
    { id: 'breaker', type: 'panel', at: [-4, 27.4], facing: 1 },
    { id: 'floodW', type: 'floodlight', at: [-7, 36.4], aim: [-1.5, 31], radius: 9 },
    { id: 'floodE', type: 'floodlight', at: [7, 36.4], aim: [1.5, 31], radius: 9 },
    { id: 'gate', type: 'extraction', at: [0, 32], radius: 3.4 },
  ],

  pickups: [[-36, 30, 'ammo'], [36, 29, 'med'], [-35, -26, 'med'], [32, -29, 'ammo'], [8, 31, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-23, 11], patrol: [-31, 18] },
    { type: 'sentry', at: [-17, -29], patrol: [-8, -25] },
    { type: 'sentry', at: [20, -26], patrol: [28, -21] },
    { type: 'sentry', at: [31, -1], patrol: [35, 7] },
    { type: 'sentry', at: [11, 20], patrol: [12, 13] },
    { type: 'sentry', at: [-10, -1], patrol: [-10, -11] },
    { type: 'skimmer', at: [0, -17], patrol: [30, -17] },
    { type: 'skimmer', at: [1, -15], patrol: [-30, -15] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'Kestrel, you\'re through the fence. The whole valley is dark, and the yard is darker.' },
    { do: 'radio', who: MARA, text: 'Halvard says three of their linemen were on shift. Their headlamps should be blinking. Find them.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Find the line crew', sub: 'Look for blinking headlamps',
      targets: ['teo', 'ines', 'dale'], action: 'Get the lineman moving', time: 1.4,
      onEach: [{ do: 'feed', text: 'Lineman {n}/{total} heading for the gate' }],
      onTarget: {
        teo: [{ do: 'radio', who: 'Teo · Lineman', text: 'Kestrel? Thank God. Those things went quiet when the lights died, then started hunting by sound.' }],
        ines: [{ do: 'radio', who: 'Ines · Lineman', text: 'I tried calling Halvard dispatch. They told me to stay put. For six hours.' }],
        dale: [{ do: 'radio', who: 'Dale · Lineman', text: 'The new drones came in from the north. Fast ones. Watch the sky line.' }],
      },
      onComplete: [
        { do: 'checkpoint', name: 'Crew found' },
        { do: 'radio', who: MARA, text: 'That\'s all three. The van can\'t find the gate in this. There\'s an emergency breaker at the control building. Bring the floodlights up.' },
      ],
    },
    {
      name: '02 / Restore the gate floodlights', sub: 'Emergency breaker · front of the control building',
      target: 'breaker', action: 'Close emergency breaker', time: 2.2,
      onComplete: [
        { do: 'propStyle', prop: 'breaker', style: 'on' },
        { do: 'propStyle', prop: 'floodW', style: 'on' },
        { do: 'propStyle', prop: 'floodE', style: 'on' },
        { do: 'checkpoint', name: 'Lights restored' },
        { do: 'radio', who: MARA, text: 'Lights are up, and LODESTAR saw them come on. Everything in that yard is coming for the gate.' },
      ],
    },
    {
      type: 'hold', name: '03 / Hold the gate', sub: 'Evac van inbound', target: 'gate', radius: 7, time: 40,
      holdText: 'Holding the gate · stay near the ring',
      onStart: [
        { do: 'spawn', alert: 'gate', feed: 'Skimmers inbound from the north', enemies: [
          { type: 'skimmer', at: [-6, -34] }, { type: 'skimmer', at: [6, -34] },
        ] },
        { do: 'investigate', at: 'gate', memory: 14 },
        { do: 'radio', who: MARA, text: 'Van\'s forty seconds out. Keep that gate clear.' },
      ],
      onComplete: [
        { do: 'radio', who: MARA, text: 'Van\'s at the gate. Everyone in. Kestrel, you too.' },
        { do: 'wait', time: 2.5 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'cones', objective: 0, when: { enter: [-26, 6, 16] }, do: [
      { do: 'radio', who: MARA, text: 'See those faint cones? That\'s where their sensors are pointed. Stay out of them and stay dark.' },
    ] },
    { id: 'flankers', when: { hold: 12 }, do: [
      { do: 'spawn', alert: 'gate', feed: 'Sentries flanking from east and west', enemies: [
        { type: 'sentry', at: [-37, -4] }, { type: 'sentry', at: [37, -4] },
      ] },
    ] },
    { id: 'swarm', when: { hold: 24 }, do: [
      { do: 'spawn', alert: 'gate', feed: 'Skimmer swarm inbound', enemies: [
        { type: 'skimmer', at: [-20, -34] }, { type: 'skimmer', at: [0, -36] }, { type: 'skimmer', at: [20, -34] },
      ] },
      { do: 'radio', who: MARA, text: 'Another flight of Skimmers. Fifteen seconds!' },
    ] },
  ],
};
