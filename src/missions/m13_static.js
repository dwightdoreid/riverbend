// Mission 13 — Static. Halvard answers the broadcast with an EMP over the relay ridge. Kestrel's
// gear is fried and scattered, and the HUD is down.
// Introduces: EMP HUD mode (no minimap, marker or compass; stereo objective pings), beacon light
// columns as landmarks, the Arc lobber (area-denial electric shells), EMP grenades (X).
const MARA = 'Mara · Ops (static)', HALVARD = 'Unknown · Halvard Security';
const lob = (x, z, patrol) => ({ type: 'lobber', at: [x, z], patrol: patrol ?? [x, z] });

export default {
  id: 'm13',
  number: '13',
  codename: 'STATIC',
  title: 'Static',
  level: 'ridge',
  environment: 'night',
  empHud: true,
  weather: { lightning: { every: [9, 15], radius: 4.5, damage: 50 }, rain: true },
  loadout: ['arc', 'shotgun', 'pistol'],
  emps: 2,
  smokes: 1,

  briefing: {
    eyebrow: 'Relay ridge / mission 13',
    title: 'STAT<span>IC.</span>',
    lede: 'The broadcast went out. Halvard\'s answer came down as an EMP.',
    body: 'A Halvard pulse weapon hit the ridge seconds after the uplink finished. Your HUD is fried, your kit is scattered across the ridge, and the only thing still transmitting is the old radar dome\'s hardened emergency set. Recover your three kit cases, get the dome to call extraction, and hold the landing zone.',
    stages: [
      ['01 / RECOVER', 'Three kit cases', 'Follow the beacon beams'],
      ['02 / CALL', 'Radar dome transmitter', 'EMP-hardened'],
      ['03 / HOLD', 'The landing zone', 'Until the lift arrives'],
    ],
    tip: 'No minimap, marker or compass: follow the blue light columns and the pings. They come from the objective\'s direction and speed up as you get closer. New: Arc lobbers drop electric fields; don\'t stand in the blue. EMP grenades (X) stun every machine around the blast.',
    deploy: 'Get up',
  },
  intro: { text: 'HUD offline. Follow the blue beams and the pings.', time: 7 },
  success: {
    eyebrow: 'Mission complete / extracted',
    title: 'SIGNAL<br><span>RESTORED.</span>',
    text: 'The lift got you off the ridge with your kit. And the dome\'s emergency set picked up something else on the way out: a Halvard order log, with a single word on every line. Blackbox.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'LOST IN<br><span>THE STATIC.</span>', text: 'Use the beams as landmarks, listen for the pings, and keep out of the lobbers\' blue fields.' },

  spawns: [[0, 14, 0], [2, 14, 0], [-2, 14, 0], [4, 14, 0]],

  props: [
    { id: 'kitA', type: 'drive', at: [-46, 8] }, { id: 'beamA', type: 'beacon', at: [-46, 8] },
    { id: 'kitB', type: 'drive', at: [5, -11] }, { id: 'beamB', type: 'beacon', at: [5, -11] },
    { id: 'kitC', type: 'drive', at: [46, 10] }, { id: 'beamC', type: 'beacon', at: [46, 10] },
    { id: 'transmitter', type: 'panel', at: [20, 3.4], facing: -1 }, { id: 'beamDome', type: 'beacon', at: [20, 3.4], style: 'off', color: 0xf3ba65 },
    { id: 'lz', type: 'marker', at: [-20, 2] }, { id: 'beamLZ', type: 'beacon', at: [-20, 2], style: 'off', color: 0x5ce08a },
  ],

  pickups: [[-40, 2, 'ammo'], [-50, -6, 'med'], [2, -10, 'ammo'], [14, -8, 'med'], [40, 2, 'ammo'], [50, 4, 'med'], [-24, 8, 'ammo'], [-16, -4, 'med']],
  reinforcements: [[-56, -20], [56, -20], [0, -24]],

  enemies: [
    lob(-30, -18, [-48, -18]),
    lob(30, -18, [48, -18]),
    { type: 'sentry', at: [-20, -6], patrol: [-38, -6] },
    { type: 'sentry', at: [26, 6], patrol: [40, 6] },
    { type: 'lineman', at: [6, -20], patrol: [-6, -20] },
    { type: 'tallyman', at: [0, 22], patrol: [20, 22] },
    { type: 'tallyman', at: [2, 23], patrol: [22, 23] },
  ],

  onStart: [
    { do: 'radio', who: MARA, text: 'Kestrel… do you… your HUD is gone. Your kit cases… beacon beams, blue… follow them.' },
  ],

  objectives: [
    {
      type: 'collect', name: '01 / Recover your kit', sub: 'Follow the blue beams',
      targets: ['kitA', 'kitB', 'kitC'], action: 'Recover kit case', time: 1.4,
      onEach: [{ do: 'feed', text: 'Kit case {n}/{total} recovered' }],
      onTarget: {
        kitA: [{ do: 'propStyle', prop: 'beamA', style: 'off' }],
        kitB: [{ do: 'propStyle', prop: 'beamB', style: 'off' }],
        kitC: [{ do: 'propStyle', prop: 'beamC', style: 'off' }],
      },
      onComplete: [
        { do: 'propStyle', prop: 'beamDome', style: 'on' },
        { do: 'checkpoint', name: 'Kit recovered' },
        { do: 'radio', who: MARA, text: '…the dome. Its emergency set is hardened. Amber beam. Get it to call a lift.' },
      ],
    },
    {
      name: '02 / Call extraction', sub: 'Radar dome emergency transmitter',
      target: 'transmitter', action: 'Key the emergency transmitter', time: 2.5,
      onComplete: [
        { do: 'propStyle', prop: 'transmitter', style: 'on' }, { do: 'propStyle', prop: 'beamDome', style: 'off' }, { do: 'propStyle', prop: 'beamLZ', style: 'on' },
        { do: 'radio', who: MARA, text: 'Heard you! Lift inbound. Forty seconds. Landing zone by the crashed dropship, green beam.' },
        { do: 'radio', who: HALVARD, text: 'Emergency transmission from the ridge. Tallymen, lobbers, everything you have. Nobody leaves.' },
        { do: 'checkpoint', name: 'Lift called' },
      ],
    },
    {
      type: 'hold', name: '03 / Hold the landing zone', sub: 'Lift inbound', target: 'lz', radius: 9, time: 40,
      holdText: 'Holding the LZ · stay near the green beam',
      onStart: [{ do: 'spawn', alert: 'lz', feed: 'Lobbers on the north slope', enemies: [lob(-40, -24), lob(0, -24), { type: 'skimmer', at: [-30, -24] }, { type: 'skimmer', at: [-26, -24] }] }],
      onComplete: [
        { do: 'radio', who: MARA, text: 'Lift\'s down! Get aboard!' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'tally-squad', when: { hold: 14 }, do: [
      { do: 'spawn', alert: 'lz', feed: 'Tallymen climbing from the south', enemies: [{ type: 'tallyman', at: [-40, 24] }, { type: 'tallyman', at: [-30, 25] }, { type: 'tallyman', at: [-20, 25] }] },
    ] },
    { id: 'last', when: { hold: 28 }, do: [
      { do: 'spawn', alert: 'lz', feed: 'Bulwark and lobber from the west', enemies: [{ type: 'bulwark', at: [-56, 0] }, lob(-56, 8), { type: 'lineman', at: [-56, -8] }] },
      { do: 'radio', who: MARA, text: 'Ten seconds!' },
    ] },
  ],
};
