// Colour coming back into the city: painted murals, paint splashes, Mardi Gras beads,
// bunting across the street, gusting leaves and confetti. Bold and graphic, never cute.
import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";

// Mardi Gras purple, gold and green lead; crimson, burnt orange and electric teal back them up.
export const COLORS = ["#5b2a86", "#f2b705", "#1f8a3a", "#7b3fb8", "#ffcc33", "#2fb35a", "#c8102e", "#e8641a", "#00a6a6", "#1d4ed8"];
export const MARDI = ["#5b2a86", "#f2b705", "#1f8a3a"];
const INK = "#15121c";

function rng(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function pick(r, list) { return list[Math.floor(r() * list.length)]; }

// A rough, loaded brush stroke: several offset passes so the edges look dragged.
function stroke(g, r, pts, width, color) {
  for (let pass = 0; pass < 5; pass++) {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = (r() - 0.5) * width * 0.25, jy = (r() - 0.5) * width * 0.25;
      i ? g.lineTo(x + jx, y + jy) : g.moveTo(x + jx, y + jy);
    });
    g.strokeStyle = color;
    g.globalAlpha = pass ? 0.55 : 1;
    g.lineWidth = width * (1 - pass * 0.12);
    g.lineCap = "round"; g.lineJoin = "round";
    g.stroke();
  }
  g.globalAlpha = 1;
}
function drips(g, r, x0, x1, y, color, n = 6) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), w = 4 + r() * 8, h = 20 + r() * 90;
    g.fillRect(x, y, w, h);
    g.beginPath(); g.arc(x + w / 2, y + h, w * 0.75, 0, Math.PI * 2); g.fill();
  }
}

// An abstract wall mural: big brush sweeps, a band of chevrons, paint drips and splatter.
export function muralTexture(seed, w = 1024, h = 768) {
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const style = seed % 3;
  if (style === 0) {
    // sweeping strokes
    for (let i = 0; i < 6; i++) {
      const col = i < 3 ? MARDI[i] : pick(r, COLORS);
      const y = h * (0.15 + r() * 0.7), amp = h * (0.1 + r() * 0.2);
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([(k / 8) * w, y + Math.sin(k * 0.9 + r() * 6) * amp]);
      stroke(g, r, pts, 70 + r() * 70, col);
      drips(g, r, w * 0.1, w * 0.9, y + 30, col, 3);
    }
  } else if (style === 1) {
    // chevron bands
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      g.fillStyle = b % 2 ? pick(r, COLORS) : MARDI[b % 3];
      const y = (b / bands) * h, bh = h / bands;
      g.beginPath();
      for (let x = 0; x <= w; x += 120) { g.lineTo(x, y + ((x / 120) % 2 ? bh * 0.4 : 0)); }
      for (let x = w; x >= 0; x -= 120) { g.lineTo(x, y + bh + ((x / 120) % 2 ? bh * 0.4 : 0)); }
      g.closePath(); g.fill();
    }
    drips(g, r, 0, w, h * 0.95, pick(r, MARDI), 10);
  } else {
    // bold geometric blocks with a heavy diagonal slash
    for (let i = 0; i < 7; i++) {
      g.fillStyle = pick(r, COLORS);
      g.save(); g.translate(r() * w, r() * h); g.rotate((r() - 0.5) * 0.8);
      g.fillRect(-120 - r() * 120, -60 - r() * 80, 240 + r() * 200, 120 + r() * 140);
      g.restore();
    }
    stroke(g, r, [[0, h * 0.9], [w * 0.5, h * 0.4], [w, h * 0.1]], 110, MARDI[seed % 3]);
  }
  // splatter
  for (let i = 0; i < 90; i++) {
    g.fillStyle = pick(r, COLORS);
    g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * r() * 22, 0, Math.PI * 2); g.fill();
  }
  // thin black linework, the way a painter outlines a piece
  g.strokeStyle = INK; g.lineWidth = 6; g.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); g.stroke(); }
  g.globalAlpha = 1;
  return tex(c);
}

// A paint splash for the street.
export function splatTexture(seed) {
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const col = pick(r, COLORS);
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = 120 + r() * 60 + (i % 5 === 0 ? r() * 90 : 0);
    g.lineTo(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr);
  }
  g.fill();
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 180 + r() * 70; g.beginPath(); g.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 3 + r() * 12, 0, Math.PI * 2); g.fill(); }
  return tex(c);
}

// A spray-paint stencil of a dog in a helmet: the war dog, tagged on a wall.
export function dogStencil() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = INK;
  // body sitting upright, chest out
  g.beginPath(); g.ellipse(256, 360, 110, 120, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(256, 200, 84, 78, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(256, 236, 48, 36, 0, 0, Math.PI * 2); g.fill(); // muzzle
  [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(256 + s * 50, 150); g.lineTo(256 + s * 90, 70); g.lineTo(256 + s * 96, 160); g.fill(); });
  // helmet, picked out in gold
  g.fillStyle = "#f2b705";
  g.beginPath(); g.arc(256, 168, 92, Math.PI, 0); g.lineTo(356, 176); g.lineTo(156, 176); g.closePath(); g.fill();
  // overspray
  for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? INK : "#f2b705"; const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 120; g.fillRect(256 + Math.cos(a) * d, 270 + Math.sin(a) * d * 1.1, 2, 2); }
  return tex(c);
}

// Paint that spreads across a surface rather than fading in: a blotchy reveal mask.
export function paintMaterial(map, { lit = true } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
    uniforms: { map: { value: map }, uReveal: { value: 0 }, uLight: { value: lit ? 1 : 0.9 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D map; uniform float uReveal, uLight;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec4 c = texture2D(map, vUv);
        // paint creeps in from the bottom-left with a ragged, blotchy front
        float front = (vUv.x * 0.35 + vUv.y * 0.65) * 0.75 + vn(vUv * 7.0) * 0.25;
        float m = smoothstep(front - 0.04, front + 0.02, uReveal * 1.1);
        if (c.a * m < 0.05) discard;
        gl_FragColor = vec4(c.rgb * uLight, c.a * m * 0.95);
      }`,
  });
}

// Bead strands: little glossy spheres along a sagging curve, alternating Mardi Gras colours.
export function beadStrand(a, b, sag, seed, count = 26) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const offset = Math.floor(r() * 3);
  const mats = MARDI.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.35, emissive: c, emissiveIntensity: 0.15 }));
  const meshes = MARDI.map((_, k) => {
    const mine = pts.filter((_, i) => (i + offset) % 3 === k);
    const m = new THREE.InstancedMesh(geo, mats[k], mine.length);
    mine.forEach((p, i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    return m;
  });
  const g = new THREE.Group();
  meshes.forEach((m) => g.add(m));
  return g;
}

// A line of triangular pennants strung across the street.
export function buntingGeometry(width, sag, flags = 18) {
  const parts = [];
  const cols = [];
  for (let i = 0; i < flags; i++) {
    const t = (i + 0.5) / flags;
    const x = -width / 2 + t * width;
    const y = -Math.sin(t * Math.PI) * sag;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([x - 0.45, y, 0, x + 0.45, y, 0, x, y - 1.1, 0], 3));
    tri.computeVertexNormals();
    const c = new THREE.Color(COLORS[i % COLORS.length]);
    tri.setAttribute("color", new THREE.Float32BufferAttribute([c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b], 3));
    parts.push(tri);
  }
  return mergeGeometries(parts);
}
