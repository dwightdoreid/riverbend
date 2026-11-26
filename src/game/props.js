// Interactive mission props and pickups, created from mission data.
// Every prop has a `style` (its visual state) that events change and checkpoints restore.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, geo, mesh, glowMats } from '../engine/builders.js';
import { G } from './state.js';

const emissive = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .5 });

const PROP_TYPES = {
  terminal(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const styles = { amber: glowMats.amber(), teal: glowMats.teal() };
    box(root, x, .7, z, .65, 1.4, .5, 'dark');
    const screen = box(root, x, 1.5, z, .78, .55, .12, styles[def.style ?? 'amber']); screen.rotation.x = -.2;
    box(root, x, 1.16, z + .15, .8, .08, .5, 'edge'); cyl(root, x, .12, z, .65, .65, .18, 'edge', 12);
    return {
      root, pos: new THREE.Vector3(x, 1.45, z),
      setStyle(s) { screen.material = styles[s]; },
      update(t, i) { screen.material.emissiveIntensity = .6 + Math.sin(t * 3 + i) * .2; },
    };
  },

  extraction(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const ringMat = glowMats.teal(), r = def.radius ?? 2.65;
    const ring = mesh(root, geo('torus', r, .065, 6, 64), ringMat, x, .24, z); ring.rotation.x = Math.PI / 2;
    for (const dx of [-3.3, 3.3]) { box(root, x + dx, .8, z, .12, 1.4, .12, 'steel'); box(root, x + dx, 1.52, z, .3, .16, .3, ringMat); }
    return {
      root, pos: new THREE.Vector3(x, 1, z),
      setStyle() {},
      update(t, i, active) { ringMat.emissiveIntensity = active ? .8 + Math.sin(t * 4) * .2 : .3; },
    };
  },

  // A stranded lineman crouched in cover, headlamp blinking. Style 'gone' once rescued.
  survivor(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.facing ?? 0;
    const suit = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: .8 });
    const lamp = emissive(0xfff3c4, 2);
    box(g, 0, .55, 0, .5, .6, .42, suit);                       // torso (crouched)
    box(g, 0, .2, -.22, .46, .32, .5, 'dark');                   // legs folded
    cyl(g, 0, 1.0, 0, .15, .16, .26, new THREE.MeshStandardMaterial({ color: 0xc9a27e }), 10); // head
    cyl(g, 0, 1.16, 0, .2, .2, .1, 'amber', 12);                 // hard hat
    box(g, 0, 1.08, -.16, .08, .06, .04, lamp);                  // headlamp
    for (const s of [-1, 1]) box(g, s * .1, .58, -.24, .1, .1, .1, 'white'); // reflective stripes
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return {
      root, pos: new THREE.Vector3(x, .9, z),
      setStyle(s) { root.visible = s !== 'gone'; },
      update(t, i) { lamp.emissiveIntensity = (Math.sin(t * 5 + i * 2) > .6) ? 3 : .4; },
    };
  },

  // Breaker cabinet with a status lamp: style 'off' (red) or 'on' (green).
  panel(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const lamps = { off: emissive(0xe0503a, 1.2), on: emissive(0x5ce08a, 1.4) };
    const f = def.facing ?? 1; // door faces +z (1) or -z (-1)
    box(root, x, .95, z, 1.1, 1.9, .55, 'edge'); box(root, x, .95, z + f * .29, .95, 1.7, .04, 'dark');
    box(root, x - .2, 1.2, z + f * .32, .08, .32, .06, 'steel'); box(root, x + .2, 1.2, z + f * .32, .08, .32, .06, 'steel');
    const lamp = cyl(root, x, 1.75, z + f * .3, .06, .06, .08, lamps[def.style ?? 'off'], 10); lamp.rotation.x = Math.PI / 2;
    return {
      root, pos: new THREE.Vector3(x, 1.2, z),
      setStyle(s) { lamp.material = lamps[s]; },
      update() {},
    };
  },

  // Floodlight mast. Style 'on' lights the area (players inside become visible in the dark).
  floodlight(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const h = def.height ?? 7, aim = def.aim ?? [x, z];
    cyl(root, x, h / 2, z, .08, .12, h, 'steel', 8); box(root, x, .15, z, .8, .3, .8, 'concrete');
    const headOff = new THREE.MeshStandardMaterial({ color: 0x39444a }), headOn = emissive(0xfff0c8, 2.5);
    const head = box(root, x, h + .1, z, .9, .35, .35, headOff);
    rod(root, [x, h - .3, z], [x, h + .1, z], .05, 'dark', 6);
    const light = new THREE.SpotLight(0xffe7b8, 0, 40, .75, .55, 1.3);
    light.position.set(x, h + .2, z); light.target.position.set(aim[0], 0, aim[1]);
    root.add(light); root.add(light.target);
    const prop = {
      root, pos: new THREE.Vector3(x, 1, z), lightRadius: def.radius ?? 9, lightCenter: new THREE.Vector3(aim[0], 0, aim[1]), lit: false,
      setStyle(s) { prop.lit = s === 'on'; head.material = prop.lit ? headOn : headOff; light.intensity = prop.lit ? (def.intensity ?? 38) : 0; },
      update() {},
    };
    return prop;
  },
};

const DEFAULT_STYLE = { terminal: 'amber', extraction: 'idle', survivor: 'present', panel: 'off', floodlight: 'off' };

export function spawnProps(defs) {
  G.props = {};
  for (const def of defs) {
    const p = Object.assign(PROP_TYPES[def.type](G.dynRoot, def), { id: def.id, type: def.type });
    const setStyle = p.setStyle;
    p.setStyle = s => { p.style = s; setStyle(s); };
    p.setStyle(def.style ?? DEFAULT_STYLE[def.type]);
    G.props[def.id] = p;
  }
}

export function updateProps(activeIds) {
  Object.values(G.props).forEach((p, i) => p.update(G.elapsed, i, activeIds.includes(p.id)));
}

/** Is this position inside the pool of any switched-on floodlight? */
export function litAt(pos) {
  for (const p of Object.values(G.props)) {
    if (p.lit && Math.hypot(pos.x - p.lightCenter.x, pos.z - p.lightCenter.z) < p.lightRadius) return true;
  }
  return false;
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
