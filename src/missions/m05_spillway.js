// Mission 05 — Spillway. Act I finale at Calder Dam.
// Introduces: the shielded Bulwark, doors, the first boss (Spillway Warden), and the story
// turn: the gate logs show Halvard Energy ordered LODESTAR's lockdown.
const MARA = 'Mara · Ops';

export default {
  id: 'm05',
  number: '05',
  codename: 'SPILLWAY',
  title: 'Spillway',
  level: 'calder',
  environment: 'storm',
  loadout: ['rifle', 'shotgun', 'pistol'],

  briefing: {
    eyebrow: 'Calder Dam / mission 05',
    title: 'SPILL<span>WAY.</span>',
    lede: 'The reservoir is a metre from the crest, and LODESTAR won\'t open the gates.',
    body: 'The storm has filled Calder reservoir and LODESTAR is holding the spillway gates shut. If the dam overtops, the valley floods. Get into the turbine hall, pull the gate-control logs from the control room so Mara can see why, then open the three spillway gates by hand.',
    stages: [
      ['01 / BREACH', 'Cross the crest', 'Turbine hall west door'],
      ['02 / EVIDENCE', 'Pull the gate logs', 'Control room, east end'],
      ['03 / RELEASE', 'Open three gates', 'Spillway apron'],
    ],
    tip: 'New: the Bulwark carries a front shield that stops bullets. Flank it, or bounce a grenade behind it. Something big maintains these gates; Mara doesn\'t know what.',
    deploy: 'Move out',
  },
  intro: { text: 'Bulwarks block bullets from the front. Flank them or use grenades.', time: 6 },
  success: {
    eyebrow: 'Act I complete / Calder Dam secured',
    title: 'THE GATES<br><span>ARE OPEN.</span>',
    text: 'The reservoir is falling and the valley is safe tonight. But the logs are clear: LODESTAR\'s lockdown order came from Halvard Energy\'s own dispatch account, and Halvard has just learned that Kestrel knows.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'OVER<br><span>THE TOP.</span>', text: 'Flank Bulwarks, save grenades for the Warden, and shoot its core only when the vents glow.' },

  spawns: [[37, -28, Math.PI / 2], [37, -25, Math.PI / 2], [37, -31, Math.PI / 2], [35, -28, Math.PI / 2]],

  props: [
    { id: 'hallWest', type: 'door', at: [-30, -8], yaw: Math.PI / 2, width: 4, height: 4.4 },
    { id: 'hallSouth', type: 'door', at: [24, 2], width: 6, height: 5 },
    { id: 'logs', type: 'terminal', at: [27.5, -12.6], style: 'amber' },
    { id: 'gateA', type: 'panel', at: [-20, 28.7], facing: -1 },
    { id: 'gateB', type: 'panel', at: [0, 28.7], facing: -1 },
    { id: 'gateC', type: 'panel', at: [20, 28.7], facing: -1 },
  ],

  pickups: [[30, -24, 'ammo'], [-37, -18, 'med'], [-27, -17, 'ammo'], [19, -17, 'med'], [-35, 10, 'ammo'], [35, 10, 'ammo'], [-30, 26, 'med'], [30, 26, 'med'], [0, 8, 'ammo']],

  enemies: [
    // Crest
    { type: 'sentry', at: [20, -28], patrol: [-10, -28] },
    { type: 'sentry', at: [0, -31], patrol: [-24, -25] },
    { type: 'bulwark', at: [-24, -27], patrol: [-36, -27] },
    { type: 'skimmer', at: [-36, 0], patrol: [-36, 22] },
    { type: 'skimmer', at: [-34, 2], patrol: [-34, 24] },
    // Turbine hall
    { type: 'bulwark', at: [-8, -3.5], patrol: [8, -3.5] },
    { type: 'sentry', at: [-22, -16], patrol: [-22, -3] },
    { type: 'sentry', at: [10, -16], patrol: [18, -4] },
    // Apron
    { type: 'sentry', at: [-25, 16], patrol: [25, 16] },
    { type: 'sentry', at: [10, 21], patrol: [-10, 21] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'Kestrel, you\'re on the east end of the crest. The turbine hall door is at the far west end.' },
    { do: 'radio', who: MARA, text: 'Something heavy is patrolling the crest. Shielded. Don\'t trade shots with it head-on.' },
  ],

  objectives: [
    {
      name: '01 / Breach the turbine hall', sub: 'West door · override the lock',
      target: 'hallWest', action: 'Override door lock', time: 3, reach: 3.2,
      onComplete: [
        { do: 'propStyle', prop: 'hallWest', style: 'open' },
        { do: 'radio', who: MARA, text: 'You\'re in. Control room is at the east end, past the three turbine units.' },
      ],
    },
    {
      name: '02 / Pull the gate logs', sub: 'Control room · east end of the hall',
      target: 'logs', action: 'Download gate-control logs', time: 3.5,
      onComplete: [
        { do: 'propStyle', prop: 'logs', style: 'teal' },
        { do: 'radio', who: MARA, text: 'Logs are coming through… Kestrel. The gate hold, the lockdown, all of it…' },
        { do: 'wait', time: 1 },
        { do: 'radio', who: MARA, text: 'It was ordered from Halvard Energy\'s dispatch account. LODESTAR didn\'t go rogue. It\'s following orders.' },
        { do: 'propStyle', prop: 'hallSouth', style: 'open' },
        { do: 'checkpoint', name: 'Logs secured' },
        { do: 'radio', who: MARA, text: 'Deal with that later. The spillway door is open. Get those gates up before the crest overtops.' },
      ],
    },
    {
      type: 'collect', name: '03 / Open the spillway gates', sub: 'Three hoist houses on the apron',
      targets: ['gateA', 'gateB', 'gateC'], action: 'Release gate brake', time: 2.6, collectStyle: 'on',
      onStart: [
        { do: 'spawn', alert: 'gateB', feed: 'Skimmers over the spillway', enemies: [
          { type: 'skimmer', at: [-36, 30] }, { type: 'skimmer', at: [36, 30] },
        ] },
      ],
      onEach: [{ do: 'feed', text: 'Gate {n}/{total} opening' }],
      onComplete: [
        { do: 'checkpoint', name: 'Gates open' },
        { do: 'radio', who: MARA, text: 'All three gates are moving. Wait, something just powered up under the apron. It\'s big.' },
      ],
    },
    {
      type: 'kill', tag: 'warden', name: '04 / Destroy the Spillway Warden', sub: 'Shoot the core when its vents open',
      onStart: [
        { do: 'spawn', feed: 'SPILLWAY WARDEN', enemies: [{ type: 'warden', tag: 'warden', at: [0, 18], patrol: [-12, 18] }] },
        { do: 'radio', who: MARA, text: 'That\'s the dam\'s maintenance walker, and LODESTAR is driving it. Its armour is too thick. Wait for the vents to open and hit the core!' },
      ],
      onComplete: [
        { do: 'radio', who: MARA, text: 'It\'s down. The gates are holding and the reservoir is dropping.' },
        { do: 'wait', time: 2 },
        { do: 'radio', who: MARA, text: 'Kestrel, get out of there. Halvard knows what we found. Whatever happens next, it won\'t only be LODESTAR\'s machines.' },
        { do: 'wait', time: 2.5 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'hall-door-close', objective: 1, when: { enter: [0, -10, 12] }, do: [
      { do: 'radio', who: MARA, text: 'Watch the units: the shielded one is patrolling between them.' },
    ] },
    { id: 'gate-1', objective: 2, when: { collected: 1 }, do: [
      { do: 'spawn', alert: 'gateB', feed: 'Bulwark on the apron', enemies: [{ type: 'bulwark', at: [-36, 30] }, { type: 'sentry', at: [36, 28] }] },
    ] },
    { id: 'gate-2', objective: 2, when: { collected: 2 }, do: [
      { do: 'spawn', alert: 'gateB', feed: 'Skimmer flight', enemies: [{ type: 'skimmer', at: [-30, 32] }, { type: 'skimmer', at: [30, 32] }, { type: 'skimmer', at: [0, 33] }] },
    ] },
  ],
};
