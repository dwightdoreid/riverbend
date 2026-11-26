// Keyboard, mouse and touch input for the local player. Continuous controls are written into
// G.local.input each frame; one-shot actions (reload, grenade, swap...) call the sim directly.
import { THREE } from './engine/three.js';
import { $, coarse } from './engine/dom.js';
import { canvas } from './engine/render.js';
import { initAudio } from './engine/audio.js';
import { G } from './game/state.js';
import { reload, throwGrenade, switchWeapon, WEAPONS } from './game/weapons.js';
import { deployTurret } from './game/turrets.js';
import { pause } from './game/flow.js';
import { say } from './ui/hud.js';

const keys = new Set();
export const settings = { sensitivity: 1 };
let dragId = null, dragLast = null, rightDrag = false, hadLock = false, rmbAim = false, lastTouch = -1e9;

const playing = () => G.status === 'playing' && !G.overlay;
const me = () => G.local;

export function sampleInput() {
  const i = me().input;
  i.forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  i.side = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  i.sprint = keys.has('shift');
  i.use = keys.has('e');
}

export function clearInput() {
  keys.clear(); rightDrag = false; rmbAim = false; dragLast = null;
  const p = me(); if (!p) return;
  p.input.trigger = p.input.semi = false; p.aiming = false;
  Object.assign(p.input, { forward: 0, side: 0, sprint: false, use: false });
}

export function requestMouse() {
  if (coarse) return;
  try {
    const r = canvas.requestPointerLock?.();
    if (r?.catch) r.catch(() => { say('Right-drag to look. Q toggles aim.', 5); $('tapResume').style.display = 'block'; });
  } catch { $('tapResume').style.display = 'block'; }
  canvas.focus();
}
export function releaseMouse() { if (document.pointerLockElement) document.exitPointerLock(); }

function setFire(down) {
  if (!playing()) return;
  if (down) { me().input.trigger = true; me().input.semi = true; } else me().input.trigger = false;
}
function toggleCrouch() { me().crouched = !me().crouched; $('crouchBtn').classList.toggle('primary', me().crouched); }
function toggleLight() { me().flashlight = !me().flashlight; $('lightBtn').classList.toggle('primary', me().flashlight); }
function toggleAim() { me().aiming = !me().aiming; $('aimBtn').classList.toggle('primary', me().aiming); }

function look(dx, dy, touch) {
  // Slower look while zoomed, in proportion to the weapon's zoom (DMR zooms furthest).
  const p = me(), zoom = (WEAPONS[p.weapon]?.zoom ?? 21) / 78, factor = (touch ? .004 : .0022) * settings.sensitivity * (1 - p.aimBlend * zoom * 1.1);
  p.yaw -= dx * factor; p.pitch = THREE.MathUtils.clamp(p.pitch - dy * factor, -1.3, 1.3);
}

function holdButton(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (!playing()) return; el.setPointerCapture(e.pointerId); down(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => up());
}

export function setupInput() {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // Touch: pointer events (one finger drags to look; buttons are handled separately).
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !playing()) return;
    lastTouch = performance.now(); initAudio();
    if (dragId === null) { dragId = e.pointerId; dragLast = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointerup', e => { if (e.pointerId === dragId) { dragId = null; dragLast = null; } });
  canvas.addEventListener('pointercancel', () => { dragId = null; rightDrag = false; if (me()) me().input.trigger = false; dragLast = null; });

  // Mouse buttons: mousedown/mouseup fire for every button, unlike pointerdown/pointerup,
  // which report a second button pressed during a chord (e.g. fire while holding aim) only
  // as a pointermove.
  canvas.addEventListener('mousedown', e => {
    if (!playing() || performance.now() - lastTouch < 1000) return; // ignore touch-emulated clicks
    initAudio();
    if (e.button === 0) setFire(true);
    if (e.button === 2) {
      if (document.pointerLockElement === canvas) { me().aiming = true; rmbAim = true; }
      else { rightDrag = true; dragLast = [e.clientX, e.clientY]; }
    }
  });
  document.addEventListener('mouseup', e => {
    if (!me()) return;
    if (e.button === 0) me().input.trigger = false;
    if (e.button === 2) {
      rightDrag = false; dragLast = null;
      if (rmbAim) { me().aiming = false; rmbAim = false; }
    }
  });
  document.addEventListener('pointermove', e => {
    if (!playing()) return;
    let dx = 0, dy = 0;
    if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
    else if ((e.pointerId === dragId || (rightDrag && e.pointerType !== 'touch')) && dragLast) { dx = e.clientX - dragLast[0]; dy = e.clientY - dragLast[1]; dragLast = [e.clientX, e.clientY]; }
    else return;
    look(dx, dy, e.pointerType === 'touch');
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { hadLock = true; $('tapResume').style.display = 'none'; }
    else if (hadLock && playing()) pause();
  });

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (e.target.matches?.('input,select')) return;
    if (k === 'escape') { if (playing()) pause(); return; }
    if (!playing() || (e.ctrlKey && k !== 'control') || e.metaKey || e.altKey) return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'control'].includes(k)) e.preventDefault();
    keys.add(k);
    if (e.repeat) return;
    const p = me();
    if (k === 'r') reload(p);
    else if (k === 'g') throwGrenade(p);
    else if (/^[1-9]$/.test(k)) { const slot = [...p.loadout, 'grenade'][+k - 1]; if (slot) switchWeapon(p, slot); }
    else if (k === 'c' || k === 'control') p.crouched = !p.crouched;
    else if (k === 'q') p.aiming = !p.aiming;
    else if (k === 'f') toggleLight();
    else if (k === 't') deployTurret(p);
    else if (k === 'v') throwGrenade(p, 'smoke');
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); if (me()) me().input.trigger = me().input.semi = false; if (playing()) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing()) pause(); });

  // Touch controls.
  for (const b of document.querySelectorAll('[data-key]')) holdButton(b, () => keys.add(b.dataset.key), () => keys.delete(b.dataset.key));
  holdButton($('fireBtn'), () => setFire(true), () => setFire(false));
  holdButton($('sprintBtn'), () => keys.add('shift'), () => keys.delete('shift'));
  holdButton($('useBtn'), () => keys.add('e'), () => keys.delete('e'));
  $('aimBtn').onclick = () => { if (playing()) toggleAim(); };
  $('crouchBtn').onclick = () => { if (playing()) toggleCrouch(); };
  $('lightBtn').onclick = () => { if (playing()) toggleLight(); };
  $('turretBtn').onclick = () => { if (playing()) deployTurret(me()); };
  $('smokeBtn').onclick = () => { if (playing()) throwGrenade(me(), 'smoke'); };
  $('reloadBtn').onclick = () => reload(me());
  $('grenadeBtn').onclick = () => throwGrenade(me());
  $('weapons').onclick = e => { const b = e.target.closest('[data-weapon]'); if (b && playing()) switchWeapon(me(), b.dataset.weapon); };
  $('tapResume').onclick = requestMouse;
}
