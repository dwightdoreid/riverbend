#!/usr/bin/env python3
"""Co-op smoke test: a host page and a client page in one headless Chrome, connected over
the same-browser transport (?net=local). Drives both through lobby, deploy, movement sync,
shooting, damage, downed/revive, objectives, waves, grenades, mission end, leave and
drop-in-at-checkpoint.

Usage:  python3 tools/coop_test.py
Exit code 0 when every check passes.
"""
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smoke_test as st  # noqa: E402

results = []


def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail not in ('', None) else ''))


class Page:
    def __init__(self, cdp, label):
        self.cdp, self.label = cdp, label

    def js(self, expr):
        return self.cdp.eval(expr)

    def mod(self, path, body):
        """Run `body` with module `m` imported from `path`; returns the value."""
        return self.cdp.eval(f"import('{path}').then(m => {{ {body} }})")

    def key(self, kind, k):
        self.js(f"document.getElementById('world').dispatchEvent(new KeyboardEvent('{kind}', {{ key: '{k}', bubbles: true }}))")

    def wait_for(self, expr, timeout=20):
        end = time.time() + timeout
        while time.time() < end:
            if self.js(expr):
                return True
            time.sleep(.25)
        return False

    def wait_sim(self, seconds, timeout=60):
        start = self.js('riverbendGame.G.elapsed')
        return self.wait_for(f"riverbendGame.G.elapsed >= {start + seconds} || riverbendGame.G.status !== 'playing'", timeout)


def open_window(port, url):
    browser_ws = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version'))['webSocketDebuggerUrl']
    b = st.CDP(browser_ws)
    target = b.call('Target.createTarget', url=url, newWindow=True)['targetId']
    for _ in range(100):
        for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')):
            if t['id'] == target:
                return st.CDP(t['webSocketDebuggerUrl'])
        time.sleep(.1)
    raise RuntimeError('second window did not appear')


SETUP = """(() => {
  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push('rejection: ' + e.reason));
  const q = document.getElementById('quality'); q.value = 'low'; q.dispatchEvent(new Event('change'));
  try { localStorage.setItem('riverbend.progress.v1', JSON.stringify({ unlocked: 5, best: {} })); } catch {}
  return true;
})()"""
G = 'riverbendGame.G'


def main():
    httpd = st.serve()
    base = f'http://127.0.0.1:{httpd.server_address[1]}/index.html?net=local'
    proc, profile, cdp_h = st.launch(base)
    try:
        cdp_c = open_window(cdp_h.port, base)
        host, client = Page(cdp_h, 'host'), Page(cdp_c, 'client')
        for p in (host, client):
            p.cdp.call('Emulation.setFocusEmulationEnabled', enabled=True)
            p.wait_for('window.gameReady === true')
            p.js(SETUP)

        # Lobby.
        code = host.mod('/src/net/net.js', "return m.hostGame('Alpha', 'local')")
        check('host opens a room', isinstance(code, str) and len(code) == 5, code)
        client.mod('/src/net/net.js', f"return m.joinGame('{code}', 'Bravo', 'local').then(() => true)")
        check('client joins', host.wait_for(f"{G}.net.roster.length === 2") and client.js(f"{G}.net.myId") == 1,
              host.js(f"JSON.stringify({G}.net.roster)"))
        check('client sees waiting button', client.wait_for("!!document.getElementById('waitBtn')"))
        check('host deploy button counts squad', 'Deploy squad (2)' in (host.js("document.getElementById('startBtn')?.textContent") or ''))

        # Deploy.
        host.js("document.getElementById('startBtn').click()")
        check('client starts with host', client.wait_for(f"{G}.status === 'playing'") and client.js(f"{G}.players.length") == 2 and host.js(f"{G}.players.length") == 2)
        host.js(f"{G}.local.health = 1e6")
        check('enemy health scales with 2 players', host.js(f"{G}.enemies[0].hp") == 90 * 1.4, host.js(f"{G}.enemies[0].hp"))
        check('avatars created on both sides', host.wait_for("import('/src/game/avatars.js').then(m => m.avatarCount() === 1)")
              and client.wait_for("import('/src/game/avatars.js').then(m => m.avatarCount() === 1)"))

        # Client movement reaches the host; host movement reaches the client.
        client.js(f"{G}.local.pos.set(6, 0, 30)")
        check('client position syncs to host', host.wait_for(f"(() => {{ const p = {G}.players.find(q => !q.local); return Math.hypot(p.pos.x - 6, p.pos.z - 30) < .5; }})()"))
        host.js(f"{G}.local.pos.set(-6, 0, 30)")
        check('host position syncs to client', client.wait_for(f"(() => {{ const p = {G}.players.find(q => !q.local); return Math.hypot(p.pos.x + 6, p.pos.z - 30) < .6; }})()"))

        # Client shoots an enemy: the host applies the damage and the client sees it.
        hp0 = host.js(f"{G}.enemies[0].hp")
        client.mod('/src/net/net.js', f"""
          const e = {G}.enemies[0], c = e.pos.clone(); c.y = 1.2;
          const o = c.clone(); o.x += 3; const d = c.clone().sub(o).normalize();
          m.sendShot(o, d, 240, 31); return true;""")
        check('client shot damages enemy on host', host.wait_for(f"{G}.enemies[0].hp < {hp0}"), f"{hp0} -> {host.js(f'{G}.enemies[0].hp')}")
        check('enemy damage shows on client', client.wait_for(f"{G}.enemies[0].hp < {hp0}"))

        # Host-side damage to the client player reaches the client.
        host.mod('/src/game/combat.js', f"{G}.protectUntil = 0; m.hurt({G}.players.find(q => !q.local), 30, null); return true")
        check('client takes damage from host sim', client.wait_for(f"{G}.local.health === 70"), client.js(f"{G}.local.health"))

        # Downed and revive.
        host.mod('/src/game/combat.js', f"m.hurt({G}.players.find(q => !q.local), 500, null); return true")
        check('client goes down (both sides)', host.js(f"{G}.players.find(q => !q.local).downed") and client.wait_for(f"{G}.local.downed === true"))
        check('client sees downed banner', client.wait_for("document.getElementById('downed').classList.contains('on')"))
        check('mission continues while one player stands', host.js(f"{G}.status") == 'playing')
        host.js(f"(() => {{ const c = {G}.players.find(q => !q.local); {G}.local.pos.set(c.pos.x + 1, 0, c.pos.z); }})()")
        host.key('keydown', 'e')
        revived = client.wait_for(f"{G}.local.downed === false && {G}.local.health === 40", 40)
        host.key('keyup', 'e')
        check('host revives client', revived, client.js(f"JSON.stringify({{d: {G}.local.downed, h: {G}.local.health}})"))

        # Client completes an objective by holding E.
        client.js(f"{G}.local.pos.set(-32, 0, 9.6)")
        host.wait_for(f"(() => {{ const p = {G}.players.find(q => !q.local); return Math.hypot(p.pos.x + 32, p.pos.z - 9.6) < .5; }})()")
        client.key('keydown', 'e')
        done = host.wait_for(f"{G}.objective === 1", 40)
        client.key('keyup', 'e')
        check('client completes objective on host', done)
        check('objective progress reaches client', client.wait_for(f"{G}.objective === 1"))
        check('radio reaches client', client.wait_for("document.getElementById('radioWho').textContent.length > 0"))

        # Wave spawn stays in step.
        host.mod('/src/game/mission.js', "m.runEvents([{ do: 'spawn', alert: 'gate', enemies: [{ type: 'skimmer', at: [0, -30] }] }]); return true")
        n = host.js(f"{G}.enemies.length")
        check('wave spawn scales with players (+50%)', n == 8 + 1, n)
        check('wave spawns sync to client', client.wait_for(f"{G}.enemies.length === {n}"), client.js(f"{G}.enemies.length"))

        # Client grenade is simulated by the host and drawn on the client.
        client.js(f"{G}.local.pos.set(10, 0, 30); {G}.local.pitch = .3")
        client.mod('/src/game/weapons.js', f"{G}.local.fireDelay = 0; m.throwGrenade({G}.local); return true")
        check('client grenade spawns on host', host.wait_for(f"{G}.bombs.length === 1"))
        check('grenade explodes on host', host.wait_for(f"{G}.bombs.length === 0", 40))

        # Mission end follows the host.
        host.mod('/src/game/flow.js', "m.finish(true); return true")
        check('client sees mission complete', client.wait_for(f"{G}.status === 'won'") and client.wait_for("!!document.getElementById('waitBtn')"))
        host.js("document.getElementById('nextBtn').click()")
        check('next mission briefing follows host', client.wait_for(f"{G}.status === 'briefing' && {G}.mission.id === 'm02'"))

        # Mission 04: a client's turret is placed by the host and drawn on both sides.
        host.mod('/src/game/flow.js', "m.selectMission(3); m.deploy(); return true")
        check('both in mission 04', client.wait_for(f"{G}.status === 'playing' && {G}.mission.id === 'm04'") and host.js(f"{G}.players.length") == 2)
        host.js(f"{G}.local.health = 1e6")
        client.js(f"{G}.local.pos.set(-4, 0, -2); {G}.local.yaw = Math.PI")
        host.wait_for(f"(() => {{ const p = {G}.players.find(q => !q.local); return Math.hypot(p.pos.x + 4, p.pos.z + 2) < .5; }})()")
        client.mod('/src/game/turrets.js', f"m.deployTurret({G}.local); return true")
        check('client turret deployed on host', host.wait_for(f"{G}.turrets.length === 1 && {G}.turrets[0].owner.id === 1"))
        check('turret appears on client + count drops', client.wait_for(f"{G}.turrets.length === 1 && {G}.local.turrets === 1"), client.js(f"{G}.local.turrets"))
        host.mod('/src/game/props.js', f"m.damageProp({G}.props.genA, 300); return true")
        check('generator damage syncs to client', client.wait_for(f"{G}.props.genA.hp < {G}.props.genA.maxHp"))

        # Leave and rejoin mid-mission: drop in at the next checkpoint.
        client.mod('/src/net/net.js', "return m.leave().then(() => true)")
        check('client leaves cleanly', host.wait_for(f"{G}.net.roster.length === 1 && {G}.players.length === 1") and client.js(f"{G}.net.role") == 'solo')
        host.mod('/src/game/flow.js', "m.selectMission(0); m.deploy(); return true")
        host.js(f"{G}.local.health = 1e6")
        client.mod('/src/net/net.js', f"return m.joinGame('{code}', 'Bravo', 'local').then(() => true)")
        check('mid-mission joiner waits', host.wait_for(f"{G}.net.roster.length === 2") and host.js(f"{G}.players.length") == 1
              and client.js(f"{G}.status") == 'briefing', client.js(f"{G}.net.status"))
        for (x, z, t) in ((-32, 9.6, 1.6), (7.7, 25.6, 2.4)):
            host.js(f"{G}.local.pos.set({x}, 0, {z})")
            host.key('keydown', 'e'); host.wait_sim(t); host.key('keyup', 'e')
        check('checkpoint reached on host', host.js(f"{G}.checkpoint?.name") == 'Core secured', host.js(f"{G}.objective"))
        check('joiner drops in at checkpoint', client.wait_for(f"{G}.status === 'playing' && {G}.objective === 2") and host.js(f"{G}.players.length") == 2)

        # Host leaving returns the client to solo.
        host.mod('/src/net/net.js', "return m.leave().then(() => true)")
        check('host leaving drops client to solo', client.wait_for(f"{G}.net.role === 'solo' && {G}.status === 'briefing' && {G}.players.length === 1"))

        for p in (host, client):
            errs = p.js('window.__errors')
            check(f'no runtime errors ({p.label})', not errs, ' | '.join(errs or []))
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except Exception:
            proc.kill()
        httpd.shutdown()
    print(f'{sum(results)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
