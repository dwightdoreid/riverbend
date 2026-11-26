import { THREE } from './three.js';
import { $, coarse } from './dom.js';

export const canvas = $('world');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.3 : 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, .08, 450);
camera.rotation.order = 'YXZ';

export const hemi = new THREE.HemisphereLight(0xc5daee, 0x555b4c, 1.9); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffd6a0, 2.8);
sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
sun.shadow.bias = -.0003; sun.shadow.normalBias = .07;
scene.add(sun); scene.add(sun.target);

// Player flashlight. It always exists (intensity 0 when off) so toggling it never forces a
// shader recompile; three.js recompiles materials when the number of lights changes.
scene.add(camera);
export const flashlight = new THREE.SpotLight(0xfff1d6, 0, 55, .5, .55, 1.4);
flashlight.position.set(.18, -.12, 0); flashlight.target.position.set(0, -.08, -1);
camera.add(flashlight); camera.add(flashlight.target);
export const FLASHLIGHT_INTENSITY = 95;

/** Lighting presets a mission can apply on top of its level's own environment. */
export const ENV_PRESETS = {
  day: {},
  night: {
    sky: '#0a121b', fog: [18, 95], hemi: [0x3a4d66, 0x0b0e12, .5], exposure: 1.15,
    sun: { color: 0x9fb6ff, intensity: .28, pos: [35, 60, -45] }, dark: true, sightScale: .55,
  },
  storm: {
    sky: '#3c4750', fog: [30, 140], hemi: [0x8796a3, 0x2a2f33, 1.1], exposure: 1,
    sun: { color: 0xc7d3dc, intensity: .9, pos: [-20, 70, 10] }, sightScale: .8,
  },
};

// The weapon is rendered in a separate scene, so its near plane never clips through the world.
export const weaponScene = new THREE.Scene();
export const viewCamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .01, 5);
weaponScene.add(new THREE.HemisphereLight(0xcfe2ef, 0x69716b, 2.2));
const gunLight = new THREE.DirectionalLight(0xffe8c5, 2); gunLight.position.set(-2, 4, 3); weaponScene.add(gunLight);

/** Applies a level's sky, fog, light and shadow settings. */
export function applyEnvironment(env) {
  renderer.toneMappingExposure = env.exposure ?? 1.05;
  scene.background = new THREE.Color(env.sky);
  scene.fog = new THREE.Fog(env.sky, env.fog[0], env.fog[1]);
  hemi.color.set(env.hemi?.[0] ?? 0xc5daee); hemi.groundColor.set(env.hemi?.[1] ?? 0x555b4c); hemi.intensity = env.hemi?.[2] ?? 1.9;
  sun.color.set(env.sun?.color ?? 0xffd6a0); sun.intensity = env.sun?.intensity ?? 2.8;
  sun.position.set(...(env.sun?.pos ?? [-48, 53, 30])); sun.target.position.set(0, 0, 0);
  const s = env.shadowExtent ?? 83;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: env.shadowFar ?? 210 });
  sun.shadow.camera.updateProjectionMatrix();
}

export function setQuality(v) {
  const scale = { low: 1, medium: coarse ? 1.15 : 1.35, high: 1.75 }[v];
  renderer.setPixelRatio(Math.min(devicePixelRatio, scale));
  renderer.shadowMap.enabled = v !== 'low';
  sun.shadow.mapSize.set(v === 'high' ? 2048 : 1024, v === 'high' ? 2048 : 1024);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.needsUpdate = true;
}

export function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = viewCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); viewCamera.updateProjectionMatrix();
}

export function renderFrame(withWeapon) {
  renderer.clear(); renderer.render(scene, camera);
  if (withWeapon) { renderer.clearDepth(); renderer.render(weaponScene, viewCamera); }
}
