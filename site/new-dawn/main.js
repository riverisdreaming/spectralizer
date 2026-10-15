import * as THREE from "three";
import {
  RAINBOW, wildflowerGeometry, bladeGeometry, leafGeometry,
  glowTexture, makeCloud, makeRainbow, mulberry,
  toonMaterial, printSunTextures, makeGate, makeTower, makeParcel, makeDog,
} from "./assets.js";

// The world starts burning, both buildings in rubble. The first song rebuilds the gate, puts the
// fires out and grows the grass back; the second rebuilds the tower and clears the sky.
// Each song lives in a place on the road: the gate over the path, and the tower on the far hill.
// Nothing names them. Pick a place (in the world or in the strip below) and that place sings.
const TRACKS = [
  { title: "doordash", src: "music/doordash.mp3" },
  { title: "wardoggin", src: "music/wardoggin.mp3" },
];
const POPPY = ["#e8121c", "#ff2a1a", "#d40f2a", "#ffffff", "#ffd400"];

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = Math.min(innerWidth, innerHeight) < 700;
const rnd = mulberry(7);

// ---------- renderer / scene ----------
const canvas = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.6 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- print pass: ink edges, stipple and blue-leaning shadows over the whole frame ----------
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
      uNear: { value: 0.1 }, uFar: { value: 400 }, uLife: { value: 0 }, uKick: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uDpr, uNear, uFar, uLife, uKick;
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
        float ink = smoothstep(0.12, 0.3, e / d0) * (1.0 - smoothstep(25.0, 90.0, d0));
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        // screen-print inks: richer colour, firmer contrast
        c = mix(vec3(l), c, 1.3);
        c = (c - 0.5) * 1.1 + 0.5;
        // shadows lean into ultramarine
        c = mix(c, c * vec3(0.45, 0.55, 1.2), smoothstep(0.35, 0.05, l) * 0.55);
        // stipple, roughly one CSS pixel per dot
        vec2 cell = floor(gl_FragCoord.xy / max(1.0, floor(uDpr + 0.25)));
        float n = hash(cell), n2 = hash(cell + 17.31);
        c *= 1.0 - step(n, (1.0 - l) * 0.32) * 0.3;
        c += step(0.988 - l * 0.02, n2) * 0.16;
        // fine hatching in the deepest shade
        float hatch = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / (3.0 * max(1.0, uDpr))));
        c *= 1.0 - hatch * smoothstep(0.2, 0.06, l) * 0.35;
        c = mix(c, vec3(0.03, 0.05, 0.17), ink * 0.85);
        // a kick lifts the whole print a touch toward warm light
        c = mix(c, c * 1.1 + vec3(0.05, 0.03, 0.0), uKick * 0.15);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  })
);
post.frustumCulled = false;
const postScene = new THREE.Scene();
postScene.add(post);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#ffd98a", 30, 150);
const camera = new THREE.PerspectiveCamera(small ? 62 : 50, innerWidth / innerHeight, 0.1, 400);
const camBase = new THREE.Vector3(0, 1.45, 9.2);
camera.position.copy(camBase);

const hemi = new THREE.HemisphereLight("#bfe6ff", "#4fbf3a", 1.25);
const sunLight = new THREE.DirectionalLight("#fff0c8", 2.2);
sunLight.position.set(-4, 10, -6);
const fill = new THREE.DirectionalLight("#ffd0f0", 0.6);
fill.position.set(5, 4, 10);
scene.add(hemi, sunLight, fill);

// ---------- sky ----------
const skyU = { uRise: { value: 0 }, uSun: { value: new THREE.Vector3(0, 0, -1) } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uRise; uniform vec3 uSun;
      void main(){
        float y = vDir.y;
        // fire (0) -> smoky dusk once the gate stands (0.5) -> clear sky once the tower stands (1)
        float k1 = smoothstep(0.0, 0.5, uRise), k2 = smoothstep(0.5, 1.0, uRise);
        vec3 zen = mix(mix(vec3(0.08,0.03,0.03), vec3(0.09,0.08,0.24), k1), vec3(0.03,0.11,0.55), k2);
        vec3 mid = mix(mix(vec3(0.34,0.08,0.04), vec3(0.42,0.24,0.42), k1), vec3(0.08,0.2,0.72), k2);
        vec3 hor = mix(mix(vec3(0.98,0.36,0.08), vec3(0.95,0.55,0.35), k1), vec3(0.35,0.55,0.98), k2);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y));
        c = mix(c, zen, smoothstep(0.15, 0.65, y));
        float s = max(0.0, dot(normalize(vDir), normalize(uSun)));
        float lit = smoothstep(0.5, 0.85, uRise);
        c += vec3(1.0,0.55,0.2) * pow(s, 30.0) * 0.45 * lit;
        c = mix(c, hor, smoothstep(0.02, -0.1, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
);
scene.add(sky);

const rainbow = makeRainbow(62, 8);
rainbow.position.set(6, -8, -120);
scene.add(rainbow);

const sunTex = printSunTextures();
const sun = { root: new THREE.Group() };
sun.rays = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: sunTex.rays, transparent: true, depthWrite: false, fog: false }));
sun.disc = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: sunTex.disc, transparent: true, depthWrite: false, fog: false }));
sun.disc.position.z = 0.2;
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,170,80,1)", "rgba(255,120,40,0)"), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
sunGlow.scale.setScalar(40);
sunGlow.position.z = -0.5;
sun.root.add(sunGlow, sun.rays, sun.disc);
scene.add(sun.root);

// Smoke from the fires hangs low over everything until the second song clears it.
const stormMat = toonMaterial({ lit: "#6e5a54", mid: "#43363a", shadow: "#1e1719" });
const clouds = [];
for (let i = 0; i < 14; i++) {
  const c = makeCloud(i + 3);
  c.traverse((o) => o.isMesh && (o.material = stormMat));
  c.position.set(-95 + i * 14 + rnd() * 8, 12 + rnd() * 12, -60 - rnd() * 40);
  c.scale.set(2.2 + rnd(), 1.4 + rnd() * 0.6, 1.6);
  c.userData.speed = 0.6 + rnd() * 0.6;
  c.userData.y = c.position.y;
  c.userData.s = c.scale.clone();
  clouds.push(c);
  scene.add(c);
}

// After the storm: towering cumulus, and streaks of cloud fanning out from the sun.
const SUN_HOME = new THREE.Vector3(-6, 17, -140);
const puffMat = toonMaterial({ lit: "#ffffff", mid: "#c7d6ff", shadow: "#3553d6", light: new THREE.Vector3(0.1, 0.35, 1), spectrum: true });
const puffs = [];
// a towering cumulus: billows stacked into a column that leans and narrows
function tower(cx, cz, h, base) {
  for (let y = 0; y < h; y += 1.6) {
    const k = y / h;
    const w = base * (0.55 + Math.sin(k * Math.PI * 0.9) * 0.6) * (1 - k * 0.35);
    const n = 3 + Math.round(w * 0.8);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = w * Math.sqrt(rnd());
      puffs.push([cx + Math.cos(a) * rr + k * 6, y, cz + Math.sin(a) * rr * 0.5, 2.2 + rnd() * 3 * (1 - k * 0.4), -1, 0]);
    }
  }
}
tower(-46, -150, 62, 13);
tower(70, -175, 26, 9);
// streaks: fine ribbons of small billows fanning out of the sun.
// Each streak is one frequency band, low on the left to high on the right: together they are the song's spectrum.
for (let i = 0; i < 12; i++) {
  const a = (6 + (i / 11) * 168 + (rnd() - 0.5) * 6) * (Math.PI / 180);
  const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
  const start = 22 + rnd() * 10;
  for (let r = start; r < 150; r += 1.2 + r * 0.018) {
    if (rnd() < 0.12) r += 4; // a gap now and then
    const side = Math.sin(r * 0.08 + i) * r * 0.025;
    const size = (0.45 + r * 0.014) * (0.7 + rnd() * 0.6);
    puffs.push([SUN_HOME.x + dir.x * r - dir.y * side, SUN_HOME.y - 6 + dir.y * r * 0.55 + dir.x * side, SUN_HOME.z + 15, size, 11 - i, (r - start) / (150 - start)]);
  }
}
const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), puffMat, puffs.length);
puffs.forEach(([x, y, z, r], i) => puffMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.85, r))));
puffMesh.geometry.setAttribute("aBand", new THREE.InstancedBufferAttribute(new Float32Array(puffs.map((p) => p[4])), 1));
puffMesh.geometry.setAttribute("aAlong", new THREE.InstancedBufferAttribute(new Float32Array(puffs.map((p) => p[5])), 1));
puffMesh.frustumCulled = false;
scene.add(puffMesh);

// ---------- ground ----------
let ground;
function height(x, z) {
  const near = 0.18 * Math.sin(x * 0.35) * Math.cos(z * 0.3) + 0.12 * Math.sin(x * 0.9 + z * 0.7);
  const far = THREE.MathUtils.smoothstep(-z, 18, 75);
  const hills = (Math.sin(x * 0.045) * 6 + Math.sin(x * 0.11 + 1.3) * 3 + Math.cos(x * 0.023 + z * 0.03) * 5 + 7) * far;
  return near + hills - 0.1;
}
{
  const g = new THREE.PlaneGeometry(420, 260, 220, 140);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -100);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const a = new THREE.Color("#145c1c"), b = new THREE.Color("#3d9a26"), farC = new THREE.Color("#2f8a3a"), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, height(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2.0);
    c.copy(a).lerp(b, n * 0.7);
    c.lerp(farC, THREE.MathUtils.smoothstep(-z, 30, 120) * 0.5);
    c.toArray(cols, i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground);
}

// The path: starts at your feet, runs through the gate and over the hills toward the sun.
function pathX(z) {
  if (z > 4) return 0;
  const k = Math.min(1, (4 - z) / 14);
  return Math.sin((4 - z) * 0.13) * 6 * k - Math.sin((4 - z) * 0.045) * 4 * k;
}
const PATH_W = 0.75;
{
  const pos = [], idx = [];
  const N = 260;
  for (let i = 0; i <= N; i++) {
    const z = 9.5 - (i / N) * 95;
    const x = pathX(z);
    const dx = pathX(z - 0.1) - x;
    const nx = 1 / Math.hypot(1, dx * 10), nz = (dx * 10) * nx;
    const w = PATH_W * (1 + Math.sin(z * 0.7) * 0.12);
    [[-1], [1]].forEach(([s]) => {
      const px = x + s * w * nx, pz = z + s * w * nz * 0.1;
      pos.push(px, height(px, pz) + 0.05, pz);
    });
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: "#e8dcc0", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.name = "path";
  scene.add(m);
}
const onPath = (x, z) => Math.abs(x - pathX(z)) < PATH_W + 0.25;

// Two still ponds holding the sky.
const PONDS = [[-8.5, -11, 3.2, 1.6], [9, -15, 4.2, 1.8]];
const pondMat = new THREE.MeshBasicMaterial({ color: "#1d39c4", fog: false, polygonOffset: true, polygonOffsetFactor: -2 });
PONDS.forEach(([px, pz, rx, rz]) => {
  const g = new THREE.CircleGeometry(1, 40);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const wob = 1 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 3) * 0.08;
    const x = px + p.getX(i) * rx * wob, z = pz + p.getZ(i) * rz * wob;
    p.setXYZ(i, x, height(x, z) + 0.12, z);
  }
  scene.add(new THREE.Mesh(g, pondMat));
});
const inPond = (x, z) => PONDS.some(([px, pz, rx, rz]) => ((x - px) / (rx + 0.3)) ** 2 + ((z - pz) / (rz + 0.3)) ** 2 < 1);

// Dark masses of shrub, like the shade under trees in a print.
const bushMat = toonMaterial({ lit: "#3f8f2a", mid: "#22621f", shadow: "#0b2a17", light: new THREE.Vector3(-0.4, 0.8, 0.4) });
const BUSH = { lit: [new THREE.Color("#3a2e2a"), new THREE.Color("#3f8f2a")], mid: [new THREE.Color("#211a1a"), new THREE.Color("#22621f")], shadow: [new THREE.Color("#0e0a0b"), new THREE.Color("#0b2a17")] };
[[-11, -6], [-6, -16], [6, -8], [13, -10], [-15, -20], [-14, -31]].forEach(([bx, bz], i) => {
  const n = 4 + (i % 3);
  for (let k = 0; k < n; k++) {
    const r = 0.9 + rnd() * 0.9;
    let x = bx + (k - n / 2) * 0.9 + rnd() * 0.5;
    const z = bz + (rnd() - 0.5) * 1.2;
    // keep every bush well clear of the path, pushing it out to whichever side it started on
    const side = Math.sign(x - pathX(z)) || 1, clear = PATH_W + r + 1.4;
    if (Math.abs(x - pathX(z)) < clear) x = pathX(z) + side * clear;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), bushMat);
    m.position.set(x, height(x, z) + r * 0.6, z);
    m.scale.y = 0.75;
    scene.add(m);
  }
});

// ---------- wind (shared by grass, wildflowers and leaves) ----------
const wind = {
  uTime: { value: 0 }, uWind: { value: new THREE.Vector2(1, -0.25) }, uGust: { value: new THREE.Vector3(0, 0, 0) },
  uBass: { value: 0 }, uFog: { value: new THREE.Color("#ffd98a") }, uRise: skyU.uRise, uHeal: { value: -6 }, uHealC: { value: new THREE.Vector2(0, 6) },
  uBloom: { value: 0 }, uFire: { value: 1 },
};
const windGLSL = `
  uniform float uTime, uBass; uniform vec2 uWind; uniform vec3 uGust;
  vec3 sway(vec3 world, vec3 root, float h, float r){
    float w = sin(uTime*1.6 + root.x*0.35 + root.z*0.25)*0.55 + sin(uTime*3.3 + root.x*1.3 + r*6.2831)*0.2;
    vec2 bend = uWind * (0.55 + w) * (0.32 + uBass*0.15);
    vec2 d = root.xz - uGust.xy;
    float g = uGust.z * exp(-dot(d,d)*0.22);
    bend += normalize(d + 1e-4) * g * 1.3;
    world.xz += bend * h;
    world.y -= length(bend) * h * 0.22;
    return world;
  }`;
// Colour returns in a widening circle around where you stand, with a ragged edge.
const healGLSL = `
  uniform vec2 uHealC; uniform float uHeal;
  float heal(vec2 xz, float r){
    float d = length((xz - uHealC) * vec2(1.0, 1.3));
    float edge = sin(xz.x*0.9 + xz.y*0.6)*1.2 + sin(xz.x*2.3 - xz.y*1.7)*0.6 + r*1.5;
    return smoothstep(uHeal, uHeal - 5.0, d + edge);
  }`;
const fogGLSL = `
  uniform vec3 uFog; varying float vDist;
  vec3 fogged(vec3 c){ return mix(c, uFog, smoothstep(30.0, 150.0, vDist)); }`;

// grass
{
  const count = small ? 18000 : 40000;
  const geo = bladeGeometry();
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: wind,
    vertexShader: `
      attribute float aRand; varying float vH; varying float vRand; varying vec2 vXZ; varying float vHeal;
      ${windGLSL}
      ${healGLSL}
      varying float vDist;
      void main(){
        vH = uv.y; vRand = aRand;
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        vHeal = heal(root.xz, aRand);
        // burnt to stubble, growing back to full height as the healing reaches it
        vec4 world = modelMatrix * instanceMatrix * vec4(position.x, position.y * mix(0.13, 1.0, vHeal), position.z, 1.0);
        world.xyz = sway(world.xyz, root, vH*vH, aRand);
        vXZ = root.xz;
        vec4 mv = viewMatrix * world;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vH; varying float vRand; varying vec2 vXZ; varying float vHeal; uniform float uRise, uFire, uTime;
      ${fogGLSL}
      void main(){
        vec3 base = mix(vec3(0.02,0.16,0.06), vec3(0.04,0.26,0.08), vRand);
        vec3 tip = mix(vec3(0.1,0.42,0.07), vec3(0.85,0.75,0.15), step(0.95, vRand));
        if (vRand < 0.06) tip = vec3(0.12,0.5,0.3);
        vec3 c = mix(base, tip, smoothstep(0.0, 1.0, vH));
        c += vec3(1.0,0.75,0.3) * pow(vH, 3.0) * 0.25 * uRise; // sunlit tips
        // charred stubble with tips still glowing while the fire lasts
        vec3 dry = mix(vec3(0.05,0.03,0.03), vec3(0.2,0.12,0.08), vH) * (0.8 + vRand*0.4);
        dry += vec3(1.0,0.32,0.04) * pow(vH, 3.0) * uFire * (0.6 + 0.4*sin(uTime*5.0 + vRand*40.0));
        c = mix(dry, c, vHeal);
        gl_FragColor = vec4(fogged(c), 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const rands = new Float32Array(count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    // denser near the camera, thinning toward the hills
    let z, x;
    do {
      z = 8.5 - Math.pow(rnd(), 1.5) * 46;
      x = (rnd() * 2 - 1) * (6 + (8.5 - z) * 0.9);
    } while (onPath(x, z) || inPond(x, z));
    e.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
    q.setFromEuler(e);
    const hgt = 0.35 + rnd() * 0.55 + (rnd() < 0.1 ? 0.4 : 0);
    s.set(1 + rnd() * 0.6, hgt, 1);
    m.compose(new THREE.Vector3(x, height(x, z), z), q, s);
    mesh.setMatrixAt(i, m);
    rands[i] = rnd();
  }
  geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rands, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
}

// wildflowers
{
  const count = small ? 700 : 1500;
  const geo = wildflowerGeometry();
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: wind, vertexColors: true,
    vertexShader: `
      attribute float aTint; attribute float aRand; attribute vec3 aColor;
      varying vec3 vCol; varying vec2 vXZ; varying float vR; uniform float uBloom;
      ${windGLSL}
      varying float vDist;
      void main(){
        vCol = mix(color, aColor, aTint);
        // poppies open one by one through the second song
        float bloom = smoothstep(aRand * 0.85, aRand * 0.85 + 0.15, uBloom);
        vec4 world = modelMatrix * instanceMatrix * vec4(position * bloom, 1.0);
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        float h = clamp(position.y / 0.5, 0.0, 1.2);
        vXZ = root.xz; vR = aRand;
        world.xyz = sway(world.xyz, root, h*h*0.8, aRand);
        vec4 mv = viewMatrix * world;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying vec2 vXZ; varying float vR;
      ${healGLSL}
      ${fogGLSL}
      void main(){
        vec3 g = vec3(dot(vCol, vec3(0.3,0.59,0.11))) * vec3(0.8,0.76,0.7);
        gl_FragColor = vec4(fogged(mix(g, vCol, heal(vXZ, vR))), 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const cols = new Float32Array(count * 3), rands = new Float32Array(count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const palette = ["#e8121c", "#e8121c", "#e8121c", "#d40f2a", "#ff2a1a", "#e8121c", "#e8121c", "#ffffff", "#ffd400", "#ff6a13"];
  for (let i = 0; i < count; i++) {
    let z, x;
    do {
      z = 4 - Math.pow(rnd(), 1.2) * 42;
      x = (rnd() * 2 - 1) * (6 + (8 - z) * 0.9);
    } while (onPath(x, z) || inPond(x, z));
    q.setFromEuler(new THREE.Euler(-0.1, rnd() * 6.28, 0));
    const sc = 0.6 + rnd() * 0.5;
    m.compose(new THREE.Vector3(x, height(x, z), z), q, new THREE.Vector3(sc, sc * (0.8 + rnd() * 0.6), sc));
    mesh.setMatrixAt(i, m);
    c.set(palette[Math.floor(rnd() * palette.length)]).toArray(cols, i * 3);
    rands[i] = rnd();
  }
  geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(cols, 3));
  geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rands, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
}

// ---------- landmarks: one per song ----------
const landmarks = [makeGate(), makeTower()];
{
  const gz = -13, gx = pathX(gz);
  landmarks[0].root.position.set(gx, height(gx, gz) - 0.1, gz);
  const slope = (pathX(gz - 0.1) - gx) / 0.1;
  landmarks[0].root.rotation.y = Math.atan2(-slope, 1);
  const tx = 44, tz = -110;
  landmarks[1].root.position.set(tx, height(tx, tz) - 3, tz);
  landmarks[1].root.rotation.y = -0.25;
  landmarks[1].root.scale.setScalar(1.0);
}
const doorDark = new THREE.Color("#10173a"), doorLit = new THREE.Color("#ffe6a3");

// --- things hidden in the world, for people who look ---
// A delivery left on the gate's doorstep.
const parcel = makeParcel();
parcel.position.set(0.55, 0.05, 0.75);
parcel.rotation.y = -0.4;
landmarks[0].root.add(parcel);
// While its song is quiet, the gate's doorway taps out D O O R in Morse: dots and dashes.
const MORSE = "-.. --- --- .-.";
const morseOn = [];
for (const ch of MORSE) {
  if (ch === " ") { morseOn.push(0, 0); continue; } // with the gap after each mark, three units between letters
  morseOn.push(...(ch === "." ? [1] : [1, 1, 1]), 0);
}
morseOn.push(0, 0, 0, 0, 0, 0, 0);
// A stone war dog keeps watch at the foot of the tower.
const dog = makeDog();
dog.root.position.set(-3.6, 16.65, 4.4);
dog.root.scale.setScalar(1.25);
landmarks[1].addPiece(dog.root);
const eyeDark = new THREE.Color("#10173a"), eyeLit = new THREE.Color("#ff7a1a");
// stone sits in grey-blue shadow under the storm and warms as the light returns
const stoneMats = [];
landmarks.forEach((lm, li) => lm.root.traverse((o) => {
  const u = o.material && o.material.uniforms;
  if (u && u.uLit && !stoneMats.some((m) => m.mat === o.material)) stoneMats.push({ mat: o.material, li, base: ["uLit", "uMid", "uShadow"].map((n) => u[n].value.clone()) });
}));
const charStone = new THREE.Color("#3d2f2c");
landmarks.forEach((lm) => lm.rebuild(0));
landmarks.forEach((lm, i) => {
  scene.add(lm.root);
  // a halo of light that spills out of the doorway while the song plays
  lm.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,225,150,1)", "rgba(255,190,90,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  const door = lm.door.position.clone();
  lm.halo.position.set(door.x, door.y + (i ? 11 : 2), door.z + 0.6);
  lm.halo.scale.setScalar(i ? 34 : 7);
  lm.root.add(lm.halo);
  lm.glow = 0;
});

// ---------- fire ----------
// How far each song has carried its rebuild (0 = rubble, 1 = standing). They only move forward.
let A = 0, B = 0, As = 0, Bs = 0, life = 0;

// Flames: flat, hard-edged print flames in three inks. Meadow flames go out as the healing
// reaches them; the gate's and the tower's burn until their song is under way.
const flameU = { uBands: { value: new Array(12).fill(0) }, uGateFire: { value: 1 }, uTowerFire: { value: 1 } };
const flames = [];
{
  const meadow = small ? 110 : 190;
  for (let i = 0; i < meadow; i++) {
    let x, z;
    do { z = 7 - Math.pow(rnd(), 1.3) * 40; x = (rnd() * 2 - 1) * (5 + (8 - z) * 0.9); } while (Math.abs(x - pathX(z)) < 1.1 || inPond(x, z));
    flames.push([x, height(x, z), z, 0.6 + rnd() * 1.1, 0]);
  }
}
const FLAME_BASE = flames.length;
const flameGeo = new THREE.InstancedBufferGeometry();
flameGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
flameGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
flameGeo.setIndex([0, 1, 2, 0, 2, 3]);
const flameMat = new THREE.ShaderMaterial({
  uniforms: { ...wind, ...flameU },
  vertexShader: `
    attribute vec3 aPos; attribute vec4 aInfo; // size, seed, band, kind (0 meadow, 1 gate, 2 tower)
    uniform float uBands[12]; uniform float uGateFire, uTowerFire;
    uniform float uTime, uBass;
    ${healGLSL}
    varying vec2 vUv; varying float vSeed;
    void main(){
      float alive = aInfo.w < 0.5 ? 1.0 - heal(aPos.xz, aInfo.y) : (aInfo.w < 1.5 ? uGateFire : uTowerFire);
      float e = uBands[int(aInfo.z)];
      // each flame leaps with its slice of the spectrum
      float h = aInfo.x * alive * (0.9 + e * 0.3 + 0.12 * sin(uTime * 7.0 + aInfo.y * 20.0));
      vec4 mv = viewMatrix * vec4(aPos, 1.0);
      mv.xy += vec2(position.x * h * 0.62, (position.y + 0.5) * h);
      vUv = uv; vSeed = aInfo.y;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec2 vUv; varying float vSeed; uniform float uTime;
    float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
    void main(){
      float y = vUv.y;
      float fl = vn(vec2(vUv.x * 3.0 + vSeed * 10.0, y * 4.0 - uTime * 3.2 - vSeed * 7.0));
      float w = (1.0 - y) * 0.42 + 0.03;
      float d = abs(vUv.x - 0.5 + (fl - 0.5) * 0.35 * y) / w;
      float body = (1.0 - d) * smoothstep(1.0, 0.7, y + (fl - 0.5) * 0.35) * smoothstep(0.0, 0.06, y);
      if (body < 0.18) discard;
      vec3 c = body > 0.62 ? vec3(1.0, 0.86, 0.35) : (body > 0.38 ? vec3(1.0, 0.45, 0.06) : vec3(0.86, 0.12, 0.04));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const flameMesh = new THREE.Mesh(flameGeo, flameMat);
flameMesh.frustumCulled = false;
scene.add(flameMesh);
function buildFlames() {
  // fires on the two ruins, placed once the landmarks have their world positions
  [[0, 22, 3.4, 1.2], [1, 34, 8, 3.2]].forEach(([li, n, r, size]) => {
    const lm = landmarks[li];
    lm.root.updateMatrixWorld(true);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, rr = r * Math.sqrt(rnd());
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.8;
      const y = li ? (Math.hypot(x, z) < 5.5 ? 14 : Math.max(0, (17 - Math.hypot(x, z)) / 0.95)) : 0;
      const p = lm.root.localToWorld(new THREE.Vector3(x, y, z));
      flames.push([p.x, p.y, p.z, size * (0.7 + rnd() * 0.8), li + 1]);
    }
  });
  const pos = new Float32Array(flames.length * 3), info = new Float32Array(flames.length * 4);
  flames.forEach(([x, y, z, sz, kind], i) => {
    pos.set([x, y, z], i * 3);
    const band = Math.min(11, Math.max(0, Math.floor(((x + 22) / 44) * 12)));
    info.set([sz, rnd(), band, kind], i * 4);
  });
  flameGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 3));
  flameGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 4));
  flameGeo.instanceCount = flames.length;
}
buildFlames();

// Smoke rising from each ruin.
const smokeMat = toonMaterial({ lit: "#7a6862", mid: "#4a3d40", shadow: "#211a1c", light: new THREE.Vector3(-0.4, 0.8, 0.4) });
const SMOKE = [[0, 22, 2.2, 9], [1, 30, 7, 28]].flatMap(([li, n, spread, rise]) => Array.from({ length: n }, (_, i) => ({ li, age: i / n, spread, rise, seed: rnd() })));
const smokeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), smokeMat, SMOKE.length);
smokeMesh.frustumCulled = false;
scene.add(smokeMesh);
const fireLight = new THREE.PointLight("#ff6a1a", 30, 22, 1.6);
scene.add(fireLight);

// ---------- leaves and petals riding the wind ----------
const LEAVES = small ? 80 : 130;
const leafMesh = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), LEAVES);
leafMesh.frustumCulled = false;
const leaves = [];
const leafGreens = ["#2fbf2f", "#62d42a", "#9be22b", "#d6e82a", "#ffb400", "#ff6a13"];
const leafDry = ["#8a7a5a", "#a08a60", "#6f6650", "#b59a6a", "#7c7466"];
const ASH = ["#2a2224", "#4a4040", "#1a1416", "#ff7a1a", "#ffb400"];
for (let i = 0; i < LEAVES; i++) {
  const L = { p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(4), s: 0.7 + rnd() * 0.8, life: 0 };
  respawnLeaf(L, true);
  leafMesh.setColorAt(i, new THREE.Color(ASH[i % ASH.length]));
  L.s *= 0.75;
  leaves.push(L);
}
scene.add(leafMesh);
function respawnLeaf(L, anywhere, i = -1) {
  if (i >= 0 && leafMesh.instanceColor) {
    const pal = rnd() > A ? ASH : rnd() < B * 0.5 ? POPPY : leafGreens;
    leafMesh.setColorAt(i, new THREE.Color(pal[Math.floor(rnd() * pal.length)]));
    leafMesh.instanceColor.needsUpdate = true;
  }
  L.p.set(camera.position.x + (anywhere ? (rnd() * 2 - 1) * 14 : -16 - rnd() * 4), 0.3 + rnd() * 3, camera.position.z - 4.5 - rnd() * 20);
  L.v.set(0, 0, 0);
  L.burst = false;
}
function burst(origin, colors, n = 10) {
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rnd() * LEAVES);
    const L = leaves[i];
    L.p.copy(origin);
    const a = rnd() * Math.PI * 2;
    L.v.set(Math.cos(a) * 3.2, 1.5 + rnd() * 3, Math.sin(a) * 1.5 + 1.2);
    L.burst = true;
    leafMesh.setColorAt(i, new THREE.Color(colors[Math.floor(rnd() * colors.length)]));
  }
  leafMesh.instanceColor.needsUpdate = true;
}

// pollen drifting up through the light
const POLLEN = small ? 140 : 260;
const pollenGeo = new THREE.BufferGeometry();
const pollenPos = new Float32Array(POLLEN * 3);
for (let i = 0; i < POLLEN; i++) { pollenPos[i * 3] = (rnd() * 2 - 1) * 12; pollenPos[i * 3 + 1] = rnd() * 7; pollenPos[i * 3 + 2] = 7 - rnd() * 30; }
pollenGeo.setAttribute("position", new THREE.BufferAttribute(pollenPos, 3));
const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ size: 0.14, map: glowTexture("rgba(255,250,210,1)", "rgba(255,230,140,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(pollen);

// ---------- audio ----------
let actx, analyser, freq, volume, volLevel = 0.8, current = -1, playing = false;
const bands = new Array(12).fill(0), bandsSmooth = new Array(12).fill(0);

const voices = [];
function startAudio() {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.78;
  volume = actx.createGain();
  volume.gain.value = volLevel;
  analyser.connect(volume).connect(actx.destination);
  freq = new Uint8Array(analyser.frequencyBinCount);
  TRACKS.forEach((t, i) => {
    const el = new Audio(t.src);
    el.preload = "auto";
    const g = actx.createGain();
    g.gain.value = 0;
    actx.createMediaElementSource(el).connect(g).connect(analyser);
    el.addEventListener("ended", () => play((i + 1) % TRACKS.length));
    voices.push({ el, g });
  });
}
function play(i) {
  if (!actx) return;
  actx.resume();
  const now = actx.currentTime;
  if (i === current) {
    const v = voices[i];
    if (playing) { v.g.gain.setTargetAtTime(0, now, 0.15); setTimeout(() => v.el.pause(), 500); playing = false; }
    else { v.el.play(); v.g.gain.setTargetAtTime(1, now, 0.2); playing = true; }
  } else {
    if (current >= 0) { const old = voices[current]; old.g.gain.setTargetAtTime(0, now, 0.35); setTimeout(() => old.el.pause(), 1600); }
    const v = voices[i];
    if (v.el.ended) v.el.currentTime = 0;
    v.el.play();
    v.g.gain.setTargetAtTime(1, now, 0.35);
    current = i; playing = true;
  }
  player.sync();

}
function levels() {
  if (!analyser) return { bass: 0, mid: 0, high: 0 };
  analyser.getByteFrequencyData(freq);
  const band = (a, b) => { let s = 0; for (let k = a; k < b; k++) s += freq[k]; return s / ((b - a) * 255); };
  // twelve bands, log-spaced, for the cloud streaks
  for (let b = 0; b < 12; b++) {
    const lo = Math.floor(2 * Math.pow(180, b / 12)), hi = Math.max(lo + 1, Math.floor(2 * Math.pow(180, (b + 1) / 12)));
    bands[b] = band(lo, hi);
  }
  return { bass: band(1, 6), mid: band(6, 60), high: band(60, 200) };
}

// ---------- the player strip: pick a place, scrub the horizon, set the volume ----------
const player = (() => {
  const root = document.getElementById("player");
  const places = [...root.querySelectorAll(".place")];
  const pp = document.getElementById("pp"), seek = document.getElementById("seek"), vol = document.getElementById("vol");
  const tNow = document.getElementById("t-now"), tEnd = document.getElementById("t-end");
  let scrubbing = false;
  const fmt = (s) => (isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00");
  places.forEach((b, i) => b.addEventListener("click", () => { if (!entered) return; if (i === current) play(i); else play(i); }));
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
    root.style.setProperty("--vol", volLevel);
    try { localStorage.setItem("new-dawn-volume", String(volLevel)); } catch (e) {}
  });
  root.style.setProperty("--vol", volLevel);
  return {
    sync() {
      places.forEach((b, i) => b.setAttribute("aria-pressed", String(i === current)));
      pp.setAttribute("aria-label", playing ? "Pause" : "Play");
      root.classList.toggle("playing", playing);
    },
    tick(progress, bass) {
      const v = current >= 0 ? voices[current] : null;
      if (!scrubbing) seek.value = Math.round(progress * 1000);
      root.style.setProperty("--p", progress);
      root.style.setProperty("--beat", bass.toFixed(3));
      if (v) { if (!scrubbing) tNow.textContent = fmt(v.el.currentTime); tEnd.textContent = fmt(v.el.duration); }
      root.style.opacity = entered ? 1 : 0;
    },
    nudgeVolume(d) { vol.value = Math.max(0, Math.min(100, +vol.value + d)); vol.dispatchEvent(new Event("input")); },
  };
})();

function pickLandmark() {
  ray.setFromCamera(ndc, camera);
  let best = -1, bestD = Infinity;
  landmarks.forEach((lm, i) => {
    const hit = ray.intersectObject(lm.root, true)[0];
    if (hit && hit.distance < bestD) { best = i; bestD = hit.distance; }
  });
  return best;
}

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(0, 0);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let pointerSpeed = 0, lastPX = 0, lastPY = 0, entered = false;
const gustTarget = new THREE.Vector3(0, -100, 0);

let hovered = -1;
canvas.addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerSpeed = Math.min(1.6, pointerSpeed + Math.hypot(e.clientX - lastPX, e.clientY - lastPY) / 60);
  lastPX = e.clientX; lastPY = e.clientY;
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) gustTarget.set(hit.x, hit.z, 0);
  hovered = pickLandmark();
  canvas.style.cursor = hovered >= 0 && entered ? "pointer" : "";

});
canvas.addEventListener("click", (e) => {
  if (!entered) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const i = pickLandmark();
  if (ray.intersectObject(sun.disc)[0]) { kick = 1; sunSpin = 2.5; pointerSpeed = 2; burst(new THREE.Vector3(camera.position.x, 1.5, camera.position.z - 5), POPPY, 24); return; }
  if (i >= 0) play(i);
  else pointerSpeed = 1.8; // a tap on the meadow sends a gust through it
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
gate.addEventListener("click", () => {
  if (entered) return;
  entered = true;
  startAudio();
  gate.classList.add("gone");
  setTimeout(() => play(0), 900);
}, { once: true });

// ---------- loop ----------
const clock = new THREE.Clock();
let bass = 0, mid = 0, high = 0, bassAvg = 0, lastBurst = 0, kick = 0, sunSpin = 0, sunAngle = 0;
const pondLit = new THREE.Color("#4d6dff"), pondDry = new THREE.Color("#1e1412"), pondFull = new THREE.Color("#1d39c4");
const emberC = new THREE.Color("#ff8a2a");
const tmp = new THREE.Vector3(), mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
const ease = (x) => 1 - Math.pow(1 - x, 3);
let walkZ = camBase.z, walkGoal = camBase.z, towerFocus = 0;
const lookTarget = new THREE.Vector3(0, 2.3, 0), lookNow = new THREE.Vector3(0, 2.3, 0);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const L = levels();
  const k = (a) => 1 - Math.pow(1 - a, dt * 60); // frame-rate independent easing
  bass += (L.bass - bass) * 0.3; mid += (L.mid - mid) * 0.25; high += (L.high - high) * 0.25;
  bassAvg += (bass - bassAvg) * 0.02;

  // redemption: each song's progress rebuilds its part of the world
  if (playing && current >= 0) {
    const v0 = voices[current];
    const pr = v0 && v0.el.duration ? v0.el.currentTime / v0.el.duration : 0;
    if (current === 0) A = Math.max(A, pr); else B = Math.max(B, pr);
  }
  As += (A - As) * k(0.04); Bs += (B - Bs) * k(0.04);
  life = 0.5 * As + 0.5 * Bs;
  landmarks[0].rebuild(As);
  landmarks[1].rebuild(Bs);
  const fire = 1 - THREE.MathUtils.smoothstep(As, 0.0, 0.9);
  const rise = life;
  wind.uHeal.value = -6 + Math.pow(As, 0.8) * 80;
  wind.uFire.value = fire;
  wind.uBloom.value = Bs;
  flameU.uGateFire.value = 1 - THREE.MathUtils.smoothstep(As, 0.15, 0.6);
  flameU.uTowerFire.value = 1 - THREE.MathUtils.smoothstep(Bs, 0.0, 0.35);
  flameU.uBands.value = bandsSmooth;
  landmarks[0].door.visible = As > 0.9; landmarks[1].door.visible = Bs > 0.9;
  parcel.visible = As > 0.97;
  skyU.uRise.value = rise;
  const sunY = THREE.MathUtils.lerp(-6, SUN_HOME.y, ease(Bs));
  sun.root.position.set(SUN_HOME.x, sunY, SUN_HOME.z);
  sun.root.lookAt(camera.position);
  sunSpin *= Math.pow(0.97, dt * 60);
  sunAngle += dt * (0.03 + sunSpin);
  sun.rays.rotation.z = sunAngle;
  sun.rays.scale.setScalar(1 + bass * 0.08);
  sun.rays.material.opacity = THREE.MathUtils.smoothstep(Bs, 0.2, 0.7) * (0.85 + bass * 0.15);
  const pulse = 1 + bass * 0.03;
  sun.root.scale.setScalar(pulse);
  skyU.uSun.value.copy(sun.root.position).sub(camera.position).normalize();
  // the rainbow only comes once the tower stands again
  rainbow.material.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(Bs, 0.6, 0.95) * 0.22;
  sunGlow.material.opacity = THREE.MathUtils.smoothstep(Bs, 0.1, 0.5) * 0.8;
  sun.disc.material.opacity = THREE.MathUtils.smoothstep(Bs, 0.05, 0.35);
  hemi.intensity = 0.55 + rise * 0.8;
  hemi.color.set("#c0603a").lerp(new THREE.Color("#bfe6ff"), rise);
  fireLight.intensity = 30 * fire * (0.9 + bass * 0.15 + Math.sin(t * 13) * 0.1);
  fireLight.position.set(pathX(walkZ - 8), 2.5, walkZ - 8);
  sunLight.intensity = 0.4 + rise * 2.0;
  ground.material.color.set("#3a2a24").lerp(new THREE.Color("#ffffff"), THREE.MathUtils.smoothstep(As, 0.05, 0.85));
  const burning = new THREE.Color("#4a1c10"), dusk = new THREE.Color("#b0645a"), day = new THREE.Color("#5f86e6");
  const fogC = burning.clone().lerp(dusk, THREE.MathUtils.smoothstep(As, 0.0, 1.0)).lerp(day, THREE.MathUtils.smoothstep(Bs, 0.0, 1.0));
  scene.fog.color.copy(fogC);
  wind.uFog.value.copy(fogC);

  // wind: a steady breeze, gusts from the pointer, swells with the music
  pointerSpeed *= 0.95;
  const breeze = reduced ? 0.4 : 0.8 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.0);
  wind.uWind.value.set(breeze, -0.2 * breeze);
  wind.uGust.value.set(
    THREE.MathUtils.lerp(wind.uGust.value.x, gustTarget.x, 0.15),
    THREE.MathUtils.lerp(wind.uGust.value.y, gustTarget.y, 0.15),
    reduced ? 0 : pointerSpeed
  );
  wind.uTime.value = t;
  wind.uBass.value = bass;

  // landmarks: light pours from the doorway of whichever song is playing
  landmarks.forEach((lm, i) => {
    const on = i === current && playing ? 1 : 0;
    lm.glow += (on - lm.glow) * k(0.03);
    let idle = 0;
    if (i === 0) idle = morseOn[Math.floor(t / 0.2) % morseOn.length] * 0.35 * (1 - lm.glow);
    lm.light.color.copy(doorDark).lerp(doorLit, Math.min(1, lm.glow * (0.85 + bass * 0.12) + idle));
    const built = i ? Bs : As;
    lm.halo.material.opacity = (lm.glow * (0.7 + bass * 0.15) + lm.glow * 0.2) * THREE.MathUtils.smoothstep(built, 0.85, 1.0);
  });
  const v = current >= 0 ? voices[current] : null;
  const progress = v && v.el.duration ? v.el.currentTime / v.el.duration : 0;
  player.tick(progress, bass);
  dog.eyes.color.copy(eyeDark).lerp(eyeLit, landmarks[1].glow * (0.8 + bass * 0.2));

  // the cloud streaks are the spectrum
  for (let b = 0; b < 12; b++) {
    const target = playing ? Math.min(1, bands[b] * (1.1 + b * 0.06)) : 0;
    bandsSmooth[b] += (target - bandsSmooth[b]) * (target > bandsSmooth[b] ? k(0.5) : k(0.12));
  }
  puffMat.uniforms.uBands.value = bandsSmooth;
  puffMat.uniforms.uBass.value = bass;
  kick *= Math.pow(0.9, dt * 60);
  post.material.uniforms.uKick.value = kick;
  pondFull.set("#1d39c4").lerp(pondLit, Math.min(1, high * 0.8));

  // the music moves the wind a little: each kick sends a soft gust and a stray petal
  if (playing && bass > 0.5 && bass > bassAvg * 1.22 && t - lastBurst > 0.4) {
    lastBurst = t;
    kick = 1;
    const ahead = camera.position.z - 3 - rnd() * 6;
    const gx = pathX(ahead) + (rnd() - 0.5) * 8;
    gustTarget.set(gx, ahead, 0);
    pointerSpeed = Math.max(pointerSpeed, 0.35);
    burst(new THREE.Vector3(gx, 0.4, ahead), fire > 0.3 ? ["#ff7a1a", "#ffb400", "#ffd24a", "#2a2224"] : B > 0.3 ? POPPY : leafGreens, 1);
  }

  // leaves
  const wx = breeze * 1.6;
  for (let i = 0; i < LEAVES; i++) {
    const Lf = leaves[i];
    const p = Lf.p;
    const swirl = Math.sin(t * 0.8 + i) * 0.6;
    if (Lf.burst) {
      Lf.v.y -= 2.2 * dt;
      Lf.v.multiplyScalar(0.985);
      Lf.v.x += (wx - Lf.v.x) * 0.01;
      if (p.y < 0.2) Lf.burst = false;
    } else {
      Lf.v.x += (wx * (0.6 + 0.4 * Math.sin(i)) - Lf.v.x) * 0.03;
      Lf.v.y += (Math.sin(t * 1.3 + i * 0.7) * 0.5 - 0.15 - Lf.v.y) * 0.03;
      Lf.v.z += (swirl * 0.4 - Lf.v.z) * 0.03;
    }
    // the pointer's gust throws nearby leaves
    const gx = p.x - wind.uGust.value.x, gz = p.z - wind.uGust.value.y;
    const gd = gx * gx + gz * gz;
    if (pointerSpeed > 0.1 && gd < 12) { Lf.v.x += (gx / (gd + 0.5)) * pointerSpeed * 0.3; Lf.v.y += pointerSpeed * 0.08; }
    p.addScaledVector(Lf.v, dt);
    const cz = camera.position.z, cx = camera.position.x;
    if (p.x > cx + 16 || p.y < -0.2 || p.y > 5 || p.z > cz - 3.5 || p.z < cz - 28) respawnLeaf(Lf, false, i);
    Lf.r.x += Lf.w.x * dt * (0.6 + Math.abs(Lf.v.x) * 0.3);
    Lf.r.y += Lf.w.y * dt;
    Lf.r.z += Lf.w.z * dt;
    quat.setFromEuler(Lf.r);
    scl.setScalar(Lf.s);
    mtx.compose(p, quat, scl);
    leafMesh.setMatrixAt(i, mtx);
  }
  leafMesh.instanceMatrix.needsUpdate = true;

  // pollen
  for (let i = 0; i < POLLEN; i++) {
    pollenPos[i * 3 + 1] += dt * (0.12 + (i % 5) * 0.03) * (1 + fire * 4);
    pollenPos[i * 3] += dt * breeze * 0.3 + Math.sin(t + i) * 0.002;
    if (pollenPos[i * 3 + 1] > 7.5) { pollenPos[i * 3 + 1] = 0; pollenPos[i * 3 + 2] = camera.position.z - 2 - rnd() * 25; }
    if (pollenPos[i * 3] > 12) pollenPos[i * 3] = -12;
  }
  pollenGeo.attributes.position.needsUpdate = true;
  pollen.material.size = 0.12 + high * 0.06;
  // embers while it burns, pollen once it has healed
  pollen.material.opacity = Math.max(fire, THREE.MathUtils.smoothstep(Bs, 0.3, 0.8));
  pollen.material.color.set("#fff4c8").lerp(emberC, fire);

  // the smoke lifts and drifts off during the second song
  const clear = THREE.MathUtils.smoothstep(Bs, 0.0, 0.7);
  clouds.forEach((c) => {
    c.position.x += dt * c.userData.speed * (1 + clear);
    if (c.position.x > 100) c.position.x = -100;
    c.position.y = c.userData.y + clear * 10;
    c.scale.copy(c.userData.s).multiplyScalar(Math.max(0.001, 1 - clear));
  });
  const green = THREE.MathUtils.smoothstep(As, 0.1, 0.8);
  // scorched stone comes clean as each building is rebuilt
  stoneMats.forEach(({ mat, base, li }) => {
    const clean = THREE.MathUtils.smoothstep(li ? Bs : As, 0.2, 1.0);
    ["uLit", "uMid", "uShadow"].forEach((n, j) => mat.uniforms[n].value.copy(base[j]).multiply(charStone.clone().lerp(new THREE.Color(1, 1, 1), clean)));
  });
  // smoke columns over the ruins
  SMOKE.forEach((sm, i) => {
    const lm = landmarks[sm.li];
    const strength = sm.li ? 1 - THREE.MathUtils.smoothstep(Bs, 0.0, 0.45) : 1 - THREE.MathUtils.smoothstep(As, 0.1, 0.6);
    sm.age += dt * 0.07 * (1 + sm.seed);
    if (sm.age > 1) sm.age -= 1;
    const a = sm.age;
    const local = new THREE.Vector3(Math.sin(sm.seed * 40) * sm.spread * 0.4 + a * sm.rise * 0.35 * breeze, (sm.li ? 15 : 1) + a * sm.rise, Math.cos(sm.seed * 40) * sm.spread * 0.3);
    const p = lm.root.localToWorld(local);
    const r = (sm.li ? 2.2 : 0.7) * (0.4 + a * 1.4) * strength * Math.sin(Math.min(1, a * 1.3) * Math.PI * 0.95 + 0.15);
    mtx.compose(p, quat.identity(), scl.setScalar(Math.max(0.0001, r)));
    smokeMesh.setMatrixAt(i, mtx);
  });
  smokeMesh.instanceMatrix.needsUpdate = true;
  pondMat.color.copy(pondDry).lerp(pondFull, green);
  ["lit", "mid", "shadow"].forEach((k) => bushMat.uniforms["u" + k[0].toUpperCase() + k.slice(1)].value.copy(BUSH[k][0]).lerp(BUSH[k][1], green));
  puffMat.uniforms.uAppear.value = THREE.MathUtils.smoothstep(Bs, 0.2, 0.7);
  puffMesh.visible = puffMat.uniforms.uAppear.value > 0.01;
  // camera: walk the path toward the song's landmark as the song plays
  walkGoal = camBase.z - 26 * As - 8 * Bs; // the first song carries you through the gate, the second on toward the tower
  walkZ += (walkGoal - walkZ) * k(0.01);
  wind.uHealC.value.set(pathX(walkZ), walkZ);
  const sw = reduced ? 0 : 1;
  const bob = Math.sin(t * 0.33) * 0.05 * sw + (playing && !reduced ? Math.abs(Math.sin(walkZ * 2.2)) * 0.03 : 0);
  camera.position.set(pathX(walkZ) + ndc.x * 0.5 * sw + Math.sin(t * 0.2) * 0.15 * sw, height(pathX(walkZ), walkZ) + 1.55 + ndc.y * 0.2 * sw + bob, walkZ);
  const ahead = walkZ - 9;
  lookTarget.set(pathX(ahead) * 0.6, 2.3, ahead);
  // while the tower rises (and once it stands) turn to watch it
  towerFocus += (((current === 1 && playing) || Bs > 0.9 ? 1 : 0) - towerFocus) * k(0.02);
  if (current === 0) lookTarget.lerp(landmarks[0].root.position.clone().setY(3), 0.25 * landmarks[0].glow);
  lookTarget.lerp(landmarks[1].root.position.clone().setY(24), 0.6 * towerFocus);
  lookNow.lerp(lookTarget, k(0.03));
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

// for the poster/export tools
window.NEW_DAWN = { scene, camera, renderer, play, landmarks, voices, setLife: (v) => { A = As = Math.min(1, v * 2); B = Bs = Math.max(0, v * 2 - 1); walkZ = walkGoal = camBase.z - 26 * As - 8 * Bs; lookNow.set(pathX(walkZ - 9) * 0.6, 2.3, walkZ - 9); }, get current() { return current; }, get playing() { return playing; } };
