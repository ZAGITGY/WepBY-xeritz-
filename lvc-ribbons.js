/* ============================================================================
 * lvc-ribbons.js — ริบบิ้นไหม three.js (v11 · 2026-11-01)
 *
 * ริบบิ้นสีเดียวกับวัสดุประติมากรรม LVC (งาช้าง · แดง · แชมเปญ) ไหลเป็นเส้นทางผ่านส่วนต่าง ๆ
 *   - หน้าแรก: ช่วง "ผลงาน" (พื้นแดงเข้ม) และท้ายเว็บ (ผ่านตัวอักษร LVC)
 *   - หน้าย่อย: ด้านขวาของหัวหน้า (หลักสูตร / ข่าว / ติดต่อ)
 * ริบบิ้นค่อย ๆ คลี่ออกเมื่อเลื่อนมาถึง ไหลตามการเลื่อน และนูนหลบตามเมาส์/นิ้ว
 *
 * three.js r180 (vendor/three, MIT) โหลดเฉพาะเมื่อส่วนนั้นใกล้เข้าจอ — ไม่เพิ่มเวลาโหลดหน้าแรก
 * ทั้งหมดเป็น 1 draw call ต่อส่วน (InstancedBufferGeometry + ShaderMaterial คำนวณรูปทรงใน vertex shader)
 *
 * ประหยัดเครื่อง: หยุดวาดเมื่อพ้นจอ/สลับแท็บ · ทิ้ง WebGL context เมื่ออยู่ไกลเกิน 2 จอ
 *   วัดเวลาเฟรมจริง: ช้าเกิน → ลดความละเอียด → ภาพนิ่ง · Save-Data / RAM ≤ 1GB → ภาพนิ่ง
 * ลดการเคลื่อนไหว (Reduced Motion): วาดภาพนิ่งที่คลี่เต็มแล้ว ไม่ขยับตามเมาส์
 * ไม่มี WebGL / โหลด three.js ไม่ได้: ไม่แสดงอะไร (หน้าเว็บเหมือนเดิมทุกอย่าง)
 * ปิดทั้งหมด: ลบ <script type="module" src="./lvc-ribbons.js"> ออกจาก HTML
 * ============================================================================ */

const THREE_URL = "./vendor/three/three.module.min.js";

/* ---------- 1) ตั้งค่า ---------- */
// สีเป็น sRGB ตรง ๆ (ShaderMaterial ไม่แปลงสี) · a = ด้านหน้า, b = ด้านหลังของผืนผ้า
const PALETTES = {
  night: [
    ["#e6cb92", "#8d6c39"], ["#f6ecda", "#b49d78"], ["#d8434f", "#5b0c17"],
    ["#cfb47c", "#6c522c"], ["#f1dfc4", "#987d55"], ["#e9d3a6", "#7c6236"]
  ],
  paper: [
    ["#a8202f", "#6a0f1b"], ["#ffffff", "#e3d8c5"], ["#d2bf96", "#9a8457"],
    ["#fbf7f0", "#d9ccb5"], ["#bd3441", "#7a1524"], ["#e4d4b0", "#a68f5f"]
  ],
  paperDark: [
    ["#c23444", "#5c0d18"], ["#efe5d3", "#8d7c62"], ["#d9c38f", "#7d6639"],
    ["#e8dcc6", "#6f604b"], ["#e0525f", "#6a1220"], ["#cdb27a", "#5f4a28"]
  ]
};

// path: จุดเริ่ม/จุดจบ (−1…1 ของครึ่งกว้าง/ครึ่งสูง) · bend: โค้งทั้งเส้น · spread: ระยะห่างระหว่างเส้น
const PRESETS = {
  night: {
    host: ".achievement", where: "prepend", palette: () => "night",
    path: [-1.3, -0.5, 1.3, -0.82], bend: -0.12, spread: 0.16, amp: 0.15, width: [0.1, 0.22],
    count: 6, light: [-0.35, 0.7, 0.62], shade: [0.42, 0.27, 0.25], sheen: 0.9, opacity: 0.92
  },
  footer: {
    host: ".footer", where: "prepend", palette: (dark) => (dark ? "paperDark" : "paper"),
    path: [-1.25, -0.12, 1.25, 0.12], bend: 0.08, spread: 0.3, amp: 0.3, width: [0.09, 0.19],
    count: 5, light: [-0.3, 0.75, 0.6], shade: [0.8, 0.71, 0.66], sheen: 0.7, opacity: 0.95
  },
  hero: {
    host: ".content-page .page-main", where: "prepend", palette: (dark) => (dark ? "paperDark" : "paper"),
    path: [-1.2, -1.0, 1.25, 0.62], bend: 0.18, spread: 0.22, amp: 0.2, width: [0.07, 0.16], fit: ".page-intro",
    count: 5, light: [-0.3, 0.75, 0.6], shade: [0.8, 0.71, 0.66], sheen: 0.75, opacity: 0.96
  }
};

const root = document.documentElement;
const motionQuery = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
const conn = navigator.connection;
const LITE = !!(conn && conn.saveData) || !!(navigator.deviceMemory && navigator.deviceMemory <= 1);
const isDark = () => root.getAttribute("data-theme") === "dark";

/* ---------- 2) shader ---------- */
const VERT = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform vec2 uHalf;
uniform vec4 uPath;
uniform float uBend;
uniform vec3 uMouse;
attribute vec2 aRib;    // x = ตำแหน่งตามความยาว 0..1, y = ตามความกว้าง -0.5..0.5
attribute vec4 aSeed;   // phase, speed, amplitude, twist
attribute vec4 aShape;  // offset, depth, width, frequency
attribute vec3 aColA;
attribute vec3 aColB;
varying vec3 vPos;
varying vec3 vN;
varying vec2 vRib;
varying vec3 vColA;
varying vec3 vColB;

vec3 centerAt(float u) {
  float t = uTime * aSeed.y + aSeed.x + uScroll * 1.35;
  vec2 p0 = uPath.xy * uHalf;
  vec2 p1 = uPath.zw * uHalf;
  vec2 dir = normalize(p1 - p0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = sin(u * aShape.w + t) * 0.62 + sin(u * aShape.w * 1.83 - t * 1.27 + aSeed.x * 2.1) * 0.38;
  float off = (aShape.x + aSeed.z * w + uBend * sin(u * 3.14159)) * uHalf.y;
  vec2 p = mix(p0, p1, u) + nrm * off;
  float z = aShape.y + 0.42 * sin(u * aShape.w * 0.63 + t * 0.8 + aSeed.x);
  return vec3(p, z);
}

vec3 ribbon(float u, float v) {
  vec3 c = centerAt(u);
  vec3 T = normalize(centerAt(u + 0.003) - centerAt(u - 0.003));
  vec3 N0 = normalize(cross(T, vec3(0.0, 0.0, 1.0)));
  vec3 B = cross(T, N0);
  float t = uTime * aSeed.y * 0.8 + aSeed.x;
  float th = aSeed.w * (sin(u * 3.7 + t) + 0.55 * sin(u * 7.9 - t * 1.4 + aSeed.x));
  vec3 p = c + (cos(th) * N0 + sin(th) * B) * (v * aShape.z * uHalf.y);
  vec2 d = p.xy - uMouse.xy;
  float r = 0.5 * uHalf.y;
  float f = exp(-dot(d, d) / (r * r)) * uMouse.z;
  p.z += f * 0.85;
  p.xy += d / (length(d) + 0.05) * f * 0.16 * uHalf.y;
  return p;
}

void main() {
  float u = aRib.x;
  float v = aRib.y;
  vec3 p = ribbon(u, v);
  vec3 du = ribbon(u + 0.004, v) - ribbon(u - 0.004, v);
  vec3 dv = ribbon(u, v + 0.05) - ribbon(u, v - 0.05);
  vN = normalize(cross(du, dv));
  vPos = p;
  vRib = aRib;
  vColA = aColA;
  vColB = aColB;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uReveal;
uniform float uOpacity;
uniform float uSheen;
uniform vec3 uShade;
uniform vec3 uLight;
varying vec3 vPos;
varying vec3 vN;
varying vec2 vRib;
varying vec3 vColA;
varying vec3 vColB;

void main() {
  float u = vRib.x;
  float a = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
  a *= 1.0 - smoothstep(uReveal - 0.12, uReveal, u);
  a *= smoothstep(0.5, 0.42, abs(vRib.y));
  if (a < 0.004) discard;

  vec3 V = normalize(cameraPosition - vPos);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(uLight);
  vec3 H = normalize(L + V);
  float wrap = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);
  float facing = abs(dot(N, V));

  vec3 base = gl_FrontFacing ? vColA : vColB;
  vec3 col = base * mix(uShade, vec3(1.0), wrap);
  float nh = max(dot(N, H), 0.0);
  col += vec3(1.0, 0.965, 0.9) * (pow(nh, 56.0) * 0.55 + pow(nh, 7.0) * 0.12) * uSheen;
  col = mix(col, col * 0.78, pow(1.0 - facing, 2.2) * 0.6);
  col += 0.05 * smoothstep(0.36, 0.5, abs(vRib.y)) * uSheen;
  gl_FragColor = vec4(col, a * uOpacity);
}
`;

/* ---------- 3) โหลด three.js ครั้งเดียว ---------- */
let threePromise = null;
function loadThree() {
  if (!threePromise) threePromise = import(THREE_URL);
  return threePromise;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (_) { return false; }
}

// สุ่มแบบกำหนดผลได้ เพื่อให้รูปทรงเหมือนเดิมทุกครั้งที่เปิด
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

/* ---------- 4) ส่วนที่มีริบบิ้น ---------- */
class RibbonStage {
  constructor(host, name, cfg) {
    this.host = host;
    this.name = name;
    this.cfg = cfg;
    this.el = document.createElement("div");
    this.el.className = "lvc-ribbons lvc-ribbons--" + name;
    this.el.setAttribute("aria-hidden", "true");
    if (cfg.where === "prepend") host.insertBefore(this.el, host.firstChild);
    else host.appendChild(this.el);
    // หัวหน้าย่อย: สูงเท่าส่วนหัว (ไม่ล้นลงไปทับเนื้อหาด้านล่าง)
    const fit = cfg.fit && host.querySelector(cfg.fit);
    if (fit) {
      const sync = () => { this.el.style.height = Math.round(fit.offsetTop + fit.offsetHeight) + "px"; };
      sync();
      new ResizeObserver(sync).observe(fit);
    }

    this.built = false;
    this.building = false;
    this.visible = false;
    this.static = LITE || motionQuery.matches;
    this.revealStart = 0;
    this.revealed = this.static;
    this.mouse = { x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0 };
    this.frames = 0;
    this.frameSum = 0;
    this.quality = 2;
    this.last = 0;
    this.time = 0;

    this.near = new IntersectionObserver((e) => this.onNear(e[e.length - 1]), { rootMargin: "20% 0px" });
    this.far = new IntersectionObserver((e) => this.onFar(e[e.length - 1]), { rootMargin: "200% 0px" });
    // คลี่ริบบิ้นเมื่อส่วนนั้นเข้าจอจริงราว 1 ใน 5 (ไม่ใช่ตอนเพิ่งใกล้)
    this.seen = new IntersectionObserver((e) => {
      if (e[e.length - 1].isIntersecting && !this.revealStart) { this.revealStart = performance.now(); this.seen.disconnect(); }
    }, { threshold: 0.2 });
    this.near.observe(this.el);
    this.far.observe(this.el);
    this.seen.observe(this.el);
  }

  onNear(entry) {
    this.visible = entry.isIntersecting;
    if (this.visible && !this.built) this.build();
    this.updateLoop();
  }

  onFar(entry) {
    if (!entry.isIntersecting && this.built) this.teardown();
  }

  async build() {
    if (this.building || this.built || this.failed) return;
    this.building = true;
    let THREE;
    try { THREE = await loadThree(); } catch (_) { this.failed = true; this.building = false; return; }
    if (!this.host.isConnected) { this.building = false; return; }
    this.THREE = THREE;
    const cfg = this.cfg;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "default" });
    } catch (_) { this.failed = true; this.building = false; return; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.dprCap);
    const canvas = renderer.domElement;
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.teardown(true); }, false);
    this.el.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 6);

    // เส้นริบบิ้นพื้นฐาน 1 เส้น: 280 ช่องตามยาว × 1 ช่องตามกว้าง
    const SEG = 280;
    const base = new THREE.InstancedBufferGeometry();
    const rib = new Float32Array((SEG + 1) * 2 * 2);
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const index = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      rib.set([u, -0.5, u, 0.5], i * 4);
      if (i < SEG) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base.setIndex(index);
    base.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    base.setAttribute("aRib", new THREE.BufferAttribute(rib, 2));

    const n = cfg.count;
    const rand = rng(name2seed(this.name));
    const seed = new Float32Array(n * 4);
    const shape = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) - 0.5 : 0;
      seed.set([rand() * 6.28, 0.16 + rand() * 0.14, cfg.amp * (0.6 + rand() * 0.7), 0.9 + rand() * 0.9], i * 4);
      shape.set([
        k * cfg.spread * 2 + (rand() - 0.5) * 0.08,
        -0.7 + rand() * 1.1,
        cfg.width[0] + rand() * (cfg.width[1] - cfg.width[0]),
        3.2 + rand() * 2.6
      ], i * 4);
    }
    base.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    base.setAttribute("aShape", new THREE.InstancedBufferAttribute(shape, 4));
    this.colA = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.colB = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    base.setAttribute("aColA", this.colA);
    base.setAttribute("aColB", this.colB);
    base.instanceCount = n;

    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uHalf: { value: new THREE.Vector2(1, 1) },
      uPath: { value: new THREE.Vector4(...cfg.path) },
      uBend: { value: cfg.bend },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uReveal: { value: this.static ? 1.15 : 0 },
      uOpacity: { value: cfg.opacity },
      uSheen: { value: cfg.sheen },
      uShade: { value: new THREE.Vector3(...cfg.shade) },
      uLight: { value: new THREE.Vector3(...cfg.light) }
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(base, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    Object.assign(this, { renderer, scene, camera, mesh, uniforms, geometry: base, material });
    this.applyPalette();
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); if (!this.running) this.render(); });
    this.ro.observe(this.el);

    this.built = true;
    this.building = false;
    this.el.classList.add("is-ready");
    this.render();
    this.updateLoop();
  }

  applyPalette() {
    if (!this.colA) return;
    const list = PALETTES[this.cfg.palette(isDark())];
    for (let i = 0; i < this.cfg.count; i++) {
      const [a, b] = list[i % list.length];
      this.colA.array.set(hexToRgb(a), i * 3);
      this.colB.array.set(hexToRgb(b), i * 3);
    }
    this.colA.needsUpdate = true;
    this.colB.needsUpdate = true;
  }

  resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.el.clientWidth);
    const h = Math.max(1, this.el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    this.uniforms.uHalf.value.set(halfH * this.camera.aspect, halfH);
  }

  pointer(x, y, inside) {
    if (!this.built || this.static) return;
    const r = this.el.getBoundingClientRect();
    const h = this.uniforms.uHalf.value;
    this.mouse.tx = ((x - r.left) / r.width * 2 - 1) * h.x;
    this.mouse.ty = -((y - r.top) / r.height * 2 - 1) * h.y;
    this.mouse.ta = inside && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? 1 : 0;
  }

  updateLoop() {
    const want = this.built && this.visible && !document.hidden && !this.static;
    if (want === this.running) return;
    this.running = want;
    if (want) { this.last = performance.now(); this.renderer.setAnimationLoop((t) => this.tick(t)); }
    else if (this.renderer) { this.renderer.setAnimationLoop(null); this.render(); }
  }

  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.watch(dt);
    if (this.revealStart && !this.revealed) {
      const p = (now - this.revealStart) / 2800;
      this.uniforms.uReveal.value = easeOutExpo(Math.min(1, p)) * 1.15;
      if (p >= 1) this.revealed = true;
    }
    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.08;
    m.y += (m.ty - m.y) * 0.08;
    m.a += (m.ta - m.a) * 0.05;
    this.uniforms.uMouse.value.set(m.x, m.y, m.a);
    this.render();
  }

  // วัดเวลาเฟรมจริง 90 เฟรม: ช้า → ลดความละเอียด → ภาพนิ่ง
  watch(dt) {
    this.frames++;
    this.frameSum += dt;
    if (this.frames < 90) return;
    const avg = this.frameSum / this.frames * 1000;
    this.frames = 0;
    this.frameSum = 0;
    if (avg > 30 && this.quality === 2) {
      this.quality = 1;
      this.renderer.setPixelRatio(1);
      this.resize();
    } else if (avg > 45 && this.quality === 1) {
      this.quality = 0;
      this.uniforms.uReveal.value = 1.15;
      this.revealed = true;
      this.static = true;
      this.updateLoop();
    }
  }

  render() {
    if (!this.renderer) return;
    if (this.static) {
      this.uniforms.uReveal.value = 1.15;
      if (!this.time) this.time = 2.4;
    }
    const vh = window.innerHeight || 1;
    const r = this.el.getBoundingClientRect();
    this.uniforms.uScroll.value = this.static ? 0 : (r.top + r.height / 2 - vh / 2) / vh;
    this.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }

  setStatic(on) {
    this.static = on || LITE;
    if (this.static) this.mouse.ta = this.mouse.a = 0;
    this.updateLoop();
    this.render();
  }

  teardown(lost) {
    if (!this.built && !this.renderer) return;
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      if (this.ro) this.ro.disconnect();
      this.geometry.dispose();
      this.material.dispose();
      this.renderer.dispose();
      if (!lost) this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.renderer = this.scene = this.camera = this.mesh = this.geometry = this.material = this.uniforms = null;
    this.colA = this.colB = null;
    this.built = false;
    this.running = false;
    this.el.classList.remove("is-ready");
    // เปิดผ่านไปแล้ว: กลับมาอีกครั้งแสดงเต็มทันที ไม่คลี่ซ้ำ
    this.revealed = true;
    if (this.revealStart === 0) this.revealStart = 1;
  }
}

function name2seed(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* ---------- 5) เริ่มทำงาน ---------- */
const stages = [];

function mount() {
  Object.keys(PRESETS).forEach((name) => {
    if (stages.some((s) => s.name === name)) return;
    const cfg = PRESETS[name];
    const host = document.querySelector(cfg.host);
    if (!host || host.querySelector(":scope > .lvc-ribbons")) return;
    stages.push(new RibbonStage(host, name, cfg));
  });
}

function boot() {
  if (!("IntersectionObserver" in window) || !("ResizeObserver" in window) || !hasWebGL()) return;
  mount();
  // หน้าแรกสร้างเนื้อหาด้วย app.js — รอจนส่วน "ผลงาน" และท้ายเว็บมีอยู่จริง
  const app = document.getElementById("app");
  if (app && stages.length < 2) {
    const mo = new MutationObserver(() => { mount(); if (stages.length >= 2) mo.disconnect(); });
    mo.observe(app, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }

  window.addEventListener("pointermove", (e) => stages.forEach((s) => s.pointer(e.clientX, e.clientY, true)), { passive: true });
  window.addEventListener("pointerdown", (e) => stages.forEach((s) => s.pointer(e.clientX, e.clientY, true)), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => stages.forEach((s) => { s.mouse.ta = 0; }));
  window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") stages.forEach((s) => { s.mouse.ta = 0; }); }, { passive: true });
  document.addEventListener("visibilitychange", () => stages.forEach((s) => s.updateLoop()));
  motionQuery.addEventListener && motionQuery.addEventListener("change", (e) => stages.forEach((s) => s.setStatic(e.matches)));
  window.addEventListener("beforeprint", () => stages.forEach((s) => s.renderer && s.renderer.setAnimationLoop(null)));
  new MutationObserver(() => stages.forEach((s) => { s.applyPalette(); if (!s.running) s.render(); }))
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  window.__LVC_RIBBONS = { stages, version: "2026-11-01.11.0" };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
