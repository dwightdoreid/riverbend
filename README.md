# Riverbend

A browser FPS built on Three.js. A campaign of about 20 missions is planned, with optional online co-op ([docs/CAMPAIGN.md](docs/CAMPAIGN.md)).

**Play online:** https://dwightdoreid.github.io/riverbend/ (share the link and a room code to play co-op).

## Run it locally

The game uses JavaScript modules, so it has to be served over HTTP. Opening the file directly won't work.

```bash
cd FPS_Test
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no npm. Three.js r160 is bundled in `vendor/`.

## Test it

```bash
python3 tools/smoke_test.py                  # 91 scripted solo checks (missions 01–05) in headless Chrome
python3 tools/coop_test.py                   # 36 co-op checks: host + client windows
python3 tools/smoke_test.py --screenshot shot.png
```

The test opens `index.html?autotest=1`, which loads `tools/autotest.js`. That script plays both missions through the real input paths and menu buttons:
- shooting, reloading, weapon swaps, grenades and movement
- interact, collect and hold objectives, waves and floodlights
- checkpoint retry, mission unlock and next mission
- pause, resume and death

It also fails if any runtime error appears. A final check holds the right mouse button and clicks the left, using real mouse input sent through Chrome DevTools.

## Layout

```
index.html            page shell and HUD markup
css/style.css
vendor/               three.min.js, peerjs.min.js and their licenses
src/
  main.js             boot and frame loop: step() runs the simulation for every player
  input.js            keyboard, mouse and touch, written into G.local.input
  engine/             renderer, mesh builders, audio, DOM helpers
  game/
    state.js          the shared state object G (players[], enemies, props...)
    world.js          collision footprints, solids, raycasts, line of sight
    players.js        player entities, movement, per-player ammo and health
    weapons.js        weapon definitions plus fire, reload, swap and grenade
    combat.js         projectiles, grenades, damage, hit effects
    bots.js           enemy types and AI that targets any living player
    props.js          mission props (terminals, extraction) and pickups
    mission.js        level loading, objectives, scripted events, interaction
    flow.js           mission select, deploy, pause, checkpoint retry, win, lose
    progress.js       unlocked missions and best times (saved in the browser)
    fx.js             routes sounds and toasts to the player they concern
    viewmodel.js      first-person camera and held weapon
    nav.js            walkability grid + A* pathfinding for machines
    avatars.js        teammates' bodies and name tags
    turrets.js        deployable auto-turrets
    bosses.js         boss enemy types (Spillway Warden), mortar shells and warning rings
  net/net.js          co-op session: lobby, snapshots, events, host/client roles
  net/transport.js    PeerJS (online) and BroadcastChannel (same-browser) connections
  ui/hud.js, menu.js  HUD, team panel, minimap, objective marker, menus, co-op lobby
  levels/             level geometry (riverbend, switchback, fernhill, calder) and reusable pieces (kit.js).
                      Lights added inside a level's build() are kept (e.g. Calder's turbine-hall lamps).
  missions/           mission definitions plus the campaign order (index.js)
tools/                smoke_test.py (solo), coop_test.py (two-browser co-op)
substation_fps.html   the original single-file version, kept for reference
```

## Adding a mission

Missions are plain data. Copy a file in `src/missions/`, change its contents, then add it to `CAMPAIGN` in `src/missions/index.js`. Mission 02, `m02_lights_out.js`, uses most of the features listed below.

**Mission-level fields**
- **level**: an id from `src/levels/index.js`. **environment**: `day`, `dusk`, `night` or `storm` (`ENV_PRESETS` in `engine/render.js`).
- **turrets**: how many auto-turrets each player carries (T to deploy). The `giveTurrets` event hands out more.
- **loadout**: guns available, in key order. Defaults to `['rifle', 'pistol']`; the options are `rifle`, `shotgun` and `pistol`.
- **spawns**: `[x, z, yaw]`, one per co-op slot.
- **props**: named objects. Types: `terminal`, `extraction`, `survivor`, `panel`, `floodlight`, `truck`, `barricade` and `door` (`open` clears it). Each has a `style` that events can change (`gone` removes a truck or barricade). There's also a `generator` type.
- **Prop health:** any prop with a collision body can take `hp`. Machine fire damages it, players hold E next to it to repair it (`repairable`, default true), and `onDestroyed` events run when it's lost. `label` names it in the HUD.
- **escort**: `{ prop, path: [[x, z]...], speed, radius, contactRadius, hp, onDestroyed }`. The vehicle drives the path during `escort` objectives.
- **pickups**: `[x, z, 'ammo' | 'med']`.
- **enemies**: `{ type, at, patrol, harass? }`, where `type` is a key of `ENEMY_TYPES` in `bots.js` (`sentry`, `skimmer`, `bulwark`, and the boss `warden`). `tag` names an enemy for `kill` objectives. With `harass: propId`, an enemy attacks that prop when no player is in sight.
- **onStart**: events that run when play begins.
- **triggers**: `{ id, when, do: [events], objective? }`.

**Objective types** (`type`)
- `interact` (default): hold E at the `target` prop.
- `collect`: hold E at each of several `targets`. Supports `onEach` and per-target `onTarget` events.
- `reach`: get within `radius` of the target.
- `hold`: stay within `radius` for `time` seconds while waves come in.
- `eliminate`: destroy every machine.
- `kill`: destroy the enemies with a given `tag`, such as a boss. The objective marker follows them.
- `survive`: last `time` seconds anywhere. With `guard: [propIds]`, the objective box shows those props' health.
- `escort`: drive the mission's escort vehicle up to waypoint `until`. It moves only while a player is within `radius` and no machine is within `contactRadius`.
- Any objective can set `reach` to change the interact distance (default 2.6 m).

Each objective can have `onStart` and `onComplete` events.

**Events** (`{ do: ..., ... }`): `say`, `radio`, `feed`, `noise`, `investigate`, `propStyle`, `spawn` (enemy waves), `checkpoint`, `giveTurrets`, `wait`, `win` and `fail`. New ones go in the `EVENTS` table in `game/mission.js`.

**Trigger conditions** (`when`): `time`, `enter: [x, z, r]`, `near: [prop, r]`, `hold: seconds`, `collected: n`, `enemiesLeft: n`, `escort: waypointIndex` and `destroyed: [[propIds], n]`. `hold` also counts time in `survive` objectives.

## Co-op (1–4 players)

1. One player opens **Co-op → Host a game** and shares the 5-letter room code.
2. Friends open the game, choose **Co-op**, type the code and press **Join game**.
3. The host picks a mission and presses **Deploy squad**. Everyone loads in together.

**How it works**
- **Connection:** browsers connect directly with WebRTC. The public PeerJS server (`vendor/peerjs.min.js`) is only used to introduce them.
- **Host-authoritative:** the host's browser runs the enemies, damage, objectives and mission script. It sends a snapshot 20 times a second, plus reliable one-off events such as radio, waves, hit markers and explosions.
- **Clients run their own player:** each player's browser moves its own player and handles its weapon locally, so it feels instant. Shots and grenades are sent to the host, which decides what they hit.
- **Downed and revive:** a player whose health hits zero goes down and has 30 s for a teammate to revive them (hold E). If they bleed out, they're back in after 20 s next to a teammate. The mission fails only when nobody is left standing. Solo players get one auto-stim per checkpoint instead.
- **Scaling:** enemy health rises 40% per extra player, and wave size rises 50%.
- **Joining late:** players who join mid-mission drop in at the next checkpoint.
- **Pause:** the menu opens over the running game and doesn't pause it.

**Known limits**
- The host's tab must stay open and in front, because browsers slow background tabs.
- Some strict networks (symmetric NAT, some corporate or mobile networks) block direct WebRTC connections. Fixing that needs a TURN relay server, which isn't set up.
- Clients are trusted with their own position and ammo. That's fine for friends, but it isn't cheat-proof.

**Testing co-op on one machine:** open two tabs with `index.html?net=local`. They connect through the browser itself, with no internet needed. `python3 tools/coop_test.py` does this automatically and runs 36 checks covering:
- lobby, deploy, and position sync both ways
- client shots, damage, downed and revive
- objectives, waves, grenades, turrets and generator health
- mission end, next mission, leaving, and dropping in at a checkpoint
