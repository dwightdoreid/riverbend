// Mission 07 — Undercurrent. Into the cable tunnels under Port Calder to cut Halvard's
// undeclared cross-border interconnector.
// Introduces: tunnels, the Lineman (ceiling ambusher), smoke grenades, flooded zones, and a
// timed escape (objective time limit).
const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch';
const ceiling = (x, z) => ({ type: 'lineman', at: [x, z], ceiling: true });

export default {
  id: 'm07',
  number: '07',
  codename: 'UNDERCURRENT',
  title: 'Undercurrent',
  level: 'tunnels',
  environment: 'underground',
  loadout: ['shotgun', 'rifle', 'pistol'],
  smokes: 2,

  briefing: {
    eyebrow: 'Port Calder tunnels / mission 07',
    title: 'UNDER<span>CURRENT.</span>',
    lede: 'The power Halvard "lost" is leaving the valley through a tunnel nobody declared.',
    body: 'Juno\'s drives name it: the Undercurrent, a cable tunnel carrying Calder power to a private interconnector and across the border. Go down the maintenance shaft, cut its three feeder junctions, then trip the interconnector itself. Halvard will want those tunnels sealed the moment it goes down.',
    stages: [
      ['01 / CUT', 'Three feeder junctions', 'Branch rooms'],
      ['02 / TRIP', 'Kill the interconnector', 'North-east vault'],
      ['03 / ESCAPE', 'Exit shaft 4', 'Before the seals close'],
    ],
    tip: 'New: Linemen cling to the ceiling and drop when you pass under them, so watch above you. Smoke grenades (V) blind machines. The flooded tunnel slows you and the splashing carries. Use your flashlight; the dark here is total.',
    deploy: 'Climb down',
  },
  intro: { text: 'Watch the ceilings. V throws smoke. F for your flashlight.', time: 6 },
  success: {
    eyebrow: 'Mission complete / interconnector down',
    title: 'THE CURRENT<br><span>STOPS HERE.</span>',
    text: 'Calder power is staying in Calder. Halvard has lost its export line, and the security chatter says it is done relying on LODESTAR\'s machines.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'SEALED<br><span>IN.</span>', text: 'Clear tunnels before walking under them, keep smoke for the vault, and don\'t stop on the way out.' },

  spawns: [[-34, 35, 0], [-32, 35, 0], [-34, 33, 0], [-32, 33, 0]],

  props: [
    { id: 'cableA', type: 'cable', at: [-21, 8] },
    { id: 'cableB', type: 'cable', at: [13, 19.3] },
    { id: 'cableC', type: 'cable', at: [-15.5, -25.3] },
    { id: 'breaker', type: 'panel', at: [19.5, -21.2], facing: 1 },
    { id: 'vaultEast', type: 'door', at: [27, -20], yaw: Math.PI / 2, width: 4, height: 4.4 },
    { id: 'exit', type: 'marker', at: [31.5, -36.5] },
  ],

  pickups: [[-31, 24, 'ammo'], [-20, 15, 'med'], [11, 11, 'ammo'], [-12, -21, 'med'], [0, -16, 'ammo'], [15, -9.5, 'med'], [31, -10, 'ammo'], [31, -30, 'med']],

  enemies: [
    { type: 'sentry', at: [-31, 20], patrol: [-31, -20] },
    { type: 'sentry', at: [0, 25], patrol: [0, -15] },
    { type: 'sentry', at: [31, 20], patrol: [31, -25] },
    { type: 'sentry', at: [-20, -31], patrol: [20, -31] },
    { type: 'skimmer', at: [20, 28], patrol: [-20, 28] },
    { type: 'skimmer', at: [22, 29], patrol: [-18, 29] },
    ceiling(-31, 8), ceiling(5, 15), ceiling(-18, -27.5), ceiling(10, 0), ceiling(24, 0), ceiling(20.5, -6),
    { type: 'lineman', at: [16, 12], patrol: [10, 18] },
    { type: 'bulwark', at: [17, -14], patrol: [23, -14] },
    { type: 'sentry', at: [14, -10], patrol: [14, -20] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'You\'re in. No power down here except Halvard\'s own feeders. Lights will be sparse.' },
    { do: 'radio', who: JUNO, text: 'The feeder junctions are in three branch rooms, west, middle and north. Cut all three and the vault runs on its own batteries.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Cut the Undercurrent feeders', sub: 'Three junctions in the branch rooms',
      targets: ['cableA', 'cableB', 'cableC'], action: 'Cut the feeder', time: 2.4, collectStyle: 'cut',
      onEach: [{ do: 'feed', text: 'Feeder {n}/{total} cut' }],
      onTarget: {
        cableA: [{ do: 'spawn', alert: 'cableA', feed: 'Linemen coming up the west tunnel', enemies: [{ type: 'lineman', at: [-31, -6] }, { type: 'lineman', at: [-31, -9] }] }],
        cableB: [{ do: 'spawn', alert: 'cableB', feed: 'Linemen in the middle tunnel', enemies: [{ type: 'lineman', at: [0, -12] }, { type: 'lineman', at: [-1, -15] }] }],
        cableC: [{ do: 'spawn', alert: 'cableC', feed: 'Linemen from the north tunnel', enemies: [{ type: 'lineman', at: [10, -31] }, { type: 'lineman', at: [14, -31] }] }],
      },
      onComplete: [
        { do: 'checkpoint', name: 'Feeders cut' },
        { do: 'radio', who: MARA, text: 'That\'s all three. The vault is north-east. The only open way in is through the flooded tunnel.' },
      ],
    },
    {
      name: '02 / Trip the interconnector', sub: 'Vault · through the flooded tunnel',
      target: 'breaker', action: 'Trip the interconnector', time: 3,
      onComplete: [
        { do: 'propStyle', prop: 'breaker', style: 'on' },
        { do: 'propStyle', prop: 'vaultEast', style: 'open' },
        { do: 'radio', who: 'Unknown · Halvard Security', text: 'Undercurrent is down. Seal the tunnel network. Nobody comes out.' },
        { do: 'checkpoint', name: 'Interconnector down' },
        { do: 'radio', who: MARA, text: 'Seventy-five seconds before the seals close. East door, then north to exit shaft four. Move!' },
      ],
    },
    {
      type: 'reach', name: '03 / Get out before the seals close', sub: 'Exit shaft 4 · north-east corner', target: 'exit', radius: 2.6,
      timeLimit: 75,
      onStart: [
        { do: 'spawn', alert: 'exit', feed: 'Linemen flooding the east tunnel', enemies: [
          { type: 'lineman', at: [31, -6] }, { type: 'lineman', at: [32, -9] }, ceiling(31, -26), ceiling(31.5, -31), ceiling(24, -31),
        ] },
      ],
      onTimeout: [
        { do: 'radio', who: MARA, text: 'The seals are closing. Kestrel, I\'ve lost you…' },
        { do: 'wait', time: 1.5 },
        { do: 'fail' },
      ],
      onComplete: [
        { do: 'radio', who: MARA, text: 'You\'re out. The interconnector is dead. Halvard just lost its biggest customer.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'flood-warning', objective: 1, when: { enter: [6, -.5, 5] }, do: [
      { do: 'radio', who: MARA, text: 'Water\'s slowing you and they can hear you splash. Throw smoke ahead if they\'re waiting.' },
    ] },
    { id: 'seals-30', objective: 2, when: { enter: [31, -18, 4] }, do: [
      { do: 'radio', who: MARA, text: 'Keep going north. Don\'t stop to fight.' },
    ] },
  ],
};
