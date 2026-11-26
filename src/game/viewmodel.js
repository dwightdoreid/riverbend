// First-person camera and held-weapon model for the local player.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, mesh, geo, glow } from '../engine/builders.js';
import { camera, viewCamera, weaponScene } from '../engine/render.js';
import { reduced } from '../engine/dom.js';

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
  } else if (type === 'pistol') {
    box(g, 0, .02, -.01, .105, .11, .27, 'edge'); box(g, 0, -.035, .02, .09, .06, .24, 'dark');
    box(g, 0, -.15, .09, .09, .22, .11, 'dark').rotation.x = -.24;
    rod(g, [0, .017, -.13], [0, .017, -.2], .019, 'dark', 8); box(g, 0, .09, -.115, .017, .03, .023, 'steel');
    box(g, 0, .09, .08, .06, .025, .03, 'dark'); box(g, .067, -.15, .12, .065, .12, .14, 'green');
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
['rifle', 'pistol', 'shotgun', 'grenade'].forEach(gunModel);

const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdca1, transparent: true, opacity: .9, depthTest: false });
const muzzle = mesh(gunRig, geo('cone', .075, .23, 5), flashMat, 0, .03, -.79);
muzzle.rotation.x = -Math.PI / 2; muzzle.visible = false;

export function updateCamera(p) {
  camera.position.set(p.pos.x, p.eye + (reduced ? 0 : Math.sin(p.bob) * .016 * p.moving), p.pos.z);
  camera.rotation.set(THREE.MathUtils.clamp(p.pitch + p.kick, -1.35, 1.35), p.yaw, 0, 'YXZ');
  camera.fov = 78 - p.aimBlend * 21; camera.updateProjectionMatrix();
}

export function updateViewModel(p) {
  const armed = p.alive && !p.downed;
  for (const [k, g] of Object.entries(gunModels)) g.visible = armed && k === p.weapon;
  const portrait = innerHeight > innerWidth, scale = portrait ? .8 : 1, pistol = p.weapon === 'pistol';
  gunRig.scale.setScalar(scale);
  const x = THREE.MathUtils.lerp((pistol ? .24 : .29) * (portrait ? .62 : 1), 0, p.aimBlend);
  const y = THREE.MathUtils.lerp(-.25 * scale, (pistol ? -.09 : -.185) * scale, p.aimBlend);
  const z = (pistol ? -.46 : -.49) * (portrait ? 1.1 : 1);
  const bob = (reduced ? 0 : Math.sin(p.bob) * .009 * p.moving) * (1 - p.aimBlend * .8);
  gunRig.position.set(x + bob, y + Math.abs(bob) + p.weaponKick * .4, z + p.weaponKick);
  gunRig.rotation.set(p.weaponKick * .7, -p.weaponKick * .13, 0);
  if (p.reloadLeft > 0) {
    const t = 1 - p.reloadLeft / p.reloadTotal;
    gunRig.position.y -= Math.sin(t * Math.PI) * .19; gunRig.rotation.z = -Math.sin(t * Math.PI) * .5; gunRig.rotation.x -= Math.sin(t * Math.PI) * .25;
  }
  if (p.swapLeft > 0) gunRig.position.y -= p.swapLeft * .8;
  muzzle.visible = armed && p.muzzleLeft > 0 && p.weapon !== 'grenade';
  muzzle.position.z = pistol ? -.22 : p.weapon === 'shotgun' ? -.74 : -.78; muzzle.rotation.z = Math.random() * 6;
  viewCamera.fov = 70 - p.aimBlend * 7; viewCamera.updateProjectionMatrix();
}
