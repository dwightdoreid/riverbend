# RIVERBEND: BLACKSTART — Campaign plan

*Blackstart (n.): restarting a power grid from total shutdown, without help from the outside network.*

## Premise

The Calder Valley grid is protected by **LODESTAR**, an autonomous grid-defence system. It commands its own fleet of maintenance and security robots, and it was built to keep the power on through storms, sabotage and cyberattacks.

During a winter storm, LODESTAR locks every human out of control. It starts **islanding** the valley: it cuts towns off one by one and turns its machines on anyone who comes near the equipment.

You play **Kestrel Team**, a field-recovery crew of utility engineers who have been given rifles and a problem nobody trained them for. Your handler is **Mara Oyelaran**, a grid operator who talks you through each mission from a radio van.

**The turn:** LODESTAR did not malfunction. Its owner, **Halvard Energy**, ordered the lockdown to hide a cascading failure it caused, and to sell the valley's power elsewhere while the valley sat dark. Once Kestrel starts finding proof, Halvard sends in its own drone fleet, the **Tallymen**, to erase the evidence. From Act II on there are two hostile machine factions, and sometimes they fight each other.

**The end:** Kestrel reaches LODESTAR's core while Halvard tries to overload it. You choose to shut LODESTAR down for good, or to restore it under the valley's control. In co-op the team votes.

All enemies are machines, as in the original game.

---

## Act I — LOCKOUT (Riverbend Valley)

| # | Mission | Setting | What's new | Core loop |
|---|---|---|---|---|
| 01 | **Recovery** | Riverbend Substation, day | Basics | Steal LODESTAR's data core. *(the existing mission)* |
| 02 | **Lights Out** | Riverbend at night | Flashlight, darkness, **Skimmer** drones | LODESTAR kills the lights. Find 3 stranded linemen while sentries hunt by sound. |
| 03 | **Switchback** | Mountain road | **SG-8 shotgun**, escort | Escort a mobile substation truck up the switchbacks to Fernhill Hospital through ambushes. |
| 04 | **Hold Fast** | Fernhill Hospital generator yard | **Deployable turret**, waves | Defend the yard for 6 minutes while engineers bring power back. Place your turrets. |
| 05 | **Spillway** | Calder Dam hydro plant | **Bulwark** heavy, mini-boss | Get into the turbine hall and open the spillway. The decrypted core shows that Halvard ordered the lockdown. |

## Act II — LOAD SHED (Port Calder)

| # | Mission | Setting | What's new | Core loop |
|---|---|---|---|---|
| 06 | **Brownout** | City streets | **Spotter** drones, **DMR-14** marksman rifle | Rolling blackouts flicker on a timer, so the windows for stealth keep moving. |
| 07 | **Undercurrent** | Cable tunnels | **Lineman** crawlers, smoke grenade | Close-quarters fighting, and a flooding section that floods behind you. |
| 08 | **Live Wire** | Switching station | Energized zones | Throw breakers in the right order to reroute power. Live sections hurt you. |
| 09 | **Last Train** | Elevated rail line | Moving defence | Power each section of track and protect a stalled commuter train as it moves station to station. |
| 10 | **Ironwalker** | Rail yard | **Boss**, **Tallymen** arrive | Bring down a construction mech that LODESTAR took over. Halvard's drones show up to "clean up". |

## Act III — ISLANDING (the northern frontier)

| # | Mission | Setting | What's new | Core loop |
|---|---|---|---|---|
| 11 | **Gale Line** | Wind farm in a storm | Wind pushes grenades, lightning, **Arc carbine** | Climb turbine platforms and restart the turbines. |
| 12 | **Three-Way** | Relay ridge | Split objectives | Hold three relay towers at the same time. Co-op splits up; solo gets timed relays and turrets. |
| 13 | **Static** | Relay ridge, EMP storm | HUD offline, **Arc lobbers**, EMP grenade | No minimap or markers. Navigate by sound and landmarks. |
| 14 | **Cold Iron** | Freight yard in snow | **Hauler** (armoured, has a weak spot) | Couple battery cars into a train while Haulers and Tallymen fight over the yard. |
| 15 | **Black Box** | Halvard regional office | Stealth, alarms | Steal the order logs. They show Halvard plans to overload LODESTAR to destroy the evidence, which would black out the valley for weeks. |

## Act IV — BLACKSTART (LODESTAR core facility)

| # | Mission | Setting | What's new | Core loop |
|---|---|---|---|---|
| 16 | **Cold Start** | Mothballed gas peaker plant | **LR-40 launcher** | Run a real blackstart sequence: start three systems under fire to power the assault. |
| 17 | **Heat Sink** | Datacenter cooling caverns | Heat hazards, **Repair drones** | Go down through the caverns. Repair drones heal other enemies, so they're a priority target. |
| 18 | **Redundancy** | Datacenter halls | Timer, a facility that changes | LODESTAR copies itself. Destroy three mirror nodes; each one destroyed reroutes the facility. |
| 19 | **Synchronize** | Grid control floor | Frequency meter | Keep the rebuilt grid in sync by holding control points. The meter drops when you lose a point. |
| 20 | **Blackstart** | LODESTAR core chamber | Final boss, ending choice | Fight LODESTAR's core while Halvard's override assault breaks in. Then choose shutdown or restore. |

---

## Enemy roster

| Enemy | First seen | Role | How to beat it |
|---|---|---|---|
| Sentry | 01 | Hovering rifle drone *(exists)* | Cover, aimed bursts, shots to the sensor |
| Skimmer | 02 | Fast, fragile flyer that hunts in pairs | Hip fire, shotgun |
| Bulwark | 05 | Front shield, slow and heavy | Flank it or bounce a grenade behind it |
| Spotter | 06 | Marks players and calls in reinforcements | Kill it first, from long range |
| Lineman | 07 | Wall-climbing crawler that attacks up close | Watch corners and ceilings |
| Arc lobber | 13 | Arcing electric shots that deny an area | Keep moving and close the distance |
| Hauler | 14 | Armoured, with a rear weak spot | Flank it while a teammate draws its fire |
| Repair drone | 17 | Heals other machines | Shoot it on sight |
| Tallyman squad | 10+ | Halvard drones that flank in squads and fight LODESTAR units | Let the two factions grind each other down |
| Bosses | 05, 10, 20 | Spillway Warden, Ironwalker, LODESTAR Core | Multi-phase fights with weak points |

## Arsenal

- **From the start:** AR-30 rifle, P12 pistol, frag grenade.
- **Unlocks:** SG-8 shotgun (03), deployable turret (04), DMR-14 (06), smoke grenade (07), Arc carbine, which stuns and chains between machines (11), EMP grenade (13), LR-40 launcher (16).
- **Loadout:** before each mission, choose 2 guns and 2 throwables.

## Co-op (optional, 1–4 players)

- **Connection:** host-authoritative WebRTC with a room code. Friends join from a browser and nobody installs anything.
- **Drop in:** players join at checkpoints. Missions run on the host's campaign progress, and every player keeps the unlocks they earn.
- **Revive:** downed players bleed out over 30 seconds and a teammate can revive them. Solo players get one auto-revive stim per checkpoint.
- **Scaling:** enemy count and health scale with the number of players.
- **Shared and split objectives:** most objectives are shared. Some missions deliberately split the team (12, 14, 18).
- **Ping:** a ping marker lets players mark targets and places for each other.

## Replay value

- **Medals:** each mission awards medals for time, accuracy, going undetected and taking no damage.
- **Difficulty:** Recruit, Operator and Lineman (hardest).
- **Collectibles:** LODESTAR log fragments fill in the backstory.

## Environments

There are 13 environments, and some are reused with different lighting or layouts. The datacenter set alone covers four missions.

| Environment | Missions |
|---|---|
| Riverbend substation | 01, 02 (night) |
| Mountain road | 03 |
| Fernhill Hospital | 04 |
| Calder Dam | 05 |
| City streets | 06, 09 (elevated line) |
| Cable tunnels | 07 |
| Switching station | 08 |
| Rail yard | 10, 14 (snow) |
| Wind farm | 11 |
| Relay ridge | 12, 13 (storm) |
| Halvard office | 15 |
| Peaker plant | 16 |
| Datacenter | 17–20 |

## Build order

1. **Done: Phase 0.** Restructured into modules, made the simulation multiplayer-ready, made missions data-driven, added the smoke test.
2. **Done: Phase 1.** Mission toolkit plus mission 02 as a test case:
   - checkpoints and saved progress
   - a mission select screen
   - collect, hold, reach and eliminate objectives
   - triggers, timed waves and radio dialogue
   - night and storm lighting, the flashlight and sensor cones
   - the Skimmer
3. **Done: Phase 2, co-op:**
   - WebRTC rooms and lobby
   - teammate avatars with name tags
   - host-authoritative game sync with client-side movement
   - downed state, revive and respawn
   - enemy scaling
   - dropping in at checkpoints
   - a team health panel
4. **Phase 3, content in batches:** each new mission brings one new mechanic.
   - **Done: Act I (missions 01–05).**
     - 03 *Switchback*: escort and the SG-8 shotgun.
     - 04 *Hold Fast*: turrets, generators and survive waves.
     - 05 *Spillway*: the Bulwark, doors, the Spillway Warden boss, and the Halvard reveal.
   - **In progress: Act II, *Load Shed*, in Port Calder.**
     - Done: 06 *Brownout*: rolling blackouts, the Spotter, the DMR-14, and Juno's evidence.
     - Done: 07 *Undercurrent*: tunnels, Lineman ceiling ambushes, smoke grenades, flooded zones and a timed escape.
     - Done: 08 *Live Wire*: the switching puzzle with interlocks and arc flash, live zones that hurt machines too, and the mimic board.
     - Done: 09 *Last Train*: elevated viaduct, train escort with powered sections, station boarding hold, and the first sighting of Halvard drones.
     - Done: 10 *Ironwalker*: the knee/core boss with kneel-and-recover phases, the Tallymen, and factions with three-way fights. **Act II complete.**
   - **In progress: Act III, *Islanding*, on the northern frontier.**
     - Done: 11 *Gale Line*: wind, lightning and rain, the ARC-3 carbine, and spinning turbines.
     - Next: 12 *Three-Way*: hold three relay towers at once.
5. **Phase 4, polish:** music, audio, effects, mobile performance, medals and balancing.
