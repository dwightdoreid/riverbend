// Mission 08 — Live Wire. Kelso Street Switching Station: re-route Port Calder North's feeder
// by operating four breakers in a safe order while live bus sections block the way.
// Introduces: the switching puzzle (interlocks, arc flash), live zones that hurt players and
// machines alike, the station mimic board.
const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch';

export default {
  id: 'm08',
  number: '08',
  codename: 'LIVE WIRE',
  title: 'Live Wire',
  level: 'kelso',
  environment: 'night',
  loadout: ['rifle', 'shotgun', 'pistol'],
  smokes: 1,

  switching: {
    breakers: {
      A: { panel: 'panelA', feeds: 'west' },
      B: { panel: 'panelB', feeds: 'east' },
      C: { panel: 'panelC', feeds: 'north' },
      D: { panel: 'panelD', feeds: 'south' },
    },
    zones: {
      west: { rect: [-32, -30, -18, 30] }, east: { rect: [18, -30, 32, 30] },
      north: { rect: [-18, -16, 18, -8] }, south: { rect: [-18, 8, 18, 16] },
    },
    interlocks: [
      { close: 'B', whileClosed: 'A', hint: 'Arc flash! A is still feeding the bus. Open A before you close B.' },
      { close: 'D', whileClosed: 'C', hint: 'Arc flash! C is still closed. Open C first, then D.' },
    ],
    goal: { A: false, B: true, D: true },
    dps: 30,
  },

  briefing: {
    eyebrow: 'Kelso Street / mission 08',
    title: 'LIVE<br><span>WIRE.</span>',
    lede: 'Halvard tangled Kelso Street on purpose. The north side stays dark until someone untangles it.',
    body: 'Feeder 7 powers Port Calder North: the trams, Fernhill\'s city clinic and forty thousand homes. Halvard has switched Kelso Street so the feeder can\'t be energized safely. Juno knows the station. Re-route it by hand: four breakers, two interlocks, and bus sections that go live as you switch them.',
    stages: [
      ['01 / ROUTE', 'Switch the station', 'Breakers A · B · C · D'],
      ['02 / SYNC', 'Hold the yard', 'While Feeder 7 syncs'],
      ['', 'Rules', 'Never close onto a live bus'],
    ],
    tip: 'New: lit-up bus sections (blue floor and arcs) are live and burn anyone inside, machines included. Interlocks: open A before closing B; open C before closing D. The mimic board by the gate shows every breaker. Lure machines into live sections.',
    deploy: 'Enter the yard',
  },
  intro: { text: 'Read the mimic board. Blue sections are live. Stay out of them.', time: 7 },
  success: {
    eyebrow: 'Mission complete / Feeder 7 live',
    title: 'NORTH SIDE<br><span>ONLINE.</span>',
    text: 'Forty thousand homes and the tram network have power. Halvard\'s story that LODESTAR is to blame for the blackouts just fell apart on every street in Port Calder North.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'ARC<br><span>FLASH.</span>', text: 'Plan the order on the mimic board first: which sections each breaker energizes, and which way you\'ll walk afterwards.' },

  spawns: [[-2, 29, 0], [2, 29, 0], [-4, 30.5, 0], [4, 30.5, 0]],

  props: [
    { id: 'panelA', type: 'panel', at: [-12, -24], style: 'on' },
    { id: 'panelB', type: 'panel', at: [12, -24] },
    { id: 'panelC', type: 'panel', at: [-23, 20], style: 'on' },
    { id: 'panelD', type: 'panel', at: [13, 22] },
    { id: 'mimic', type: 'mimic', at: [0, 23.5], yaw: Math.PI, title: 'KELSO ST · MIMIC', feeder: 'FEEDER 7' },
    { id: 'yard', type: 'marker', at: [0, 4] },
  ],

  pickups: [[4, 28, 'ammo'], [-30, -31, 'med'], [-4, -30, 'ammo'], [30, -31, 'med'], [-8, 5, 'ammo'], [8, -5, 'med'], [16, 30, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-12, 22], patrol: [-4, 19] },         // south-west quadrant, near the gate
    { type: 'sentry', at: [25, 20], patrol: [25, -20] },         // in the east lane (dead at start)
    { type: 'lineman', at: [0, 12], patrol: [-14, 12] },         // in the south strip: fried if it lingers once D closes
    { type: 'bulwark', at: [-10, 0], patrol: [10, 6] },
    { type: 'sentry', at: [-6, -24], patrol: [6, -24] },
    { type: 'spotter', at: [12, 4], patrol: [-12, 4] },
    { type: 'skimmer', at: [10, 24], patrol: [-10, 22] },
  ],

  onStart: [
    { do: 'radio', who: JUNO, text: 'Kestrel, look at the mimic board. A feeds the west lane and C the north strip. Both closed, both live.' },
    { do: 'radio', who: JUNO, text: 'We need B and D closed and A open. And never close a breaker onto a live bus: open A before B, open C before D.' },
  ],

  objectives: [
    {
      type: 'switching', name: '01 / Re-route Feeder 7', time: 1.4,
      onComplete: [
        { do: 'radio', who: JUNO, text: 'That\'s it, Feeder 7 is routed! It needs forty seconds to synchronise. Don\'t let them trip it.' },
        { do: 'checkpoint', name: 'Feeder routed' },
      ],
    },
    {
      type: 'survive', name: '02 / Hold the yard', sub: 'Feeder 7 synchronising', time: 40,
      onStart: [{ do: 'spawn', alert: 'yard', feed: 'Halvard is sending everything at Kelso Street', enemies: [
        { type: 'skimmer', at: [-30, -31] }, { type: 'skimmer', at: [30, -31] }, { type: 'sentry', at: [0, -31] }, { type: 'lineman', at: [-4, -31] },
      ] }],
      onComplete: [
        { do: 'radio', who: MARA, text: 'Feeder 7 is synchronised. Port Calder North has power.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'a-open', when: { breaker: ['A', false] }, do: [
      { do: 'radio', who: JUNO, text: 'A is open. The west lane is dead. C is down that way.' },
      { do: 'spawn', alert: 'panelA', feed: 'Skimmers over the north fence', enemies: [{ type: 'skimmer', at: [-10, -31] }, { type: 'skimmer', at: [-6, -31] }] },
    ] },
    { id: 'c-open', when: { breaker: ['C', false] }, do: [
      { do: 'radio', who: JUNO, text: 'C is open. The north strip is dead, so you can cross the middle now.' },
      { do: 'spawn', alert: 'panelC', feed: 'Sentries at the west gate', enemies: [{ type: 'sentry', at: [-31, 31] }, { type: 'lineman', at: [-29, 31] }] },
    ] },
    { id: 'b-closed', when: { breaker: ['B', true] }, do: [
      { do: 'radio', who: JUNO, text: 'B is closed. East lane is live now; don\'t go back that way.' },
      { do: 'spawn', alert: 'panelB', feed: 'Bulwark at the east gate', enemies: [{ type: 'bulwark', at: [31, 31] }, { type: 'skimmer', at: [31, -31] }] },
    ] },
  ],
};
