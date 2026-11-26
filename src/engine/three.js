// Three.js r160 is loaded as a classic script (vendor/three.min.js) and exposes a global.
// Every module imports it from here so swapping to an ES-module build later is a one-line change.
export const THREE = window.THREE;
