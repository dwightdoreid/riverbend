// Navigation grid + A* pathfinding for enemies. Built once per level from the walk
// collisions, so machines can route around buildings and equipment instead of stalling
// against them.
import { THREE } from '../engine/three.js';
import { world, moveBlocked } from './world.js';

const CELL = 1, CLEARANCE = .32;
const nav = { grid: null, w: 0, h: 0, ox: 0, oz: 0 };

export function buildNav() {
  const b = world.bounds;
  nav.ox = -b.x; nav.oz = -b.z;
  nav.w = Math.floor(2 * b.x / CELL) + 1; nav.h = Math.floor(2 * b.z / CELL) + 1;
  nav.grid = new Uint8Array(nav.w * nav.h);
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    nav.grid[j * nav.w + i] = moveBlocked(nav.ox + i * CELL, nav.oz + j * CELL, CLEARANCE) ? 1 : 0;
  }
}

const cellX = x => Math.round((x - nav.ox) / CELL), cellZ = z => Math.round((z - nav.oz) / CELL);
const inside = (i, j) => i >= 0 && j >= 0 && i < nav.w && j < nav.h;
const open = (i, j) => inside(i, j) && !nav.grid[j * nav.w + i];

/** Nearest open cell to (i, j), searching outward a few rings. */
function nearestOpen(i, j) {
  if (open(i, j)) return [i, j];
  for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) === r && open(i + di, j + dj)) return [i + di, j + dj];
  }
  return null;
}

/** True when a straight walk from a to b stays on open cells. */
export function walkable(a, b) {
  if (!nav.grid) return true;
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / (CELL * .5));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (!open(cellX(a.x + (b.x - a.x) * t), cellZ(a.z + (b.z - a.z) * t))) return false;
  }
  return true;
}

// Reused A* buffers.
let gScore, came, closed, heapCells, heapF;
function ensureBuffers() {
  const n = nav.w * nav.h;
  if (gScore?.length === n) return;
  gScore = new Float32Array(n); came = new Int32Array(n); closed = new Uint8Array(n);
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** A* path from `from` to `to` as a list of waypoints (smoothed), or null. */
export function findPath(from, to, maxExpand = 6000) {
  if (!nav.grid) return null;
  const s = nearestOpen(cellX(from.x), cellZ(from.z)), g = nearestOpen(cellX(to.x), cellZ(to.z));
  if (!s || !g) return null;
  ensureBuffers();
  gScore.fill(Infinity); closed.fill(0);
  const W = nav.w, start = s[1] * W + s[0], goal = g[1] * W + g[0];
  const hEst = c => { const dx = Math.abs(c % W - g[0]), dz = Math.abs(Math.floor(c / W) - g[1]); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  heapCells = [start]; heapF = [hEst(start)]; gScore[start] = 0; came[start] = -1;
  let expanded = 0, found = false;
  while (heapCells.length && expanded++ < maxExpand) {
    // Binary-heap pop.
    const cur = heapCells[0], last = heapCells.pop(), lastF = heapF.pop();
    if (heapCells.length) { heapCells[0] = last; heapF[0] = lastF; siftDown(0); }
    if (closed[cur]) continue;
    if (cur === goal) { found = true; break; }
    closed[cur] = 1;
    const ci = cur % W, cj = Math.floor(cur / W);
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (!open(ni, nj)) continue;
      if (di && dj && (!open(ci + di, cj) || !open(ci, cj + dj))) continue; // no corner cutting
      const n = nj * W + ni, tentative = gScore[cur] + cost;
      if (tentative < gScore[n]) { gScore[n] = tentative; came[n] = cur; push(n, tentative + hEst(n)); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map(c => new THREE.Vector3(nav.ox + (c % W) * CELL, 0, nav.oz + Math.floor(c / W) * CELL));
  pts[pts.length - 1] = new THREE.Vector3(to.x, 0, to.z);
  // String-pull: keep only the waypoints needed to stay on walkable straight lines.
  const out = []; let anchor = new THREE.Vector3(from.x, 0, from.z);
  for (let k = 1; k < pts.length; k++) {
    if (!walkable(anchor, pts[k])) { out.push(pts[k - 1]); anchor = pts[k - 1]; }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function push(cell, f) {
  heapCells.push(cell); heapF.push(f);
  let i = heapCells.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] <= heapF[i]) break;
    [heapCells[p], heapCells[i]] = [heapCells[i], heapCells[p]]; [heapF[p], heapF[i]] = [heapF[i], heapF[p]]; i = p;
  }
}
function siftDown(i) {
  const n = heapCells.length;
  for (;;) {
    const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < n && heapF[l] < heapF[m]) m = l;
    if (r < n && heapF[r] < heapF[m]) m = r;
    if (m === i) return;
    [heapCells[m], heapCells[i]] = [heapCells[i], heapCells[m]]; [heapF[m], heapF[i]] = [heapF[i], heapF[m]]; i = m;
  }
}
