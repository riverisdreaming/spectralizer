import * as THREE from "three";
import { makeCloud, mulberry, toonMaterial, makeParcel, leafGeometry, printSunTextures, glowTexture } from "./assets.js";
import { makeBuilding, fireEscapeGeometry, streetTexture, sidewalkTexture, makeCar, makeLamp, makeStoop, makeBridge, makeSkyline } from "./city.js";
import { COLORS, MARDI, muralTexture, splatTexture, dogStencil, paintMaterial, beadStrand, buntingGeometry } from "./color.js";

// A city street in the rain, grey and empty. The first song brings the colour back down the
// street: paint spreads over the walls, beads and bunting go up, leaves gust through. The second
// paints the bridge, fills the air with confetti and turns the sky into a purple-and-gold sunset.
// Each song lives in a place: the front door, and the bridge.
const TRACKS = [
  { title: "doordash", src: "music/doordash.mp3" },
  { title: "wardoggin", src: "music/wardoggin.mp3" },
];

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = Math.min(innerWidth, innerHeight) < 700;
const rnd = mulberry(7);

// ---------- renderer ----------
const canvas = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.6 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- finishing pass ----------
// Colour returns with distance: everything nearer than uReach is in full colour, everything past
// it is rain-grey. A light paper grain and faint ink edges tie the city to the drawings.
const dprNow = () => renderer.getPixelRatio();
const rt = new THREE.WebGLRenderTarget(innerWidth * dprNow(), innerHeight * dprNow(), { type: THREE.HalfFloatType, samples: 4 });
rt.depthTexture = new THREE.DepthTexture(innerWidth * dprNow(), innerHeight * dprNow());
const post = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture },
      uRes: { value: new THREE.Vector2(rt.width, rt.height) }, uDpr: { value: dprNow() },
      uNear: { value: 0.1 }, uFar: { value: 600 }, uReach: { value: 3 }, uSky: { value: 0 }, uRain: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uDpr, uNear, uFar, uReach, uSky, uRain;
      float lin(float d){ float z = d*2.0 - 1.0; return 2.0*uNear*uFar / (uFar + uNear - z*(uFar - uNear)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 px = 1.0 / uRes;
        vec3 c = pow(max(texture2D(tColor, vUv).rgb, 0.0), vec3(1.0/2.2));
        float d0 = lin(texture2D(tDepth, vUv).r);
        float e = abs(lin(texture2D(tDepth, vUv - vec2(px.x, 0.0)).r) - d0)
                + abs(lin(texture2D(tDepth, vUv + vec2(px.x, 0.0)).r) - d0)
                + abs(lin(texture2D(tDepth, vUv - vec2(0.0, px.y)).r) - d0)
                + abs(lin(texture2D(tDepth, vUv + vec2(0.0, px.y)).r) - d0);
        float ink = smoothstep(0.15, 0.4, e / d0) * (1.0 - smoothstep(20.0, 70.0, d0));
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        // how much colour this pixel has got back
        float col = d0 > 500.0 ? uSky : smoothstep(uReach, uReach - 14.0, d0);
        vec3 vivid = mix(vec3(l), c, 1.15);
        vec3 rainy = (vec3(0.2) + vec3(l) * 0.75) * vec3(0.84, 0.88, 0.95);
        c = mix(rainy, vivid, col);
        // in the rain everything sits a little lower and cooler
        c *= 1.0 - uRain * 0.06;
        c = mix(c, vec3(0.08, 0.07, 0.1), ink * 0.22);
        // light paper grain
        vec2 cell = floor(gl_FragCoord.xy / max(1.0, floor(uDpr + 0.25)));
        c += (hash(cell) - 0.5) * 0.045;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  })
);
post.frustumCulled = false;
const postScene = new THREE.Scene();
postScene.add(post);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- scene, camera, light ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#8a909a", 50, 260);
const camera = new THREE.PerspectiveCamera(small ? 66 : 55, innerWidth / innerHeight, 0.1, 600);
const camBase = new THREE.Vector3(0, 1.7, 12);
camera.position.copy(camBase);
const hemi = new THREE.HemisphereLight("#cfe3ff", "#8a6a5a", 1.0);
const sunLight = new THREE.DirectionalLight("#fff1dc", 1.0);
sunLight.position.set(-40, 70, 30);
scene.add(hemi, sunLight);

// ---------- sky ----------
const skyU = { uClear: { value: 0 } };
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uClear;
      void main(){
        float y = max(vDir.y, 0.0);
        vec3 grey = mix(vec3(0.66, 0.68, 0.72), vec3(0.5, 0.53, 0.58), smoothstep(0.0, 0.6, y));
        // a Mardi Gras sunset: gold at the horizon, purple above, deep blue overhead
        vec3 sunset = mix(vec3(0.98, 0.66, 0.24), vec3(0.45, 0.2, 0.55), smoothstep(0.0, 0.22, y));
        sunset = mix(sunset, vec3(0.1, 0.12, 0.38), smoothstep(0.18, 0.7, y));
        gl_FragColor = vec4(mix(grey, sunset, uClear), 1.0);
      }`,
  })
));

// rain clouds that break up during the second song, and a few clean ones after
const stormMat = toonMaterial({ lit: "#a3a8b2", mid: "#7c818c", shadow: "#565a64" });
const clouds = [];
for (let i = 0; i < 12; i++) {
  const c = makeCloud(i + 3);
  c.traverse((o) => o.isMesh && (o.material = stormMat));
  c.position.set(-110 + i * 20 + rnd() * 8, 55 + rnd() * 12, -60 - rnd() * 120);
  c.scale.set(3 + rnd(), 1.6 + rnd() * 0.6, 2);
  c.userData = { y: c.position.y, s: c.scale.clone(), speed: 0.5 + rnd() * 0.5 };
  clouds.push(c);
  scene.add(c);
}
const fairMat = toonMaterial({ lit: "#ffd28a", mid: "#c0605a", shadow: "#3b2a6e", light: new THREE.Vector3(-0.6, -0.1, 0.6) });
const fair = [[-70, 70, -170], [80, 64, -190], [-20, 84, -230]].map(([x, y, z], i) => {
  const c = makeCloud(i + 40);
  c.traverse((o) => o.isMesh && (o.material = fairMat));
  c.position.set(x, y, z);
  c.scale.setScalar(3.4);
  scene.add(c);
  return c;
});

// ---------- the street ----------
const STREET_HALF = 5, WALK = 3, FRONT = STREET_HALF + WALK; // building fronts at x = ±8
{
  const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET_HALF * 2, 260), new THREE.MeshStandardMaterial({ map: streetTexture(), roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -100);
  scene.add(road);
  [-1, 1].forEach((s) => {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALK, 0.18, 260), new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 0.95 }));
    walk.position.set(s * (STREET_HALF + WALK / 2), 0.09, -100);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 260), new THREE.MeshStandardMaterial({ color: "#a39f97", roughness: 0.9 }));
    curb.position.set(s * STREET_HALF, 0.1, -100);
    scene.add(walk, curb);
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  scene.add(ground);
}

// warehouse blocks down both sides, with fire escapes on the street fronts
const BRICKS = ["#8e3b2c", "#9c4a34", "#7d3427", "#a5553c", "#6e3a2e", "#93432f"];
const escapeMat = new THREE.MeshStandardMaterial({ color: "#26282c", roughness: 0.7, metalness: 0.4 });
const facades = []; // stretches of building front where paint can spread
const escapes = [];
[-1, 1].forEach((s, si) => {
  let z = 20;
  let k = 0;
  while (z > -86) {
    const width = 10 + rnd() * 7, height = 18 + rnd() * 18, depth = 14;
    const b = makeBuilding({ width, height, depth, brick: BRICKS[(k + si * 3) % BRICKS.length], seed: 10 + k + si * 50 });
    b.position.set(s * (FRONT + depth / 2), 0, z - width / 2);
    scene.add(b);
    if (rnd() < 0.75) {
      const esc = new THREE.Mesh(fireEscapeGeometry(b.userData.floors), escapeMat);
      esc.position.set(s * FRONT, 0, z - width * (0.3 + rnd() * 0.4));
      if (s > 0) esc.rotation.y = Math.PI;
      scene.add(esc);
      escapes.push({ s, z: esc.position.z, floors: b.userData.floors });
    }
    facades.push({ s, z0: z, z1: z - width, h: height });
    z -= width + 0.2;
    k++;
  }
});

// parked cars and lamps
const CAR_COLORS = ["#3d5a80", "#8a9a5b", "#d8d8d6", "#6b2d2d", "#2f3e46", "#c9a227", "#5b6f8a"];
for (let z = 6, i = 0; z > -70; z -= 6 + rnd() * 4, i++) {
  if (rnd() < 0.2) continue;
  const car = makeCar(CAR_COLORS[i % CAR_COLORS.length], i + 3);
  car.position.set(3.7, 0, z);
  scene.add(car);
  if (rnd() < 0.35) { const c2 = makeCar(CAR_COLORS[(i + 3) % CAR_COLORS.length], i + 40); c2.position.set(-3.7, 0, z - 3); scene.add(c2); }
}
const lamps = [];
for (let z = 4; z > -84; z -= 16) [-1, 1].forEach((s) => {
  const l = makeLamp();
  l.root.position.set(s * (STREET_HALF + 0.6), 0.18, z - (s > 0 ? 8 : 0));
  if (s < 0) l.root.rotation.y = Math.PI;
  scene.add(l.root);
  lamps.push(l);
});

// ---------- the two places ----------
// the first song's front door: a brownstone stoop on the right
const stoop = makeStoop();
const STOOP_Z = -18;
stoop.root.position.set(FRONT, 0.18, STOOP_Z);
scene.add(stoop.root);
const parcel = makeParcel(); // a delivery waiting on the step, once the street has its colour
parcel.position.set(-1.25, 0.88, 0.6);
parcel.rotation.y = 0.5;
parcel.visible = false;
stoop.root.add(parcel);
// the second song's bridge, closing the end of the street
const bridge = makeBridge();
bridge.root.position.set(0, 0, -98);
scene.add(bridge.root);
const skyline = makeSkyline();
skyline.position.set(0, 0, -240);
scene.add(skyline);
const places = [
  { root: stoop.root, glow: 0 },
  { root: bridge.root, glow: 0 },
];
const doorDark = new THREE.Color("#2a1d18"), doorLit = new THREE.Color("#ffd98a");
// while its song is quiet, the front door taps out D O O R in Morse
const morseOn = [];
for (const ch of "-.. --- --- .-.") {
  if (ch === " ") { morseOn.push(0, 0); continue; }
  morseOn.push(...(ch === "." ? [1] : [1, 1, 1]), 0);
}
morseOn.push(0, 0, 0, 0, 0, 0, 0);

// ---------- colour coming back ----------
// Everything waits for its moment in the story (t0 on a 0..2 scale: the first song is 0..1,
// the second 1..2). Nearer things come first, so the colour runs down the street.
const zMoment = (z) => 0.06 + THREE.MathUtils.clamp((8 - z) / 92, 0, 1) * 0.85;
const painted = []; // surfaces paint spreads across: { mat, t0 }
function paint(map, w, h, pos, rotY, t0, rotX = 0) {
  const mat = paintMaterial(map);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  m.rotation.set(rotX, rotY, 0);
  scene.add(m);
  painted.push({ mat, t0 });
  return m;
}
// murals across the brick, one or two per building
let seed = 1;
facades.forEach((f) => {
  const width = f.z0 - f.z1;
  const n = width > 13 && f.h > 24 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const w = Math.min(width - 2, 5 + rnd() * 4.5), h = 4 + rnd() * 5;
    const y = 2.5 + h / 2 + rnd() * Math.max(0, f.h - h - 6);
    const z = f.z1 + 0.75 + w / 2 + rnd() * Math.max(0, width - w - 1.5);
    paint(muralTexture(seed++), w, h, new THREE.Vector3(f.s * (FRONT - 0.03), y, z), f.s > 0 ? -Math.PI / 2 : Math.PI / 2, zMoment(z) + 0.05 * i);
  }
});
// paint splashed across the street
for (let z = 6; z > -84; z -= 5 + rnd() * 5) {
  const size = 2.5 + rnd() * 3;
  paint(splatTexture(seed++), size, size, new THREE.Vector3((rnd() - 0.5) * 8, 0.03, z), rnd() * Math.PI, zMoment(z), -Math.PI / 2);
}
// the war dog, stencilled on a wall near the bridge
paint(dogStencil(), 3.4, 3.4, new THREE.Vector3(-(FRONT - 0.04), 2.6, -80), Math.PI / 2, 1.25);
// the second song paints the bridge: tall bands up both tower legs
[-6.5, 6.5].forEach((x, i) => paint(muralTexture(100 + i, 512, 2048), 3.1, 34, new THREE.Vector3(x, 33, -98 + 2.05), 0, 1.25 + i * 0.12));

// Mardi Gras beads draped from the fire escapes and the lamps
const strands = [];
function drape(a, b, sag, t0) {
  const g = beadStrand(a, b, sag, seed++);
  g.scale.setScalar(0.001);
  scene.add(g);
  strands.push({ g, t0, shown: 0, phase: rnd() * 6 });
}
escapes.forEach((e) => {
  for (let f = 2; f < Math.min(e.floors, 6); f += 1 + Math.floor(rnd() * 2)) {
    const x = e.s * (FRONT - 1.1), y = f * 3.4 + 0.95;
    drape(new THREE.Vector3(x, y, e.z - 1.5), new THREE.Vector3(x, y, e.z + 1.5), 0.5 + rnd() * 0.5, zMoment(e.z) + 0.04);
  }
});
lamps.forEach((l) => {
  const p = l.root.position;
  const dir = l.root.rotation.y ? 1 : -1;
  drape(new THREE.Vector3(p.x, 4.9, p.z), new THREE.Vector3(p.x + dir * 0.95, 4.7, p.z), 0.6, zMoment(p.z) + 0.02);
});

// bunting strung across the street
const bunting = [];
const buntMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
for (let z = 0; z > -82; z -= 12 + rnd() * 5) {
  const m = new THREE.Mesh(buntingGeometry(FRONT * 2, 1.2 + rnd() * 0.6, 20), buntMat);
  m.position.set(0, 8.5 + rnd() * 3, z);
  m.scale.setScalar(0.001);
  scene.add(m);
  bunting.push({ m, t0: zMoment(z) + 0.08, shown: 0, phase: rnd() * 6 });
}

// leaves gusting down the street toward you: a few soggy ones in the rain, a storm of colour later
const LEAVES = small ? 220 : 380;
const leafMesh = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), LEAVES);
leafMesh.frustumCulled = false;
scene.add(leafMesh);
const SOGGY = ["#5a4632", "#6b5a3a", "#4a4030", "#3d3a2c"];
const LEAF_COLS = [...MARDI, ...MARDI, ...COLORS];
const leaves = [];
const leafCol = new THREE.Color();
const story = () => As + Bs;
function respawnLeaf(L, i, anywhere) {
  const cz = camera.position.z;
  L.p.set((rnd() - 0.5) * 14, 0.3 + rnd() * (story() > 0.1 ? 9 : 1.5), anywhere ? cz + 3 - rnd() * 50 : cz - 30 - rnd() * 30);
  L.v.set((rnd() - 0.5) * 0.5, 0, 2 + rnd() * 2);
  leafMesh.setColorAt(i, leafCol.set(story() > 0.08 ? LEAF_COLS[Math.floor(rnd() * LEAF_COLS.length)] : SOGGY[Math.floor(rnd() * SOGGY.length)]));
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
}
for (let i = 0; i < LEAVES; i++) {
  const L = { p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(5), s: 1.4 + rnd() * 1.2 };
  leaves.push(L);
}

// confetti in the air once the second song is under way
const CONFETTI = small ? 260 : 520;
const confMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONFETTI);
confMesh.frustumCulled = false;
const confetti = [];
for (let i = 0; i < CONFETTI; i++) {
  confetti.push({ p: new THREE.Vector3((rnd() - 0.5) * 16, rnd() * 18, 6 - rnd() * 60), r: new THREE.Euler(rnd() * 6, rnd() * 6, 0), w: 2 + rnd() * 4, fall: 0.6 + rnd() * 0.8 });
  confMesh.setColorAt(i, leafCol.set(COLORS[i % COLORS.length]));
}
confMesh.count = 0;
scene.add(confMesh);

// a low sunset sun over the bridge; tap it and the wind picks up
const sunTex = printSunTextures();
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex.disc, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
sun.position.set(-34, 24, -300);
sun.scale.setScalar(26);
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,190,90,1)", "rgba(255,140,60,0)"), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0 }));
sunGlow.position.copy(sun.position).add(new THREE.Vector3(0, 0, -1));
sunGlow.scale.setScalar(110);
scene.add(sunGlow, sun);

// ---------- rain ----------
const RAIN = small ? 1000 : 2000;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN * 6);
for (let i = 0; i < RAIN; i++) {
  const x = (rnd() * 2 - 1) * 9, y = rnd() * 16, z = 12 - rnd() * 40;
  rainPos.set([x, y, z, x - 0.04, y - 0.5, z], i * 6);
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#d0d6e2", transparent: true, opacity: 0.5, depthWrite: false }));
rain.frustumCulled = false;
scene.add(rain);

// ---------- audio ----------
let actx, analyser, freq, volume, volLevel = 0.8, current = -1, playing = false;
const voices = [];
// Fetch both songs as soon as the page opens. Playing them from blob: URLs keeps them on the
// page's own origin, so Web Audio may read them (a cross-origin file plays silent through it),
// and it means the tap on "wake up" can start the sound at once, inside the gesture phones need.
const songURLs = TRACKS.map(() => null);
const songsReady = Promise.all(TRACKS.map((t, i) =>
  fetch(t.src)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then((b) => (songURLs[i] = URL.createObjectURL(b)))
    .catch(() => (songURLs[i] = t.src)) // fall back to plain playback without the visual link
));

function startAudio() {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  actx.resume();
  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;
  // volume sits after the analyser, so the drawings react the same at any volume
  volume = actx.createGain();
  volume.gain.value = volLevel;
  analyser.connect(volume).connect(actx.destination);
  freq = new Uint8Array(analyser.frequencyBinCount);
  TRACKS.forEach((t, i) => {
    const url = songURLs[i] || t.src;
    const el = new Audio(url);
    el.preload = "auto";
    el.addEventListener("ended", () => play((i + 1) % TRACKS.length));
    // only same-origin (blob:) audio goes through Web Audio; anything else plays straight out
    const direct = !url.startsWith("blob:");
    let g = null;
    if (!direct) {
      g = actx.createGain();
      g.gain.value = 0;
      actx.createMediaElementSource(el).connect(g).connect(analyser);
    } else {
      el.volume = 0;
    }
    voices.push({ el, g, direct });
  });
}
// fade a voice in or out, whichever way it is wired
function fade(v, to, time) {
  if (v.direct) { v.el.volume = to * volLevel; return; }
  v.g.gain.setTargetAtTime(to, actx.currentTime, time);
}
function play(i) {
  if (!actx) return;
  actx.resume();
  if (i === current) {
    const v = voices[i];
    if (playing) { fade(v, 0, 0.15); setTimeout(() => v.el.pause(), 500); playing = false; }
    else { v.el.play(); fade(v, 1, 0.2); playing = true; }
  } else {
    if (current >= 0) { const old = voices[current]; fade(old, 0, 0.35); setTimeout(() => old.el.pause(), 1600); }
    const v = voices[i];
    if (v.el.ended) v.el.currentTime = 0;
    v.el.play();
    fade(v, 1, 0.35);
    current = i; playing = true;
  }
  player.sync();
}
function levels() {
  if (!analyser) return { bass: 0, high: 0 };
  analyser.getByteFrequencyData(freq);
  const band = (a, b) => { let s = 0; for (let k = a; k < b; k++) s += freq[k]; return s / ((b - a) * 255); };
  return { bass: band(1, 6), high: band(60, 200) };
}

// ---------- the player strip ----------
let entered = false;
const player = (() => {
  const root = document.getElementById("player");
  const placeBtns = [...root.querySelectorAll(".place")];
  const pp = document.getElementById("pp"), seek = document.getElementById("seek"), vol = document.getElementById("vol");
  const tNow = document.getElementById("t-now"), tEnd = document.getElementById("t-end");
  let scrubbing = false;
  const fmt = (s) => (isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00");
  placeBtns.forEach((b, i) => b.addEventListener("click", () => entered && play(i)));
  pp.addEventListener("click", () => entered && play(current < 0 ? 0 : current));
  seek.addEventListener("input", () => {
    scrubbing = true;
    const v = current >= 0 ? voices[current] : null;
    if (v && v.el.duration) tNow.textContent = fmt((seek.value / 1000) * v.el.duration);
  });
  seek.addEventListener("change", () => {
    const v = current >= 0 ? voices[current] : null;
    if (v && v.el.duration) v.el.currentTime = (seek.value / 1000) * v.el.duration;
    scrubbing = false;
  });
  try { const saved = parseFloat(localStorage.getItem("new-dawn-volume")); if (saved >= 0 && saved <= 1) volLevel = saved; } catch (e) {}
  vol.value = Math.round(volLevel * 100);
  vol.addEventListener("input", () => {
    volLevel = vol.value / 100;
    if (volume) volume.gain.setTargetAtTime(volLevel, actx.currentTime, 0.03);
    voices.forEach((v, k) => { if (v.direct && k === current && playing) v.el.volume = volLevel; });
    root.style.setProperty("--vol", volLevel);
    try { localStorage.setItem("new-dawn-volume", String(volLevel)); } catch (e) {}
  });
  root.style.setProperty("--vol", volLevel);
  return {
    sync() {
      placeBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === current)));
      pp.setAttribute("aria-label", playing ? "Pause" : "Play");
      root.classList.toggle("playing", playing);
    },
    tick(progress, bass) {
      const v = current >= 0 ? voices[current] : null;
      if (!scrubbing) seek.value = Math.round(progress * 1000);
      root.style.setProperty("--p", progress);
      root.style.setProperty("--beat", (bass * 0.4).toFixed(3));
      if (v) { if (!scrubbing) tNow.textContent = fmt(v.el.currentTime); tEnd.textContent = fmt(v.el.duration); }
      root.style.opacity = entered ? 1 : 0;
    },
    nudgeVolume(d) { vol.value = Math.max(0, Math.min(100, +vol.value + d)); vol.dispatchEvent(new Event("input")); },
  };
})();

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(0, 0);
function pickPlace() {
  ray.setFromCamera(ndc, camera);
  let best = -1, bestD = Infinity;
  places.forEach((p, i) => { const h = ray.intersectObject(p.root, true)[0]; if (h && h.distance < bestD) { best = i; bestD = h.distance; } });
  return best;
}
canvas.addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  canvas.style.cursor = entered && pickPlace() >= 0 ? "pointer" : "";
});
canvas.addEventListener("click", (e) => {
  if (!entered) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (sun.material.opacity > 0.3 && ray.intersectObject(sun)[0]) { gust = 1; return; } // tap the sun: a gust
  const i = pickPlace();
  if (i >= 0) play(i);
});
addEventListener("keydown", (e) => {
  if (!entered) return;
  if (e.target.closest && e.target.closest("input, button")) return; // native controls handle their own keys
  const v = current >= 0 ? voices[current] : null;
  if (e.code === "Space") { e.preventDefault(); play(current < 0 ? 0 : current); }
  if (v && e.key === "ArrowRight") v.el.currentTime = Math.min(v.el.duration || 0, v.el.currentTime + 5);
  if (v && e.key === "ArrowLeft") v.el.currentTime = Math.max(0, v.el.currentTime - 5);
  if (e.key === "ArrowUp") { e.preventDefault(); player.nudgeVolume(5); }
  if (e.key === "ArrowDown") { e.preventDefault(); player.nudgeVolume(-5); }
  if (e.key === "1" || e.key === "2") play(+e.key - 1);
});

// ---------- entry ----------
const gate = document.getElementById("gate");
gate.querySelector("img").src = sunTex.disc.image.toDataURL();
// The button waits until both songs are loaded, then starts the music right on the tap.
const gateLabel = gate.querySelector("span");
gate.disabled = true;
gate.classList.add("loading");
gateLabel.textContent = "loading";
songsReady.then(() => { gate.disabled = false; gate.classList.remove("loading"); gateLabel.textContent = "wake up"; });
gate.addEventListener("click", () => {
  if (entered || gate.disabled) return;
  entered = true;
  startAudio();
  play(0);
  gate.classList.add("gone");
});

// ---------- loop ----------
// A, B: how far each song has carried the city back (0..1). They only move forward.
let A = 0, B = 0, As = 0, Bs = 0, bass = 0, high = 0, gust = 0;
let walkZ = camBase.z;
const lookNow = new THREE.Vector3(0, 8, walkZ - 50);
const clock = new THREE.Clock();
const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
const ease = (x) => 1 - Math.pow(1 - x, 3);
const easeBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const fogRain = new THREE.Color("#8a909a"), fogClear = new THREE.Color("#c98e6a");
const hemiRain = new THREE.Color("#a8b0bc"), hemiClear = new THREE.Color("#ffd8b0");
const lampOff = new THREE.Color("#3b3a33"), lampOn = new THREE.Color("#ffd27a"), sunsetLight = new THREE.Color("#ffb46a");

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const k = (a) => 1 - Math.pow(1 - a, dt * 60); // frame-rate independent easing
  const L = levels();
  bass += (L.bass - bass) * 0.25; high += (L.high - high) * 0.25;

  const v = current >= 0 ? voices[current] : null;
  const progress = v && v.el.duration ? v.el.currentTime / v.el.duration : 0;
  if (playing && current === 0) A = Math.max(A, progress);
  if (playing && current === 1) B = Math.max(B, progress);
  As += (A - As) * k(0.04); Bs += (B - Bs) * k(0.04);
  const storyNow = As + Bs; // 0..2

  // colour flows down the street with the first song, and reaches the bridge and sky with the second
  post.material.uniforms.uReach.value = 3 + ease(As) * 72 + ease(Bs) * 160;
  post.material.uniforms.uSky.value = THREE.MathUtils.smoothstep(Bs, 0.2, 0.8);
  const rainAmt = 1 - THREE.MathUtils.smoothstep(As, 0.1, 0.55);
  post.material.uniforms.uRain.value = rainAmt;
  skyU.uClear.value = THREE.MathUtils.smoothstep(Bs, 0.1, 0.85);
  const clear = skyU.uClear.value;
  scene.fog.color.copy(fogRain).lerp(fogClear, clear);
  hemi.color.copy(hemiRain).lerp(hemiClear, clear);
  hemi.intensity = 0.9 + 0.5 * clear + 0.2 * As;
  sunLight.intensity = 0.5 + 1.1 * clear;
  sunLight.color.set("#fff1dc").lerp(sunsetLight, clear);
  clouds.forEach((c) => {
    c.position.x += dt * c.userData.speed * (1 + clear * 3);
    if (c.position.x > 130) c.position.x = -130;
    c.position.y = c.userData.y + clear * 20;
    c.scale.copy(c.userData.s).multiplyScalar(Math.max(0.001, 1 - clear));
  });
  fair.forEach((c) => (c.visible = clear > 0.3));

  // rain
  rain.material.opacity = 0.5 * rainAmt;
  rain.visible = rainAmt > 0.01;
  if (rain.visible) {
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6;
      let y = rainPos[o + 1] - dt * 16;
      if (y < 0) { y += 16; const z = camera.position.z - rnd() * 40; rainPos[o + 2] = rainPos[o + 5] = z; }
      rainPos[o + 1] = y; rainPos[o + 4] = y - 0.5;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // street lamps glow in the gloom and go off as the sun comes
  lamps.forEach((l) => l.bulb.color.copy(lampOff).lerp(lampOn, Math.min(1, rainAmt * 0.8 + clear * 0.9)));

  // paint spreads, beads and bunting go up, all at their moment in the story
  painted.forEach((p) => { p.mat.uniforms.uReveal.value += ((storyNow > p.t0 ? 1 : 0) - p.mat.uniforms.uReveal.value) * k(0.015); });
  strands.forEach((s) => {
    s.shown += ((storyNow > s.t0 ? 1 : 0) - s.shown) * k(0.05);
    s.g.scale.setScalar(Math.max(0.001, easeBack(Math.min(1, s.shown))));
    s.g.rotation.x = Math.sin(t * 1.3 + s.phase) * 0.05 * (1 + bass * 0.5);
  });
  bunting.forEach((b) => {
    b.shown += ((storyNow > b.t0 ? 1 : 0) - b.shown) * k(0.04);
    b.m.scale.set(Math.max(0.001, Math.min(1, b.shown * 1.2)), Math.max(0.001, easeBack(Math.min(1, b.shown))), 1);
    b.m.rotation.x = Math.sin(t * 1.7 + b.phase) * (0.08 + gust * 0.1);
  });

  // leaves: the wind blows down the street toward you, gusting; more of them as colour comes back
  const alive = Math.min(1, storyNow / 1.2);
  const activeLeaves = Math.floor(25 + (LEAVES - 25) * alive);
  gust *= Math.pow(0.97, dt * 60);
  const wind = (rainAmt > 0.5 ? 0.6 : 2.2 + Math.sin(t * 0.4) * 1.2 + Math.max(0, Math.sin(t * 0.13)) * 2.5) + gust * 6;
  for (let i = 0; i < LEAVES; i++) {
    const L = leaves[i];
    if (i >= activeLeaves) { mtx.makeScale(0, 0, 0); leafMesh.setMatrixAt(i, mtx); continue; }
    if (!L.live) { respawnLeaf(L, i, true); L.live = true; }
    const p = L.p;
    const heavy = rainAmt > 0.5;
    L.v.z += (wind * (0.7 + 0.3 * Math.sin(i)) - L.v.z) * 0.03;
    L.v.x += (Math.sin(t * 0.9 + i) * 0.8 - L.v.x) * 0.02;
    L.v.y += ((heavy ? -0.6 : Math.sin(t * 1.4 + i * 0.7) * 0.9 - 0.25) - L.v.y) * 0.03;
    p.addScaledVector(L.v, dt);
    if (p.y < 0.22) { p.y = 0.22; L.v.y = Math.max(0, L.v.y); }
    if (Math.abs(p.x) > FRONT - 0.3) L.v.x *= -1, p.x = Math.sign(p.x) * (FRONT - 0.3);
    if (p.z > camera.position.z + 3 || p.y > 16) respawnLeaf(L, i, false);
    const tumble = heavy ? 0.15 : 1;
    L.r.x += L.w.x * dt * tumble; L.r.y += L.w.y * dt * tumble; L.r.z += L.w.z * dt * tumble;
    quat.setFromEuler(L.r);
    mtx.compose(p, quat, scl.setScalar(L.s));
    leafMesh.setMatrixAt(i, mtx);
  }
  leafMesh.instanceMatrix.needsUpdate = true;

  // confetti drifts down through the second song
  confMesh.count = Math.floor(CONFETTI * THREE.MathUtils.smoothstep(Bs, 0.25, 0.9));
  for (let i = 0; i < confMesh.count; i++) {
    const c = confetti[i];
    c.p.y -= dt * c.fall;
    c.p.z += dt * wind * 0.25;
    c.p.x += Math.sin(t * 2 + i) * dt * 0.6;
    if (c.p.y < 0 || c.p.z > camera.position.z + 2) c.p.set((rnd() - 0.5) * 16, 10 + rnd() * 10, camera.position.z - 4 - rnd() * 50);
    c.r.x += dt * c.w; c.r.y += dt * c.w * 0.7;
    quat.setFromEuler(c.r);
    mtx.compose(c.p, quat, scl.setScalar(1.6));
    confMesh.setMatrixAt(i, mtx);
  }
  confMesh.instanceMatrix.needsUpdate = true;

  // the sunset sun
  sun.material.opacity = THREE.MathUtils.smoothstep(Bs, 0.15, 0.6);
  sunGlow.material.opacity = sun.material.opacity * (0.75 + bass * 0.1);

  // places: the door and the bridge arch light up while their song plays
  places.forEach((p, i) => { p.glow += ((i === current && playing ? 1 : 0) - p.glow) * k(0.04); });
  const idle = morseOn[Math.floor(t / 0.2) % morseOn.length] * 0.35 * (1 - places[0].glow);
  stoop.light.color.copy(doorDark).lerp(doorLit, Math.min(1, places[0].glow * (0.85 + bass * 0.12) + idle));
  bridge.light.opacity = places[1].glow * (0.35 + bass * 0.06);
  parcel.visible = As > 0.9;
  player.tick(progress, bass);

  // camera: walk down the street toward the bridge as the songs play
  const goal = camBase.z - 22 * As - 16 * Bs;
  walkZ += (goal - walkZ) * k(0.01);
  const sw = reduced ? 0 : 1;
  camera.position.set(ndc.x * 0.6 * sw + Math.sin(t * 0.2) * 0.12 * sw, 1.7 + ndc.y * 0.25 * sw + Math.sin(t * 0.33) * 0.04 * sw, walkZ);
  const lookGoal = new THREE.Vector3(0, 8 + Bs * 4, walkZ - 50);
  if (current === 0 && playing) lookGoal.lerp(new THREE.Vector3(FRONT - 1, 2, STOOP_Z), 0.18 * places[0].glow);
  lookNow.lerp(lookGoal, k(0.03));
  camera.lookAt(lookNow);

  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  rt.setSize(innerWidth * dprNow(), innerHeight * dprNow());
  post.material.uniforms.uRes.value.set(rt.width, rt.height);
});

// test hook: v = 0 rainy, 0.5 after the first song, 1 fully alive
window.NEW_DAWN = {
  scene, camera, renderer, play, voices,
  setLife: (v) => { A = As = Math.min(1, v * 2); B = Bs = Math.max(0, v * 2 - 1); walkZ = camBase.z - 22 * As - 16 * Bs; lookNow.set(0, 8 + Bs * 4, walkZ - 50); },
  get current() { return current; }, get playing() { return playing; },
};
