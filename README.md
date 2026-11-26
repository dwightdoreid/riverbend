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
python3 tools/smoke_test.py                  # 19 scripted checks in headless Chrome
python3 tools/smoke_test.py --screenshot shot.png
```

The test opens `index.html?autotest=1`, which loads `tools/autotest.js`. That script plays the mission through the real input paths: shoot, reload, swap weapons, grenade, move, finish each objective, win, replay, die, pause and resume. It also fails if any runtime error appears.

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
    flow.js           start, pause, restart, win, lose
    fx.js             routes sounds and toasts to the player they concern
    viewmodel.js      first-person camera and held weapon
  ui/hud.js, menu.js  HUD, minimap, objective marker, menus
  levels/             level geometry (riverbend.js) and reusable pieces (kit.js)
  missions/           mission definitions plus the campaign order (index.js)
tools/                smoke test
substation_fps.html   the original single-file version, kept for reference
```

## Adding a mission

Missions are plain data. Copy `src/missions/m01_recovery.js`, change its contents, then add it to `CAMPAIGN` in `src/missions/index.js`.

- **level**: an id from `src/levels/index.js`.
- **spawns**: `[x, z, yaw]`, one per co-op slot.
- **props**: named objects. Objectives point at them through `target`.
- **enemies**: `{ type, at, patrol }`, where `type` is a key of `ENEMY_TYPES` in `bots.js`.
- **objectives**: run in order. Each has `onComplete` events.
- **events**: `say`, `feed`, `noise`, `investigate`, `propStyle` and `win`. New verbs go in the `EVENTS` table in `mission.js`.

## Co-op readiness

The simulation no longer assumes a single player:

- Every player has its own position, health, ammo, timers and stats in `G.players`.
- Players are moved by an `input` struct, so a remote player can be driven by network messages.
- Enemies choose the nearest visible living player as their target.
- Bullets and explosions can hit any player. The mission fails only when every player is down.
- Sounds and toasts go only to the player they concern (`fx.js`).
