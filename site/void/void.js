// VOID: a chrome wheel in the dark, and a pool of black ferrofluid that the music magnetizes.
// One fragment shader raymarches everything; this file runs the audio and the gestures.

const TRACKS = ["music/doordash.mp3", "music/wardoggin.mp3"];
const BANDS = 16;
const R = 1.15;            // wheel radius in world units
const ARC = 0.93;          // progress arc radius
const WORLD = 5.2 / 1.6;   // world units per uv unit on the z = 0 plane (camera distance / focal length)

// ---------- audio: songs decoded into buffers, no <audio> element ----------
const actx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = actx.createAnalyser();
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 0.72;
const volume = actx.createGain();
analyser.connect(volume).connect(actx.destination);
const freq = new Uint8Array(analyser.frequencyBinCount);
let volLevel = 0.8;
try { const v = parseFloat(localStorage.getItem("void-volume")); if (v >= 0 && v <= 1) volLevel = v; } catch (e) {}
volume.gain.value = volLevel;

function bufferPlayer(buffer, out, onEnded) {
  let src = null, startAt = 0, offset = 0, on = false;
  const start = () => {
    const s = (src = actx.createBufferSource());
    s.buffer = buffer;
    s.connect(out);
    s.onended = () => { if (s !== src || !on) return; on = false; src = null; offset = buffer.duration; onEnded(); };
    startAt = actx.currentTime - offset;
    s.start(0, offset);
    on = true;
  };
  const stop = () => { const s = src; src = null; on = false; if (s) try { s.stop(); } catch (e) {} };
  const p = {
    duration: buffer.duration,
    get playing() { return on; },
    get time() { return on ? Math.min(buffer.duration, actx.currentTime - startAt) : offset; },
    seek(t) { const was = on; if (was) stop(); offset = Math.max(0, Math.min(t, buffer.duration - 0.05)); if (was) start(); },
    play() { if (offset >= buffer.duration - 0.05) offset = 0; if (!on) start(); },
    pause() { if (on) { offset = p.time; stop(); } },
  };
  return p;
}

const voices = [];
let current = -1, wanted = -1;
function load(i) {
  return fetch(TRACKS[i])
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
    .then((d) => new Promise((res, rej) => actx.decodeAudioData(d, res, rej)))
    .then((buf) => {
      const g = actx.createGain();
      g.gain.value = 0;
      g.connect(analyser);
      voices[i] = { p: bufferPlayer(buf, g, () => select((i + 1) % TRACKS.length, true)), g };
      if (wanted === i) { wanted = -1; play(i); }
    });
}
const firstReady = load(0);
firstReady.then(() => load(1)).catch((e) => console.error("music failed to load", e));

function play(i) {
  actx.resume();
  if (!voices[i]) { wanted = i; return; }
  if (current >= 0 && current !== i && voices[current]) {
    const old = voices[current];
    old.g.gain.setTargetAtTime(0, actx.currentTime, 0.25);
    setTimeout(() => { if (voices.indexOf(old) !== current) old.p.pause(); }, 1200);
  }
  const v = voices[i];
  v.p.play();
  v.g.gain.setTargetAtTime(1, actx.currentTime, 0.3);
  current = i;
}
function togglePause() {
  const v = voices[current];
  if (!v) return;
  if (v.p.playing) { v.g.gain.setTargetAtTime(0, actx.currentTime, 0.08); setTimeout(() => { if (v.g.gain.value < 0.05) v.p.pause(); }, 300); }
  else { v.p.play(); v.g.gain.setTargetAtTime(1, actx.currentTime, 0.15); }
}

// ---------- shader ----------
const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uRot, uBass, uHigh, uProg, uPlay, uSel, uHoverRing, uHoverCore, uAlive;
uniform float uBands[${BANDS}];
#define PI 3.14159265
#define R ${R.toFixed(3)}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// studio lighting on black: softboxes and strips are what make chrome read as chrome
vec3 studio(vec3 r){
  float k = 0.0;
  k += smoothstep(0.7, 0.97, r.y) * 1.3;
  k += pow(max(0.0, dot(r, normalize(vec3(-0.7, 0.4, 0.6)))), 24.0) * 3.0;
  float az = atan(r.x, r.z);
  k += smoothstep(0.09, 0.03, abs(az - 1.3)) * smoothstep(-0.3, 0.1, r.y) * smoothstep(0.85, 0.35, r.y) * 1.8;
  k += smoothstep(0.07, 0.02, abs(az + 1.2)) * smoothstep(-0.2, 0.3, r.y) * smoothstep(0.9, 0.5, r.y) * 1.1;
  k += smoothstep(0.05, 0.01, abs(az + 2.4)) * 0.8;
  k += exp(-abs(r.y + 0.05) * 16.0) * 0.16;
  // softboxes behind the viewer, which the wheel's face sees
  k += smoothstep(0.08, 0.02, abs(r.x - 0.38)) * smoothstep(0.15, 0.6, r.z) * 1.5;
  k += smoothstep(0.05, 0.015, abs(r.y - 0.42)) * smoothstep(0.3, 0.7, r.z) * 0.9;
  k += smoothstep(0.04, 0.01, abs(r.x + 0.55)) * smoothstep(0.2, 0.6, r.z) * 0.6;
  k += max(r.z, 0.0) * 0.05;
  return vec3(k) * vec3(0.95, 0.97, 1.03);
}

float band(float u){
  float x = u * ${BANDS}.0 - 0.5;
  int i0 = int(mod(floor(x), ${BANDS}.0));
  int i1 = int(mod(floor(x) + 1.0, ${BANDS}.0));
  float a = 0.0, b = 0.0;
  for (int i = 0; i < ${BANDS}; i++) { if (i == i0) a = uBands[i]; if (i == i1) b = uBands[i]; }
  return mix(a, b, smoothstep(0.0, 1.0, fract(x)));
}

// the wheel: a knurled chrome torus with the song marks raised on its face
float wheel(vec3 p){
  vec3 q = p; q.xy = rot(-uRot) * q.xy;
  float a = atan(q.y, q.x);
  vec2 t = vec2(length(q.xy) - R, q.z);
  float d = length(t * vec2(1.0, 0.85)) - 0.13;
  d += 0.004 * sin(a * 180.0) * smoothstep(-0.02, 0.1, t.x);   // knurled outer edge
  d -= 0.012 * smoothstep(0.05, 0.0, abs(t.x)) * smoothstep(0.0, 0.1, q.z); // a raised crown line
  // song marks: one bead for the first, two for the second
  vec3 m0 = vec3(0.0, R, 0.125);
  d = smin(d, length(q - m0) - 0.045, 0.03);
  vec3 m1 = vec3(0.0, -R, 0.125);
  d = smin(d, length(q - m1 - vec3(0.06, 0.0, 0.0)) - 0.038, 0.03);
  d = smin(d, length(q - m1 + vec3(0.06, 0.0, 0.0)) - 0.038, 0.03);
  return d;
}
// the fixed pointer above the wheel
float pointer(vec3 p){
  vec3 q = p - vec3(0.0, R + 0.26, 0.05);
  float cone = max(length(q.xz) * 0.9 - (q.y + 0.09) * 0.42, abs(q.y) - 0.09);
  return cone;
}
// the ferrofluid: a black pool that grows spikes where its band of the spectrum is loud
float ferro(vec3 p){
  vec3 q = p * vec3(1.0, 1.0, 1.55);
  float r = length(q);
  vec3 n = q / max(r, 1e-4);
  float th = atan(n.y, n.x);
  float ph = acos(clamp(n.z, -1.0, 1.0));
  float e = band(fract(th / (2.0 * PI) + 0.25));
  float idle = 0.04 + 0.03 * sin(uTime * 0.8 + th * 3.0);
  float amp = mix(idle, 0.06 + e * 0.36, uAlive);
  // a staggered lattice of spikes, denser around the rim than at the centre
  float rows = 9.0;
  float row = ph / PI * rows;
  float rowc = (floor(row) + 0.5) / rows * PI;           // each row keeps one spike count
  float shift = mod(floor(row), 2.0) * 0.5;
  float cols = max(3.0, floor(sin(rowc) * 30.0));
  float cell = (th / (2.0 * PI)) * cols + shift + uTime * 0.03;
  float sx = 0.5 + 0.5 * cos(fract(cell) * 2.0 * PI);
  float sy = 0.5 + 0.5 * cos((fract(row) - 0.5) * 2.0 * PI); // zero at row edges, so rows meet cleanly
  float spike = pow(sx * sy, 4.0) * smoothstep(0.1, 0.9, n.z);
  float base = 0.4 + uBass * 0.06 * uAlive;
  return (r - base - spike * amp - 0.015 * sin(uTime * 1.3 + th * 5.0)) * 0.3;
}

vec2 map(vec3 p){
  float w = min(wheel(p), pointer(p));
  float f = ferro(p);
  return w < f ? vec2(w, 1.0) : vec2(f, 2.0);
}
vec3 normalAt(vec3 p){
  vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.0, 5.2);
  vec3 rd = normalize(vec3(uv, -1.6));
  float t = 0.0; vec2 h = vec2(1.0, 0.0);
  for (int i = 0; i < 160; i++) {
    h = map(ro + rd * t);
    if (h.x < 0.0008 || t > 9.0) break;
    t += h.x;
  }
  vec3 col = vec3(0.0);
  if (h.x < 0.002) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    vec3 r = reflect(rd, n);
    float fr = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);
    if (h.y < 1.5) {
      // polished chrome
      col = studio(r) * mix(0.6, 1.1, fr) + vec3(0.03);
      col *= 1.0 + uHoverRing * 0.12;
      // the playing mark glows faintly from within
      vec3 q = p; q.xy = rot(-uRot) * q.xy;
      float onMark = uSel < 0.5 ? exp(-length(q - vec3(0.0, R, 0.125)) * 40.0) : exp(-min(length(q - vec3(0.06, -R, 0.125)), length(q - vec3(-0.06, -R, 0.125))) * 40.0);
      col += vec3(1.0, 0.92, 0.8) * onMark * uPlay * (0.6 + uBass * 0.8);
    } else {
      // glossy black liquid: dark body, hard bright reflections, a cold rim
      col = studio(r) * 0.32 + vec3(0.006);
      col += vec3(0.55, 0.62, 0.75) * fr * 0.35;
      col += vec3(1.0) * pow(max(0.0, dot(r, normalize(vec3(-0.5, 0.7, 0.5)))), 120.0) * 2.0;
      col *= 1.0 + uHoverCore * 0.25;
    }
  }
  // progress: a hairline arc inside the wheel, lit from the top clockwise
  float rr = length(uv) * ${WORLD.toFixed(4)};
  float ang = atan(uv.x, uv.y); if (ang < 0.0) ang += 2.0 * PI;
  float line = smoothstep(0.006, 0.0, abs(rr - ${ARC.toFixed(3)}));
  float lit = step(ang / (2.0 * PI), uProg);
  if (h.x >= 0.002 || t > 4.6) col += vec3(0.85, 0.88, 0.95) * line * mix(0.06, 0.7, lit) * uAlive;
  // grain and a soft vignette
  col *= 1.0 - dot(uv, uv) * 0.35;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.03;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }"));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, "p");
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = {};
["uRes", "uTime", "uRot", "uBass", "uHigh", "uProg", "uPlay", "uSel", "uHoverRing", "uHoverCore", "uAlive", "uBands"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

let dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resize();
addEventListener("resize", resize);

// ---------- gestures ----------
// Where a pointer is, in world units on the wheel's plane, measured from the centre.
function polar(e) {
  const s = Math.min(innerWidth, innerHeight);
  const x = (e.clientX - innerWidth / 2) / s * WORLD, y = -(e.clientY - innerHeight / 2) / s * WORLD;
  return { r: Math.hypot(x, y), a: Math.atan2(y, x), clock: (Math.atan2(x, y) + Math.PI * 2) % (Math.PI * 2) };
}
const zone = (r) => (r < 0.62 ? "core" : Math.abs(r - ARC) < 0.1 ? "arc" : Math.abs(r - R) < 0.28 ? "ring" : null);

let rotA = 0, vel = 0, dragging = null, lastA = 0, lastT = 0, downR = 0, moved = 0, hover = null, entered = false;
let selected = 0;
const snapAngle = (i) => i * Math.PI; // mark i sits at the pointer when the wheel is turned by i * PI
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function select(i, autoAdvance = false) {
  selected = i;
  if (autoAdvance) { swing = snapAngle(i); }
  play(i);
}
let swing = null;

function seekTo(clock) {
  const v = voices[current];
  if (v) v.p.seek((clock / (Math.PI * 2)) * v.p.duration);
}

canvas.addEventListener("pointerdown", (e) => {
  if (!entered) return;
  const p = polar(e);
  downR = p.r; moved = 0;
  dragging = zone(p.r);
  if (!dragging) return;
  canvas.setPointerCapture(e.pointerId);
  if (dragging === "ring") { lastA = p.a; lastT = performance.now(); vel = 0; swing = null; }
  if (dragging === "arc") seekTo(p.clock);
});
canvas.addEventListener("pointermove", (e) => {
  const p = polar(e);
  hover = zone(p.r);
  canvas.style.cursor = !entered ? "default" : hover === "ring" ? (dragging ? "grabbing" : "grab") : hover ? "pointer" : "default";
  if (!dragging) return;
  if (dragging === "ring") {
    const da = wrap(p.a - lastA), now = performance.now();
    rotA += da;
    vel = vel * 0.5 + (da / Math.max(1, now - lastT)) * 16 * 0.5;
    lastA = p.a; lastT = now;
    moved += Math.abs(da);
  }
  if (dragging === "arc") seekTo(p.clock);
});
const up = () => {
  if (dragging === "core" && moved < 0.02) togglePause();
  if (dragging === "ring" && performance.now() - lastT > 80) vel = 0; // held still before letting go
  dragging = null;
};
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", up);
canvas.addEventListener("pointerleave", () => (hover = null));

// scroll turns the volume; a faint readout surfaces for a moment
const volEl = document.getElementById("vol");
let volTimer;
function setVolume(v) {
  volLevel = Math.max(0, Math.min(1, v));
  volume.gain.setTargetAtTime(volLevel, actx.currentTime, 0.03);
  try { localStorage.setItem("void-volume", String(volLevel)); } catch (e) {}
  volEl.textContent = String(Math.round(volLevel * 100)).padStart(2, "0");
  volEl.classList.add("on");
  clearTimeout(volTimer);
  volTimer = setTimeout(() => volEl.classList.remove("on"), 1100);
}
addEventListener("wheel", (e) => { if (entered) setVolume(volLevel - Math.sign(e.deltaY) * 0.04); }, { passive: true });
addEventListener("keydown", (e) => {
  if (!entered) return;
  const v = voices[current];
  if (e.code === "Space") { e.preventDefault(); togglePause(); }
  if (e.key === "ArrowUp") { e.preventDefault(); setVolume(volLevel + 0.05); }
  if (e.key === "ArrowDown") { e.preventDefault(); setVolume(volLevel - 0.05); }
  if (v && e.key === "ArrowRight") v.p.seek(v.p.time + 5);
  if (v && e.key === "ArrowLeft") v.p.seek(v.p.time - 5);
  if (e.key === "1" || e.key === "2" || e.key === "Tab") { e.preventDefault(); swing = snapAngle(e.key === "2" ? 1 : e.key === "1" ? 0 : 1 - selected); }
});

// ---------- entry ----------
const gate = document.getElementById("gate");
gate.disabled = true;
firstReady.then(() => { gate.disabled = false; gate.classList.add("ready"); gate.setAttribute("aria-label", "Enter"); });
gate.addEventListener("click", () => {
  if (gate.disabled || entered) return;
  entered = true;
  actx.resume();
  select(0);
  gate.classList.add("gone");
});

// ---------- loop ----------
const bands = new Float32Array(BANDS);
let bass = 0, high = 0, alive = 0, t0 = performance.now(), last = t0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const k = (a) => 1 - Math.pow(1 - a, dt * 60);

  // spectrum: sixteen log-spaced bands with a quick rise and a slow fall
  analyser.getByteFrequencyData(freq);
  for (let b = 0; b < BANDS; b++) {
    const lo = Math.floor(2 * Math.pow(400, b / BANDS)), hi = Math.max(lo + 1, Math.floor(2 * Math.pow(400, (b + 1) / BANDS)));
    let s = 0;
    for (let j = lo; j < hi; j++) s += freq[j];
    const v = Math.min(1, (s / ((hi - lo) * 255)) * (1.15 + b * 0.05));
    bands[b] += (v - bands[b]) * (v > bands[b] ? k(0.5) : k(0.08));
  }
  bass += ((bands[0] + bands[1] + bands[2]) / 3 - bass) * k(0.3);
  high += ((bands[12] + bands[13] + bands[14]) / 3 - high) * k(0.3);
  const v = voices[current];
  const playingNow = !!(v && v.p.playing);
  alive += ((playingNow ? 1 : 0) - alive) * k(0.04);

  // the wheel: inertia, then a pull to the nearest mark; settling on a new mark changes the song
  if (!dragging) {
    if (swing !== null) {
      const d = wrap(swing - rotA);
      rotA += d * k(0.08);
      if (Math.abs(d) < 0.003) { rotA = swing; swing = null; }
    } else {
      rotA += vel * dt * 60;
      vel *= Math.pow(0.95, dt * 60);
      const nearest = Math.round(rotA / Math.PI) * Math.PI;
      if (Math.abs(vel) < 0.01) vel += wrap(nearest - rotA) * 0.03;
    }
    const settled = Math.abs(vel) < 0.002 && swing === null && Math.abs(wrap(Math.round(rotA / Math.PI) * Math.PI - rotA)) < 0.01;
    if (entered && settled) {
      const i = ((Math.round(rotA / Math.PI) % 2) + 2) % 2;
      if (i !== current && wanted !== i) select(i);
    }
  }

  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform1f(U.uTime, (now - t0) / 1000);
  gl.uniform1f(U.uRot, rotA);
  gl.uniform1f(U.uBass, bass);
  gl.uniform1f(U.uHigh, high);
  gl.uniform1f(U.uProg, v ? v.p.time / v.p.duration : 0);
  gl.uniform1f(U.uPlay, alive);
  gl.uniform1f(U.uSel, Math.max(0, current));
  gl.uniform1f(U.uHoverRing, hover === "ring" || dragging === "ring" ? 1 : 0);
  gl.uniform1f(U.uHoverCore, hover === "core" ? 1 : 0);
  gl.uniform1f(U.uAlive, entered ? Math.max(alive, 0.0) : 0);
  gl.uniform1fv(U.uBands, bands);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.VOID = { voices, get current() { return current; }, select, get rot() { return rotA; }, set rot(v) { rotA = v; } };
