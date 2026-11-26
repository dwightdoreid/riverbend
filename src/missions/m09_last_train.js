// Mission 09 — Last Train. With Feeder 7 live, a commuter train stranded on the elevated line
// since the blackout can finally move. LODESTAR's machines want it stopped.
// Introduces: the elevated viaduct, a train escort with powered sections and a station stop.
const MARA = 'Mara · Ops', DRIVER = 'Okafor · Train driver';
const TX = -3.5;
const raid = (type, x, z) => ({ type, at: [x, z], harass: 'train' });

export default {
  id: 'm09',
  number: '09',
  codename: 'LAST TRAIN',
  title: 'Last Train',
  level: 'viaduct',
  environment: 'night',
  loadout: ['rifle', 'dmr', 'pistol'],
  smokes: 1,

  briefing: {
    eyebrow: 'Port Calder Elevated / mission 09',
    title: 'LAST<br><span>TRAIN.</span>',
    lede: 'Two hundred commuters have been stuck on the elevated line since the lights went out.',
    body: 'Feeder 7 is live, so the line can move again, one powered section at a time. Get the stranded train to Market Street, hold the platform while the stranded passengers there board, then bring everyone into Harbour Terminus. The machines will go for the train.',
    stages: [
      ['01 / POWER', 'Energize section 1', 'Trackside cabinet'],
      ['02 / BOARD', 'Hold Market Street', 'While passengers board'],
      ['03 / HOME', 'Harbour Terminus', 'Reset section 2 first'],
    ],
    tip: 'The train only rolls while you\'re within 16 m and no machine is near it. Raiders shoot the train when they can\'t see you; it\'s cover for you too. The DMR is your best answer to Spotters over the tracks.',
    deploy: 'Board the line',
  },
  intro: { text: 'Power the section, then stay with the train.', time: 6 },
  success: {
    eyebrow: 'Mission complete / passengers home',
    title: 'END OF<br><span>THE LINE.</span>',
    text: 'Two hundred people walked off at Harbour Terminus. And over the harbour, drones with Halvard markings were watching the whole thing.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'DERAILED.', text: 'Engage raiders before they reach the train, and clear the next stretch of deck before it rolls into it.' },

  spawns: [[-7.5, 79, 0], [-6, 80.5, 0], [-8.5, 81, 0], [-5, 82, 0]],

  props: [
    { id: 'train', type: 'train', at: [TX, 70] },
    { id: 'cab1', type: 'panel', at: [-8.6, 58], facing: 1 },
    { id: 'cab2', type: 'panel', at: [8.6, -14], facing: 1 },
    { id: 'market', type: 'marker', at: [-4, 8] },
  ],
  escort: { prop: 'train', path: [[TX, 70], [TX, 8], [TX, -20], [TX, -45], [TX, -70]], speed: 2.6, radius: 16, contactRadius: 12, blockAhead: 10.8, hp: 2200 },

  pickups: [[-8.4, 70, 'ammo'], [8.4, 46, 'med'], [-8.4, 16, 'ammo'], [8.4, 2, 'med'], [-8.4, -28, 'ammo'], [8.4, -50, 'med'], [-8.4, -64, 'ammo']],

  enemies: [
    { type: 'sentry', at: [6.5, 40], patrol: [6.5, 22] },
    { type: 'spotter', at: [0, 30], patrol: [0, -10] },
    { type: 'sentry', at: [-8, -6], patrol: [-8, -26] },
    { type: 'bulwark', at: [0, -32], patrol: [0, -56] },
    { type: 'skimmer', at: [5, -60], patrol: [-5, -40] },
    { type: 'skimmer', at: [6, -62], patrol: [-4, -42] },
  ],

  onStart: [
    { do: 'radio', who: DRIVER, text: 'Okafor here, driving. I\'ve got a full train and a dead rail. Power section one and I\'ll roll.' },
    { do: 'radio', who: MARA, text: 'Cabinet\'s on the west walkway just ahead. Then stay with the train. It\'s the only cover on this deck.' },
  ],

  objectives: [
    {
      name: '01 / Power section 1', sub: 'Trackside cabinet · west walkway',
      target: 'cab1', action: 'Close section breaker', time: 1.8,
      onComplete: [
        { do: 'propStyle', prop: 'cab1', style: 'on' },
        { do: 'radio', who: DRIVER, text: 'Rail\'s live. Rolling, slowly. Keep them off us.' },
      ],
    },
    {
      type: 'escort', name: '02 / Escort the train to Market Street', target: 'train', until: 1,
      onComplete: [
        { do: 'checkpoint', name: 'Market Street' },
        { do: 'radio', who: DRIVER, text: 'Market Street. Doors open. There are sixty more people on this platform. Give me twenty-five seconds.' },
      ],
    },
    {
      type: 'hold', name: '03 / Hold Market Street', sub: 'Passengers boarding', target: 'market', radius: 15, time: 25,
      holdText: 'Holding the platform · passengers boarding',
      onStart: [{ do: 'spawn', alert: 'market', feed: 'Skimmers climbing from the street', enemies: [raid('skimmer', 9, 26), raid('skimmer', -9, 28), raid('sentry', 8, -8)] }],
      onComplete: [
        { do: 'radio', who: DRIVER, text: 'Doors closed… section two is dead! Somebody cut it.' },
        { do: 'radio', who: 'Unknown · Halvard Security', text: 'Section two isolated. That train doesn\'t reach the harbour.' },
      ],
    },
    {
      name: '04 / Reset section 2', sub: 'Cabinet on the east walkway, by the freight wagons',
      target: 'cab2', action: 'Override the isolation', time: 3,
      onStart: [{ do: 'spawn', alert: 'cab2', feed: 'Ambush at the freight wagons', enemies: [raid('sentry', 8, -30), { type: 'lineman', at: [9, -26] }, { type: 'lineman', at: [9, -22] }] }],
      onComplete: [
        { do: 'propStyle', prop: 'cab2', style: 'on' },
        { do: 'radio', who: MARA, text: 'Halvard is cutting our power now, not LODESTAR. Get that train home.' },
      ],
    },
    {
      type: 'escort', name: '05 / Bring it into Harbour Terminus', target: 'train', until: 4,
      onComplete: [
        { do: 'radio', who: DRIVER, text: 'Harbour Terminus. Everybody off. Thank you, Kestrel.' },
        { do: 'wait', time: 2 },
        { do: 'radio', who: MARA, text: 'Kestrel, I\'m seeing drones over the harbour with Halvard markings, not LODESTAR. They\'re watching you.' },
        { do: 'wait', time: 2.5 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'below', objective: 4, when: { escort: 2 }, do: [
      { do: 'spawn', alert: 'train', feed: 'Skimmers rising from the street', enemies: [raid('skimmer', 9, -34), raid('skimmer', -9, -36), raid('skimmer', 9, -40)] },
      { do: 'radio', who: DRIVER, text: 'Under the deck! They\'re coming up the piers!' },
    ] },
    { id: 'harbour-gate', objective: 4, when: { escort: 3 }, do: [
      { do: 'checkpoint', name: 'Harbour approach' },
      { do: 'spawn', alert: 'train', feed: 'Spotter over the harbour approach', enemies: [{ type: 'spotter', at: [0, -80] }, raid('sentry', 7, -78), raid('lineman', -9, -60)] },
    ] },
  ],
  reinforcements: [[9, -82], [-9, -82], [9, 0], [-9, 0], [9, 50], [-9, 50]],
};
