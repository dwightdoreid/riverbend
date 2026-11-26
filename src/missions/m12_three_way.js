// Mission 12 — Three-Way. Hold three relay masts along the ridge to push Juno's evidence across
// the islanded north, while LODESTAR's machines and Halvard's Tallymen both come for them.
// Introduces: the uplink objective (progress scales with how many relays are online), relays
// knocked offline instead of destroyed (hold E to reboot), multi-target raiders.
import { PADS } from '../levels/ridge.js';
const MARA = 'Mara · Ops', JUNO = 'Juno · Halvard dispatch', HALVARD = 'Unknown · Halvard Security';
const RELAYS = ['relayW', 'relayC', 'relayE'];
const relay = (id, pad, label) => ({ id, type: 'relay', at: PADS[pad], hp: 650, label, downStyle: 'offline', upStyle: 'online', repairable: true,
  onDestroyed: [{ do: 'feed', text: label + ' knocked offline. Reboot it!' }] });
const raid = (type, x, z) => ({ type, at: [x, z], harass: RELAYS });

export default {
  id: 'm12',
  number: '12',
  codename: 'THREE-WAY',
  title: 'Three-Way',
  level: 'ridge',
  environment: 'day',
  loadout: ['rifle', 'dmr', 'arc'],
  turrets: 2,   // one relay always depends on you

  briefing: {
    eyebrow: 'Relay ridge / mission 12',
    title: 'THREE<span>-WAY.</span>',
    lede: 'Three relays, one ridge, and two armies that want them dark.',
    body: 'Juno\'s evidence has to reach the valley, and the north is islanded. The old relay ridge can carry it if all three masts transmit together. Power them up and hold the uplink. LODESTAR\'s machines and Halvard\'s Tallymen will both try to knock the masts offline, and each other.',
    stages: [
      ['01 / POWER', 'Three relay masts', 'West · centre · east'],
      ['02 / UPLINK', 'Keep them transmitting', 'Faster with all three up'],
      ['', 'Knocked offline?', 'Hold E at its cabinet to reboot'],
    ],
    tip: 'The uplink only runs at full speed with all three relays online; with one it crawls. Solo, turret (T) two relays and hold the third yourself, running to whichever is in trouble. In co-op, split up. Hold E next to a damaged relay to patch it, or a dead one to reboot it.',
    deploy: 'Take the ridge',
  },
  intro: { text: 'Two turrets (T): cover two relays, hold the third yourself.', time: 6 },
  success: {
    eyebrow: 'Mission complete / evidence broadcast',
    title: 'THE NORTH<br><span>KNOWS.</span>',
    text: 'Juno\'s files are on every screen from the ridge to Port Calder. Halvard\'s board has gone silent. Its machines haven\'t.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'SIGNAL<br><span>LOST.</span>', text: 'Turrets at every relay, patch damage between waves, and let the Tallymen and LODESTAR\'s machines grind each other down.' },

  spawns: [[0, 14, 0], [2, 14, 0], [-2, 14, 0], [4, 14, 0]],

  props: [relay('relayW', 'west', 'West relay'), relay('relayC', 'centre', 'Centre relay'), relay('relayE', 'east', 'East relay'), { id: 'ridge', type: 'marker', at: [0, 0] }],

  pickups: [[-36, 6, 'ammo'], [-44, 6, 'med'], [4, 9, 'ammo'], [-4, 9, 'med'], [36, 6, 'ammo'], [44, 6, 'med'], [-20, 4, 'ammo'], [20, -4, 'med']],
  reinforcements: [[-56, -20], [56, -20], [-56, 20], [56, 20], [0, -24]],

  enemies: [
    { type: 'sentry', at: [-30, -16], patrol: [-50, -16] },
    { type: 'sentry', at: [30, -16], patrol: [50, -16] },
    { type: 'skimmer', at: [0, -20], patrol: [-20, -20] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'Three masts along the ridge, west, centre and east. Power each one at its base cabinet.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Power the relays', sub: 'Base cabinets',
      targets: RELAYS, action: 'Power the relay', time: 1.8, collectStyle: 'online',
      onEach: [{ do: 'feed', text: 'Relay {n}/{total} transmitting' }],
      onComplete: [
        { do: 'checkpoint', name: 'Relays online' },
        { do: 'radio', who: JUNO, text: 'Uplink handshake… it\'s working! Keep all three up, and it\'ll go out in about ninety seconds.' },
      ],
    },
    {
      type: 'uplink', name: '02 / Hold the uplink', targets: RELAYS, time: 90,
      onStart: [
        { do: 'spawn', alert: 'ridge', feed: 'LODESTAR machines climbing the north slope', enemies: [raid('sentry', -50, -24), raid('skimmer', -44, -24), raid('sentry', 50, -24), raid('skimmer', 44, -24)] },
      ],
      onComplete: [
        { do: 'radio', who: JUNO, text: 'Transmitted. All of it. Every screen in the valley.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'early', when: { hold: 6 }, do: [
      { do: 'spawn', alert: 'ridge', feed: 'Skimmers on the centre relay', enemies: [raid('skimmer', 0, -25), raid('skimmer', 3, -25), raid('sentry', -3, -25)] },
    ] },
    { id: 'tallymen', when: { hold: 15 }, do: [
      { do: 'radio', who: HALVARD, text: 'Tallymen: cut the ridge relays. Kill the uplink, whatever it costs.' },
      { do: 'spawn', alert: 'ridge', feed: 'Tallymen from the south slope', enemies: [raid('tallyman', -20, 24), raid('tallyman', 20, 24), raid('tallyman', 0, 25), raid('tallyman', -40, 24)] },
    ] },
    { id: 'bulwark-east', when: { hold: 35 }, do: [
      { do: 'spawn', alert: 'ridge', feed: 'Bulwark pushing the east relay', enemies: [raid('bulwark', 56, -6), raid('skimmer', 56, 6), raid('skimmer', 54, 8), raid('sentry', 56, 0), raid('sentry', -56, 0)] },
    ] },
    { id: 'spotter', when: { hold: 50 }, do: [
      { do: 'spawn', alert: 'ridge', feed: 'Spotter over the ridge', enemies: [{ type: 'spotter', at: [-56, 0] }, raid('lineman', -56, -10), raid('lineman', -56, 10)] },
      { do: 'radio', who: MARA, text: 'Spotter on the west end. It\'ll call in everything. Drop it.' },
    ] },
    { id: 'last-push', when: { hold: 70 }, do: [
      { do: 'spawn', alert: 'ridge', feed: 'Last push: both sides', enemies: [raid('tallyman', 56, 20), raid('tallyman', -56, 20), raid('tallyman', 0, 25), raid('sentry', 0, -25), raid('sentry', 6, -25), raid('bulwark', -56, -10)] },
      { do: 'radio', who: JUNO, text: 'Eighty percent… don\'t let a mast drop now!' },
    ] },
  ],
};
