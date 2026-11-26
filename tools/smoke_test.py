#!/usr/bin/env python3
"""Headless smoke test: serves the project, runs tools/autotest.js in Chrome, prints the report.

Uses only the Python standard library (a tiny Chrome DevTools Protocol client), so it works
without pip/node.

Usage:  python3 tools/smoke_test.py [--screenshot out.png] [--url-args "&foo=1"]
Exit code 0 when every check passes.
"""
import base64, functools, http.server, json, os, shutil, socket, struct, subprocess, sys, tempfile, threading, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = next((c for c in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser') if shutil.which(c)), None)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class CDP:
    """Minimal websocket + DevTools client (text frames only)."""

    def __init__(self, ws_url):
        host_port, path = ws_url[len('ws://'):].split('/', 1)
        host, port = host_port.split(':')
        self.sock = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                           f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.sock.recv(4096)
        self.buf = buf.split(b'\r\n\r\n', 1)[1]
        self.next_id = 0

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError('devtools socket closed')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _recv(self):
        data = b''
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7f
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            data += self._read(n)
            if b0 & 0x80:
                return data.decode('utf-8', 'replace')

    def call(self, method, **params):
        self.next_id += 1
        payload = json.dumps({'id': self.next_id, 'method': method, 'params': params}).encode()
        mask = os.urandom(4)
        n = len(payload)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('>H', n) if n < 65536 else bytes([0x80 | 127]) + struct.pack('>Q', n))
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
        while True:
            msg = json.loads(self._recv())
            if msg.get('id') == self.next_id:
                if 'error' in msg:
                    raise RuntimeError(msg['error'])
                return msg['result']

    def eval(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True)
        return r['result'].get('value')


def launch(url):
    profile = tempfile.mkdtemp(prefix='rb-chrome-')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                             '--mute-audio', '--window-size=' + os.environ.get('RB_WINDOW', '800,450'), '--remote-debugging-port=0', '--user-data-dir=' + profile,
                             '--no-first-run', '--no-default-browser-check', url],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    port_file = os.path.join(profile, 'DevToolsActivePort')
    for _ in range(200):
        if os.path.exists(port_file) and open(port_file).read().strip():
            break
        time.sleep(.1)
    port = open(port_file).read().split()[0]
    for _ in range(100):
        pages = [t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')) if t['type'] == 'page']
        if pages:
            break
        time.sleep(.1)
    return proc, profile, CDP(pages[0]['webSocketDebuggerUrl'])


def chord_fire_check(cdp):
    """Real (CDP) mouse input: hold the right button, then press the left button.
    Browsers report the second button of a chord as pointermove, not pointerdown, so
    this catches handlers that only listen for pointerdown."""
    cdp.eval("(() => { const G = riverbendGame.G; G.local.health = 1e6; G.local.weapon = 'rifle'; G.local.ammo.rifle.mag = 30; G.local.fireDelay = 0; G.local.reloadLeft = 0; })()")
    if cdp.eval('riverbendGame.G.status') != 'playing':
        print('FAIL fire while holding right mouse  (game not playing)')
        return False
    shots0 = cdp.eval('riverbendGame.G.local.stats.shots')
    x, y = 150, 300

    def mouse(kind, button, buttons):
        cdp.call('Input.dispatchMouseEvent', type=kind, x=x, y=y, button=button, buttons=buttons, clickCount=1)

    mouse('mousePressed', 'right', 2); time.sleep(.3)
    mouse('mousePressed', 'left', 3); time.sleep(1.5)
    fired = cdp.eval('riverbendGame.G.local.stats.shots') - shots0
    mouse('mouseReleased', 'left', 2); time.sleep(.3)
    after_left = cdp.eval('riverbendGame.G.local.input.trigger')
    mouse('mouseReleased', 'right', 0); time.sleep(.3)
    ok = fired > 0 and not after_left
    print(('PASS ' if ok else 'FAIL ') + f'fire while holding right mouse  (shots={fired}, trigger after release={after_left})')
    return ok


def main():
    if not CHROME:
        sys.exit('Chrome/Chromium not found')
    extra = sys.argv[sys.argv.index('--url-args') + 1] if '--url-args' in sys.argv else ''
    httpd = serve()
    url = f'http://127.0.0.1:{httpd.server_address[1]}/index.html?autotest=1{extra}'
    proc, profile, cdp = launch(url)
    try:
        report = None
        deadline = time.time() + 400
        while time.time() < deadline:
            title = cdp.eval('document.title') or ''
            if title.startswith('AUTOTEST'):
                report = json.loads(cdp.eval("document.getElementById('autotest-result').textContent"))
                break
            time.sleep(.5)
        if report is None:
            print('Timed out. Page state:', cdp.eval("JSON.stringify({title:document.title, load:document.getElementById('loadText')?.textContent, ready:!!window.gameReady})"))
            sys.exit(1)
        for item in report.get('log', []):
            print(('PASS ' if item['ok'] else 'FAIL ') + item['name'] + (f"  ({item['detail']})" if item.get('detail') not in ('', None) else ''))
        if report.get('crash'):
            print('CRASH:', report['crash'])
        ok = chord_fire_check(cdp)
        report['passed'] = report.get('passed') and ok
        print('draw calls:', report.get('drawCalls'))
        if '--screenshot' in sys.argv:
            path = os.path.abspath(sys.argv[sys.argv.index('--screenshot') + 1])
            with open(path, 'wb') as f:
                f.write(base64.b64decode(cdp.call('Page.captureScreenshot', format='png')['data']))
            print('screenshot:', path)
        sys.exit(0 if report.get('passed') else 1)
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
        httpd.shutdown()


if __name__ == '__main__':
    main()
