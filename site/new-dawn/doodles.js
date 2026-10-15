// Hand-drawn characters for the city: bold ink outlines, flat colour, a little paper grain.
// Each function draws into a fresh canvas and returns a THREE texture.
import * as THREE from "three";

const INK = "#1a1020";
export const PALETTE = {
  pink: "#f78bd0", hot: "#ff4fb4", orange: "#ff7a1a", coral: "#ff5a4a", yellow: "#ffd23a",
  lilac: "#b49cf0", green: "#2fa84a", leaf: "#1f8f3a", red: "#e8121c", blue: "#3d7cf0", cream: "#fff6e0",
};

function canvas(w = 512, h = 512) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.lineJoin = "round"; g.lineCap = "round";
  return { c, g };
}
function finish(c, g) {
  // a light paper grain over the flat colour, only where something is drawn
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const n = (Math.random() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function ink(g, w = 9) { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); }
function blob(g, fill, w = 9) { g.fillStyle = fill; g.fill(); ink(g, w); }

// A face: happy (smile with tongue), singing (open O mouth), sleepy (closed and droopy).
function face(g, x, y, r, mood = "happy") {
  g.save();
  g.translate(x, y);
  if (mood === "sleepy") {
    g.beginPath(); g.arc(-r * 0.35, -r * 0.05, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); ink(g, r * 0.08);
    g.beginPath(); g.arc(r * 0.35, -r * 0.05, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); ink(g, r * 0.08);
    g.beginPath(); g.moveTo(-r * 0.18, r * 0.42); g.lineTo(r * 0.18, r * 0.42); ink(g, r * 0.07);
  } else {
    // closed happy eyes, like the reference's content little faces
    g.beginPath(); g.arc(-r * 0.33, -r * 0.08, r * 0.15, 1.1 * Math.PI, 1.9 * Math.PI); ink(g, r * 0.08);
    g.beginPath(); g.arc(r * 0.33, -r * 0.08, r * 0.15, 1.1 * Math.PI, 1.9 * Math.PI); ink(g, r * 0.08);
    if (mood === "singing") {
      g.beginPath(); g.ellipse(0, r * 0.38, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); blob(g, PALETTE.red, r * 0.06);
    } else {
      g.beginPath(); g.arc(0, r * 0.12, r * 0.38, 0.15 * Math.PI, 0.85 * Math.PI); ink(g, r * 0.08);
      // a tongue that hangs down, as in the big daisy on the bridge
      g.beginPath(); g.moveTo(-r * 0.08, r * 0.47); g.lineTo(-r * 0.08, r * 1.15); g.quadraticCurveTo(0, r * 1.3, r * 0.08, r * 1.15); g.lineTo(r * 0.08, r * 0.47);
      blob(g, PALETTE.red, r * 0.05);
    }
  }
  g.restore();
}

function petalPath(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(wid, -len * 0.25, wid * 0.9, -len * 0.95, 0, -len);
  g.bezierCurveTo(-wid * 0.9, -len * 0.95, -wid, -len * 0.25, 0, 0);
}

export function daisy({ petals = 14, color = PALETTE.pink, center = PALETTE.yellow, mood = "happy", stem = true } = {}) {
  const { c, g } = canvas(512, 640);
  const cx = 256, cy = 250;
  if (stem) {
    g.beginPath(); g.moveTo(cx, cy); g.bezierCurveTo(cx + 30, cy + 140, cx - 20, cy + 260, cx + 10, 636);
    g.strokeStyle = INK; g.lineWidth = 26; g.stroke(); g.strokeStyle = PALETTE.green; g.lineWidth = 14; g.stroke();
  }
  for (let i = 0; i < petals; i++) {
    g.save(); g.translate(cx, cy); g.rotate((i / petals) * Math.PI * 2);
    petalPath(g, 210, 48); blob(g, color, 8);
    g.restore();
  }
  // the face sits on a half-moon centre, like the reference
  g.beginPath(); g.arc(cx, cy, 82, 0, Math.PI * 2); blob(g, center, 9);
  face(g, cx, cy, 70, mood);
  return finish(c, g);
}

export function tulip({ outer = PALETTE.orange, inner = PALETTE.pink } = {}) {
  const { c, g } = canvas(512, 640);
  g.beginPath(); g.moveTo(256, 330); g.bezierCurveTo(240, 450, 280, 540, 250, 636);
  g.strokeStyle = INK; g.lineWidth = 26; g.stroke(); g.strokeStyle = PALETTE.green; g.lineWidth = 14; g.stroke();
  // leaf
  g.beginPath(); g.moveTo(260, 520); g.bezierCurveTo(360, 440, 430, 470, 450, 400); g.bezierCurveTo(400, 500, 330, 520, 260, 540); blob(g, PALETTE.leaf, 8);
  [[-1, inner], [1, inner], [0, outer]].forEach(([s, col]) => {
    g.save(); g.translate(256 + s * 60, 340); g.rotate(s * 0.45);
    petalPath(g, 260, 95); blob(g, col, 9);
    // painted stripe down the petal
    g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(s * 18, -130, 0, -220); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 14; g.stroke();
    g.restore();
  });
  // stamens
  [-30, 0, 30].forEach((x, i) => { g.beginPath(); g.moveTo(256 + x, 250); g.lineTo(256 + x * 1.6, 120 - i * 10); ink(g, 6); g.beginPath(); g.arc(256 + x * 1.6, 112 - i * 10, 14, 0, Math.PI * 2); blob(g, PALETTE.yellow, 6); });
  return finish(c, g);
}

export function spotted({ color = PALETTE.lilac, mood = "happy" } = {}) {
  const { c, g } = canvas(512, 512);
  for (let i = 0; i < 6; i++) {
    g.save(); g.translate(256, 256); g.rotate((i / 6) * Math.PI * 2 + 0.3);
    petalPath(g, 230, 80); blob(g, color, 9);
    // white dashes, as on the reference's lilac flower
    g.fillStyle = "#ffffff";
    for (let k = 0; k < 6; k++) { g.save(); g.translate((k % 2 ? 22 : -22), -60 - k * 26); g.rotate(0.6); g.fillRect(-12, -4, 24, 8); g.restore(); }
    g.restore();
  }
  g.beginPath(); g.ellipse(256, 256, 70, 56, 0, 0, Math.PI * 2); blob(g, PALETTE.yellow, 9);
  face(g, 256, 252, 56, mood);
  return finish(c, g);
}

export function heartPetal() {
  const { c, g } = canvas(512, 512);
  g.beginPath(); g.moveTo(256, 470);
  g.bezierCurveTo(60, 330, 40, 120, 170, 70); g.bezierCurveTo(230, 50, 256, 110, 256, 140);
  g.bezierCurveTo(256, 110, 282, 50, 342, 70); g.bezierCurveTo(472, 120, 452, 330, 256, 470);
  blob(g, PALETTE.yellow, 10);
  g.save(); g.clip();
  g.strokeStyle = "#ffffff"; g.lineWidth = 16;
  for (let i = -6; i < 8; i++) { g.beginPath(); g.moveTo(i * 60, 520); g.lineTo(i * 60 + 300, 0); g.stroke(); }
  g.restore();
  g.beginPath(); g.moveTo(256, 470);
  g.bezierCurveTo(60, 330, 40, 120, 170, 70); g.bezierCurveTo(230, 50, 256, 110, 256, 140);
  g.bezierCurveTo(256, 110, 282, 50, 342, 70); g.bezierCurveTo(472, 120, 452, 330, 256, 470);
  ink(g, 10);
  return finish(c, g);
}

export function leaf({ color = PALETTE.green } = {}) {
  const { c, g } = canvas(512, 512);
  g.beginPath(); g.moveTo(60, 460);
  g.bezierCurveTo(80, 220, 260, 60, 470, 40); g.bezierCurveTo(430, 260, 280, 430, 60, 460);
  blob(g, color, 10);
  g.beginPath(); g.moveTo(70, 450); g.quadraticCurveTo(260, 260, 440, 60); ink(g, 6);
  return finish(c, g);
}

export function sunDoodle() {
  const { c, g } = canvas(512, 512);
  g.save(); g.translate(256, 256);
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 200 : 150; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  blob(g, PALETTE.orange, 10);
  g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); blob(g, PALETTE.yellow, 10);
  g.restore();
  return finish(c, g);
}

export function sparkle({ color = PALETTE.yellow } = {}) {
  const { c, g } = canvas(256, 256);
  g.beginPath(); g.moveTo(128, 8); g.quadraticCurveTo(140, 116, 248, 128); g.quadraticCurveTo(140, 140, 128, 248);
  g.quadraticCurveTo(116, 140, 8, 128); g.quadraticCurveTo(116, 116, 128, 8);
  blob(g, color, 7);
  return finish(c, g);
}

export function ribbon({ color = PALETTE.pink } = {}) {
  const { c, g } = canvas(512, 256);
  g.beginPath(); g.moveTo(20, 180); g.bezierCurveTo(140, 20, 260, 260, 380, 90); g.quadraticCurveTo(430, 30, 490, 70);
  g.strokeStyle = INK; g.lineWidth = 48; g.stroke(); g.strokeStyle = color; g.lineWidth = 34; g.stroke();
  return finish(c, g);
}

// Painted rainbow arch: red, orange, pink bands, as at the top of the reference.
export function rainbowArch() {
  const { c, g } = canvas(1024, 512);
  [["#e8341c", 470], [PALETTE.orange, 420], ["#f7a0a0", 370]].forEach(([col, r]) => {
    g.beginPath(); g.arc(512, 512, r, Math.PI, 0); g.arc(512, 512, r - 50, 0, Math.PI, true); g.closePath(); blob(g, col, 8);
  });
  return finish(c, g);
}

export function singer({ color = PALETTE.yellow } = {}) {
  const { c, g } = canvas(512, 512);
  // little petal hair
  for (let i = 0; i < 7; i++) { g.save(); g.translate(256, 270); g.rotate(-1.4 + i * 0.47); petalPath(g, 220, 50); blob(g, PALETTE.orange, 8); g.restore(); }
  g.beginPath(); g.arc(256, 280, 130, 0, Math.PI * 2); blob(g, color, 10);
  face(g, 256, 270, 110, "singing");
  return finish(c, g);
}

export function ladybug() {
  const { c, g } = canvas(256, 256);
  g.beginPath(); g.arc(128, 150, 90, Math.PI, 0); g.closePath(); blob(g, PALETTE.red, 8);
  g.fillStyle = "#ffffff";
  [[90, 120], [150, 105], [175, 140], [110, 145]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); });
  g.beginPath(); g.moveTo(40, 150); g.lineTo(216, 150); ink(g, 8);
  return finish(c, g);
}

export function bird() {
  const { c, g } = canvas(256, 128);
  g.beginPath(); g.moveTo(20, 50); g.quadraticCurveTo(80, 10, 128, 70); g.quadraticCurveTo(176, 10, 236, 50); ink(g, 10);
  return finish(c, g);
}

// A small brown dog peeking up out of the grass, ears up: the war dog, off duty.
export function dogPeek() {
  const { c, g } = canvas(512, 512);
  [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(256 + s * 60, 220); g.quadraticCurveTo(256 + s * 150, 80, 256 + s * 120, 40); g.quadraticCurveTo(256 + s * 70, 120, 256 + s * 20, 210); blob(g, "#8a5a36", 9); });
  g.beginPath(); g.ellipse(256, 290, 120, 100, 0, 0, Math.PI * 2); blob(g, "#a8703f", 10);
  g.beginPath(); g.ellipse(256, 330, 60, 42, 0, 0, Math.PI * 2); blob(g, "#e8c89a", 8);
  g.beginPath(); g.ellipse(256, 312, 18, 12, 0, 0, Math.PI * 2); blob(g, INK, 4);
  g.beginPath(); g.arc(210, 270, 12, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  g.beginPath(); g.arc(302, 270, 12, 0, Math.PI * 2); g.fill();
  // a tiny helmet
  g.beginPath(); g.arc(256, 220, 70, Math.PI, 0); g.closePath(); blob(g, "#5d7a3a", 8);
  // grass in front
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(90 + i * 42, 512); g.quadraticCurveTo(80 + i * 42, 420, 110 + i * 42, 370 + (i % 3) * 20); g.quadraticCurveTo(100 + i * 42, 440, 120 + i * 42, 512); blob(g, PALETTE.green, 6); }
  return finish(c, g);
}

// The one flower that is already there in the rain, drooping, waiting.
export function sadFlower() {
  const { c, g } = canvas(512, 640);
  g.beginPath(); g.moveTo(256, 636); g.bezierCurveTo(250, 420, 330, 240, 380, 250);
  g.strokeStyle = INK; g.lineWidth = 24; g.stroke(); g.strokeStyle = "#5c7060"; g.lineWidth = 12; g.stroke();
  g.save(); g.translate(380, 300); g.rotate(Math.PI * 0.85);
  for (let i = 0; i < 5; i++) { g.save(); g.rotate(-0.9 + i * 0.45); petalPath(g, 130, 34); blob(g, "#9a92a8", 7); g.restore(); }
  g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); blob(g, "#b8ae90", 8);
  g.restore();
  face(g, 380, 300, 36, "sleepy");
  return finish(c, g);
}
