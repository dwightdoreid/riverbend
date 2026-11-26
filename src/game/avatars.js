// Third-person bodies for the other players in a co-op game, with floating name tags.
import { THREE } from '../engine/three.js';
import { box, cyl } from '../engine/builders.js';
import { scene } from '../engine/render.js';
import { G } from './state.js';

const SLOT_COLORS = [0x5cc8a8, 0x8fc6f0, 0xf3ba65, 0xe07a6a];
const avatars = new Map();   // player id -> { root, body, tag, lamp, name }

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c1f26cc'; ctx.beginPath(); ctx.roundRect(4, 8, 248, 48, 10); ctx.fill();
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(4, 8, 6, 48);
  ctx.fillStyle = '#eaf1eb'; ctx.font = '600 28px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 132, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.3, .325, 1); s.renderOrder = 10;
  return s;
}

function build(p) {
  const color = SLOT_COLORS[p.id % SLOT_COLORS.length];
  const suit = new THREE.MeshStandardMaterial({ color: 0x3d4e48, roughness: .85 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: .6 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); scene.add(root);
  for (const s of [-1, 1]) box(body, s * .14, .45, 0, .2, .9, .24, suit);             // legs
  box(body, 0, 1.18, 0, .56, .66, .32, suit);                                         // torso
  box(body, 0, 1.22, -.17, .44, .42, .05, accent);                                    // chest plate (slot colour)
  for (const s of [-1, 1]) box(body, s * .36, 1.2, -.14, .14, .5, .14, suit);         // arms
  cyl(body, 0, 1.68, 0, .15, .16, .26, new THREE.MeshStandardMaterial({ color: 0xc9a27e }), 10);
  cyl(body, 0, 1.82, 0, .19, .2, .14, accent, 12);                                     // helmet
  box(body, .16, 1.22, -.45, .08, .12, .62, 'dark');                                   // rifle
  const lamp = box(body, .1, 1.78, -.18, .07, .05, .04, new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xfff1d6, emissiveIntensity: 0 }));
  body.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const tag = nameTag(p.name, color); tag.position.y = 2.25; root.add(tag);
  return { root, body, tag, lamp, name: p.name };
}

export function updateAvatars() {
  const seen = new Set();
  for (const p of G.players) {
    if (p.local) continue;
    seen.add(p.id);
    let a = avatars.get(p.id);
    if (a && a.name !== p.name) { a.root.removeFromParent(); a = null; }
    if (!a) { a = build(p); avatars.set(p.id, a); }
    const show = G.status !== 'briefing' && (p.alive || p.downed);
    a.root.visible = show;
    if (!show) continue;
    a.root.position.copy(p.pos); a.root.rotation.y = p.yaw;
    if (p.downed) { a.body.rotation.x = -Math.PI / 2; a.body.position.set(0, .3, .9); a.body.scale.y = 1; }
    else { a.body.rotation.x = 0; a.body.position.set(0, 0, 0); a.body.scale.y = p.crouched ? .7 : 1; }
    a.tag.position.y = p.downed ? .9 : p.crouched ? 1.75 : 2.25;
    a.tag.material.color.set(p.downed ? 0xff8a70 : 0xffffff);
    a.lamp.material.emissiveIntensity = p.flashlight ? 3 : 0;
  }
  for (const [id, a] of avatars) if (!seen.has(id)) { a.root.removeFromParent(); avatars.delete(id); }
}
export const avatarCount = () => avatars.size;
