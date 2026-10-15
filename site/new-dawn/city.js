// The city: brick warehouse blocks with fire escapes, a cobbled street, parked cars,
// lamps, a brownstone stoop, and a steel suspension bridge closing the end of the street.
// Surfaces use painted canvas textures so the city reads almost photographic under the doodles.
import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}
function rnd(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One tile of facade: brick with mortar, a window with a cream frame and a sky-tinted pane.
// A tile is one window bay: 3 m wide, 3.4 m tall.
function facadeTile(brick, seed) {
  const r = rnd(seed);
  const c = document.createElement("canvas");
  c.width = 256; c.height = 290;
  const g = c.getContext("2d");
  g.fillStyle = brick; g.fillRect(0, 0, 256, 290);
  // bricks, each a touch different
  for (let y = 0; y < 290; y += 10) {
    for (let x = (y / 10) % 2 ? -12 : 0; x < 256; x += 24) {
      const v = (r() - 0.5) * 30;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 220 : 0},${v > 0 ? 200 : 0},${Math.abs(v) / 260})`;
      g.fillRect(x + 1, y + 1, 22, 8);
    }
  }
  g.fillStyle = "rgba(60,30,25,0.35)";
  for (let y = 0; y < 290; y += 10) g.fillRect(0, y, 256, 1.2);
  // window: arched brick lintel, frame, glass reflecting the sky, mullions
  const wx = 78, wy = 70, ww = 100, wh = 150;
  g.fillStyle = "rgba(90,40,30,0.6)"; g.fillRect(wx - 10, wy - 16, ww + 20, 16);
  g.fillStyle = "#e9e1cf"; g.fillRect(wx - 6, wy - 4, ww + 12, wh + 10);
  const sky = g.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, "#6f8fae"); sky.addColorStop(0.45, "#2c3a4c"); sky.addColorStop(1, "#1c2430");
  g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = "#e9e1cf"; g.fillRect(wx + ww / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh / 2 - 3, ww, 6);
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(wx, wy + 30); g.lineTo(wx + 40, wy); g.lineTo(wx + 60, wy); g.lineTo(wx, wy + 60); g.fill();
  g.fillStyle = "#d8cfbb"; g.fillRect(wx - 10, wy + wh + 6, ww + 20, 10); // sill
  return c;
}

export function buildingMaterial(brick, seed, bays, floors) {
  return new THREE.MeshStandardMaterial({ map: tex(facadeTile(brick, seed), bays, floors), roughness: 0.92, metalness: 0 });
}

// A box building whose window grid lines up with its size. Width along the street (z), depth into the block (x).
export function makeBuilding({ width, height, depth, brick, seed }) {
  const bays = Math.max(2, Math.round(width / 3)), floors = Math.max(3, Math.round(height / 3.4));
  const side = buildingMaterial(brick, seed, bays, floors);
  const end = buildingMaterial(brick, seed + 7, Math.max(2, Math.round(depth / 3)), floors);
  const roof = new THREE.MeshStandardMaterial({ color: "#3b3634", roughness: 1 });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), [side, side, roof, roof, end, end]);
  const g = new THREE.Group();
  m.position.y = height / 2;
  g.add(m);
  // cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.6, 0.8, width + 0.6), new THREE.MeshStandardMaterial({ color: "#6e4436", roughness: 0.9 }));
  cornice.position.y = height + 0.1;
  g.add(cornice);
  g.userData = { width, height, depth, floors };
  return g;
}

// Zig-zag black fire escape: a platform and railing per floor, a stair between floors.
export function fireEscapeGeometry(floors, bayWidth = 3.2) {
  const parts = [];
  for (let f = 1; f < floors; f++) {
    const y = f * 3.4;
    const plat = new THREE.BoxGeometry(1.1, 0.08, bayWidth); plat.translate(0.55, y, 0); parts.push(plat);
    const rail = new THREE.BoxGeometry(0.05, 0.05, bayWidth); rail.translate(1.1, y + 0.95, 0); parts.push(rail);
    for (let k = 0; k <= 6; k++) { const p = new THREE.BoxGeometry(0.04, 0.95, 0.04); p.translate(1.1, y + 0.47, -bayWidth / 2 + (k / 6) * bayWidth); parts.push(p); }
    if (f < floors - 1) {
      const stair = new THREE.BoxGeometry(0.06, 0.06, Math.hypot(3.4, bayWidth * 0.8));
      stair.rotateX((f % 2 ? 1 : -1) * Math.atan2(3.4, bayWidth * 0.8));
      stair.translate(0.75, y + 1.7, 0);
      parts.push(stair);
    }
  }
  return mergeGeometries(parts);
}

// The street surface: worn asphalt with a few patches.
export function streetTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#8a8a88"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 90 + Math.random() * 70; g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  g.strokeStyle = "rgba(40,40,40,0.08)"; g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(Math.random() * 512, Math.random() * 512); for (let k = 0; k < 5; k++) g.lineTo(Math.random() * 512, Math.random() * 512); g.stroke(); }
  return tex(c, 2, 24);
}
export function sidewalkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#c9c4bb"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { const v = 170 + Math.random() * 50; g.fillStyle = `rgba(${v},${v},${v - 6},0.4)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.fillStyle = "rgba(90,85,80,0.5)"; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256);
  return tex(c, 1, 40);
}

export function makeCar(color, seed) {
  const r = rnd(seed);
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({ color: "#5d7288", roughness: 0.2, metalness: 0 });
  const tyre = new THREE.MeshStandardMaterial({ color: "#1b1b1d", roughness: 0.9 });
  const len = 4.2 + r() * 0.6;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, len), body); lower.position.y = 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, len * 0.55), glass); cabin.position.set(0, 1.2, -0.1);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, len * 0.5), body); roof.position.set(0, 1.52, -0.1);
  g.add(lower, cabin, roof);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 16), tyre);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 0.85, 0.34, sz * len * 0.33);
    g.add(w);
  });
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: "#2a2f2c", roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 8), iron); pole.position.y = 2.5;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), iron); arm.position.set(-0.5, 4.9, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: "#3b3a33" });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 12, 1, true), iron); head.position.set(-1.0, 4.8, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lampMat); bulb.position.set(-1.0, 4.68, 0);
  g.add(pole, arm, head, bulb);
  return { root: g, bulb: lampMat };
}

// A brownstone stoop with an arched front door. The doorway's material lights up while its song plays.
export function makeStoop() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#7a5240", roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: "#e6dcc8", roughness: 0.7 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.12, 0.22, 2.4), stone);
    s.position.set(-0.8 - i * 0.12, 0.11 + i * 0.22, 0); g.add(s);
  }
  const surround = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 2.4), trim); surround.position.set(-1.6, 2.6, 0); g.add(surround);
  const shape = new THREE.Shape();
  shape.moveTo(-0.7, 0); shape.lineTo(-0.7, 2.0); shape.absarc(0, 2.0, 0.7, Math.PI, 0, true); shape.lineTo(0.7, 0); shape.closePath();
  const light = new THREE.MeshBasicMaterial({ color: "#2a1d18", side: THREE.DoubleSide });
  const door = new THREE.Mesh(new THREE.ShapeGeometry(shape, 20), light);
  door.rotation.y = Math.PI / 2; door.position.set(-1.38, 1.1, 0); g.add(door);
  [-1, 1].forEach((s) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: "#1e1e20" })); rail.position.set(-0.4, 1.4, s * 1.15); rail.rotation.z = -0.45; g.add(rail); });
  return { root: g, light, door };
}

// The suspension bridge across the end of the street: blue steel towers with an arched
// opening, a truss deck, main cables and suspenders. Its arch glows while its song plays.
export function makeBridge() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#7aaee6", roughness: 0.55, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: "#4a74b4", roughness: 0.6, metalness: 0 });
  const H = 52, deckY = 17, legX = 6.5;
  // tower legs with bracing
  [-legX, legX].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3.2, H, 4), steel); leg.position.set(x, H / 2, 0); g.add(leg);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4), dark); cap.position.set(x, H + 1.5, 0); cap.rotation.y = Math.PI / 4; g.add(cap);
  });
  // cross beams with X bracing, the tower's lattice look
  [deckY + 8, deckY + 20, H - 4].forEach((y) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(legX * 2, 1.6, 3), steel); beam.position.set(0, y, 0); g.add(beam);
  });
  for (let k = 0; k < 2; k++) {
    const y0 = deckY + 8 + k * 12;
    [-1, 1].forEach((s) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.5, Math.hypot(legX * 2, 12), 0.5), dark);
      brace.position.set(0, y0 + 6, 1.6); brace.rotation.z = s * Math.atan2(legX * 2, 12); g.add(brace);
    });
  }
  // the arch the street looks through
  const archShape = new THREE.Shape();
  archShape.moveTo(-legX + 1.6, 0); archShape.lineTo(-legX + 1.6, 7); archShape.absarc(0, 7, legX - 1.6, Math.PI, 0, true); archShape.lineTo(legX - 1.6, 0); archShape.closePath();
  const light = new THREE.MeshBasicMaterial({ color: "#9cc4f0", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 24), light);
  door.position.set(0, 0.2, 0.1); g.add(door);
  // deck: a deep truss girder crossing the street
  const deck = new THREE.Mesh(new THREE.BoxGeometry(260, 3.2, 9), steel); deck.position.set(0, deckY, 6); g.add(deck);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(260, 0.8, 9.6), dark); lower.position.set(0, deckY - 1.8, 6); g.add(lower);
  for (let x = -128; x <= 128; x += 4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), dark); post.position.set(x, deckY, 10.6); g.add(post);
  }
  // main cables sagging from the tower top, and suspenders down to the deck
  const cableMat = new THREE.MeshStandardMaterial({ color: "#2f4f80", roughness: 0.5 });
  [-1, 1].forEach((s) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const x = s * (legX + (i / 30) * 120); const t = i / 30; pts.push(new THREE.Vector3(x, H - 2 - Math.sin(t * Math.PI * 0.95) * (H - deckY - 6) * 1.0 + t * 4, 8)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.35, 8), cableMat));
    for (let i = 1; i < 30; i += 1) {
      const p = curve.getPoint(i / 30);
      const len = p.y - deckY;
      if (len < 0.5) continue;
      const sus = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 4), cableMat);
      sus.position.set(p.x, deckY + len / 2, 8); g.add(sus);
    }
  });
  return { root: g, light, door, top: new THREE.Vector3(0, H + 3, 0) };
}

// A far skyline glimpsed through the bridge arch, with one spire.
export function makeSkyline() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#a9bcd6", roughness: 1 });
  const r = rnd(5);
  for (let i = 0; i < 26; i++) {
    const h = 10 + r() * 30, w = 4 + r() * 6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), mat);
    b.position.set(-70 + i * 5.5 + r() * 2, h / 2, -r() * 20); g.add(b);
  }
  const spire = new THREE.Mesh(new THREE.BoxGeometry(5, 46, 5), mat); spire.position.set(2, 23, -8); g.add(spire);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.4, 14, 4), mat); tip.position.set(2, 53, -8); g.add(tip);
  return g;
}
