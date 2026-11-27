// Mission 16 — Cold Start. Act IV opens: to power the assault on LODESTAR, bring a mothballed peaker
// plant back from dead cold. A real blackstart sequence: crank the black-start diesel, close the
// auxiliary breaker and pressurise the fuel gas, ignite Unit 2 and bring it to speed, then close
// the generator breaker. Each running system is a target; stalled ones must be restarted.
// Introduces: the LR-40 launcher (impact HE rounds, armed past 4 m), staged multi-system uplinks.
const MARA = 'Mara · Ops', OKAFOR = 'Okafor · Plant', JUNO = 'Juno · Halvard dispatch';
const raid = (type, x, z, harass) => ({ type, at: [x, z], harass });
const machine = (id, type, x, z, label, hp, yaw) => ({ id, type, at: [x, z], yaw, label, hp, downStyle: 'tripped', upStyle: 'running', repairable: true, style: 'cold' });

export default {
  id: 'm16',
  number: '16',
  codename: 'COLD START',
  title: 'Cold Start',
  level: 'peaker',
  environment: 'dusk',
  loadout: ['launcher', 'rifle', 'shotgun'],
  smokes: 1,
  emps: 1,
  turrets: 1,

  briefing: {
    eyebrow: 'Harrow Point / mission 16',
    title: 'COLD<br><span>START.</span>',
    lede: 'No grid, no fuel pressure, no spinning iron. Just a diesel and a sequence.',
    body: 'LODESTAR has a week until Halvard burns it. To get there, the forward base needs real power, and Harrow Point peaker plant has been cold for two years. Okafor knows the blackstart sequence: diesel first, then fuel gas, then Unit 2, then sync. Every machine that starts up makes noise, and LODESTAR\'s machines will come to shut each one down.',
    stages: [
      ['01 / DIESEL', 'Crank the black-start diesel', 'Bring it to speed'],
      ['02 / FUEL GAS', 'Aux breaker, compressor', 'Build pressure'],
      ['03 / UNIT 2', 'Ignite the turbine', 'Then close the generator breaker'],
    ],
    tip: 'New: the LR-40 launcher (key 1). Its HE rounds burst on impact and wreck Haulers from any side, but they need 4 m of flight to arm. A machine that trips stalls the sequence: hold E at it to restart, or next to it to patch damage.',
    deploy: 'Start the diesel',
  },
  intro: { text: 'LR-40: HE rounds arm after 4 m. Restart anything that trips (hold E).', time: 7 },
  success: {
    eyebrow: 'Mission complete / Unit 2 synchronised',
    title: 'WARM<br><span>IRON.</span>',
    text: 'Unit 2 is on the bus and forty megawatts are flowing to the forward base. Juno has traced LODESTAR\'s cooling plant to the caverns under the datacenter: the way in is down.',
  },
  failure: { eyebrow: 'Mission incomplete / retry available', title: 'STILL<br><span>COLD.</span>', text: 'Turret the machine you can\'t stand next to, save launcher rounds for Haulers, and restart anything that trips straight away.' },

  spawns: [[0, 31, 0], [-2, 31, 0], [2, 31, 0], [0, 33, 0]],

  props: [
    machine('diesel', 'generator', -30, 20, 'Diesel', 520, 0),
    { id: 'auxBkr', type: 'panel', at: [-16, 23.6], facing: 1 },
    machine('compressor', 'generator', 28, 20, 'Compressor', 800, 0),
    machine('unit2', 'gasTurbine', 0, -12, 'Unit 2', 1400),
    { id: 'genBkr', type: 'panel', at: [6, -24], facing: 1 },
    { id: 'site', type: 'marker', at: [0, 10] },
    { id: 'north', type: 'marker', at: [0, -32] },
  ],

  pickups: [[-4, 28, 'ammo'], [-26, 26, 'ammo'], [-20, 14, 'med'], [24, 26, 'ammo'], [20, 12, 'med'], [-8, 2, 'ammo'], [8, 2, 'med'], [10, -20, 'ammo'], [-30, -2, 'med'], [32, -2, 'ammo']],

  enemies: [
    { type: 'sentry', at: [-20, 8], patrol: [-34, 2] },
    { type: 'sentry', at: [18, 8], patrol: [36, 2] },
    { type: 'bulwark', at: [0, 2], patrol: [0, -4] },
    { type: 'skimmer', at: [-10, -26], patrol: [10, -26] },
    { type: 'hauler', at: [-12, -30], patrol: [12, -30] },
  ],

  onStart: [
    { do: 'radio', who: OKAFOR, text: 'Blackstart, by the book. Diesel first: the shed in the south-west. She\'s been cold two years, so give her time to come up to speed.' },
    { do: 'radio', who: MARA, text: 'There\'s a Hauler patrolling the switchyard. That\'s what the launcher is for.' },
  ],

  objectives: [
    {
      name: '01 / Crank the black-start diesel', sub: 'Diesel shed · south-west',
      target: 'diesel', action: 'Crank the diesel', time: 3,
      onComplete: [{ do: 'propStyle', prop: 'diesel', style: 'running' }, { do: 'radio', who: OKAFOR, text: 'She caught! Keep them off her while she comes up to speed.' }],
    },
    {
      type: 'uplink', gauge: 'Diesel speed', name: '02 / Diesel to rated speed', targets: ['diesel'], onlineStyle: 'running', time: 25, guard: ['diesel'],
      onStart: [{ do: 'spawn', alert: 'diesel', feed: 'Machines homing in on the diesel', enemies: [raid('skimmer', -44, 4, 'diesel'), raid('skimmer', -44, 0, 'diesel'), raid('sentry', -44, -4, 'diesel')] }],
      onComplete: [{ do: 'checkpoint', name: 'Diesel at speed' }, { do: 'radio', who: OKAFOR, text: 'Diesel\'s at speed. Close the auxiliary breaker at the kiosk next door. That powers the compressor.' }],
    },
    {
      name: '03 / Close the auxiliary breaker', sub: 'Switchgear kiosk', target: 'auxBkr', action: 'Close the aux breaker', time: 1.5,
      onComplete: [{ do: 'propStyle', prop: 'auxBkr', style: 'on' }, { do: 'radio', who: OKAFOR, text: 'Aux bus is live. Now the fuel gas compressor, across on the east side.' }],
    },
    {
      name: '04 / Start the fuel gas compressor', sub: 'Compressor skid · south-east', target: 'compressor', action: 'Start the compressor', time: 2.5,
      onComplete: [{ do: 'propStyle', prop: 'compressor', style: 'running' }],
    },
    {
      type: 'uplink', gauge: 'Fuel gas pressure', name: '05 / Build fuel gas pressure', targets: ['diesel', 'compressor'], onlineStyle: 'running', time: 40, guard: ['diesel', 'compressor'],
      onStart: [
        { do: 'radio', who: OKAFOR, text: 'Pressure needs the diesel and the compressor both running. If one trips, it crawls.' },
        { do: 'spawn', alert: 'site', feed: 'A Bulwark and Skimmers on the compressor', enemies: [raid('bulwark', 44, 4, ['compressor', 'diesel']), raid('skimmer', 44, 0, ['compressor', 'diesel']), raid('skimmer', 44, -4, ['compressor', 'diesel'])] },
      ],
      onComplete: [
        { do: 'checkpoint', name: 'Fuel gas up' },
        { do: 'radio', who: OKAFOR, text: 'Pressure\'s good. Ignite Unit 2: the control cab on its east side.' },
      ],
    },
    {
      name: '06 / Ignite Unit 2', sub: 'Unit 2 control cab', target: 'unit2', action: 'Purge and ignite Unit 2', time: 3,
      onComplete: [{ do: 'propStyle', prop: 'unit2', style: 'running' }, { do: 'radio', who: OKAFOR, text: 'Light-off! She\'ll take a minute to reach sync speed. Keep the compressor fed and the turbine in one piece.' }],
    },
    {
      type: 'uplink', gauge: 'Turbine speed', name: '07 / Bring Unit 2 to speed', targets: ['compressor', 'unit2'], onlineStyle: 'running', time: 50, guard: ['compressor', 'unit2'],
      onStart: [{ do: 'spawn', alert: 'north', feed: 'A Hauler from the switchyard', enemies: [raid('hauler', -8, -34, ['unit2', 'compressor']), raid('sentry', 8, -34, ['unit2', 'compressor']), raid('sentry', 0, -34, ['unit2', 'compressor'])] }],
      onComplete: [
        { do: 'checkpoint', name: 'Unit 2 at speed' },
        { do: 'radio', who: OKAFOR, text: 'Sync speed. Close the generator breaker by the transformer and we\'re on the bus!' },
      ],
    },
    {
      name: '08 / Close the generator breaker', sub: 'Switchyard · by the transformer', target: 'genBkr', action: 'Close the generator breaker', time: 2,
      onComplete: [
        { do: 'propStyle', prop: 'genBkr', style: 'on' },
        { do: 'radio', who: OKAFOR, text: 'Breaker closed. Forty megawatts, rock steady. Harrow Point is alive.' },
        { do: 'wait', time: 2 },
        { do: 'win' },
      ],
    },
  ],

  triggers: [
    { id: 'gas-lobber', objective: 4, when: { hold: 18 }, do: [
      { do: 'spawn', alert: 'diesel', feed: 'Arc lobber shelling the diesel shed', enemies: [raid('lobber', -44, -20, ['diesel', 'compressor']), raid('sentry', -44, -16, ['diesel', 'compressor'])] },
    ] },
    { id: 'unit-hauler', objective: 6, when: { hold: 22 }, do: [
      { do: 'radio', who: JUNO, text: 'LODESTAR\'s rerouting everything it has at the plant. A second Hauler, coming from the east.' },
      { do: 'spawn', alert: 'site', feed: 'Second Hauler on the east fence', enemies: [raid('hauler', 44, -10, ['unit2', 'compressor']), raid('skimmer', 44, -6, ['unit2', 'compressor']), raid('skimmer', 44, -14, ['unit2', 'compressor'])] },
    ] },
    { id: 'unit-last', objective: 6, when: { hold: 36 }, do: [
      { do: 'spawn', alert: 'north', feed: 'Bulwarks pushing Unit 2', enemies: [raid('bulwark', -20, -34, 'unit2'), raid('bulwark', 20, -34, 'unit2'), raid('lobber', 0, -34, 'unit2')] },
      { do: 'radio', who: OKAFOR, text: 'Nearly at sync speed!' },
    ] },
  ],
};
