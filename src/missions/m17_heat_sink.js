// Mission 17 — Heat Sink. Down through LODESTAR's cooling caverns to the core access hatch.
// Halvard has throttled the chilled-water loop to cook the core; the hot gallery to the pump
// hall is unsurvivable until the bypass valves at both ends of the exchanger hall are opened.
// Introduces: heat hazards (cycling steam vents, a superheated gallery), Repair drones.
import { HOT_GALLERY } from '../levels/caverns.js';

const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch', OKAFOR = 'Okafor · Plant';
const vent = (id, x, z, phase, period = 6) => ({ id, type: 'vent', at: [x, z], phase, period, r: 2.8 });

export default {
  id: 'm17',
  number: '17',
  codename: 'HEAT SINK',
  title: 'Heat Sink',
  level: 'caverns',
  environment: 'underground',
  loadout: ['rifle', 'arc', 'shotgun'],
  smokes: 1,
  emps: 1,

  briefing: {
    eyebrow: 'LODESTAR cooling caverns / mission 17',
    title: 'HEAT<br><span>SINK.</span>',
    lede: 'Halvard is cooking LODESTAR slowly. The only way in is through the oven.',
    body: 'The cooling caverns run under the datacenter to the core access hatch. Halvard has throttled the chilled-water loop to cook the core ahead of the overload, so the hot gallery to the pump hall is superheated. Open the bypass valves at both ends of the exchanger hall to cool it, cross, and break through. LODESTAR\'s machines down here have Repair drones keeping them alive.',
    stages: [
      ['01 / VALVES', 'Two bypass valves', 'West and east ends of the exchanger hall'],
      ['02 / GALLERY', 'Cross to the pump hall', 'Once the heat drops'],
      ['03 / HATCH', 'Break the guardian', 'Open the core access hatch'],
    ],
    tip: 'New: steam vents cycle. Watch for the hiss and the glowing grate, then cross. Machines caught in the steam get cooked too. Repair drones (white, green cross) heal other machines, so kill them first. The ARC chains into them.',
    deploy: 'Go down',
  },
  intro: { text: 'Time the steam vents. Shoot Repair drones first.', time: 6 },
  success: {
    eyebrow: 'Mission complete / core access open',
    title: 'COOLER<br><span>HEADS.</span>',
    text: 'The chilled water is flowing again and the core access hatch is open. Past it are the datacenter halls, and Juno has found something there: LODESTAR has started copying itself.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'BOILED<br><span>DRY.</span>', text: 'Wait for the vents to finish blasting before you cross, and drop the Repair drones before you fight what they\'re fixing.' },

  spawns: [[0, 42, 0], [-2, 42, 0], [2, 42, 0], [0, 40.5, 0]],

  props: [
    vent('ventW1', -15, 12, 0), vent('ventW2', -15, 3, 3),
    vent('ventE1', 15, 12, 1.5), vent('ventE2', 15, 3, 4.5),
    vent('ventH1', -8, -9, 2, 7), vent('ventH2', 8, -9, 5.5, 7),
    { id: 'valveW', type: 'valve', at: [-28.6, -12], facing: 1, label: 'West valve' },
    { id: 'valveE', type: 'valve', at: [28.6, -12], facing: 1, label: 'East valve' },
    { id: 'gallery', type: 'heatZone', rect: HOT_GALLERY, valves: ['valveW', 'valveE'], dps: 34 },
    { id: 'pumpHall', type: 'marker', at: [0, -36] },
    { id: 'hatch', type: 'panel', at: [3.6, -46.6], facing: 1 },
    { id: 'intake', type: 'marker', at: [0, 28] },
  ],

  pickups: [[-14, 34, 'ammo'], [14, 23, 'med'], [-24, -6, 'ammo'], [24, -6, 'med'], [-1, -7, 'ammo'], [-15, -36, 'med'], [15, -36, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-8, 26], patrol: [8, 26] },
    { type: 'mender', at: [0, 24], patrol: [0, 30] },
    { type: 'lineman', at: [-15, 6], ceiling: true },
    { type: 'sentry', at: [15, 0], patrol: [15, 16] },
    { type: 'bulwark', at: [-6, -9], patrol: [6, -9] },
    { type: 'mender', at: [0, -11], patrol: [0, -6] },
    { type: 'skimmer', at: [-22, -6], patrol: [22, -6] },
  ],

  onStart: [
    { do: 'radio', who: OKAFOR, text: 'Chilled-water loop is throttled to a trickle. The gallery to the pump hall will be over two hundred degrees. Open both bypass valves in the exchanger hall.' },
    { do: 'radio', who: MARA, text: 'The vent tunnels blast steam on a cycle. Listen for the hiss.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Open the bypass valves', sub: 'West and east ends of the exchanger hall',
      targets: ['valveW', 'valveE'], action: 'Open the bypass valve', time: 2.5, collectStyle: 'open',
      onEach: [{ do: 'feed', text: 'Bypass valve {n}/{total} open · gallery cooling' }],
      onTarget: {
        valveW: [{ do: 'spawn', alert: 'valveW', feed: 'Machines and a Repair drone from the gallery', enemies: [{ type: 'sentry', at: [0, -18] }, { type: 'sentry', at: [1, -20] }, { type: 'mender', at: [0, -22] }] }],
        valveE: [{ do: 'spawn', alert: 'valveE', feed: 'Skimmers down the east tunnel', enemies: [{ type: 'skimmer', at: [15, 18] }, { type: 'skimmer', at: [15, 16] }] }],
      },
      onComplete: [
        { do: 'checkpoint', name: 'Gallery cooled' },
        { do: 'radio', who: OKAFOR, text: 'Flow\'s back. The gallery is cooling. Go, before Halvard throttles it again.' },
      ],
    },
    {
      type: 'reach', name: '02 / Cross the gallery', sub: 'To the pump hall', target: 'pumpHall', radius: 4,
      onComplete: [
        { do: 'radio', who: JUNO, text: 'Big contact in the pump hall: a Hauler with drones tending it. That\'s LODESTAR\'s door guard.' },
        { do: 'spawn', alert: 'pumpHall', feed: 'The coolant guardian wakes', enemies: [
          { type: 'hauler', at: [0, -45], tag: 'guardian' }, { type: 'mender', at: [-4, -46] }, { type: 'mender', at: [4, -46] },
          { type: 'sentry', at: [-14, -46] }, { type: 'sentry', at: [14, -46] },
        ] },
        { do: 'checkpoint', name: 'Pump hall' },
      ],
    },
    {
      type: 'kill', tag: 'guardian', name: '03 / Destroy the guardian', sub: 'Repair drones keep it alive: drop them first',
      onComplete: [{ do: 'radio', who: MARA, text: 'Guardian\'s down. Open the hatch.' }],
    },
    {
      name: '04 / Open the core access hatch', sub: 'North wall of the pump hall', target: 'hatch', action: 'Override the hatch lock', time: 3,
      onComplete: [
        { do: 'propStyle', prop: 'hatch', style: 'on' },
        { do: 'radio', who: JUNO, text: 'Hatch is open. And LODESTAR knows we\'re here. It\'s started copying itself across the halls.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'guard-wave', objective: 2, when: { enemyHp: ['guardian', .5] }, do: [
      { do: 'spawn', alert: 'pumpHall', feed: 'More Repair drones from the shaft', enemies: [{ type: 'mender', at: [-16, -46] }, { type: 'mender', at: [16, -46] }, { type: 'skimmer', at: [0, -20] }] },
    ] },
  ],
};
