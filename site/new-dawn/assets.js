// New Dawn: every 3D model in the world, built in code.
// tools/export.html saves the landmarks, cloud, leaf and poppy as .glb files.
import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";

// Full-strength rainbow, nudged warm. Saturated on purpose: no pastels.
export const RAINBOW = ["#ff2a4f", "#ff6a13", "#ffb400", "#ffe000", "#7ad61d", "#13c47a", "#12a8ff", "#4a5bff", "#9b3dff", "#ff3fb4"];
export const INK = "#1a1020";


// ---------- wildflower (small, many) ----------
export function wildflowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.008, 0.012, 0.5, 4);
  stem.translate(0, 0.25, 0);
  paint(stem, "#2a9d33", 0);
  parts.push(stem);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.CircleGeometry(0.045, 8);
    p.scale(0.7, 1.25, 1);
    p.translate(0, 0.055, 0);
    p.rotateZ((i / 6) * Math.PI * 2);
    p.rotateX(-0.9);
    p.translate(0, 0.5, 0);
    paint(p, "#ffffff", 1);
    parts.push(p);
  }
  const c = new THREE.SphereGeometry(0.03, 8, 6);
  c.translate(0, 0.51, 0);
  paint(c, "#ffcf00", 0);
  parts.push(c);
  return mergeGeometries(parts);
}
function paint(geo, hex, tint) {
  const col = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const cols = new Float32Array(n * 3);
  const tints = new Float32Array(n).fill(tint);
  for (let i = 0; i < n; i++) col.toArray(cols, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 1));
}

// ---------- grass blade ----------
export function bladeGeometry() {
  const segs = 5, w = 0.055;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const half = w * (1 - t * t * 0.95);
    pos.push(-half, t, 0, half, t, 0);
    uv.push(0, t, 1, t);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function petalShape(w, l, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(0, y0);
  s.bezierCurveTo(w * 0.95, y0 + l * 0.2, w * 1.05, y0 + l * 0.9, 0, y0 + l);
  s.bezierCurveTo(-w * 1.05, y0 + l * 0.9, -w * 0.95, y0 + l * 0.2, 0, y0);
  return s;
}

// ---------- falling leaf ----------
export function leafGeometry() {
  const s = petalShape(0.09, 0.26, -0.13);
  const g = new THREE.ShapeGeometry(s, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.6); // a gentle fold along the vein
  g.computeVertexNormals();
  return g;
}

// ---------- sun ----------
export function makeSun() {
  const sun = new THREE.Group();
  sun.name = "sun";
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshBasicMaterial({ color: "#ffd21a", fog: false }));
  disc.name = "disc";
  const rays = new THREE.Group();
  rays.name = "rays";
  const n = 18;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Shape();
    s.moveTo(-0.9, 0); s.lineTo(0, 4.2 + (i % 2) * 1.6); s.lineTo(0.9, 0); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: i % 2 ? "#ff9d00" : "#ffc21a", fog: false }));
    m.position.y = 6.6;
    const sp = new THREE.Group();
    sp.rotation.z = (i / n) * Math.PI * 2;
    sp.add(m);
    rays.add(sp);
  }
  rays.position.z = -0.1;
  sun.add(rays, disc);
  return { root: sun, disc, rays };
}

export function glowTexture(inner = "rgba(255,240,180,1)", outer = "rgba(255,200,80,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, inner);
  r.addColorStop(0.25, inner.replace(/[\d.]+\)$/, "0.55)"));
  r.addColorStop(1, outer);
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- cloud ----------
export function makeCloud(seed = 1) {
  const rnd = mulberry(seed);
  const g = new THREE.Group();
  g.name = "cloud";
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#fff6e8", emissiveIntensity: 0.35 });
  g.userData.mat = mat;
  const puffs = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < puffs; i++) {
    const r = 1.2 + rnd() * 1.6;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
    m.position.set((i - puffs / 2) * 1.6 + rnd(), Math.sin((i / (puffs - 1)) * Math.PI) * 1.2 + rnd() * 0.4, rnd() * 1.2);
    m.scale.y = 0.8;
    g.add(m);
  }
  return g;
}

// ---------- rainbow ----------
export function makeRainbow(radius = 60, width = 7) {
  const geo = new THREE.RingGeometry(radius - width / 2, radius + width / 2, 160, 1, 0, Math.PI);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uR: { value: radius }, uW: { value: width }, uAlpha: { value: 0.3 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vP; uniform float uR, uW, uAlpha;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){
        float t = (length(vP) - (uR - uW*0.5)) / uW;
        vec3 c = hue(0.78 * (1.0 - t));
        float edge = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);
        float lift = smoothstep(-2.0, 18.0, vP.y);
        gl_FragColor = vec4(c, uAlpha * edge * lift);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = "rainbow";
  return m;
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- print style: toon shading in three flat inks ----------
// With `spectrum`, each instance carries aBand (which frequency band it belongs to, -1 for none)
// and aAlong (0 near the sun, 1 at the far end); its band's energy swells and warms it.
export function toonMaterial({ lit = "#ffffff", mid = "#bcd0ff", shadow = "#2c4bd0", light = new THREE.Vector3(-0.3, 0.6, 0.75), bumps = 1, spectrum = false } = {}) {
  return new THREE.ShaderMaterial({
    fog: false,
    defines: spectrum ? { SPECTRUM: "" } : {},
    uniforms: {
      uLit: { value: new THREE.Color(lit) }, uMid: { value: new THREE.Color(mid) }, uShadow: { value: new THREE.Color(shadow) },
      uLight: { value: light.clone().normalize() }, uBumps: { value: bumps }, uAppear: { value: 1 },
      uBands: { value: new Array(12).fill(0) }, uBass: { value: 0 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vW; varying float vGlow; uniform float uAppear;
      #ifdef SPECTRUM
        attribute float aBand; attribute float aAlong; uniform float uBands[12]; uniform float uBass;
      #endif
      void main(){
        float grow = 1.0;
        vGlow = 0.0;
        #ifdef SPECTRUM
          float e = aBand < 0.0 ? uBass * 0.35 : uBands[int(aBand)];
          // energy reaches further out along the streak the louder the band is
          float reach = aBand < 0.0 ? 1.0 : smoothstep(e * 1.25 + 0.05, e * 1.25 - 0.25, aAlong);
          grow = 1.0 + e * reach * 0.15;
          vGlow = e * reach;
        #endif
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vN = normalize(mat3(m) * normal);
        vec4 w = m * vec4(position * uAppear * grow, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vW; varying float vGlow;
      uniform vec3 uLit, uMid, uShadow, uLight; uniform float uBumps;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        float d = dot(normalize(vN), uLight) * 0.5 + 0.5;
        d += (sin(vW.x*1.7 + vW.y*2.3) * sin(vW.y*1.9 - vW.z*1.3)) * 0.07 * uBumps;
        vec3 c = mix(uShadow, uMid, smoothstep(0.40, 0.44, d));
        c = mix(c, uLit, smoothstep(0.60, 0.64, d));
        c = mix(c, vec3(1.0, 0.78, 0.45), clamp(vGlow, 0.0, 1.0) * 0.15 * smoothstep(0.4, 0.62, d));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// A low sun: white core, orange ring, and a fan of fine dotted rays.
export function printSunTextures() {
  const disc = document.createElement("canvas");
  disc.width = disc.height = 512;
  let g = disc.getContext("2d");
  const r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  r.addColorStop(0, "#ffffff"); r.addColorStop(0.5, "#fff6d8"); r.addColorStop(0.6, "#ffd24a");
  r.addColorStop(0.68, "#ff8a1a"); r.addColorStop(0.86, "#ff5a0a"); r.addColorStop(0.93, "#c8300a"); r.addColorStop(0.97, "rgba(160,30,10,0)");
  g.fillStyle = r; g.fillRect(0, 0, 512, 512);
  const rays = document.createElement("canvas");
  rays.width = rays.height = 1024;
  g = rays.getContext("2d");
  g.translate(512, 512);
  const n = 150;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = 300 + ((i * 37) % 11) * 18;
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grad.addColorStop(0, i % 3 ? "rgba(255,190,60,0.95)" : "rgba(255,110,30,0.95)");
    grad.addColorStop(1, "rgba(255,200,90,0)");
    g.strokeStyle = grad;
    g.lineWidth = i % 2 ? 2 : 1.2;
    g.setLineDash([3 + (i % 3), 4 + (i % 4)]);
    g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { disc: tex(disc), rays: tex(rays) };
}

// ---------- landmarks: one per song ----------
const STONE = { lit: "#e6dcc4", mid: "#a69c88", shadow: "#3b4270" };

// An arched doorway shape: a rectangle with a round top.
function archShape(w, h, x = 0, y = 0) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(x - r, y);
  s.lineTo(x - r, y + h - r);
  s.absarc(x, y + h - r, r, Math.PI, 0, true);
  s.lineTo(x + r, y);
  s.closePath();
  return s;
}

// The light inside a doorway: deep shadow at rest, warm light while its song plays.
export function doorLightMaterial() {
  return new THREE.MeshBasicMaterial({ color: "#10173a", side: THREE.DoubleSide, fog: false });
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- ruin and rebuild ----------
// Every landmark is a set of stone pieces. Each piece knows where it stands when built and
// where it lies in the rubble; rebuild(t) lifts them back into place, lowest courses first.
function rebuildable(root, pieces, { radius, ground, lift, seed }) {
  const rnd = mulberry(seed);
  const size = new THREE.Vector3();
  const items = pieces.map((m) => {
    new THREE.Box3().setFromObject(m).getSize(size);
    const builtP = m.position.clone(), builtQ = m.quaternion.clone();
    // topple it: long side down, spun at random, half sunk into the ground
    const a = rnd() * Math.PI * 2, r = radius * Math.sqrt(rnd());
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    const tall = size.y > Math.max(size.x, size.z);
    const e = new THREE.Euler(tall ? (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rnd() - 0.5) * 0.4) : (rnd() - 0.5) * 0.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
    const lying = tall ? Math.min(size.x, size.z) : size.y;
    const ruinP = new THREE.Vector3(x, ground(x, z) + lying * 0.35 + rnd() * 0.3, z);
    return { m, builtP, builtQ, ruinP, ruinQ: new THREE.Quaternion().setFromEuler(e), y: builtP.y };
  });
  items.sort((p, q) => p.y - q.y);
  const span = 0.22;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  return function rebuild(t) {
    items.forEach((it, k) => {
      const start = (k / items.length) * (1 - span);
      const e = ease(Math.min(1, Math.max(0, (t - start) / span)));
      it.m.position.lerpVectors(it.ruinP, it.builtP, e);
      it.m.position.y += Math.sin(e * Math.PI) * lift;
      it.m.quaternion.slerpQuaternions(it.ruinQ, it.builtQ, e);
    });
  };
}

// A weathered stone gate standing over the path, built in courses so it can be rebuilt.
export function makeGate() {
  const root = new THREE.Group();
  root.name = "gate";
  const stone = toonMaterial({ ...STONE, light: new THREE.Vector3(-0.5, 0.7, 0.6) });
  const pieces = [];
  const add = (m) => { root.add(m); pieces.push(m); return m; };
  [-1.55, 1.55].forEach((x) => {
    add(box(1.25, 0.35, 1.25, stone, x, 0.17, 0));
    for (let j = 0; j < 5; j++) add(box(1.0, 1.0, 1.0, stone, x, 0.35 + 0.5 + j * 1.0 + (j ? 0.01 * j : 0), 0));
  });
  // the arch panel between the pillars
  const panel = new THREE.Shape();
  panel.moveTo(-1.05, 3.0); panel.lineTo(-1.05, 5.15); panel.lineTo(1.05, 5.15); panel.lineTo(1.05, 3.0);
  panel.absarc(0, 3.0, 1.05, 0, Math.PI, false);
  const pg = new THREE.ExtrudeGeometry(panel, { depth: 0.8, bevelEnabled: false, curveSegments: 24 });
  pg.translate(0, -4.1, -0.4);
  const arch = add(new THREE.Mesh(pg, stone));
  arch.position.y = 4.1;
  add(box(4.4, 0.9, 1.15, stone, 0, 5.6, 0));
  add(box(4.8, 0.25, 1.3, stone, 0, 6.15, 0));
  add(box(3.2, 0.5, 0.9, stone, 0, 6.5, 0));
  const light = doorLightMaterial();
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(2.1, 4.05), 24), light);
  door.name = "doorway";
  root.add(door);
  const rebuild = rebuildable(root, pieces, { radius: 4, ground: () => 0, lift: 1.5, seed: 11 });
  rebuild(1);
  return { root, light, top: new THREE.Vector3(0, 7.2, 0), door, rebuild };
}

// The great tower on the far hill: a rock outcrop, a plinth, and one immense arched opening.
export function makeTower() {
  const root = new THREE.Group();
  root.name = "tower";
  const rock = toonMaterial({ lit: "#cfc6ac", mid: "#8d8874", shadow: "#323a63", light: new THREE.Vector3(-0.6, 0.6, 0.5) });
  const stone = toonMaterial({ ...STONE, light: new THREE.Vector3(-0.6, 0.5, 0.6) });
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * 14;
    prof.push(new THREE.Vector2(Math.max(5.5, 17 - y * 0.95 + Math.sin(i * 1.7) * 1.2), y));
  }
  prof.push(new THREE.Vector2(0, 14));
  const rg = new THREE.LatheGeometry(prof, 28);
  const p = rg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 0.7 + y * 0.4) * Math.cos(z * 0.6 - y * 0.3) * 1.2;
    p.setXYZ(i, x + n * (x / 17), y, z + n * (z / 17));
  }
  rg.computeVertexNormals();
  const rockMesh = new THREE.Mesh(rg, rock);
  rockMesh.name = "rock";
  root.add(rockMesh);

  const pieces = [];
  const add = (m) => { root.add(m); pieces.push(m); return m; };
  for (let k = 0; k < 3; k++) {
    const t = add(new THREE.Mesh(new THREE.CylinderGeometry(13 - k * 3.2, 13.5 - k * 3.2, 0.9, 28, 1, true), stone));
    t.position.y = 4 + k * 3.4;
  }
  const W = 7, H = 30, base = 14, y0 = base + 2.6, OPEN = 3.2, OPEN_H = 22;
  add(box(11, 2.2, 11, stone, 0, base + 1.1, 0));
  add(box(12, 0.5, 12, stone, 0, base + 2.4, 0));
  // walls either side of the opening, laid in courses
  const side = (W - OPEN) / 2, course = OPEN_H / 8;
  for (let j = 0; j < 8; j++) {
    [-1, 1].forEach((s) => add(box(side, course, W, stone, s * (OPEN / 2 + side / 2), y0 + course * (j + 0.5), 0)));
  }
  // the arch over the opening, then solid courses to the cornice
  const cap = new THREE.Shape();
  cap.moveTo(-OPEN / 2, 0); cap.lineTo(-OPEN / 2, 1.6); cap.lineTo(OPEN / 2, 1.6); cap.lineTo(OPEN / 2, 0);
  cap.absarc(0, 0, OPEN / 2, 0, Math.PI, false);
  const cg = new THREE.ExtrudeGeometry(cap, { depth: W, bevelEnabled: false, curveSegments: 24 });
  cg.translate(0, -1.6, -W / 2);
  add(new THREE.Mesh(cg, stone)).position.y = y0 + OPEN_H - 1.6 + 1.6;
  const upper = (H - OPEN_H) / 3;
  for (let j = 0; j < 3; j++) add(box(W, upper, W, stone, 0, y0 + OPEN_H + upper * (j + 0.5), 0));
  // pilasters in segments, cornice, and a crown with its row of small arches
  [-W / 2, W / 2].forEach((x) => { for (let j = 0; j < 5; j++) add(box(0.7, H / 5, W + 0.4, stone, x, y0 + (H / 5) * (j + 0.5), 0)); });
  add(box(W + 1.4, 0.8, W + 1.4, stone, 0, y0 + H, 0));
  const crown = add(box(W + 0.6, 2.6, W + 0.6, stone, 0, y0 + H + 1.7, 0));
  const ink = new THREE.MeshBasicMaterial({ color: "#10173a", fog: false });
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.75, 1.7), 12), ink);
    w.position.set(-2.8 + i * 1.4, -0.95, W / 2 + 0.31);
    crown.add(w);
  }
  const light = doorLightMaterial();
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(OPEN, OPEN_H), 24), light);
  door.position.set(0, y0, 0);
  door.name = "doorway";
  root.add(door);
  // rubble falls across the plateau and down the rock
  const ground = (x, z) => { const r = Math.hypot(x, z); return r < 5.5 ? 14 : Math.max(0, Math.min(14, (17 - r) / 0.95)); };
  const extra = [];
  return {
    root, light, door, top: new THREE.Vector3(0, y0 + H + 4, 0),
    // the dog is placed with the crown: call this before the first rebuild()
    addPiece(m) { root.add(m); pieces.push(m); extra.push(m); },
    rebuild: (() => { let fn = null; return (t) => { if (!fn) fn = rebuildable(root, pieces, { radius: 9, ground, lift: 5, seed: 23 }); fn(t); }; })(),
  };
}

// ---------- small things hidden in the world ----------

// A paper delivery bag left on a doorstep, with its receipt.
export function makeParcel() {
  const g = new THREE.Group();
  g.name = "parcel";
  const kraft = new THREE.MeshLambertMaterial({ color: "#c79a5e" });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.22), kraft);
  bag.position.y = 0.21;
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.12), kraft);
  fold.position.set(0, 0.45, 0.02);
  fold.rotation.x = -0.35;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.05, 0.225), new THREE.MeshLambertMaterial({ color: "#e8121c" }));
  band.position.y = 0.3;
  const slip = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.22), new THREE.MeshLambertMaterial({ color: "#fbf6ea", side: THREE.DoubleSide }));
  slip.position.set(0.06, 0.2, 0.112);
  slip.rotation.z = -0.15;
  g.add(bag, fold, band, slip);
  return g;
}

// A stone war dog, sitting guard. Its eyes are a separate material so they can kindle.
export function makeDog() {
  const g = new THREE.Group();
  g.name = "dog";
  const stone = toonMaterial({ lit: "#e6dcc4", mid: "#a69c88", shadow: "#3b4270", light: new THREE.Vector3(-0.5, 0.6, 0.6) });
  const eyes = new THREE.MeshBasicMaterial({ color: "#10173a", fog: false });
  const part = (geo, x, y, z, rx = 0, ry = 0, rz = 0, mat = stone) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(0.9, 0.55, 1.3), 0, 0.3, -0.1);                 // haunches
  part(new THREE.BoxGeometry(0.75, 1.2, 0.6), 0, 0.95, 0.35, -0.35);         // chest, upright
  [-0.22, 0.22].forEach((x) => part(new THREE.BoxGeometry(0.18, 0.9, 0.2), x, 0.45, 0.62)); // forelegs
  part(new THREE.BoxGeometry(0.62, 0.55, 0.62), 0, 1.75, 0.55);              // head
  part(new THREE.BoxGeometry(0.34, 0.28, 0.42), 0, 1.66, 0.98);              // muzzle
  part(new THREE.BoxGeometry(0.14, 0.1, 0.08), 0, 1.78, 1.2, 0, 0, 0, eyes); // nose
  [-0.2, 0.2].forEach((x) => part(new THREE.ConeGeometry(0.13, 0.42, 4), x, 2.16, 0.48, 0.15, Math.PI / 4)); // ears, pricked
  [-0.15, 0.15].forEach((x) => part(new THREE.BoxGeometry(0.1, 0.08, 0.04), x, 1.86, 0.87, 0, 0, 0, eyes));  // eyes
  part(new THREE.BoxGeometry(0.12, 0.12, 0.7), 0, 0.2, -0.85, 0.5);          // tail
  return { root: g, eyes };
}
