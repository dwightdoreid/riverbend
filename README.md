# Riverbend

A browser FPS built on Three.js. A campaign of about 20 missions is planned, with optional online co-op ([docs/CAMPAIGN.md](docs/CAMPAIGN.md)).

## Run it

The game uses JavaScript modules, so it has to be served over HTTP. Opening the file directly won't work.

```bash
cd FPS_Test
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no npm. Three.js r160 is bundled in `vendor/`.

## Test it

```bash
python3 tools/smoke_test.py                  # 37 scripted checks in headless Chrome
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
vendor/               three.min.js and its license
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
  ui/hud.js, menu.js  HUD, minimap, objective marker, menus
  levels/             level geometry (riverbend.js) and reusable pieces (kit.js)
  missions/           mission definitions plus the campaign order (index.js)
tools/                smoke test
substation_fps.html   the original single-file version, kept for reference
```

## Adding a mission

Missions are plain data. Copy a file in `src/missions/`, change its contents, then add it to `CAMPAIGN` in `src/missions/index.js`. Mission 02, `m02_lights_out.js`, uses most of the features listed below.

**Mission-level fields**
- **level**: an id from `src/levels/index.js`. **environment**: `day`, `night` or `storm` (`ENV_PRESETS` in `engine/render.js`).
- **spawns**: `[x, z, yaw]`, one per co-op slot.
- **props**: named objects. Types: `terminal`, `extraction`, `survivor`, `panel` and `floodlight`. Each has a `style` that events can change.
- **pickups**: `[x, z, 'ammo' | 'med']`.
- **enemies**: `{ type, at, patrol }`, where `type` is a key of `ENEMY_TYPES` in `bots.js` (`sentry`, `skimmer`).
- **onStart**: events that run when play begins.
- **triggers**: `{ id, when, do: [events], objective? }`.

**Objective types** (`type`)
- `interact` (default): hold E at the `target` prop.
- `collect`: hold E at each of several `targets`. Supports `onEach` and per-target `onTarget` events.
- `reach`: get within `radius` of the target.
- `hold`: stay within `radius` for `time` seconds while waves come in.
- `eliminate`: destroy every machine.

Each objective can have `onStart` and `onComplete` events.

**Events** (`{ do: ..., ... }`): `say`, `radio`, `feed`, `noise`, `investigate`, `propStyle`, `spawn` (enemy waves), `checkpoint`, `wait`, `win` and `fail`. New ones go in the `EVENTS` table in `game/mission.js`.

**Trigger conditions** (`when`): `time`, `enter: [x, z, r]`, `near: [prop, r]`, `hold: seconds`, `collected: n` and `enemiesLeft: n`.

## Co-op readiness

The simulation no longer assumes a single player:

- Every player has its own position, health, ammo, timers and stats in `G.players`.
- Players are moved by an `input` struct, so a remote player can be driven by network messages.
- Enemies choose the nearest visible living player as their target.
- Bullets and explosions can hit any player. The mission fails only when every player is down.
- Sounds and toasts go only to the player they concern (`fx.js`).
