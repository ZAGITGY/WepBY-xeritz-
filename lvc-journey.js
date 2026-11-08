/* ============================================================================
 * lvc-journey.js — ฉากหนังต่อเนื่องช่วงที่สองของหน้าแรก (v13 · 2026-11-06) แทน lvc-showcase.js
 *
 * เลื่อนหน้า = กล้องเดินทางเป็นฉากเดียว (ตรึงจอ ~7 เท่าความสูงจอ)
 *   0  มาถึง      ภาพวิทยาลัยจริงในแสงค่ำ ตัวอักษร VOCATIONAL ยักษ์อยู่หลังตึก (ตึกบังบางส่วน)
 *   1  บินผ่าน     กล้องเลื่อนต่ำผ่านลานหน้าวิทยาลัยไปที่ป้ายชื่อ ฝุ่นแสงยืดเป็นเส้นตามความเร็ว
 *   2  8 เส้นทาง   โมเดล 8 กลุ่มสาขา (จาก lvc-objects.js) ลอยเหนือลาน มีป้ายชื่อโยงเส้นชี้
 *   3  งาช้าง      พื้นสว่าง ตัว LVC ยักษ์อยู่ด้านหลัง ประติมากรรม LVC หมุน ระยะใกล้ แล้วแยกชิ้น · ตัวเลข 8 / 3
 *   4  ห้องมืด     สปอตไลต์ แท่นโชว์ ช่องแสงผนังหลัง ประติมากรรมลงจอดบนแท่น
 *   5  ปิดท้าย     ตัวหนังสือ "ลงมือทำ" สามมิติขนาดยักษ์ขึ้นหลังแท่น · ปุ่มสำรวจหลักสูตร / สอบถามการสมัคร
 *
 * ภาพวิทยาลัย: ฉายภาพ campus.webp ลงบนโครงง่าย ๆ (พื้นลาน · ผนังตึก · ฉากฟ้า) จากตำแหน่งกล้องที่ถ่ายภาพ
 *   (camera projection) ตอนเริ่มจึงตรงกับภาพจริงทุกพิกเซล เมื่อกล้องขยับจึงเห็นมิติ ไม่ได้แต่งรูปตึกเพิ่ม
 * ประติมากรรม LVC สร้างด้วยโค้ด (หน้าแดง ตัวงาช้าง ฐานแดง-ขาว) · ไม่ใช้ไฟล์โมเดล
 *
 * ประหยัดเครื่อง: สร้าง WebGL เมื่อใกล้ถึง ทิ้งเมื่อไกลเกิน 2 จอ · วาดเฉพาะตอนเลื่อนหรือมีอะไรขยับ
 *   วัดเวลาเฟรม: ช้า → ความละเอียด 1x → ปิดการขยับเล็ก ๆ (ยังตามการเลื่อน)
 * ไม่มี WebGL: ยังตรึงจอและเล่าเรื่องด้วยภาพนิ่ง + ข้อความ · Reduced Motion: ไม่ตรึงจอ เรียงบทอ่านได้ทั้งหมด
 * ย้อนกลับ v12: ใน index.html เปลี่ยน lvc-journey.js/journey.css กลับเป็น lvc-showcase.js/showcase.css
 * ============================================================================ */

const VERSION = "2026-11-06.13.0";
const THREE_URL = "./vendor/three/three.module.min.js";
const PHOTO = "./images/campus.webp";

const root = document.documentElement;
const motionQ = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
const conn = navigator.connection;
const LITE = !!(conn && conn.saveData) || !!(navigator.deviceMemory && navigator.deviceMemory <= 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const unit = (a, b, t) => clamp((t - a) / (b - a), 0, 1);
const smooth = (a, b, t) => { const x = unit(a, b, t); return x * x * (3 - 2 * x); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const band = (a, b, c, d, t) => Math.min(smooth(a, b, t), 1 - smooth(c, d, t));
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (_) { return false; }
}

/* ---------- 1) บท (ช่วงเวลา 0–1 ของการเลื่อน) ---------- */
const CH = [
  { at: [0, 0.115], html: '<p class="lvc-jr__kicker">วิทยาลัยอาชีวศึกษาเลย</p><h2 id="lvc-jr-title">ทักษะ<br>สร้างจากการลงมือทำ</h2><p>เลื่อนลงเพื่อเดินผ่านวิทยาลัย</p>' },
  { at: [0.135, 0.275], html: '<p class="lvc-jr__kicker">พื้นที่เริ่มต้นของคนมีฝัน</p><h3>เรียนรู้<br>ลงมือทำ เติบโต</h3><p>ทุกเส้นทางเริ่มจากลานหน้าวิทยาลัยแห่งนี้</p>' },
  { at: [0.37, 0.515], html: '<p class="lvc-jr__kicker">เส้นทางการเรียนรู้</p><h3>8 กลุ่มสาขา<br>เลือกในแบบคุณ</h3><p>ปวช. ปวส. และปริญญาตรีบางสาขา<br>ตามคู่มือนักเรียน ปีการศึกษา 2569</p>' },
  { at: [0.565, 0.7], html: '<p class="lvc-jr__kicker">สัญลักษณ์ของเรา</p><h3>สามตัวอักษร<br>หนึ่งเส้นทาง</h3><p><b>L</b> เรียนรู้ · <b>V</b> ลงมือทำ · <b>C</b> สร้างสรรค์</p>' },
  { at: [0.745, 0.855], html: '<p class="lvc-jr__kicker">ที่นี่</p><h3>บ้านของ<br>คนลงมือทำ</h3><p>เรียนรู้จากการลงมือทำ<br>ค้นพบเส้นทางของคุณที่อาชีวศึกษาเลย</p>' },
  { at: [0.9, 1.01], final: true, html: '<p class="lvc-jr__kicker">— วิทยาลัยอาชีวศึกษาเลย —</p><h3 class="lvc-jr__sr">เส้นทางของคุณเริ่มที่ LVC</h3><div class="lvc-jr__actions"><a class="button" href="./programs.html">สำรวจหลักสูตร ' + ARROW + '</a><a class="text-link" href="./contact.html#admissions">สอบถามการสมัคร ' + ARROW + "</a></div>" }
];
const LABELS = ["บริหารธุรกิจ", "ดิจิทัลฯ", "ศิลปกรรมฯ", "คหกรรม", "ท่องเที่ยว", "อาหาร", "แฟชั่นสิ่งทอ", "โลจิสติกส์"];
const SLUGS = ["business", "digital", "arts", "home-economics", "tourism", "food", "fashion", "logistics"];

/* ---------- 2) โครงหน้า ---------- */
function buildSection(story) {
  const s = document.createElement("section");
  s.className = "lvc-jr";
  s.id = "symbol";
  s.setAttribute("aria-labelledby", "lvc-jr-title");
  s.innerHTML =
    '<div class="lvc-jr__stage">' +
      '<div class="lvc-jr__poster" aria-hidden="true"></div>' +
      '<img class="lvc-jr__fallback" src="./images/sculpture-poster.webp" alt="" width="900" height="650" loading="lazy" decoding="async" aria-hidden="true">' +
      '<div class="lvc-jr__type" aria-hidden="true"><span>LVC</span></div>' +
      '<div class="lvc-jr__gl" aria-hidden="true"></div>' +
      '<svg class="lvc-jr__lines" aria-hidden="true"></svg>' +
      '<div class="lvc-jr__tags" aria-hidden="true">' + LABELS.map((l, i) => '<a tabindex="-1" href="./programs.html#' + SLUGS[i] + '" style="--i:' + i + '"><i></i>' + l + "</a>").join("") + "</div>" +
      '<div class="lvc-jr__nums" aria-hidden="true"><div><b>8</b><span>กลุ่มสาขาวิชา</span></div><div><b>3</b><span>ระดับการศึกษา</span></div></div>' +
      '<div class="lvc-jr__grain" aria-hidden="true"></div>' +
      '<div class="lvc-jr__veil" aria-hidden="true"></div>' +
      '<div class="lvc-jr__copy wrap">' + CH.map((c, i) => '<div class="lvc-jr__ch' + (c.final ? " lvc-jr__ch--final" : "") + '" data-i="' + i + '">' + c.html + "</div>").join("") + "</div>" +
      '<div class="lvc-jr__hud" aria-hidden="true"><span class="lvc-jr__count"><b>01</b> / 06</span><i class="lvc-jr__bar"><i></i></i></div>' +
    "</div>";
  story.insertAdjacentElement("afterend", s);
  return s;
}

/* ---------- 3) ภาพวิทยาลัย: กล้องฉายภาพ + โครงพื้น/ตึก/ฟ้า ---------- */
// กล้องที่ถ่ายภาพ (ประมาณจากเส้นขอบฟ้าของลาน y≈880/1024): สูง 1.6 เงยขึ้น 0.36 rad มุมมองแนวตั้ง 58°
const PROJ = { y: 1.6, pitch: 0.36, vfov: 58, aspect: 1536 / 1024 };
function rayDir(u, v) {
  const ty = Math.tan((PROJ.vfov * Math.PI) / 360), tx = ty * PROJ.aspect;
  const x = (u * 2 - 1) * tx, y = (v * 2 - 1) * ty, z = -1;
  const c = Math.cos(PROJ.pitch), s = Math.sin(PROJ.pitch);
  const y2 = y * c - z * s, z2 = y * s + z * c;
  const n = Math.hypot(x, y2, z2);
  return [x / n, y2 / n, z2 / n];
}
const along = (u, v, d) => { const r = rayDir(u, v); return [r[0] * d, PROJ.y + r[1] * d, r[2] * d]; };
// ระยะตามแนวลำแสงของผนังตึก (u ซ้าย→ขวา, v ล่าง→บน)
function wallDepth(u, v) {
  const left = lerp(15, 52, clamp(u / 0.46, 0, 1));
  const right = 62 - Math.max(0, 0.42 - v) * 38;
  const mid = 78;
  const kL = 1 - smooth(0.445, 0.47, u), kR = smooth(0.475, 0.5, u);
  return left * kL + right * kR + mid * (1 - kL - kR > 0 ? 1 - kL - kR : 0);
}
// ขอบตึก+ต้นไม้ (พิกเซลภาพ 1536×1024, y ลง) ส่วนที่เหลือคือฟ้า
const SILHOUETTE = [[0, 0], [92, 0], [722, 318], [724, 384], [692, 392], [692, 598], [768, 598], [756, 446], [984, 446], [980, 398], [1300, 352], [1460, 330], [1536, 296], [1536, 1024], [0, 1024]];

function makeMask(T) {
  const W = 384, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff"; g.beginPath();
  SILHOUETTE.forEach(([x, y], i) => (i ? g.lineTo(x / 4, y / 4) : g.moveTo(x / 4, y / 4)));
  g.closePath(); g.fill();
  const src = g.getImageData(0, 0, W, H);
  const a = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = src.data[i * 4] / 255;
  const blur = (inp, r) => {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += inp[y * W + xx]; n++; } } tmp[y * W + x] = s / n; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; n++; } } out[y * W + x] = s / n; }
    return out;
  };
  const sharp = blur(a, 1), wide = blur(blur(a, 5), 5);
  const out = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { out.data[i * 4] = sharp[i] * 255; out.data[i * 4 + 1] = wide[i] * 255; out.data[i * 4 + 3] = 255; }
  g.putImageData(out, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.flipY = true;
  tex.minFilter = T.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ตาข่ายตามลำแสงจากกล้องถ่ายภาพ: depthFn(u, v) → ระยะ · uv คือพิกัดภาพตรง ๆ
function rayGrid(T, u0, u1, v0, v1, nu, nv, depthFn) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = lerp(u0, u1, i / nu), v = lerp(v0, v1, j / nv);
    const k = j * (nu + 1) + i;
    pos.set(along(u, v, depthFn(u, v)), k * 3);
    uv.set([u, v], k * 2);
    if (i < nu && j < nv) idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);
  }
  const geo = new T.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
  return geo;
}

const PHOTO_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PHOTO_FRAG = /* glsl */ `
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform float uCut;       // 1 = ผนังตึก (ตัดส่วนฟ้าทิ้ง)
uniform float uGrade;     // 0 ภาพจริง → 1 แสงค่ำแบบหนัง
uniform float uWhite;     // ซีดเป็นงาช้าง (เปลี่ยนฉาก)
uniform float uTime;
uniform vec3 uFog;
varying vec2 vUv;
varying float vDist;
void main() {
  vec2 uv = clamp(vUv, vec2(0.001), vec2(0.999));
  vec2 m = texture2D(uMask, uv).rg;
  if (uCut > 0.5 && m.r < 0.5) discard;
  vec3 c = texture2D(uPhoto, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 sh = vec3(0.075, 0.018, 0.03), mi = vec3(0.46, 0.2, 0.17), hi = vec3(1.0, 0.86, 0.66);
  vec3 tone = l < 0.5 ? mix(sh, mi, l * 2.0) : mix(mi, hi, l * 2.0 - 1.0);
  vec3 g = mix(tone, mix(vec3(l), c, 0.45) * vec3(1.0, 0.86, 0.8), 0.3) * 0.7;
  // ฟ้า: มืดลง แสงอุ่นเรืองหลังช่องระหว่างตึก
  float sky = 1.0 - m.r;
  vec2 gp = (uv - vec2(0.52, 0.5)) * vec2(1.2, 1.7);
  float glow = exp(-dot(gp, gp) * 3.2);
  float shimmer = 0.9 + 0.1 * sin(uTime * 0.35 + uv.x * 9.0);
  vec3 skyCol = mix(vec3(0.03, 0.01, 0.018), vec3(1.0, 0.74, 0.5), glow * 0.85 * shimmer) + tone * 0.22;
  g = mix(g, skyCol, sky);
  // แสงขอบตึกด้านที่หันหาแสง
  float rim = clamp((1.0 - m.g) * m.r * 1.6, 0.0, 1.0);
  g += vec3(1.0, 0.78, 0.52) * rim * (0.08 + glow * 0.75);
  vec3 col = mix(c, g, uGrade);
  col = mix(col, uFog, smoothstep(30.0, 140.0, vDist) * 0.75 * uGrade);
  // นอกขอบภาพจริง: จางเป็นความมืดแทนพิกเซลขอบที่ยืดออก
  float inside = smoothstep(-0.07, 0.015, vUv.x) * smoothstep(1.07, 0.985, vUv.x) * smoothstep(-0.12, 0.0, vUv.y);
  col = mix(uFog * 0.6, col, mix(1.0, inside, uGrade));
  col = mix(col, vec3(0.953, 0.925, 0.878), uWhite);
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- 4) ฝุ่นแสง (จุด + เส้นยืดตามความเร็วกล้อง) ---------- */
const DUST_VERT = /* glsl */ `
attribute vec3 aSeed;
attribute float aEnd;
uniform float uTime;
uniform vec3 uVel;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.21 + aSeed.x * 6.28) * 0.6;
  p.y += sin(uTime * 0.17 + aSeed.y * 6.28) * 0.5 + mod(uTime * 0.15 * (0.3 + aSeed.z), 6.0) - 3.0;
  p -= uVel * aEnd * (0.6 + aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = (0.35 + 0.65 * aSeed.z) * (1.0 - aEnd * 0.85);
  gl_PointSize = uSize * (0.6 + aSeed.z) * 30.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uRound;
varying float vA;
void main() {
  float a = vA * uAlpha;
  if (uRound > 0.5) { vec2 d = gl_PointCoord - 0.5; a *= smoothstep(0.5, 0.0, length(d)); }
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a, a);
}`;

/* ---------- 5) ประติมากรรม LVC (สร้างด้วยโค้ด) ---------- */
function buildSculpture(T, K) {
  const g = new T.Group();
  const H = 1.6, D = 0.34;
  const opts = { depth: D, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 40 };
  const shapeL = new T.Shape([[0, 0], [1.05, 0], [1.05, 0.36], [0.38, 0.36], [0.38, H], [0, H]].map(([x, y]) => new T.Vector2(x, y)));
  const shapeV = new T.Shape([[0, H], [0.4, H], [0.63, 0.46], [0.86, H], [1.26, H], [0.82, 0], [0.44, 0]].map(([x, y]) => new T.Vector2(x, y)));
  const shapeC = new T.Shape();
  const R = 0.8, r = 0.44, a0 = 0.72;
  shapeC.absarc(R, R, R, a0, Math.PI * 2 - a0, false);
  shapeC.absarc(R, R, r, Math.PI * 2 - a0 - 0.08, a0 + 0.08, true);
  shapeC.closePath();
  const mats = [K.M.red, K.M.porcelain];
  const letters = [[shapeL, -2.21], [shapeV, -0.84], [shapeC, 0.62]].map(([sh, x]) => {
    const geo = new T.ExtrudeGeometry(sh, opts);
    geo.translate(0, 0, -D / 2);
    const m = new T.Mesh(geo, mats);
    const holder = new T.Group();
    geo.computeBoundingBox();
    const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
    geo.translate(-cx, -H / 2, 0);
    holder.position.set(x + cx, 0.24 + H / 2, 0);
    holder.userData.x0 = x + cx;
    holder.add(m);
    g.add(holder);
    return holder;
  });
  const base = new T.Group();
  base.add(K.mesh(K.rbox(4.6, 0.16, 1.15, 0.04), K.M.porcelain, 0, 0.08, 0));
  base.add(K.mesh(K.rbox(4.66, 0.07, 1.2, 0.02), K.M.red, 0, 0.19, 0));
  base.add(K.mesh(K.rbox(4.5, 0.012, 1.06, 0.004), K.M.gold, 0, 0.228, 0));
  g.add(base);
  const shadow = K.shadow(6, 2.2, 0.002, 0.8);
  g.add(shadow);
  g.userData = { letters, base, shadow };
  return g;
}

// ตัวหนังสือยักษ์บนแคนวาส (รองรับภาษาไทย) → ซ้อนเป็นชั้นให้ดูเป็นตัวนูนสามมิติ
function textCanvas(text, w, h, font, fill) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  let size = h * 0.78;
  x.font = font.replace("{s}", size);
  const mw = x.measureText(text).width;
  if (mw > w * 0.94) { size *= (w * 0.94) / mw; x.font = font.replace("{s}", size); }
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = fill(x, h);
  x.fillText(text, w / 2, h * 0.54);
  return c;
}
function layeredText(T, text, width, depth, slices) {
  const font = '600 {s}px "Noto Serif Thai", "IBM Plex Sans Thai", serif';
  const front = textCanvas(text, 2048, 512, font, (x, h) => { const gr = x.createLinearGradient(0, h * 0.15, 0, h * 0.9); gr.addColorStop(0, "#fffaf0"); gr.addColorStop(0.55, "#eedfc4"); gr.addColorStop(1, "#c9a46a"); return gr; });
  const back = textCanvas(text, 2048, 512, font, () => "#ffffff");
  const tf = new T.CanvasTexture(front), tb = new T.CanvasTexture(back);
  tf.colorSpace = T.SRGBColorSpace;
  tf.anisotropy = tb.anisotropy = 4;
  const geo = new T.PlaneGeometry(width, width / 4);
  const g = new T.Group();
  for (let i = slices - 1; i >= 0; i--) {
    const k = i / (slices - 1);
    const mat = i === 0
      ? new T.MeshBasicMaterial({ map: tf, alphaTest: 0.45, toneMapped: false })
      : new T.MeshBasicMaterial({ alphaMap: tb, color: new T.Color().setRGB(lerp(0.42, 0.06, k), lerp(0.2, 0.02, k), lerp(0.16, 0.03, k)), alphaTest: 0.45, toneMapped: false });
    const m = new T.Mesh(geo, mat);
    m.position.z = -k * depth;
    g.add(m);
  }
  return g;
}

/* ---------- 6) ห้องมืด: พื้น แท่น ช่องแสง ลำแสงสปอตไลต์ ---------- */
const CONE_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  vY = uv.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CONE_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float a = f * smoothstep(0.0, 0.85, vY) * 0.22 * uAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * a, a);
}`;
function gradientTex(T, stops, w = 8, h = 256, radial = false) {
  const c = document.createElement("canvas");
  c.width = radial ? 256 : w; c.height = h;
  const x = c.getContext("2d");
  const gr = radial ? x.createRadialGradient(128, 128, 0, 128, 128, 128) : x.createLinearGradient(0, h, 0, 0);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  x.fillStyle = gr;
  x.fillRect(0, 0, c.width, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function buildRoom(T, K) {
  const g = new T.Group();
  const floor = new T.Mesh(new T.CircleGeometry(40, 96), new T.MeshStandardMaterial({ color: 0x0c090a, roughness: 0.32, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  g.add(floor);
  const pool = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshBasicMaterial({ map: gradientTex(T, [[0, "rgba(255,226,180,.55)"], [0.35, "rgba(214,150,110,.18)"], [1, "rgba(0,0,0,0)"]], 8, 256, true), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -1.19;
  g.add(pool);
  const ped = new T.Group();
  ped.add(K.mesh(new T.CylinderGeometry(2.45, 2.55, 1.2, 128), K.M.porcelain, 0, -0.6, 0));
  const ring = K.mesh(new T.TorusGeometry(2.45, 0.025, 10, 160), K.M.gold, 0, 0, 0);
  ring.rotation.x = Math.PI / 2;
  ped.add(ring);
  const band = K.mesh(new T.CylinderGeometry(2.56, 2.56, 0.06, 128, 1, true), K.M.red, 0, -1.05, 0);
  ped.add(band);
  g.add(ped);
  // ช่องแสงผนังหลัง
  const slitTex = gradientTex(T, [[0, "rgba(255,220,170,0)"], [0.3, "rgba(255,226,180,.9)"], [0.75, "rgba(255,236,206,.7)"], [1, "rgba(255,220,170,0)"]]);
  const slitMat = new T.MeshBasicMaterial({ map: slitTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
  [-7.5, -5.2, -3.4, 3.4, 5.2, 7.5].forEach((x, i) => {
    const m = new T.Mesh(new T.PlaneGeometry(i % 3 === 1 ? 0.5 : 0.18, 11), slitMat);
    m.position.set(x, 4.2, -11 - Math.abs(x) * 0.15);
    g.add(m);
  });
  const wall = new T.Mesh(new T.PlaneGeometry(60, 30), new T.MeshStandardMaterial({ color: 0x120d0f, roughness: 0.9 }));
  wall.position.set(0, 8, -12.5);
  g.add(wall);
  // ลำแสงสปอตไลต์ (ปลอมแบบ volumetric)
  const coneU = { uAlpha: { value: 1 } };
  const cone = new T.Mesh(new T.CylinderGeometry(0.35, 3.1, 10, 72, 1, true), new T.ShaderMaterial({ vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, uniforms: coneU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  cone.position.y = 4.6;
  g.add(cone);
  const spot = new T.SpotLight(0xfff0da, 420, 24, 0.42, 0.65, 1.4);
  spot.position.set(0, 10, 0.6);
  spot.target.position.set(0, 0, 0);
  g.add(spot, spot.target);
  const fill = new T.PointLight(0xffc9a0, 12, 18, 1.6);
  fill.position.set(-5, 2, 6);
  g.add(fill);
  g.userData = { coneU, ped };
  return g;
}

/* ---------- 7) ตัวหลัก ---------- */
class Journey {
  constructor(section, ST) {
    this.s = section;
    this.ST = ST;
    this.stage = section.querySelector(".lvc-jr__stage");
    this.glBox = section.querySelector(".lvc-jr__gl");
    this.chs = Array.from(section.querySelectorAll(".lvc-jr__ch"));
    this.tags = Array.from(section.querySelectorAll(".lvc-jr__tags a"));
    this.svg = section.querySelector(".lvc-jr__lines");
    this.svg.innerHTML = SLUGS.map(() => "<line/><circle r=\"3\"/>").join("");
    this.lines = Array.from(this.svg.querySelectorAll("line"));
    this.dots = Array.from(this.svg.querySelectorAll("circle"));
    this.p = 0; this.target = 0; this.time = 0; this.quality = 2;
    this.frames = 0; this.frameSum = 0; this.lastActive = -1;
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.prevCam = null;
    this.setupHeader();
    this.pin();
    this.applyDom(0);
    this.near = new IntersectionObserver((e) => { this.visible = e[e.length - 1].isIntersecting; if (this.visible) this.build(); this.loop(); }, { rootMargin: "120% 0px" });
    this.far = new IntersectionObserver((e) => { if (!e[e.length - 1].isIntersecting) this.teardown(); }, { rootMargin: "250% 0px" });
    this.near.observe(section);
    this.far.observe(section);
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      this.mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
      this.mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => this.loop());
    // แป้นพิมพ์: โฟกัสลิงก์ในบทที่ยังไม่แสดง → เลื่อนไปที่บทนั้นก่อน
    section.querySelector(".lvc-jr__copy").addEventListener("focusin", (e) => {
      const ch = e.target.closest(".lvc-jr__ch");
      if (!ch || !this.trigger || ch.classList.contains("is-on")) return;
      const c = CH[+ch.dataset.i];
      const tr = this.trigger;
      window.scrollTo({ top: tr.start + (tr.end - tr.start) * Math.min(1, (c.at[0] + c.at[1]) / 2), behavior: "instant" });
    });
  }

  length() { return innerHeight * (innerWidth < 761 ? 6.2 : 7.2); }

  /* v13.1 (A4): ฉากตรึงเต็มจอเริ่มที่ขอบบน แต่แถบเมนู (sticky, z 40) ทับอยู่
   * ระหว่างตรึงฉาก: เลื่อนลง → แถบหลบขึ้น · เลื่อนขึ้น / ออกจากฉาก / โฟกัสเข้าเมนู → กลับมา (~0.35 วิ) */
  setupHeader() {
    const hdr = document.querySelector(".site-header");
    this.hdr = hdr;
    this.hdrHidden = false;
    this.hdrAcc = 0;
    this.lastY = window.scrollY;
    this.hdrUntil = 0;
    this.tagSize = null;
    if (!hdr) { this.hdrH = 0; this.clearTop = 12; return; }
    document.documentElement.classList.add("lvc-jr-hdr");
    const measure = () => { this.hdrH = hdr.getBoundingClientRect().height; this.tagSize = null; };
    measure();
    this.clearTop = this.hdrH + 12;
    window.addEventListener("resize", measure, { passive: true });
    hdr.addEventListener("focusin", () => this.setHeader(false));
  }

  setHeader(hide) {
    if (!this.hdr) return;
    if (hide && this.hdr.contains(document.activeElement)) hide = false;
    if (hide === this.hdrHidden) return;
    this.hdrHidden = hide;
    document.documentElement.classList.toggle("lvc-hdr-hide", hide);
    this.hdrUntil = performance.now() + 450;   // ให้ป้ายชี้ขยับตามแถบจนแถบเลื่อนเสร็จ
    this.loop();
  }

  headerOnScroll(active) {
    const y = window.scrollY, dy = y - this.lastY;
    this.lastY = y;
    if (!active) { this.hdrAcc = 0; this.setHeader(false); return; }
    this.hdrAcc = dy > 0 ? Math.max(0, this.hdrAcc) + dy : dy < 0 ? Math.min(0, this.hdrAcc) + dy : this.hdrAcc;
    if (this.hdrAcc > 12) this.setHeader(true);
    else if (this.hdrAcc < -12) this.setHeader(false);
  }

  pin() {
    this.trigger = this.ST.create({
      trigger: this.s, start: "top top", end: () => "+=" + this.length(), pin: this.stage, pinSpacing: true,
      anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: -1,
      onToggle: (self) => this.headerOnScroll(self.isActive),
      onUpdate: (self) => {
        this.headerOnScroll(self.isActive);
        this.target = self.progress;
        // ยังไม่มี/ไม่มี WebGL: ข้อความและภาพนิ่งตามการเลื่อนทันที
        if (!this.built) { this.p = this.target; this.applyDom(this.p); }
        this.loop();
      }
    });
    requestAnimationFrame(() => this.ST.refresh());
  }

  async build() {
    if (this.built || this.building || this.failed) return;
    this.building = true;
    let T, O;
    try {
      const objScript = document.querySelector('script[src*="lvc-objects.js"]');
      [T, O] = await Promise.all([import(THREE_URL), objScript ? import(objScript.src).catch(() => null) : null]);
    } catch (_) { this.failed = true; this.building = false; return; }
    let renderer;
    if (!hasWebGL()) { this.failed = true; this.building = false; this.s.classList.add("no-gl"); return; }
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (_) { this.failed = true; this.building = false; return; }
    try { await Promise.race([document.fonts && document.fonts.load('600 120px "Noto Serif Thai"', "ลงมือทำ"), new Promise((r) => setTimeout(r, 1500))]); } catch (_) {}
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping;
    this.dpr = Math.min(window.devicePixelRatio || 1, innerWidth < 761 ? 1.5 : 2);
    renderer.setPixelRatio(this.dpr);
    renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.teardown(true); });
    this.glBox.appendChild(renderer.domElement);
    this.T = T; this.renderer = renderer;
    const K = (this.K = O && O.createLab ? O.createLab(T, renderer) : null);
    if (!K) { this.failed = true; this.building = false; renderer.dispose(); renderer.domElement.remove(); return; }
    const scene = (this.scene = new T.Scene());
    scene.environment = K.env;
    this.key = new T.DirectionalLight(0xfff1e2, 1.4);
    this.key.position.set(-4, 6, 5);
    scene.add(this.key);
    this.camera = new T.PerspectiveCamera(PROJ.vfov, 1, 0.1, 600);

    // ภาพวิทยาลัย
    const photo = new T.TextureLoader().load(PHOTO, () => this.dirty = true);
    photo.colorSpace = T.NoColorSpace;
    photo.anisotropy = 8;
    const mask = makeMask(T);
    this.pu = { uPhoto: { value: photo }, uMask: { value: mask }, uCut: { value: 0 }, uGrade: { value: 1 }, uWhite: { value: 0 }, uTime: { value: 0 }, uFog: { value: new T.Color().setRGB(0.05, 0.016, 0.024, T.LinearSRGBColorSpace) } };
    const mk = (cut) => new T.ShaderMaterial({ vertexShader: PHOTO_VERT, fragmentShader: PHOTO_FRAG, uniforms: { ...this.pu, uCut: { value: cut } } });
    const world = (this.world = new T.Group());
    world.add(new T.Mesh(rayGrid(T, -0.35, 1.35, -0.1, 1.45, 40, 40, () => 260), mk(0)));
    const groundD = (u, v) => { const r = rayDir(u, v); return r[1] < -0.004 ? Math.min(95, PROJ.y / -r[1]) : 95; };
    world.add(new T.Mesh(rayGrid(T, -0.45, 1.45, -0.25, 0.15, 150, 60, groundD), mk(0)));
    world.add(new T.Mesh(rayGrid(T, -0.32, 1.32, 0.14, 1.04, 200, 140, wallDepth), mk(1)));
    // ตัวอักษรยักษ์หลังตึก (ระหว่างตึกกับฟ้า)
    const word = new T.CanvasTexture(textCanvas("VOCATIONAL", 2048, 400, '600 {s}px "Noto Serif Thai", Georgia, serif', (x, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#fff3dc"); gr.addColorStop(1, "#d8b27a"); return gr; }));
    word.colorSpace = T.SRGBColorSpace;
    this.wordMat = new T.MeshBasicMaterial({ map: word, transparent: true, depthWrite: false, toneMapped: false, opacity: 1 });
    // จอแนวตั้งเห็นภาพแค่ช่วงกลาง → ตัวอักษรเล็กลงและอยู่กลาง
    const tall = this.stage.clientWidth / Math.max(1, this.stage.clientHeight) < 1;
    this.wordUV = tall ? [0.5, 0.78] : [0.62, 0.735];
    const wordMesh = new T.Mesh(tall ? new T.PlaneGeometry(52, 10.15) : new T.PlaneGeometry(104, 20.3), this.wordMat);
    const wc = along(this.wordUV[0], this.wordUV[1], 118);
    wordMesh.position.set(wc[0], wc[1], wc[2]);
    wordMesh.rotation.x = PROJ.pitch;
    wordMesh.renderOrder = 1;
    this.wordMesh = wordMesh;
    world.add(wordMesh);
    // ฝุ่นแสง
    const N = innerWidth < 761 ? 600 : 1100;
    const dp = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const x = lerp(-14, 22, rnd()), y = lerp(0.4, 18, rnd() * rnd()), z = lerp(-58, 2, rnd());
      const sd = [rnd(), rnd(), rnd()];
      for (let e = 0; e < 2; e++) { dp.set([x, y, z], (i * 2 + e) * 3); seed.set(sd, (i * 2 + e) * 3); end[i * 2 + e] = e; }
    }
    const dg = new T.BufferGeometry();
    dg.setAttribute("position", new T.BufferAttribute(dp, 3));
    dg.setAttribute("aSeed", new T.BufferAttribute(seed, 3));
    dg.setAttribute("aEnd", new T.BufferAttribute(end, 1));
    this.du = { uTime: { value: 0 }, uVel: { value: new T.Vector3() }, uSize: { value: 2.2 }, uAlpha: { value: 1 }, uRound: { value: 0 } };
    const dmat = (round) => new T.ShaderMaterial({ vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: { ...this.du, uRound: { value: round } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(dp.filter((_, k) => Math.floor(k / 3) % 2 === 0), 3));
    pg.setAttribute("aSeed", new T.BufferAttribute(seed.filter((_, k) => Math.floor(k / 3) % 2 === 0), 3));
    pg.setAttribute("aEnd", new T.BufferAttribute(new Float32Array(N), 1));
    world.add(new T.LineSegments(dg, dmat(0)), new T.Points(pg, dmat(1)));
    scene.add(world);

    // โมเดล 8 กลุ่มสาขาลอยเหนือลาน
    this.objs = new T.Group();
    const spots = [[-4.6, 4.6, -17], [-1.0, 9.4, -24], [2.0, 4.9, -16.5], [5.4, 10.2, -26], [8.0, 5.4, -19.5], [11.4, 9.8, -28], [-6.8, 9.6, -26], [13.2, 4.6, -22]];
    this.items = SLUGS.map((slug, i) => {
      const m = O.buildModel(K, slug);
      const h = new T.Group();
      h.position.set(...spots[i]);
      h.userData = { base: spots[i].slice(), k: m.scale.x * (innerWidth < 761 ? 1.0 : 1.5), m, ph: i * 1.7 };
      h.add(m);
      this.objs.add(h);
      return h;
    });
    scene.add(this.objs);

    // สตูดิโอ: ประติมากรรม + ห้องมืด + ตัวหนังสือยักษ์ (อยู่ห่างจากฉากภาพเพื่อไม่ให้ซ้อนกัน)
    this.studio = new T.Group();
    this.studio.position.set(0, 0, 400);
    this.sculpt = buildSculpture(T, K);
    this.room = buildRoom(T, K);
    this.big = layeredText(T, "ลงมือทำ", 13.5, 1.1, innerWidth < 761 ? 12 : 22);
    this.big.position.set(0, 3.35, -6.2);
    this.studio.add(this.sculpt, this.room, this.big);
    scene.add(this.studio);

    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.dirty = true; this.loop(); });
    this.ro.observe(this.stage);
    this.built = true;
    this.building = false;
    this.s.classList.add("is-gl");
    this.dirty = true;
    this.loop();
  }

  resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.stage.clientWidth), h = Math.max(1, this.stage.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.W = w; this.H = h;
  }

  loop() {
    const want = this.built && this.visible && !document.hidden;
    if (want && !this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); }
  }

  tick(now) {
    this.raf = 0;
    if (!this.built || !this.visible || document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const prev = this.p;
    // กระโดดไกล (เมนู/ลิงก์ #ส่วน/โฟกัสด้วยแป้นพิมพ์) → ไปถึงทันที ไม่บินผ่านทั้งเส้นทาง
    if (Math.abs(this.target - this.p) > 0.22) this.p = this.target;
    this.p += (this.target - this.p) * (1 - Math.exp(-dt * 7));
    if (Math.abs(this.target - this.p) < 0.00005) this.p = this.target;
    const moving = Math.abs(this.p - prev) > 0.000005 || this.dirty;
    const idle = this.quality > 0 && !LITE && !motionQ.matches;
    const onScreen = !!(this.trigger && this.trigger.isActive);
    if (idle) { this.time += dt; this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.05; this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.05; }
    if (moving || (idle && onScreen)) {
      this.dirty = false;
      this.frame(this.p, dt);
      this.renderer.render(this.scene, this.camera);
      this.watch(dt);
    }
    const hdrAnim = now < this.hdrUntil;
    const clearT = (this.hdrHidden ? 0 : this.hdrH) + 12;
    // dt อาจติดลบเมื่อเวลาเฟรมของ rAF มาก่อน performance.now() ที่ loop() จดไว้ → ห้ามใช้ค่าลบ
    this.clearTop += (clearT - this.clearTop) * (1 - Math.exp(-Math.max(0, dt) * 12));
    if (!Number.isFinite(this.clearTop)) this.clearTop = clearT;
    this.applyDom(this.p);
    if (moving || idle || hdrAnim) this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  watch(dt) {
    this.frames++; this.frameSum += dt;
    if (this.frames < 90) return;
    const avg = (this.frameSum / this.frames) * 1000;
    this.frames = 0; this.frameSum = 0;
    if (avg > 30 && this.quality === 2) { this.quality = 1; this.renderer.setPixelRatio(1); this.resize(); }
    else if (avg > 48 && this.quality === 1) this.quality = 0;
  }

  /* กล้องและวัตถุตามเวลา t */
  frame(t, dt) {
    const T = this.T, cam = this.camera;
    const narrow = this.W < 761;
    const mx = this.mouse.x, my = this.mouse.y;
    const look = new T.Vector3();
    const pos = new T.Vector3();
    const photoOn = t < 0.566;
    // ม่านเปลี่ยนฉาก: ดำ (บินเข้าป้าย / เข้าห้องมืด) · งาช้าง (ก่อนประติมากรรม) — ซ่อนจังหวะตัดกล้อง
    this.veil = Math.max(band(0.285, 0.31, 0.33, 0.36, t), band(0.695, 0.715, 0.725, 0.75, t) * 0.95);
    this.veilWhite = band(0.52, 0.555, 0.567, 0.6, t);
    this.world.visible = photoOn;
    this.objs.visible = t > 0.33 && t < 0.57;
    this.studio.visible = t > 0.53;
    this.pu.uTime.value = this.time;
    this.du.uTime.value = this.time;

    if (photoOn) {
      // จอกว้างกว่าภาพ (3:2): ลดมุมแนวตั้งให้ภาพเต็มความกว้าง (ตัดบน-ล่างแทนขอบข้าง)
      const asp = this.camera.aspect;
      cam.fov = asp > PROJ.aspect ? (2 * Math.atan(Math.tan((PROJ.vfov * Math.PI) / 360) * PROJ.aspect / asp) * 180) / Math.PI : PROJ.vfov;
      const P0 = [0, PROJ.y, 0];
      const sign = along(0.82, 0.6, 60);
      const keys = [
        [0, P0, along(0.5, 0.5, 60)],
        [0.12, [0.4, 2.3, -6.5], along(0.56, 0.56, 60)],
        [0.24, [2.6, 4.6, -19], along(0.7, 0.58, 62)],
        [0.305, [5.6, 7.6, -33], sign],
        [0.33, [-1.4, 3.0, -4], [5, 8.4, -40]],
        [0.56, [1.6, 3.6, -9.5], [3.4, 9.2, -40]]
      ];
      let a = keys[0], b = keys[1];
      for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0]) { a = keys[i]; b = keys[i + 1]; }
      const k = t >= 0.305 && t < 0.33 ? 1 : ease(unit(a[0], b[0], t));
      pos.set(lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k));
      look.set(lerp(a[2][0], b[2][0], k), lerp(a[2][1], b[2][1], k), lerp(a[2][2], b[2][2], k));
      if (t >= 0.305 && t < 0.33) { pos.set(...keys[3][1]); look.set(...keys[3][2]); }
      pos.x += mx * 0.25; pos.y -= my * 0.15;
      this.pu.uWhite.value = smooth(0.5, 0.55, t);
      this.wordMat.opacity = 1 - smooth(0.1, 0.2, t);
      this.wordMesh.position.y = along(this.wordUV[0], this.wordUV[1], 118)[1] + smooth(0.0, 0.2, t) * 6;
      // ความเร็วกล้อง → ฝุ่นยืดเป็นเส้น
      if (this.prevCam) {
        const v = pos.clone().sub(this.prevCam).multiplyScalar(dt > 0.001 ? 0.09 / dt : 0);
        this.du.uVel.value.lerp(v, 0.3);
      }
      this.prevCam = pos.clone();
      this.du.uAlpha.value = 0.55 + 0.45 * band(0.08, 0.16, 0.5, 0.55, t);
      // โมเดลลอย
      const appear = (i) => smooth(0.34 + i * 0.012, 0.4 + i * 0.012, t) * (1 - smooth(0.505, 0.545, t));
      this.items.forEach((h, i) => {
        const u = h.userData, e = appear(i);
        const fly = smooth(0.5, 0.55, t);
        h.position.set(u.base[0], u.base[1] + Math.sin(this.time * 0.9 + u.ph) * 0.35 + fly * 6, u.base[2]);
        u.m.scale.setScalar(Math.max(0.0001, u.k * (e < 1 ? 1 - Math.pow(1 - e, 3) : 1)));
        u.m.rotation.y = this.time * 0.35 + u.ph + t * 6;
        u.m.rotation.x = 0.12 * Math.sin(this.time * 0.6 + u.ph);
        if (u.m.userData.update && e > 0.01) u.m.userData.update(this.time + u.ph);
      });
      cam.position.copy(pos);
      cam.lookAt(look);
      cam.updateProjectionMatrix();
      this.renderer.toneMappingExposure = 1.0;
      this.scene.environmentIntensity = 0.9;
      this.key.intensity = 1.6;
    }

    if (this.studio.visible) {
      const S = this.sculpt, L = S.userData.letters, room = this.room;
      const fitK = Math.max(1, 0.86 / Math.max(0.4, this.camera.aspect));
      const dark = smooth(0.705, 0.745, t);
      room.visible = t > 0.7;
      this.big.visible = t > 0.84;
      // ท่าประติมากรรม
      const enter = smooth(0.545, 0.6, t);
      const explode = band(0.645, 0.68, 0.705, 0.73, t);
      const land = smooth(0.73, 0.79, t);
      S.rotation.y = lerp(-1.5, -0.32, enter) + smooth(0.6, 0.66, t) * 0.55 - land * 0.33 + smooth(0.8, 0.9, t) * 0.1 - smooth(0.9, 0.98, t) * 0.1 + (this.time ? Math.sin(this.time * 0.3) * 0.04 : 0);
      S.position.set(0, lerp(-0.4, 0, enter) + (1 - land) * 0.0, 0);
      L[0].position.x = L[0].userData.x0 - explode * 0.9; L[0].position.z = explode * 0.7;
      L[1].position.y = 1.04 + explode * 0.45; L[1].rotation.y = explode * 0.35;
      L[2].position.x = L[2].userData.x0 + explode * 0.9; L[2].position.z = -explode * 0.7;
      L[0].rotation.y = -explode * 0.3; L[2].rotation.y = explode * 0.3;
      S.userData.base.position.y = -explode * 0.35;
      S.userData.shadow.material.opacity = (1 - dark) * 0.75;
      // กล้องสตูดิโอ
      const c0 = [0, 0.9, 10.5], c1 = [0.7, 1.2, 7.6], c2 = [0, 1.4, 11.6], c3 = [0, 3.8, 12.8], c4 = [0, 2.3, 10.4], c5 = [0, 1.15, 12.4];
      const l0 = [0, 0.5, 0], l1 = [-0.2, 0.7, 0], l2 = [0, 0.55, 0], l3 = [0, 0.7, 0], l4 = [0, 0.75, 0], l5 = [0, 1.9, -1];
      const seg = [[0.53, c0, l0], [0.6, c0, l0], [0.66, c1, l1], [0.72, c2, l2], [0.75, c3, l3], [0.86, c4, l4], [1.0, c5, l5]];
      let A = seg[0], B = seg[1];
      for (let i = 0; i < seg.length - 1; i++) if (t >= seg[i][0]) { A = seg[i]; B = seg[i + 1]; }
      const k = ease(unit(A[0], B[0], t));
      const off = this.studio.position;
      pos.set(lerp(A[1][0], B[1][0], k) * fitK + mx * 0.3, lerp(A[1][1], B[1][1], k) - my * 0.15, lerp(A[1][2], B[1][2], k) * fitK).add(off);
      look.set(lerp(A[2][0], B[2][0], k), lerp(A[2][1], B[2][1], k), lerp(A[2][2], B[2][2], k)).add(off);
      if (!photoOn) {
        cam.fov = 32;
        cam.position.copy(pos);
        cam.lookAt(look);
        cam.updateProjectionMatrix();
        this.scene.environmentIntensity = lerp(1.05, 0.22, dark);
        this.key.intensity = lerp(1.5, 0.25, dark);
        this.renderer.toneMappingExposure = lerp(1.05, 1.15, dark);
      }
      room.userData.coneU.uAlpha.value = smooth(0.74, 0.8, t) * (0.85 + 0.15 * Math.sin(this.time * 1.3));
      // ตัวหนังสือยักษ์ขึ้นหลังแท่น
      const rise = smooth(0.85, 0.93, t);
      this.big.position.y = lerp(-3.4, 3.35, rise);
      // จอแคบ: ย่อตัวหนังสือยักษ์ให้พอดีความกว้างที่เห็น
      if (!photoOn) {
        const bw = this.big.getWorldPosition(new T.Vector3());
        const visW = 2 * cam.position.distanceTo(bw) * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
        this.big.scale.setScalar(Math.min(1, (visW * 0.9) / 13.5));
      }
      this.big.rotation.x = lerp(0.25, 0, rise);
      this.bgDark = dark;
    } else this.bgDark = 0;
  }

  /* DOM: บท ตัวเลข ป้ายชี้ พื้นหลัง */
  applyDom(t) {
    const s = this.s;
    let active = -1;
    CH.forEach((c, i) => { if (t >= c.at[0] - 0.005 && t <= c.at[1]) active = i; });
    if (active !== this.lastActive) {
      this.chs.forEach((el, i) => el.classList.toggle("is-on", i === active));
      this.lastActive = active;
      const shown = active >= 0 ? active : CH.findIndex((c) => t < c.at[0]) - 1;
      s.querySelector(".lvc-jr__count b").textContent = String(Math.max(0, shown) + 1).padStart(2, "0");
    }
    const st = s.style;
    st.setProperty("--jr-p", t.toFixed(4));
    const ivory = band(0.535, 0.56, 0.7, 0.735, t);
    st.setProperty("--jr-ivory", ivory.toFixed(3));
    st.setProperty("--jr-type", band(0.56, 0.6, 0.69, 0.715, t).toFixed(3));
    st.setProperty("--jr-nums", band(0.6, 0.625, 0.645, 0.665, t).toFixed(3));
    st.setProperty("--jr-veil", (this.veil || 0).toFixed(3));
    st.setProperty("--jr-white", (this.veilWhite || 0).toFixed(3) );
    s.classList.toggle("is-light", ivory > 0.5);
    // ไม่มี WebGL: ใช้ภาพนิ่งเป็นฉาก (ซ่อนเมื่อ WebGL พร้อม)
    st.setProperty("--jr-poster", this.built ? 0 : 1 - smooth(0.52, 0.56, t));
    // ป้ายชี้โมเดล
    const tagsOn = this.built && t > 0.36 && t < 0.53;
    s.classList.toggle("tags-on", tagsOn);
    if (tagsOn && this.camera) {
      const v = new this.T.Vector3();
      const narrow = this.W < 761;
      // พื้นที่ที่มองเห็นจริง: ใต้แถบเมนู (ถ้าแถบโผล่) ถึงขอบล่าง เว้นขอบ 8 px
      if (!this.tagSize) this.tagSize = this.tags.map((a) => [a.offsetWidth, a.offsetHeight]);
      // ฉากสูง 100lvh: ตอนแถบเบราว์เซอร์ขยาย ส่วนล่างของฉากอยู่ใต้แถบ → ใช้ความสูงที่มองเห็นจริง
      const visH = Math.min(this.H, window.innerHeight || this.H);
      const minX = 8, maxX = this.W - 8, minY = this.clearTop, maxY = visH - 8;
      this.items.forEach((h, i) => {
        const a = smooth(0.365 + i * 0.012, 0.41 + i * 0.012, t) * (1 - smooth(0.49, 0.52, t));
        h.getWorldPosition(v);
        v.y += h.userData.k * (i % 2 ? -0.7 : 0.9);
        v.project(this.camera);
        const x = (v.x * 0.5 + 0.5) * this.W, y = (-v.y * 0.5 + 0.5) * this.H;
        const side = x > this.W * 0.55 ? 1 : -1;
        const up = i % 2 ? 1 : -1;
        let tx = x + side * (narrow ? 22 : 64), ty = y + up * (narrow ? 30 : 50);
        const [tw, th] = this.tagSize[i];
        tx = side > 0 ? clamp(tx, minX, maxX - tw) : clamp(tx, minX + tw, maxX);
        ty = clamp(ty, minY + th / 2, maxY - th / 2);
        // จุดของโมเดลอยู่นอกพื้นที่ (ใต้แถบเมนู/นอกจอ) → ป้ายจางหาย
        const inView = smooth(minY - 6, minY + 26, y) * smooth(-10, 24, x) * smooth(this.W + 10, this.W - 24, x) * smooth(visH + 10, visH - 20, y);
        const av = a * inView;
        const tag = this.tags[i];
        const vis = v.z < 1 && av > 0.02;
        tag.style.opacity = vis ? av : 0;
        tag.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) translate(" + (side > 0 ? "0" : "-100%") + ",-50%)";
        tag.style.pointerEvents = vis && av > 0.6 ? "auto" : "none";
        const ln = this.lines[i], dot = this.dots[i];
        ln.setAttribute("x1", x.toFixed(1)); ln.setAttribute("y1", y.toFixed(1));
        ln.setAttribute("x2", tx.toFixed(1)); ln.setAttribute("y2", ty.toFixed(1));
        ln.style.opacity = vis ? av * 0.8 : 0;
        dot.setAttribute("cx", x.toFixed(1)); dot.setAttribute("cy", y.toFixed(1));
        dot.style.opacity = vis ? av : 0;
      });
    }
  }

  teardown(lost) {
    if (!this.renderer) return;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.ro) this.ro.disconnect();
    const seen = new Set();
    this.scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach((m) => {
        if (seen.has(m)) return;
        seen.add(m);
        ["map", "alphaMap"].forEach((k) => m[k] && m[k].dispose());
        if (m.uniforms) Object.values(m.uniforms).forEach((u) => u.value && u.value.isTexture && u.value.dispose());
        m.dispose();
      });
    });
    this.K.dispose();
    this.renderer.dispose();
    if (!lost) this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.renderer = this.scene = this.K = null;
    this.built = false;
    this.s.classList.remove("is-gl");
  }
}

/* ---------- 8) โหมดนิ่ง (Reduced Motion): ไม่ตรึงจอ อ่านได้ทุกบท ---------- */
function staticMode(section) {
  section.classList.add("is-static");
  section.querySelectorAll(".lvc-jr__ch").forEach((c) => c.classList.add("is-on"));
}

/* ---------- 9) เริ่มทำงาน ---------- */
function boot() {
  const L = window.__LVC;
  const story = document.querySelector("#app .story");
  if (!story || document.querySelector(".lvc-jr, .lvc-show")) return false;
  const section = buildSection(story);
  let J = null;
  const canPin = L && L.ScrollTrigger && !motionQ.matches;
  if (!canPin) staticMode(section);
  else J = new Journey(section, L.ScrollTrigger);
  window.__LVC_SHOWCASE = { get trigger() { return J && J.trigger; }, journey: J, version: VERSION };
  window.__LVC_JOURNEY = J;
  motionQ.addEventListener && motionQ.addEventListener("change", (e) => {
    if (!e.matches || !J) return;
    J.setHeader(false);
    document.documentElement.classList.remove("lvc-jr-hdr");
    J.trigger.kill(true);
    J.teardown();
    J.near.disconnect(); J.far.disconnect();
    staticMode(section);
    window.__LVC.ScrollTrigger.refresh();
  });
  return true;
}

function start() {
  if (boot()) return;
  const app = document.getElementById("app");
  if (!app) return;
  const mo = new MutationObserver(() => { if (window.__LVC && document.querySelector("#app .story") && boot()) mo.disconnect(); });
  mo.observe(app, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 20000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
