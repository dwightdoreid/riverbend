// Mission 06 — Brownout. Act II opens in Port Calder during Halvard's rolling blackouts.
// Introduces: rolling blackouts (stealth windows), Spotter drones, the DMR-14 marksman rifle.
const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch';

export default {
  id: 'm06',
  number: '06',
  codename: 'BROWNOUT',
  title: 'Brownout',
  level: 'portcalder',
  environment: 'night',
  loadout: ['rifle', 'dmr', 'pistol'],
  // Each district is lit for 15 s of every 30 s, staggered west to east.
  blackout: { period: 30, litFraction: .5, offsets: { market: 0, civic: 10, harbour: 20 } },
  // Where Spotters call reinforcements from (the nearest point at least 25 m from the target).
  reinforcements: [[-44, 0], [44, 0], [0, -44], [0, 44], [-44, -30], [44, 30], [30, 44], [-30, -44], [44, -12], [-12, 44]],

  briefing: {
    eyebrow: 'Port Calder / mission 06',
    title: 'BROWN<span>OUT.</span>',
    lede: 'Halvard is switching the city off one district at a time, and blaming LODESTAR.',
    body: 'Juno Vale, a Halvard dispatcher, wants to give us proof. She hid three drives around the city before Halvard locked her out. Recover them, call her from a clean line, and get to the tram depot before Halvard\'s people find her.',
    stages: [
      ['01 / RECOVER', 'Three dead drops', 'Market · Civic · Harbour'],
      ['02 / CONTACT', 'Call Juno', 'Payphone, north avenue'],
      ['03 / EXTRACT', 'Hold the tram depot', 'North-east corner'],
    ],
    tip: 'New: the DMR-14 (key 2) zooms hard when aiming and one-shots Skimmers. Spotters fly high and call in reinforcements while they see you; shoot them first. Districts lose power in turn: move through the dark ones. The top-right readout shows your district\'s state.',
    deploy: 'Go dark',
  },
  intro: { text: 'Districts black out in turn. Move through the dark ones.', time: 6 },
  success: {
    eyebrow: 'Mission complete / witness extracted',
    title: 'ON THE<br><span>LAST TRAM.</span>',
    text: 'Juno and her drives are out of the city. The schedules prove Halvard planned the blackouts, and someone at Halvard has noticed the drives are gone.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'CAUGHT<br><span>IN THE LIGHT.</span>', text: 'Wait for districts to go dark before crossing them, and drop Spotters with the DMR before they can call in help.' },

  spawns: [[-40, 40, -Math.PI / 4], [-38, 40, -Math.PI / 4], [-40, 38, -Math.PI / 4], [-38, 38, -Math.PI / 4]],

  props: [
    { id: 'driveA', type: 'drive', at: [-20, -15] },
    { id: 'driveB', type: 'drive', at: [3.2, 12] },
    { id: 'driveC', type: 'drive', at: [15, 10] },
    { id: 'phone', type: 'payphone', at: [-4.2, -38], yaw: -Math.PI / 2 },
    { id: 'depot', type: 'marker', at: [40, -40] },
  ],

  pickups: [[-36, 30, 'ammo'], [-26, -18, 'med'], [-3, 18, 'ammo'], [26, 14, 'med'], [3, -40, 'ammo'], [38, -36, 'med'], [42, -38, 'ammo']],

  enemies: [
    { type: 'spotter', at: [-30, -12], patrol: [-30, 22] },
    { type: 'spotter', at: [0, -22], patrol: [0, 22] },
    { type: 'spotter', at: [30, 12], patrol: [30, -22] },
    { type: 'sentry', at: [-20, 0], patrol: [-42, 0] },
    { type: 'sentry', at: [15, 30], patrol: [-15, 30] },
    { type: 'sentry', at: [20, 0], patrol: [42, 0] },
    { type: 'sentry', at: [0, -30], patrol: [25, -30] },
    { type: 'sentry', at: [-28, -30], patrol: [-8, -30] },
    { type: 'skimmer', at: [30, 32], patrol: [30, 6] },
    { type: 'skimmer', at: [31, 34], patrol: [31, 8] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'You\'re in Port Calder. Halvard is cutting districts in rotation: Market, Civic, Harbour. Watch the readout, top right.' },
    { do: 'radio', who: MARA, text: 'Spotters are working the avenues. If one sees you, everything nearby knows where you are. Take them down fast.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Recover Juno\'s drives', sub: 'Three dead drops · use the dark',
      targets: ['driveA', 'driveB', 'driveC'], action: 'Take the drive', time: 1.2,
      onEach: [{ do: 'feed', text: 'Drive {n}/{total} recovered' }],
      onTarget: {
        driveA: [{ do: 'radio', who: JUNO, text: 'That\'s the dispatch schedule. They planned these blackouts weeks before the storm.' }],
        driveB: [{ do: 'radio', who: JUNO, text: 'Billing records. The power they "lost" was sold over the border at three times the price.' }],
        driveC: [{ do: 'radio', who: JUNO, text: 'The order chain. It goes to the Halvard board. All of it.' }],
      },
      onComplete: [
        { do: 'checkpoint', name: 'Drives recovered' },
        { do: 'radio', who: MARA, text: 'That\'s all three. Use the payphone on the north avenue. Halvard monitors the mobile network.' },
      ],
    },
    {
      name: '02 / Call Juno', sub: 'Payphone · north avenue',
      target: 'phone', action: 'Call Juno', time: 1.6,
      onComplete: [
        { do: 'radio', who: JUNO, text: 'You have them? I\'m on the last tram out of the depot. North-east corner. Hurry.' },
        { do: 'radio', who: 'Unknown · Halvard Security', text: 'Dispatch, we have a trace on that call. Public phone, north avenue. Sending machines.' },
        { do: 'spawn', alert: 'phone', feed: 'Halvard traced the call', enemies: [{ type: 'spotter', at: [-30, -44] }, { type: 'skimmer', at: [-44, -30] }, { type: 'skimmer', at: [-42, -32] }] },
      ],
    },
    {
      type: 'reach', name: '03 / Reach the tram depot', sub: 'North-east corner', target: 'depot', radius: 6,
      onComplete: [
        { do: 'checkpoint', name: 'At the depot' },
        { do: 'radio', who: JUNO, text: 'I see you! The tram\'s charging. Thirty seconds, then we go!' },
      ],
    },
    {
      type: 'hold', name: '04 / Hold the tram depot', sub: 'Until the tram leaves', target: 'depot', radius: 9, time: 30,
      holdText: 'Holding the depot · stay close to the tram',
      onStart: [{ do: 'spawn', alert: 'depot', feed: 'Machines converging on the depot', enemies: [{ type: 'spotter', at: [0, -44] }, { type: 'skimmer', at: [44, 0] }, { type: 'skimmer', at: [42, 2] }] }],
      onComplete: [
        { do: 'radio', who: JUNO, text: 'Doors closing. Get on!' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'depot-sentries', when: { hold: 12 }, do: [
      { do: 'spawn', alert: 'depot', feed: 'Sentries from the harbour', enemies: [{ type: 'sentry', at: [44, -12] }, { type: 'sentry', at: [44, -8] }] },
    ] },
    { id: 'depot-swarm', when: { hold: 22 }, do: [
      { do: 'spawn', alert: 'depot', feed: 'Skimmer swarm', enemies: [{ type: 'skimmer', at: [30, -44] }, { type: 'skimmer', at: [26, -44] }, { type: 'skimmer', at: [44, -24] }] },
      { do: 'radio', who: JUNO, text: 'Almost charged… ten seconds!' },
    ] },
  ],
};
