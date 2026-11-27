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
python3 tools/smoke_test.py                  # 261 scripted solo checks (missions 01–16 + spawn safety) in headless Chrome
python3 tools/smoke_test.py --url-args "&only=m11"   # just one mission's checks (m03–m16), much faster
python3 tools/smoke_test.py --url-args "&only=spawns" # every mission: spawns clear + player can walk away
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
    blackout.js       rolling-blackout districts (lit/dark schedule, visibility)
    switching.js      breaker puzzle: live zones, interlocks, arc flash
    weather.js        wind, lightning strikes, rain
    bosses.js         boss enemy types (Spillway Warden, Ironwalker), mortar shells and warning rings
  net/net.js          co-op session: lobby, snapshots, events, host/client roles
  net/transport.js    PeerJS (online) and BroadcastChannel (same-browser) connections
  ui/hud.js, menu.js  HUD, team panel, minimap, objective marker, menus, co-op lobby
  levels/             level geometry (riverbend, switchback, fernhill, calder, portcalder, tunnels, kelso, viaduct, railyard (+ snow variant), galeline, ridge, office, peaker) and reusable pieces (kit.js).
                      Levels may define `zones` (water: slow, noisy wading) and `map.rects` (minimap floor areas).
                      Lights added inside a level's build() are kept (e.g. Calder's turbine-hall lamps).
  missions/           mission definitions plus the campaign order (index.js)
tools/                smoke_test.py (solo), coop_test.py (two-browser co-op)
substation_fps.html   the original single-file version, kept for reference
```

## Adding a mission

Missions are plain data. Copy a file in `src/missions/`, change its contents, then add it to `CAMPAIGN` in `src/missions/index.js`. Mission 02, `m02_lights_out.js`, uses most of the features listed below.

**Mission-level fields**
- **level**: an id from `src/levels/index.js`. **environment**: `day`, `dusk`, `night`, `storm`, `snow` or `underground` (`ENV_PRESETS` in `engine/render.js`).
- **blackout**: `{ period, litFraction, offsets: { districtId: seconds } }` runs rolling blackouts on levels that define districts (Port Calder). Lit districts expose players; dark ones hide them.
- **reinforcements**: `[[x, z]...]`, the points Spotters call Skimmers from.
- **switching**: `{ breakers: { id: { panel, feeds } }, zones: { name: { rect } }, interlocks: [{ close, whileClosed, hint }], goal: { id: closed }, dps }`. Breakers are panel props (`style: 'on'` = closed). Closed breakers energize their zones, which hurt players and machines. Closing a breaker against an interlock causes an arc flash.
- **weather**: `{ wind: { dir, base, gust }, lightning: { every: [min, max], radius, damage, tall: [[x, z]...] }, rain: true, snow: true }`. Wind pushes grenades, smoke and moving players. Lightning strikes after a warning ring.
- **empHud**: `true` takes the HUD aids offline (no minimap, marker or compass). The objective pings in stereo from its direction instead.
- **emps**: EMP grenades per player (X). They stun every machine within 8 m for 4.5 s.
- **smokes**: smoke grenades per player (V). The cloud blocks machines' line of sight.
- **turrets**: how many auto-turrets each player carries (T to deploy). The `giveTurrets` event hands out more.
- **loadout**: guns available, in key order. Defaults to `['rifle', 'pistol']`; the options are `rifle`, `shotgun`, `dmr`, `arc` (stuns and chains between machines) and `pistol`.
- **spawns**: `[x, z, yaw]`, one per co-op slot.
- **props**: named objects. Types: `terminal`, `extraction`, `survivor`, `panel`, `floodlight`, `camera` (stealth missions), `gasTurbine`, `truck`, `train`, `battery` (a wagon shunted to `to` once coupled), `turbine`, `relay`, `beacon` (light column landmark), `barricade`, `lever`, `door` (`open` clears it), `drive`, `payphone`, `cable`, `mimic` (a live breaker diagram) and `marker` (an invisible target point). Each has a `style` that events can change (`gone` removes a truck or barricade). There's also a `generator` type.
- **Prop health:** any prop with a collision body can take `hp`. Machine fire damages it, players hold E next to it to repair it (`repairable`, default true), and `onDestroyed` events run when it's lost. `label` names it in the HUD. With `downStyle` (e.g. `'offline'`) and `upStyle`, zero health knocks the prop out instead of destroying it, and players hold E next to it to reboot it at half health.
- **escort**: `{ prop, path: [[x, z]...], speed, radius, contactRadius, blockAhead, hp, onDestroyed }`. The vehicle drives the path during `escort` objectives.
- **pickups**: `[x, z, 'ammo' | 'med']`.
- **enemies**: `{ type, at, patrol, harass? }`, where `type` is a key of `ENEMY_TYPES` in `bots.js` (`sentry`, `skimmer`, `bulwark`, `spotter`, `hauler` (armoured, weak rear radiator), `lobber` (Arc lobber: electric shells that leave damaging fields), `lineman` (with `ceiling: true` it hangs from the ceiling until a player passes under it), `tallyman`, and the bosses `warden` and `ironwalker`).
  - **Factions:** Tallymen belong to `halvard`; everything else is `lodestar` (override with `faction`). Machines target players and machines of the other faction, their rounds hit the other faction, and they turn on whatever shoots them. `tag` names an enemy for `kill` objectives. With `harass: propId` (or a list of ids), an enemy attacks that prop, or the nearest one still up, when no player is in sight.
- **onStart**: events that run when play begins.
- **triggers**: `{ id, when, do: [events], objective? }`.

**Objective types** (`type`)
- `interact` (default): hold E at the `target` prop.
- `collect`: hold E at each of several `targets`. Supports `onEach` and per-target `onTarget` events.
- `reach`: get within `radius` of the target.
- `hold`: stay within `radius` for `time` seconds while waves come in.
- `eliminate`: destroy every machine.
- `switching`: operate the mission's breakers (hold E at a panel) until the `goal` state is reached.
- `kill`: destroy the enemies with a given `tag`, such as a boss. The objective marker follows them.
- `survive`: last `time` seconds anywhere. With `guard: [propIds]`, the objective box shows those props' health.
- `uplink`: keep the `targets` props in their online style for `time` seconds. Progress scales with how many are online.
- `escort`: drive the mission's escort vehicle up to waypoint `until`. It moves only while a player is within `radius` and no machine is within `contactRadius`.
- Any objective can set `reach` to change the interact distance (default 2.6 m).
- Any objective can set `timeLimit` (seconds) with `onTimeout` events (default: fail). The countdown shows in the objective box.

Each objective can have `onStart` and `onComplete` events.

**Events** (`{ do: ..., ... }`): `say`, `radio`, `feed`, `noise`, `investigate`, `propStyle`, `spawn` (enemy waves), `checkpoint`, `giveTurrets`, `wait`, `win` and `fail`. New ones go in the `EVENTS` table in `game/mission.js`.

**Trigger conditions** (`when`): `time`, `enter: [x, z, r]`, `near: [prop, r]`, `hold: seconds`, `collected: n`, `enemiesLeft: n`, `escort: waypointIndex`, `destroyed: [[propIds], n]`, `breaker: [id, closed]` and `enemyHp: [tag, fraction]`. `hold` also counts time in `survive` objectives.

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

### Stealth (mission 15)
A mission opts in with `stealth: { onAlarm: [events], waves: { every, events } }`. Cameras (`camera` props)
and guards (enemies with `guard: true`) fill a detection meter; when full, the alarm is raised for good
(also via the `alarm` event). Hold E behind an unaware machine for a silent takedown. Props can carry an
optional action: `use: { action, time, events }`. The `spistol` weapon is suppressed (per-weapon `noise`).

### Launcher and staged power-up (mission 16)
`launcher` (LR-40) fires impact-fused HE rounds (`spawnBomb` kind `'he'`): they arm after 4 m, burst on
walls, ground or machines, and ignore Hauler armour. An `uplink` objective takes `gauge` (the label for
its progress) and `onlineStyle`; give machine props `hp`, `downStyle: 'tripped'`, `upStyle: 'running'`
so raiders can trip them and players restart them with E. Triggers take `objective: n` to arm only
during one objective.
