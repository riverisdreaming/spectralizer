// Shared helpers: fullscreen fragment-shader runner, the entry gate,
// a pointer/drag tracker, and the chrome studio-lighting GLSL.
(function () {
  const VOID = (window.VOID = window.VOID || {});

  // A black void lit by a few soft studio strips: that is what makes chrome read as chrome.
  VOID.GLSL_COMMON = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

vec3 studio(vec3 r){
  float k = 0.0;
  k += smoothstep(0.72, 0.97, r.y) * 1.4;                                   // overhead softbox
  k += pow(max(0.0, dot(r, normalize(vec3(-0.75, 0.35, 0.55)))), 28.0) * 3.0; // key light
  float az = atan(r.x, r.z);
  k += smoothstep(0.10, 0.04, abs(az - 1.35)) * smoothstep(-0.35, 0.1, r.y) * smoothstep(0.85, 0.35, r.y) * 1.6; // strip right
  k += smoothstep(0.06, 0.02, abs(az + 2.2)) * smoothstep(-0.1, 0.4, r.y) * 0.9;  // rim strip behind
  k += smoothstep(0.08, 0.03, abs(az + 1.15)) * smoothstep(-0.2, 0.3, r.y) * smoothstep(0.9, 0.5, r.y) * 1.2; // strip left
  k += smoothstep(-0.2, 1.0, r.y) * 0.1;                                   // sky fill
  k += smoothstep(-0.35, -0.9, r.y) * 0.35;                                // pale floor bounce
  k += exp(-abs(r.y + 0.05) * 18.0) * 0.22;                                // faint horizon
  return vec3(k) * vec3(0.96, 0.98, 1.02);
}

float grain(vec2 fc, float t){ return hash(fc + fract(t) * 91.7) - 0.5; }
`;

  VOID.shader = function (canvas, frag, { maxDpr = 1.5 } = {}) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    const vs = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, VOID.GLSL_COMMON + frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const locs = {};
    const u = (name, ...v) => {
      if (!(name in locs)) locs[name] = gl.getUniformLocation(prog, name);
      const l = locs[name];
      if (l === null) return;
      if (Array.isArray(v[0]) || v[0] instanceof Float32Array) gl["uniform" + (v[1] || 4) + "fv"](l, v[0]);
      else gl["uniform" + v.length + "f"](l, ...v);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    return {
      u,
      draw(time) {
        u("u_res", canvas.width, canvas.height);
        u("u_time", time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  };

  // Pointer tracking with velocity, for drags, flicks and taps.
  VOID.pointer = function (el, { move, drag, release, tap } = {}) {
    let down = null;
    let last = null;
    let vx = 0, vy = 0;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      down = last = { x: e.clientX, y: e.clientY, t: performance.now() };
      vx = vy = 0;
    });
    el.addEventListener("pointermove", (e) => {
      move && move(e.clientX, e.clientY);
      if (!down) return;
      const now = performance.now();
      const dt = Math.max(1, now - last.t);
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      vx = vx * 0.6 + (dx / dt) * 0.4;
      vy = vy * 0.6 + (dy / dt) * 0.4;
      drag && drag(dx, dy);
      last = { x: e.clientX, y: e.clientY, t: now };
    });
    const up = (e) => {
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const stale = performance.now() - last.t > 90;
      if (dist < 6 && performance.now() - down.t < 350) tap && tap(e.clientX, e.clientY);
      else release && release(stale ? 0 : vx, stale ? 0 : vy);
      down = null;
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // The only thing a visitor sees first: a breathing point of light. Touch it to enter.
  VOID.gate = function (onEnter) {
    const g = document.createElement("button");
    g.className = "gate";
    g.setAttribute("aria-label", "Enter");
    g.innerHTML = "<span></span>";
    document.body.appendChild(g);
    g.addEventListener("click", async () => {
      await VOID.player.start();
      g.classList.add("gone");
      setTimeout(() => g.remove(), 1800);
      onEnter();
    }, { once: true });
  };

  // Mockup-only: Esc or the faint corner mark returns to the index.
  VOID.mockNav = function () {
    const a = document.createElement("a");
    a.href = "index.html";
    a.className = "mock-nav";
    a.setAttribute("aria-label", "Back to mockups");
    a.textContent = "×";
    document.body.appendChild(a);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") location.href = "index.html"; });
  };

  VOID.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
})();
