// Interactive mission props and pickups, created from mission data.
import { THREE } from '../engine/three.js';
import { box, cyl, geo, mesh, glowMats } from '../engine/builders.js';
import { G } from './state.js';

const PROP_TYPES = {
  terminal(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const styles = { amber: glowMats.amber(), teal: glowMats.teal() };
    box(root, x, .7, z, .65, 1.4, .5, 'dark');
    const screen = box(root, x, 1.5, z, .78, .55, .12, styles[def.style]); screen.rotation.x = -.2;
    box(root, x, 1.16, z + .15, .8, .08, .5, 'edge'); cyl(root, x, .12, z, .65, .65, .18, 'edge', 12);
    return {
      root, pos: new THREE.Vector3(x, 1.45, z),
      setStyle(s) { screen.material = styles[s]; },
      update(t, i) { screen.material.emissiveIntensity = .6 + Math.sin(t * 3 + i) * .2; },
    };
  },
  extraction(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const ringMat = glowMats.teal();
    const ring = mesh(root, geo('torus', 2.65, .065, 6, 64), ringMat, x, .24, z); ring.rotation.x = Math.PI / 2;
    for (const dx of [-3.3, 3.3]) { box(root, x + dx, .8, z, .12, 1.4, .12, 'steel'); box(root, x + dx, 1.52, z, .3, .16, .3, ringMat); }
    return {
      root, pos: new THREE.Vector3(x, 1, z),
      setStyle() {},
      update(t, i, active) { ringMat.emissiveIntensity = active ? 1 : .3; },
    };
  },
};

export function spawnProps(defs) {
  G.props = {};
  for (const def of defs) G.props[def.id] = { id: def.id, ...PROP_TYPES[def.type](G.dynRoot, def) };
}

export function updateProps(activeId) {
  Object.values(G.props).forEach((p, i) => p.update(G.elapsed, i, p.id === activeId));
}

export function spawnPickups(defs) {
  G.pickups = defs.map(([x, z, type]) => {
    const g = new THREE.Group(); G.dynRoot.add(g);
    box(g, x, .5, z, 1, .85, .75, type === 'med' ? 'white' : 'crate');
    if (type === 'med') { box(g, x, .53, z + .39, .55, .16, .04, 'green'); box(g, x, .53, z + .41, .16, .55, .04, 'green'); }
    else for (const dx of [-.3, .3]) box(g, x + dx, .5, z + .39, .07, .7, .03, 'amber');
    return { g, pos: new THREE.Vector3(x, .8, z), type, used: false };
  });
}
