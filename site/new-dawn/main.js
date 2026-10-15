import * as THREE from "three";
import {
  RAINBOW, wildflowerGeometry, bladeGeometry, leafGeometry,
  glowTexture, makeCloud, makeButterfly, makeRainbow, mulberry,
  toonMaterial, printSunTextures, makeGate, makeTower,
} from "./assets.js";

// Each song lives in a place on the road: the gate over the path, and the tower on the far hill.
// Nothing names them. The compass needle points at a place, and that place sings.
const TRACKS = [
  { title: "doordash", src: "music/doordash.mp3", walkTo: -1.5 },
  { title: "wardoggin", src: "music/wardoggin.mp3", walkTo: -7 },
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
      uNear: { value: 0.1 }, uFar: { value: 400 }, uLife: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uDpr, uNear, uFar, uLife;
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
        // storm (0) -> the light after it (1)
        float k1 = smoothstep(0.0, 0.55, uRise), k2 = smoothstep(0.35, 1.0, uRise);
        vec3 zen = mix(mix(vec3(0.09,0.10,0.18), vec3(0.08,0.10,0.38), k1), vec3(0.03,0.11,0.55), k2);
        vec3 mid = mix(mix(vec3(0.24,0.25,0.33), vec3(0.30,0.22,0.48), k1), vec3(0.08,0.2,0.72), k2);
        vec3 hor = mix(mix(vec3(0.42,0.4,0.42), vec3(0.95,0.5,0.28), k1), vec3(0.35,0.55,0.98), k2);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y));
        c = mix(c, zen, smoothstep(0.15, 0.65, y));
        float s = max(0.0, dot(normalize(vDir), normalize(uSun)));
        float lit = smoothstep(0.1, 0.6, uRise);
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

// The storm: a low blanket of heavy cloud that breaks up and drifts off.
const stormMat = toonMaterial({ lit: "#8b90a6", mid: "#5b6076", shadow: "#30344a" });
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
const puffMat = toonMaterial({ lit: "#ffffff", mid: "#c7d6ff", shadow: "#3553d6", light: new THREE.Vector3(0.1, 0.35, 1) });
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
      puffs.push([cx + Math.cos(a) * rr + k * 6, y, cz + Math.sin(a) * rr * 0.5, 2.2 + rnd() * 3 * (1 - k * 0.4)]);
    }
  }
}
tower(-46, -150, 62, 13);
tower(70, -175, 26, 9);
// streaks: fine ribbons of small billows fanning out of the sun
for (let i = 0; i < 12; i++) {
  const a = (6 + (i / 11) * 168 + (rnd() - 0.5) * 6) * (Math.PI / 180);
  const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
  const start = 22 + rnd() * 10;
  for (let r = start; r < 150; r += 1.2 + r * 0.018) {
    if (rnd() < 0.12) r += 4; // a gap now and then
    const side = Math.sin(r * 0.08 + i) * r * 0.025;
    const size = (0.45 + r * 0.014) * (0.7 + rnd() * 0.6);
    puffs.push([SUN_HOME.x + dir.x * r - dir.y * side, SUN_HOME.y - 6 + dir.y * r * 0.55 + dir.x * side, SUN_HOME.z + 15, size]);
  }
}
const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), puffMat, puffs.length);
puffs.forEach(([x, y, z, r], i) => puffMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.85, r))));
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
const BUSH = { lit: [new THREE.Color("#6b6a5c"), new THREE.Color("#3f8f2a")], mid: [new THREE.Color("#45463e"), new THREE.Color("#22621f")], shadow: [new THREE.Color("#1d1f22"), new THREE.Color("#0b2a17")] };
[[-11, -6], [-6, -16], [6, -8], [13, -10], [-15, -20], [4, -24], [17, -22], [-3, -30]].forEach(([bx, bz], i) => {
  const n = 4 + (i % 3);
  for (let k = 0; k < n; k++) {
    const r = 0.9 + rnd() * 0.9;
    const x = bx + (k - n / 2) * 0.9 + rnd() * 0.5, z = bz + (rnd() - 0.5) * 1.2;
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
};
const windGLSL = `
  uniform float uTime, uBass; uniform vec2 uWind; uniform vec3 uGust;
  vec3 sway(vec3 world, vec3 root, float h, float r){
    float w = sin(uTime*1.6 + root.x*0.35 + root.z*0.25)*0.55 + sin(uTime*3.3 + root.x*1.3 + r*6.2831)*0.2;
    vec2 bend = uWind * (0.55 + w) * (0.32 + uBass*0.55);
    vec2 d = root.xz - uGust.xy;
    float g = uGust.z * exp(-dot(d,d)*0.22);
    bend += normalize(d + 1e-4) * g * 1.3;
    world.xz += bend * h;
    world.y -= length(bend) * h * 0.22;
    return world;
  }`;
// Colour returns in a widening circle around where you stand, with a ragged edge.
const healGLSL = `
  uniform vec2 uHealC;
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
      attribute float aRand; varying float vH; varying float vRand; varying vec2 vXZ;
      ${windGLSL}
      varying float vDist;
      void main(){
        vH = uv.y; vRand = aRand;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        world.xyz = sway(world.xyz, root, vH*vH, aRand);
        vXZ = root.xz;
        vec4 mv = viewMatrix * world;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vH; varying float vRand; varying vec2 vXZ; uniform float uRise; uniform float uHeal;
      ${healGLSL}
      ${fogGLSL}
      void main(){
        vec3 base = mix(vec3(0.02,0.16,0.06), vec3(0.04,0.26,0.08), vRand);
        vec3 tip = mix(vec3(0.1,0.42,0.07), vec3(0.85,0.75,0.15), step(0.95, vRand));
        if (vRand < 0.06) tip = vec3(0.12,0.5,0.3);
        vec3 c = mix(base, tip, smoothstep(0.0, 1.0, vH));
        c += vec3(1.0,0.75,0.3) * pow(vH, 3.0) * 0.25 * uRise; // sunlit tips
        vec3 dry = mix(vec3(0.33,0.31,0.24), vec3(0.62,0.56,0.4), vH) * (0.8 + vRand*0.3);
        c = mix(dry, c, heal(vXZ, vRand));
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
      varying vec3 vCol; varying vec2 vXZ; varying float vR;
      ${windGLSL}
      varying float vDist;
      void main(){
        vCol = mix(color, aColor, aTint);
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        float h = clamp(position.y / 0.5, 0.0, 1.2);
        vXZ = root.xz; vR = aRand;
        world.xyz = sway(world.xyz, root, h*h*0.8, aRand);
        vec4 mv = viewMatrix * world;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying vec2 vXZ; varying float vR; uniform float uHeal;
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
  landmarks[0].root.rotation.y = Math.atan2(0 - gx, 9 - gz) * 0.8;
  const tx = 44, tz = -110;
  landmarks[1].root.position.set(tx, height(tx, tz) - 3, tz);
  landmarks[1].root.rotation.y = -0.25;
  landmarks[1].root.scale.setScalar(1.0);
}
const doorDark = new THREE.Color("#10173a"), doorLit = new THREE.Color("#ffe6a3");
// stone sits in grey-blue shadow under the storm and warms as the light returns
const stoneMats = [];
landmarks.forEach((lm) => lm.root.traverse((o) => {
  const u = o.material && o.material.uniforms;
  if (u && u.uLit && !stoneMats.some((m) => m.mat === o.material)) stoneMats.push({ mat: o.material, base: ["uLit", "uMid", "uShadow"].map((n) => u[n].value.clone()) });
}));
const stormStone = new THREE.Color("#5d6380");
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

// rain
const RAIN = small ? 900 : 1800;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN * 6);
for (let i = 0; i < RAIN; i++) {
  const x = (rnd() * 2 - 1) * 16, y = rnd() * 14, z = 8 - rnd() * 26;
  rainPos.set([x, y, z, x - 0.05, y - 0.45, z], i * 6);
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#c9d3e6", transparent: true, opacity: 0.45, depthWrite: false }));
rain.frustumCulled = false;
scene.add(rain);

// How far the world has come back. It only moves forward, and it remembers you.
let life = 0;
try { life = Math.min(0.5, (parseFloat(localStorage.getItem("new-dawn-life")) || 0) * 0.6); } catch (e) {}
let lastSave = 0;

// ---------- leaves and petals riding the wind ----------
const LEAVES = small ? 140 : 220;
const leafMesh = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), LEAVES);
leafMesh.frustumCulled = false;
const leaves = [];
const leafGreens = ["#2fbf2f", "#62d42a", "#9be22b", "#d6e82a", "#ffb400", "#ff6a13"];
const leafDry = ["#8a7a5a", "#a08a60", "#6f6650", "#b59a6a", "#7c7466"];
for (let i = 0; i < LEAVES; i++) {
  const L = { p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(4), s: 0.7 + rnd() * 0.8, life: 0 };
  respawnLeaf(L, true);
  leafMesh.setColorAt(i, new THREE.Color(leafDry[i % leafDry.length]));
  L.s *= 0.75;
  leaves.push(L);
}
scene.add(leafMesh);
function respawnLeaf(L, anywhere, i = -1) {
  if (i >= 0 && leafMesh.instanceColor) {
    const pal = rnd() < life ? (rnd() < 0.3 * life ? POPPY : leafGreens) : leafDry;
    leafMesh.setColorAt(i, new THREE.Color(pal[Math.floor(rnd() * pal.length)]));
    leafMesh.instanceColor.needsUpdate = true;
  }
  L.p.set(camera.position.x + (anywhere ? (rnd() * 2 - 1) * 14 : -16 - rnd() * 4), 0.3 + rnd() * 6.5, camera.position.z - 4.5 - rnd() * 20);
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

// butterflies
const butterflies = Array.from({ length: 6 }, (_, i) => {
  const b = makeButterfly(RAINBOW[(i * 3) % RAINBOW.length]);
  b.phase = rnd() * 10;
  b.home = new THREE.Vector3((rnd() * 2 - 1) * 5, 1.2 + rnd() * 2, 3 - rnd() * 6);
  scene.add(b.root);
  return b;
});

// ---------- audio ----------
let actx, analyser, freq, current = -1, playing = false;
const visited = TRACKS.map(() => false);

const voices = [];
function startAudio() {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.78;
  analyser.connect(actx.destination);
  freq = new Uint8Array(analyser.frequencyBinCount);
  TRACKS.forEach((t, i) => {
    const el = new Audio(t.src);
    el.preload = "auto";
    const g = actx.createGain();
    g.gain.value = 0;
    actx.createMediaElementSource(el).connect(g).connect(analyser);
    el.addEventListener("ended", () => compass.swingTo((i + 1) % TRACKS.length));
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
    if (!visited[i]) { visited[i] = true; life = Math.min(1, life + 0.06); }
  }

}
function levels() {
  if (!analyser) return { bass: 0, mid: 0, high: 0 };
  analyser.getByteFrequencyData(freq);
  const band = (a, b) => { let s = 0; for (let k = a; k < b; k++) s += freq[k]; return s / ((b - a) * 255); };
  return { bass: band(1, 6), mid: band(6, 60), high: band(60, 200) };
}

// ---------- the compass: spin the needle; whatever it points at plays ----------
const compass = (() => {
  const cv = document.getElementById("compass");
  const g = cv.getContext("2d");
  let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
  let angle = -Math.PI / 2, vel = 0, dragging = false, lastA = 0, lastT = 0, swingTarget = -1, glow = 0;
  const targets = TRACKS.map(() => -Math.PI / 2);
  const SNAP = 0.22; // radians: how close the needle must rest to a place to wake it
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const css = Math.min(innerWidth * 0.56, innerHeight * 0.36, 300);
    cv.style.width = cv.style.height = css + "px";
    W = H = Math.round(css * dpr);
    cv.width = W; cv.height = H;
    R = W * 0.44; cx = W / 2; cy = H / 2;
  }
  size();
  addEventListener("resize", size);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // screen angle from the dial's centre to each place's doorway
  function aim() {
    const rect = cv.getBoundingClientRect();
    const ox = rect.left + rect.width / 2, oy = rect.top + rect.height / 2;
    landmarks.forEach((lm, i) => {
      const p = lm.door.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, i ? 12 : 2, 0)).project(camera);
      const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
      // both places sit high in the frame, so spread their bearings out to make them easy to find
      const raw = wrap(Math.atan2(y - oy, x - ox) + Math.PI / 2);
      targets[i] = -Math.PI / 2 + Math.max(-1.35, Math.min(1.35, raw * 3.2));
    });
  }
  function nearest() {
    let best = -1, bd = Infinity;
    targets.forEach((a, i) => { const d = Math.abs(wrap(angle - a)); if (d < bd) { bd = d; best = i; } });
    return { i: best, d: bd };
  }
  function settle() {
    const n = nearest();
    if (n.d < SNAP) { if (current !== n.i || !playing) play(n.i); }
    else if (playing) play(current); // pointing at nothing: the music rests
  }
  const pAngle = (e) => {
    const r = cv.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  cv.addEventListener("pointerdown", (e) => {
    if (!entered) return;
    cv.setPointerCapture(e.pointerId);
    const r = cv.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (dist < r.width * 0.12) { if (current >= 0) play(current); return; } // the hub pauses and resumes
    dragging = true; swingTarget = -1;
    lastA = pAngle(e); lastT = performance.now(); vel = 0;
    angle = lastA;
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const a = pAngle(e), now = performance.now();
    const da = wrap(a - lastA);
    vel = vel * 0.5 + (da / Math.max(1, now - lastT)) * 16 * 0.5;
    angle = a; lastA = a; lastT = now;
  });
  const up = () => { if (!dragging) return; dragging = false; if (Math.abs(vel) < 0.02) settle(); };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  function swingTo(i) { swingTarget = i; vel = 0; }

  function draw(dt, t, progress, bass) {
    aim();
    if (!dragging) {
      if (swingTarget >= 0) {
        const d = wrap(targets[swingTarget] - angle);
        angle += d * (1 - Math.pow(0.94, dt * 60));
        if (Math.abs(d) < 0.05) { if (current !== swingTarget || !playing) play(swingTarget); swingTarget = -1; }
      } else if (Math.abs(vel) > 0.0005) {
        angle += vel * dt * 60;
        vel *= Math.pow(0.965, dt * 60);
        const n = nearest();
        if (Math.abs(vel) < 0.03 && n.d < SNAP * 1.6) vel += wrap(targets[n.i] - angle) * 0.02; // drawn toward a place
        if (Math.abs(vel) <= 0.0005) settle();
      } else if (current >= 0 && playing) {
        angle += wrap(targets[current] - angle) * (1 - Math.pow(0.9, dt * 60)); // keep pointing as you walk
      }
    }
    glow += ((playing ? 1 : 0) - glow) * (1 - Math.pow(0.95, dt * 60));

    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(cx, cy);
    // body: paper ring, ultramarine face
    g.fillStyle = "rgba(10,16,51,0.35)";
    g.beginPath(); g.arc(0, R * 0.06, R * 1.04, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#efe3c4";
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2.2 * dpr; g.strokeStyle = "#0a1033"; g.stroke();
    g.fillStyle = "#0f2aa8";
    g.beginPath(); g.arc(0, 0, R * 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
    // stipple on the face
    g.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 160; i++) {
      const a = i * 2.39996, r = R * 0.78 * Math.sqrt(((i * 97) % 160) / 160);
      g.fillRect(Math.cos(a) * r, Math.sin(a) * r, dpr, dpr);
    }
    // the sun-star at the heart, like the rays over the hills
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.02;
      const len = R * (i % 2 ? 0.42 : 0.66) * (1 + glow * bass * 0.15);
      g.fillStyle = i % 2 ? "#ffb23a" : "#ff6a1a";
      g.beginPath();
      g.moveTo(Math.cos(a - 0.09) * R * 0.14, Math.sin(a - 0.09) * R * 0.14);
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      g.lineTo(Math.cos(a + 0.09) * R * 0.14, Math.sin(a + 0.09) * R * 0.14);
      g.closePath(); g.fill();
    }
    // engraved ticks on the ring
    g.strokeStyle = "#0a1033";
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r0 = i % 6 ? R * 0.9 : R * 0.84;
      g.lineWidth = (i % 6 ? 1 : 1.8) * dpr;
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); g.stroke();
    }
    // a warm notch on the rim where each place lies
    targets.forEach((a, i) => {
      const on = i === current ? glow : 0;
      g.fillStyle = on > 0.1 ? `rgba(255,${Math.round(150 + on * 80)},60,1)` : "#ff7a1a";
      g.beginPath(); g.arc(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * (0.045 + on * 0.02 + on * bass * 0.03), 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.5 * dpr; g.strokeStyle = "#0a1033"; g.stroke();
    });
    // how far the song has come, burned into the rim
    if (current >= 0 && progress > 0) {
      g.strokeStyle = `rgba(255,122,26,${0.5 + glow * 0.5})`;
      g.lineWidth = R * 0.05;
      g.beginPath(); g.arc(0, 0, R * 1.0 + R * 0.04, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); g.stroke();
    }
    // the needle
    g.rotate(angle);
    g.fillStyle = "#0a1033";
    g.beginPath(); g.moveTo(R * 0.86, 0); g.lineTo(-R * 0.1, R * 0.07); g.lineTo(-R * 0.3, 0); g.lineTo(-R * 0.1, -R * 0.07); g.closePath(); g.fill();
    g.fillStyle = "#f4ead2";
    g.beginPath(); g.moveTo(R * 0.86, 0); g.lineTo(R * 0.55, R * 0.035); g.lineTo(R * 0.55, -R * 0.035); g.closePath(); g.fill();
    g.rotate(-angle);
    // the hub
    g.fillStyle = "#f4ead2";
    g.beginPath(); g.arc(0, 0, R * 0.11, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2 * dpr; g.strokeStyle = "#0a1033"; g.stroke();
    g.fillStyle = "#0a1033";
    if (playing) { g.fillRect(-R * 0.04, -R * 0.045, R * 0.025, R * 0.09); g.fillRect(R * 0.015, -R * 0.045, R * 0.025, R * 0.09); }
    else { g.beginPath(); g.moveTo(-R * 0.03, -R * 0.05); g.lineTo(R * 0.05, 0); g.lineTo(-R * 0.03, R * 0.05); g.closePath(); g.fill(); }
    g.restore();
    cv.style.opacity = entered ? 1 : 0;
  }
  return { draw, swingTo, targets };
})();

// ---------- input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(0, 0);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let pointerSpeed = 0, lastPX = 0, lastPY = 0, entered = false;
const gustTarget = new THREE.Vector3(0, -100, 0);

addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerSpeed = Math.min(1.6, pointerSpeed + Math.hypot(e.clientX - lastPX, e.clientY - lastPY) / 60);
  lastPX = e.clientX; lastPY = e.clientY;
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) gustTarget.set(hit.x, hit.z, 0);

});
canvas.addEventListener("click", (e) => {
  if (!entered) return;
  pointerSpeed = 1.8; // a tap on the meadow sends a gust through it
});
addEventListener("keydown", (e) => {
  if (!entered) return;
  if (e.code === "Space") { e.preventDefault(); if (current >= 0) play(current); }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") compass.swingTo(current < 0 ? 0 : (current + 1) % TRACKS.length);
});

// ---------- entry ----------
const gate = document.getElementById("gate");
gate.querySelector("img").src = sunTex.disc.image.toDataURL();
gate.addEventListener("click", () => {
  if (entered) return;
  entered = true;
  startAudio();
  gate.classList.add("gone");
  setTimeout(() => compass.swingTo(0), 1200);
}, { once: true });

// ---------- loop ----------
const clock = new THREE.Clock();
let bass = 0, mid = 0, high = 0, bassAvg = 0, lastBurst = 0;
const tmp = new THREE.Vector3(), mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
const ease = (x) => 1 - Math.pow(1 - x, 3);
let walkZ = camBase.z, walkGoal = camBase.z;
const lookTarget = new THREE.Vector3(0, 2.3, 0), lookNow = new THREE.Vector3(0, 2.3, 0);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const L = levels();
  const k = (a) => 1 - Math.pow(1 - a, dt * 60); // frame-rate independent easing
  bass += (L.bass - bass) * 0.3; mid += (L.mid - mid) * 0.25; high += (L.high - high) * 0.25;
  bassAvg += (bass - bassAvg) * 0.02;

  // redemption: the music slowly brings the world back
  if (entered) life = Math.min(1, life + dt * (playing ? 1 / 75 : 1 / 600));
  if (t - lastSave > 3) { lastSave = t; try { localStorage.setItem("new-dawn-life", life.toFixed(3)); } catch (e) {} }
  const rise = ease(life);
  wind.uHeal.value = -6 + Math.pow(life, 0.8) * 70;
  skyU.uRise.value = rise;
  const sunY = THREE.MathUtils.lerp(-6, SUN_HOME.y, rise);
  sun.root.position.set(SUN_HOME.x, sunY, SUN_HOME.z);
  sun.root.lookAt(camera.position);
  sun.rays.rotation.z = t * 0.03;
  sun.rays.material.opacity = THREE.MathUtils.smoothstep(life, 0.3, 0.75) * (0.75 + bass * 0.5);
  const pulse = 1 + bass * 0.12;
  sun.root.scale.setScalar(pulse);
  skyU.uSun.value.copy(sun.root.position).sub(camera.position).normalize();
  // the rainbow only comes once the rain has passed
  rainbow.material.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(life, 0.5, 0.85) * 0.22;
  sunGlow.material.opacity = THREE.MathUtils.smoothstep(life, 0.15, 0.6) * 0.8;
  sun.disc.material.opacity = THREE.MathUtils.smoothstep(life, 0.05, 0.4);
  hemi.intensity = 0.55 + rise * 0.8;
  hemi.color.set("#8d96ad").lerp(new THREE.Color("#bfe6ff"), rise);
  sunLight.intensity = 0.4 + rise * 2.0;
  ground.material.color.set("#9a8f74").lerp(new THREE.Color("#ffffff"), THREE.MathUtils.smoothstep(life, 0.05, 0.8));
  const storm = new THREE.Color("#4d505e"), dawn = new THREE.Color("#c4704a"), day = new THREE.Color("#5f86e6");
  const fogC = storm.clone().lerp(dawn, THREE.MathUtils.smoothstep(life, 0.0, 0.5)).lerp(day, THREE.MathUtils.smoothstep(life, 0.4, 1.0));
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
    lm.light.color.copy(doorDark).lerp(doorLit, Math.min(1, lm.glow * (0.75 + bass * 0.4)));
    lm.halo.material.opacity = lm.glow * (0.55 + bass * 0.6) * THREE.MathUtils.smoothstep(life, 0.0, 0.3) + lm.glow * 0.25;
  });
  const v = current >= 0 ? voices[current] : null;
  const progress = v && v.el.duration ? v.el.currentTime / v.el.duration : 0;
  compass.draw(dt, t, progress, bass);

  // the music moves the wind: each kick sends a gust and a scatter of petals across the meadow
  if (playing && bass > 0.5 && bass > bassAvg * 1.22 && t - lastBurst > 0.4) {
    lastBurst = t;
    const ahead = camera.position.z - 3 - rnd() * 6;
    const gx = pathX(ahead) + (rnd() - 0.5) * 8;
    gustTarget.set(gx, ahead, 0);
    pointerSpeed = Math.max(pointerSpeed, 0.9 * Math.min(1, life + 0.3));
    if (life > 0.25) burst(new THREE.Vector3(gx, 0.4, ahead), POPPY, 5);
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
    if (p.x > cx + 16 || p.y < -0.2 || p.y > 12 || p.z > cz - 3.5 || p.z < cz - 28) respawnLeaf(Lf, false, i);
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
    pollenPos[i * 3 + 1] += dt * (0.12 + (i % 5) * 0.03);
    pollenPos[i * 3] += dt * breeze * 0.3 + Math.sin(t + i) * 0.002;
    if (pollenPos[i * 3 + 1] > 7.5) { pollenPos[i * 3 + 1] = 0; pollenPos[i * 3 + 2] = camera.position.z - 2 - rnd() * 25; }
    if (pollenPos[i * 3] > 12) pollenPos[i * 3] = -12;
  }
  pollenGeo.attributes.position.needsUpdate = true;
  pollen.material.size = 0.12 + high * 0.25;
  pollen.material.opacity = THREE.MathUtils.smoothstep(life, 0.3, 0.8);

  // butterflies keep you company along the road
  butterflies.forEach((b, i) => {
    const ph = t * 0.5 + b.phase;
    const target = tmp.set(camera.position.x + b.home.x, b.home.y, camera.position.z - 6 + b.home.z);
    const r = 1.2 + (playing ? bass : 0);
    b.root.position.lerp(new THREE.Vector3(target.x + Math.cos(ph) * r, target.y + Math.sin(ph * 1.7) * 0.5, target.z + Math.sin(ph) * r * 0.6), 0.02);
    const flap = Math.sin(t * 14 + b.phase) * 1.1;
    b.L.rotation.y = flap; b.R.rotation.y = -flap;
    b.root.rotation.y = -ph;
  });

  // clouds lighten and lift; rain thins out and stops
  const clear = THREE.MathUtils.smoothstep(life, 0.15, 0.7);
  clouds.forEach((c) => {
    c.position.x += dt * c.userData.speed * (1 + clear);
    if (c.position.x > 100) c.position.x = -100;
    c.position.y = c.userData.y + clear * 10;
    c.scale.copy(c.userData.s).multiplyScalar(Math.max(0.001, 1 - clear));
  });
  const green = THREE.MathUtils.smoothstep(life, 0.1, 0.7);
  stoneMats.forEach(({ mat, base }) => ["uLit", "uMid", "uShadow"].forEach((n, j) => mat.uniforms[n].value.copy(base[j]).multiply(stormStone.clone().lerp(new THREE.Color(1, 1, 1), green))));
  ["lit", "mid", "shadow"].forEach((k) => bushMat.uniforms["u" + k[0].toUpperCase() + k.slice(1)].value.copy(BUSH[k][0]).lerp(BUSH[k][1], green));
  puffMat.uniforms.uAppear.value = THREE.MathUtils.smoothstep(life, 0.3, 0.8);
  puffMesh.visible = puffMat.uniforms.uAppear.value > 0.01;
  rain.material.opacity = 0.45 * (1 - THREE.MathUtils.smoothstep(life, 0.2, 0.5));
  rain.visible = rain.material.opacity > 0.01;
  if (rain.visible) {
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6;
      let y = rainPos[o + 1] - dt * 13;
      if (y < 0) y += 14;
      const dx = breeze * 0.12;
      rainPos[o + 1] = y; rainPos[o + 4] = y - 0.45; rainPos[o + 3] = rainPos[o] - dx;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // camera: walk the path toward the song's landmark as the song plays
  if (current >= 0) walkGoal = THREE.MathUtils.lerp(camBase.z, TRACKS[current].walkTo, progress);
  walkZ += (walkGoal - walkZ) * k(0.01);
  wind.uHealC.value.set(pathX(walkZ), walkZ);
  const sw = reduced ? 0 : 1;
  const bob = Math.sin(t * 0.33) * 0.05 * sw + (playing && !reduced ? Math.abs(Math.sin(walkZ * 2.2)) * 0.03 : 0);
  camera.position.set(pathX(walkZ) + ndc.x * 0.5 * sw + Math.sin(t * 0.2) * 0.15 * sw, height(pathX(walkZ), walkZ) + 1.55 + ndc.y * 0.2 * sw + bob, walkZ);
  const ahead = walkZ - 9;
  lookTarget.set(pathX(ahead) * 0.6, 2.3, ahead);
  if (current >= 0) lookTarget.lerp(landmarks[current].root.position.clone().setY(current ? 14 : 3), 0.25 * landmarks[current].glow);
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
window.NEW_DAWN = { scene, camera, renderer, play, landmarks, compass, setLife: (v) => { life = v; }, get current() { return current; }, get playing() { return playing; } };
