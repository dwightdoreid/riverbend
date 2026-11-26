// Single shared game state. Simulation modules read and write it; UI modules only read it.
// Everything per-player lives on entries of G.players so co-op can add more of them.
export const G = {
  status: 'briefing',        // briefing | playing | paused | won | lost
  elapsed: 0,
  frame: 0,
  menuOrbit: 0,
  simSteps: 1,               // simulation steps per rendered frame (tests raise this)

  mission: null,             // current mission definition (src/missions/*)
  missionIndex: 0,
  objective: 0,              // index into mission.objectives
  objState: null,            // per-objective progress: { collected: Set, hold: seconds }
  fired: new Set(),          // ids of mission triggers that have already fired
  scripts: [],               // running event lists (support { do: 'wait' })
  checkpoint: null,          // last checkpoint snapshot for this run
  protectUntil: 2.5,         // players can't be hurt before this mission time
  env: {},                   // active environment: level environment + mission preset

  level: null,               // current level definition (src/levels/*)
  levelRoot: null,           // static, batched level geometry
  dynRoot: null,             // per-run entities: props, pickups, enemies

  players: [],
  local: null,               // the player this browser controls and renders from

  enemies: [],
  pickups: [],
  turrets: [],
  shells: [],                // boss mortar shells (host)
  markers: [],               // ground warning rings
  smokes: [],                // smoke clouds (block machines' sight)
  props: {},                 // named mission props (terminals, extraction rings...)
  projectiles: [],
  bombs: [],
  effects: [],
  decals: [],
  messages: [],
};

export const alivePlayers = () => G.players.filter(p => p.alive);
