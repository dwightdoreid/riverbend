// First-person camera and held-weapon model for the local player.
import { shakeOffset, ejectCasing } from './vfx.js';
import { THREE } from '../engine/three.js';
import { box, cyl, rod, mesh, geo, glow } from '../engine/builders.js';
import { camera, viewCamera, weaponScene } from '../engine/render.js';
import { reduced } from '../engine/dom.js';
import { WEAPONS } from './weapons.js';

const gunRig = new THREE.Group(); weaponScene.add(gunRig);
const gunModels = {};

function gunModel(type) {
  const g = new THREE.Group(); gunModels[type] = g; gunRig.add(g);
  if (type === 'rifle') {
    box(g, 0, 0, 0, .13, .16, .34, 'dark'); box(g, 0, .035, -.27, .115, .13, .32, 'edge');
    for (let z = -.4; z < -.12; z += .055) box(g, 0, .108, z, .14, .018, .023, 'dark');
    rod(g, [0, .035, -.43], [0, .035, -.74], .022, 'dark', 9); cyl(g, 0, .11, -.51, .015, .015, .09, 'steel', 7);
    box(g, 0, -.055, .3, .12, .18, .27, 'edge'); box(g, 0, .02, .21, .07, .065, .18, 'dark');
    box(g, 0, -.18, .09, .08, .24, .1, 'edge').rotation.x = -.3;
    box(g, 0, -.23, -.06, .09, .3, .16, 'dark').rotation.x = -.13;
    box(g, 0, .14, .05, .08, .06, .09, 'edge'); mesh(g, geo('torus', .048, .008, 5, 14), 'dark', 0, .19, -.02);
    box(g, 0, .19, -.019, .006, .006, .005, glow); box(g, -.1, -.09, -.2, .08, .1, .21, 'green'); box(g, .09, -.17, .1, .08, .12, .16, 'green');
  } else if (type === 'pistol' || type === 'spistol') {
    if (type === 'spistol') rod(g, [0, .017, -.13], [0, .017, -.36], .032, 'dark', 10);   // suppressor
    box(g, 0, .02, -.01, .105, .11, .27, 'edge'); box(g, 0, -.035, .02, .09, .06, .24, 'dark');
    box(g, 0, -.15, .09, .09, .22, .11, 'dark').rotation.x = -.24;
    rod(g, [0, .017, -.13], [0, .017, -.2], .019, 'dark', 8); box(g, 0, .09, -.115, .017, .03, .023, 'steel');
    box(g, 0, .09, .08, .06, .025, .03, 'dark'); box(g, .067, -.15, .12, .065, .12, .14, 'green');
  } else if (type === 'arc') {
    const coil = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x3fa8ff, emissiveIntensity: 1.4 });
    box(g, 0, 0, 0, .13, .17, .4, 'edge'); box(g, 0, -.04, .3, .11, .16, .24, 'dark');
    for (let z = -.2; z >= -.5; z -= .08) cyl(g, 0, .03, z, .055, .055, .035, coil, 10).rotation.x = Math.PI / 2;   // coils
    rod(g, [0, .03, -.15], [0, .03, -.6], .025, 'dark', 8);
    box(g, 0, .13, -.05, .05, .07, .2, coil);
    box(g, 0, -.17, .08, .08, .22, .1, 'edge').rotation.x = -.3;
  } else if (type === 'launcher') {
    cyl(g, 0, .02, -.2, .05, .05, .58, 'green', 12).rotation.x = Math.PI / 2;           // barrel tube
    cyl(g, 0, .02, -.5, .058, .058, .05, 'dark', 12).rotation.x = Math.PI / 2;
    cyl(g, 0, -.01, .1, .075, .075, .15, 'dark', 8).rotation.x = Math.PI / 2;             // cylinder
    box(g, 0, -.05, .3, .1, .15, .26, 'edge'); box(g, 0, -.17, .12, .08, .2, .1, 'edge').rotation.x = -.3;
    box(g, 0, -.1, -.3, .06, .16, .08, 'dark').rotation.x = .3;                           // foregrip
    box(g, 0, .13, -.12, .03, .08, .02, 'steel'); box(g, 0, .12, .05, .05, .05, .02, glow);   // leaf sight
  } else if (type === 'dmr') {
    box(g, 0, 0, .02, .11, .15, .42, 'dark');                                   // receiver
    rod(g, [0, .03, -.2], [0, .03, -.86], .02, 'dark', 10);                     // long barrel
    box(g, 0, .02, -.36, .1, .1, .3, 'edge');                                   // handguard
    cyl(g, 0, .14, -.05, .04, .04, .32, 'dark', 12).rotation.x = Math.PI / 2;   // scope
    cyl(g, 0, .14, -.22, .046, .046, .02, 'edge', 12).rotation.x = Math.PI / 2;
    box(g, 0, .14, .115, .055, .055, .01, new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x2f6fa0, emissiveIntensity: .8 }));
    box(g, 0, -.2, -.02, .08, .26, .12, 'dark').rotation.x = -.1;               // magazine
    box(g, 0, -.05, .32, .11, .17, .3, 'edge'); box(g, 0, -.17, .13, .08, .2, .1, 'edge').rotation.x = -.3;
  } else if (type === 'shotgun') {
    box(g, 0, 0, .02, .12, .14, .36, 'dark');                                   // receiver
    rod(g, [0, .03, -.15], [0, .03, -.72], .026, 'steel', 10);                  // barrel
    rod(g, [0, -.035, -.15], [0, -.035, -.62], .022, 'dark', 10);               // magazine tube
    box(g, 0, -.035, -.36, .1, .085, .2, 'orange');                             // pump
    box(g, 0, -.06, .3, .11, .17, .28, 'edge');                                 // stock
    box(g, 0, -.17, .12, .08, .2, .1, 'edge').rotation.x = -.3;                 // grip
    box(g, 0, .095, -.68, .02, .03, .02, glow);                                 // bead sight
  } else {
    cyl(g, 0, -.07, 0, .06, .075, .17, 'green', 10); box(g, 0, .035, 0, .1, .03, .05, 'edge'); box(g, .07, -.11, .03, .07, .12, .12, 'green');
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
}
['rifle', 'pistol', 'spistol', 'shotgun', 'dmr', 'arc', 'launcher', 'grenade'].forEach(gunModel);

const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdca1, transparent: true, opacity: .9, depthTest: false });
const muzzle = mesh(gunRig, geo('cone', .075, .23, 5), flashMat, 0, .03, -.79);
muzzle.rotation.x = -Math.PI / 2; muzzle.visible = false;

export function updateCamera(p) {
  camera.position.set(p.pos.x, p.eye + (reduced ? 0 : Math.sin(p.bob) * .016 * p.moving), p.pos.z);
  camera.rotation.set(THREE.MathUtils.clamp(p.pitch + p.kick, -1.35, 1.35), p.yaw, 0, 'YXZ');
  const sh = shakeOffset(); if (sh) { camera.rotation.x += sh.pitch; camera.rotation.y += sh.yaw; camera.position.y += sh.y; }
  camera.fov = 78 - p.aimBlend * (WEAPONS[p.weapon]?.zoom ?? 21); camera.updateProjectionMatrix();
}

export function updateViewModel(p) {
  const armed = p.alive && !p.downed;
  // Fully aimed with a scoped weapon: hide the gun and show the scope overlay instead.
  const scoped = armed && p.weapon === 'dmr' && p.aimBlend > .8;
  document.getElementById('scope').classList.toggle('on', scoped);
  for (const [k, g] of Object.entries(gunModels)) g.visible = armed && !scoped && k === p.weapon;
  const portrait = innerHeight > innerWidth, scale = portrait ? .8 : 1, pistol = p.weapon === 'pistol' || p.weapon === 'spistol';
  gunRig.scale.setScalar(scale);
  const x = THREE.MathUtils.lerp((pistol ? .24 : .29) * (portrait ? .62 : 1), 0, p.aimBlend);
  const y = THREE.MathUtils.lerp(-.25 * scale, (pistol ? -.09 : p.weapon === 'dmr' ? -.14 : -.185) * scale, p.aimBlend);
  const z = (pistol ? -.46 : -.49) * (portrait ? 1.1 : 1);
  const bob = (reduced ? 0 : Math.sin(p.bob) * .009 * p.moving) * (1 - p.aimBlend * .8);
  gunRig.position.set(x + bob, y + Math.abs(bob) + p.weaponKick * .4, z + p.weaponKick);
  gunRig.rotation.set(p.weaponKick * .7, -p.weaponKick * .13, 0);
  if (p.reloadLeft > 0) {
    const t = 1 - p.reloadLeft / p.reloadTotal;
    gunRig.position.y -= Math.sin(t * Math.PI) * .19; gunRig.rotation.z = -Math.sin(t * Math.PI) * .5; gunRig.rotation.x -= Math.sin(t * Math.PI) * .25;
  }
  if (p.swapLeft > 0) gunRig.position.y -= p.swapLeft * .8;
  muzzle.visible = armed && p.muzzleLeft > 0 && p.weapon !== 'grenade' && p.weapon !== 'spistol';
  muzzle.position.z = pistol ? -.22 : p.weapon === 'shotgun' ? -.74 : p.weapon === 'dmr' ? -.88 : -.78; muzzle.rotation.z = Math.random() * 6;
  viewCamera.fov = 70 - p.aimBlend * 7; viewCamera.updateProjectionMatrix();
}

/** A spent casing from the current weapon (local player only). */
export function casing(p) { ejectCasing(weaponScene, p.weapon, gunRig); }
