// Mission 11 — Gale Line. Act III opens on the northern moor in a storm.
// Introduces: weather (gusting wind that pushes grenades, smoke and players; lightning strikes
// with warning rings; rain), the ARC-3 carbine (stun + chain), spinning turbine props.
import { PADS } from '../levels/galeline.js';
const MARA = 'Mara · Ops', HALVARD = 'Unknown · Halvard Security';
const turbine = (id, pad, style) => ({ id, type: 'turbine', at: PADS[pad], yaw: .3, style });

export default {
  id: 'm11',
  number: '11',
  codename: 'GALE LINE',
  title: 'Gale Line',
  level: 'galeline',
  environment: 'storm',
  loadout: ['arc', 'rifle', 'pistol'],
  smokes: 1,
  weather: {
    wind: { dir: .3, base: 6, gust: 10 },
    lightning: { every: [7, 12], radius: 4.5, damage: 55, tall: Object.values(PADS) },
    rain: true,
  },

  briefing: {
    eyebrow: 'Northern moor / mission 11',
    title: 'GALE<br><span>LINE.</span>',
    lede: 'LODESTAR has islanded the north. The only power left up here is the wind.',
    body: 'Everything north of Calder runs on Halvard\'s private grid now: the towns, the relay ridge, and whatever Halvard is hiding up there. The Gale Line wind farm could power our forward base, but LODESTAR has braked every turbine. Release three lead turbines, close the collector, and hold it while the line comes up. In this storm.',
    stages: [
      ['01 / RELEASE', 'Three lead turbines', 'Pads 1 · 3 · 6'],
      ['02 / CONNECT', 'Close the collector', 'Substation, centre'],
      ['03 / HOLD', 'While the line energizes', 'Expect Halvard'],
    ],
    tip: 'New: the ARC-3 carbine (key 1) stuns machines and chains to two more nearby, so fire into groups. Wind gusts push grenades and smoke and lean on you; the readout top-right shows direction. Lightning hits near tall turbines and anyone standing still: move when a ring appears.',
    deploy: 'Into the storm',
  },
  intro: { text: 'Watch for lightning rings. ARC carbine stuns and chains.', time: 6 },
  success: {
    eyebrow: 'Mission complete / Gale Line live',
    title: 'THE WIND<br><span>IS OURS.</span>',
    text: 'The forward base has power and the northern towns have lights. Halvard\'s Tallymen fought LODESTAR\'s machines for this farm, and lost both.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'STRUCK<br><span>DOWN.</span>', text: 'Keep moving in the open, use the walls for cover, and arc groups of machines before they spread out.' },

  spawns: [[0, 44, 0], [2, 44, 0], [-2, 44, 0], [4, 44, 0]],

  props: [
    turbine('tA', 't1'), turbine('tT2', 't2'), turbine('tB', 't3'), turbine('tT4', 't4'), turbine('tT5', 't5'), turbine('tC', 't6'),
    { id: 'collector', type: 'panel', at: [1.2, 2.6], facing: 1 },
  ],

  pickups: [[4, 40, 'ammo'], [-26, -24, 'med'], [-2, -30, 'ammo'], [28, -22, 'med'], [-8, 34, 'med'], [12, 8, 'ammo'], [-12, 8, 'med'], [36, 10, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-14, 30], patrol: [-28, 18] },
    { type: 'skimmer', at: [-26, -16], patrol: [-34, -30] },
    { type: 'skimmer', at: [-24, -18], patrol: [-32, -32] },
    { type: 'sentry', at: [16, -24], patrol: [30, -20] },
    { type: 'bulwark', at: [-6, 6], patrol: [8, 12] },
    { type: 'sentry', at: [36, 4], patrol: [36, 24] },
    { type: 'lineman', at: [6, -32], patrol: [-6, -36] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'Kestrel, the farm\'s braked solid. Lead turbines are pads one, three and six. Release their rotor brakes at the base cabinets.' },
    { do: 'radio', who: MARA, text: 'And stay off the skyline in this. That lightning is hitting anything that stands still.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Release the lead turbines', sub: 'Base cabinets at pads 1, 3 and 6',
      targets: ['tA', 'tB', 'tC'], action: 'Release the rotor brake', time: 2.5, collectStyle: 'running', reach: 2.8,
      onEach: [{ do: 'feed', text: 'Turbine {n}/{total} spinning up' }],
      onTarget: {
        tA: [{ do: 'spawn', alert: 'tA', feed: 'Skimmers riding the wind', enemies: [{ type: 'skimmer', at: [-46, -40] }, { type: 'skimmer', at: [-44, -44] }] }],
        tB: [{ do: 'spawn', alert: 'tB', feed: 'Linemen from the north fence', enemies: [{ type: 'lineman', at: [40, -46] }, { type: 'lineman', at: [44, -44] }] }],
        tC: [{ do: 'spawn', alert: 'tC', feed: 'Sentries over the wall', enemies: [{ type: 'sentry', at: [-30, 46] }, { type: 'sentry', at: [16, 46] }] }],
      },
      onComplete: [
        { do: 'propStyle', prop: 'tT2', style: 'running' }, { do: 'propStyle', prop: 'tT4', style: 'running' }, { do: 'propStyle', prop: 'tT5', style: 'running' },
        { do: 'checkpoint', name: 'Turbines spinning' },
        { do: 'radio', who: MARA, text: 'The whole string is turning! Now close the collector breaker at the substation.' },
      ],
    },
    {
      name: '02 / Close the collector', sub: 'Substation control building',
      target: 'collector', action: 'Close collector breaker', time: 2,
      onComplete: [
        { do: 'propStyle', prop: 'collector', style: 'on' },
        { do: 'radio', who: HALVARD, text: 'Gale Line is coming up on our grid. That farm is Halvard property. Tallymen, retake it.' },
        { do: 'checkpoint', name: 'Collector closed' },
      ],
    },
    {
      type: 'survive', name: '03 / Hold the collector', sub: 'Line energizing', time: 45,
      onStart: [{ do: 'spawn', alert: 'collector', feed: 'Tallymen inbound from the north', enemies: [
        { type: 'tallyman', at: [-6, -46] }, { type: 'tallyman', at: [0, -46] }, { type: 'tallyman', at: [6, -46] },
      ] }],
      onComplete: [
        { do: 'radio', who: MARA, text: 'Line\'s up. The forward base has power. Get under cover. That storm\'s getting worse.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'lodestar-push', objective: 2, when: { hold: 15 }, do: [
      { do: 'spawn', alert: 'collector', feed: 'LODESTAR machines from the west, straight into the Tallymen', enemies: [{ type: 'sentry', at: [-46, 0] }, { type: 'sentry', at: [-46, 6] }, { type: 'skimmer', at: [-46, -6] }] },
    ] },
    { id: 'tally-flank', objective: 2, when: { hold: 30 }, do: [
      { do: 'spawn', alert: 'collector', feed: 'Tallymen flanking east', enemies: [{ type: 'tallyman', at: [46, -4] }, { type: 'tallyman', at: [46, 6] }] },
    ] },
  ],
};
