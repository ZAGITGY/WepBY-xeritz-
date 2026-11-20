/* ============================================================================
 * loy3d.js — แม่น้ำ 3D + แต่งกระทง (โหลดเมื่อเลื่อนใกล้ section #loy เท่านั้น · three.js r180 ใน vendor/three)
 *
 * ฉาก: ภาพวิทยาลัยกลางคืน (มือถือใช้ @1x) เป็นฉากหลัง ครึ่งล่างเป็นผิวน้ำ: เงาสะท้อนคือภาพฉากหลังกลับหัวใน shader
 *   (ยิงรังสีสะท้อนจากผิวน้ำไปชนระนาบภาพ ไม่ใช้ Reflector ที่เรนเดอร์ฉากซ้ำ) คลื่นอ่อน ๆ ระลอกตอนแตะ หมอกบาง ๆ สองชั้น
 *
 * กระทงหลายร้อยใบ (ไม่มีเพดาน 40 ใบแล้ว):
 *   - ใบใกล้กล้อง: ครบทุกชิ้น วาดด้วย InstancedMesh แยกตามชนิดชิ้นส่วน (ฐาน 3 + ของแต่ง 6 × ส่วนเปลี่ยนสี/ส่วนสีคงที่)
 *     แต่ละชนิดรวม geometry ย่อยไว้ด้วย mergeGeometries + vertex colors ใช้ material เดียวทั้งหมด สีที่ผู้ใช้เลือก = instanceColor
 *     เงาใต้น้ำ = instance กลับหัวสีหม่นใน mesh เดียวกัน
 *   - ใบไกล: Points ชุดเดียว (sprite atlas ภาพกระทงจากไฟล์ร่างที่มีแสงเทียนในตัว)
 *   - แสงเทียน + แสงสะท้อนบนน้ำของทุกใบ: Points แบบ additive ชุดเดียวทั้งฉาก (ไม่มี PointLight) กระพริบใน shader
 *   - ทุกใบอัปเดตใน loop เดียว (ไม่มี tween แยกต่อใบ) · object pool: ใบที่ลอยพ้นขอบขวาวนกลับมาทางซ้ายพร้อมข้อมูลใบถัดไป
 *     ข้อมูลหมดคิว → ขอหน้าถัดไปจาก Firestore (api.more)
 *   - ปุ่ม DOM 24 ปุ่มวางทับใบที่ใกล้ที่สุดให้ Tab/ลูกศร/screen reader ใช้ได้ · แตะที่ฉากเลือกใบไหนก็ได้ (คำนวณจากตำแหน่งบนจอ)
 *   - ปรับคุณภาพเอง: FPS < 50 ติดกัน 2 วินาที → ลดจำนวนใบและ DPR ทีละขั้น · ?debug=1 แสดง FPS/จำนวนใบ (?n=300 ล็อกจำนวน)
 * แต่งกระทง: ขั้น 1 เลือกฐาน → 2 แต่ง (แตะบนกระทงเพื่อวางของ · เลือกชิ้นแล้วเปลี่ยนสี/ขนาด/หมุน/ลบ · ย้อนกลับ · ลากเพื่อหมุนดูรอบตัว) → 3 ลอย
 * เรนเดอร์เฉพาะตอนฉากอยู่ในจอและแท็บแสดงอยู่ · DPR สูงสุด 1.5
 * ============================================================================ */
import * as THREE from "./vendor/three/three.module.min.js";
import * as M from "./loy-models.js?v=2026-11-21.1";
import { krathongSVG } from "./loy-art.js?v=2026-11-21.1";

const L = window.__LVC || {};
const gsap = L.gsap || null;
const ZB = -46;                       // ระนาบภาพฉากหลัง
const IMG_ASPECT = 1536 / 1024;
const WATER_V = 0.86;                 // แนวน้ำในภาพ (ใต้นี้คือลานอิฐ ไม่แสดง)
const CROP_ASPECT = IMG_ASPECT / WATER_V;
const MOON_UV = [0.8835, 0.1353];     // พระจันทร์ในภาพ (ใช้ทำทางแสงจันทร์บนน้ำ)
const BUILD_AT = new THREE.Vector3(0, 0, 3.2);
const Z_FAR = -36, Z_NEAR = 1;        // ช่วงลำน้ำที่กระทงลอย (หลังจุดแต่งกระทงที่ z = 3.2 จึงไม่ลอยชนกระทงของเรา)
const NEAR_DIST = 15;                 // ใกล้กว่านี้ = แสดงครบทุกชิ้น
const NEAR_MAX = 180;                 // ใบเต็มรายละเอียดพร้อมกันสูงสุด
const PART_CAP = 3072;                // instance ต่อชนิดชิ้นส่วน (รวมเงาใต้น้ำ)
const POOL_MAX = 900;
const GLOW_MAX = POOL_MAX * 2 + NEAR_MAX * 6 + 64;
const AMBIENCE = 80;                  // ข้อมูลน้อยกว่านี้ เติมกระทงประดับ (ไม่มีข้อความ กดไม่ได้) ให้ลำน้ำไม่โล่ง
const BUTTONS = 24;
const Q = new URLSearchParams(location.search);
const DEBUG = Q.get("debug") === "1";
const TEST_N = DEBUG && Q.get("n") ? Math.min(POOL_MAX, Math.max(10, +Q.get("n") | 0)) : 0;
const LOCK_N = TEST_N && Q.get("adapt") !== "1" ? TEST_N : 0;   // ?debug=1&n=300 ล็อกจำนวน · เติม &adapt=1 ให้ปรับคุณภาพเองจาก n
const LEVELS = [{ f: 1, pr: 1.5 }, { f: 0.75, pr: 1.25 }, { f: 0.55, pr: 1 }, { f: 0.4, pr: 0.85 }, { f: 0.28, pr: 0.7 }];

/* ---------- shader ผิวน้ำ ---------- */
const WATER_VS = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform sampler2D uTex;
uniform vec4 uB;            // x ซ้ายของภาพ, กว้าง, สูง, z ของระนาบภาพ
uniform float uTime;
uniform vec4 uRip[8];       // x, z, เวลาเริ่ม, แรง
uniform vec3 uMoon;         // พระจันทร์ (โลก) สำหรับทางแสงบนน้ำ
uniform vec3 uSky, uDeep, uFog;
uniform float uFogK;
varying vec3 vW;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
void main(){
  vec3 P = vW;
  vec3 toP = P - cameraPosition;
  float dist = length(toP);
  vec3 V = toP / dist;
  // คลื่นอ่อน ๆ: เกรเดียนต์ของผิวน้ำจากคลื่นไซน์ + noise (ไกลแล้วเบาลง กันลายระยิบเกิน)
  float far = 1.0 / (1.0 + dist * 0.05);
  vec2 g = vec2(0.0);
  g += vec2(0.20, 0.55) * cos(dot(P.xz, vec2(0.6, 1.5)) - uTime * 1.1) * 0.05;
  g += vec2(-0.45, 0.30) * cos(dot(P.xz, vec2(-1.3, 0.9)) - uTime * 0.8) * 0.04;
  g += (vec2(vn(P.xz * vec2(2.4, 5.0) + uTime * vec2(0.1, 0.35)), vn(P.xz * vec2(2.4, 5.0) * 1.3 - uTime * 0.2)) - 0.5) * 0.12;
  g *= far;
  // ระลอกจากการแตะ / กระทงลงน้ำ
  float ring = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    float age = uTime - r.z;
    if (age < 0.0 || age > 4.5) continue;
    vec2 d = P.xz - r.xy; float dl = length(d) + 1e-4;
    float ph = dl - age * 1.6;
    float env = r.w * exp(-age * 0.85) * exp(-ph * ph * 2.2);
    g += (d / dl) * sin(ph * 14.0) * env * 0.9;
    ring += env * (0.5 + 0.5 * sin(ph * 14.0));
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 R = reflect(V, N);
  vec3 refl = uSky;
  if (R.z < -0.001) {
    float t = (uB.w - P.z) / R.z;
    vec3 Q = P + R * t;
    float vy = Q.y / uB.z;
    if (vy >= 0.0 && vy < 1.0) {
      vec2 uv = vec2((Q.x - uB.x) / uB.y, (1.0 - ${WATER_V.toFixed(2)}) + ${WATER_V.toFixed(2)} * vy);
      refl = mix(texture2D(uTex, uv).rgb, uSky, smoothstep(0.9, 1.0, vy));
    }
  }
  float fres = 0.2 + 0.8 * pow(1.0 - max(dot(-V, N), 0.0), 3.0);
  vec3 col = mix(uDeep, refl * 1.12, fres);
  vec3 Lm = normalize(uMoon - P);
  float m = max(dot(R, Lm), 0.0);
  col += vec3(1.0, 0.92, 0.78) * (pow(m, 500.0) * 2.4 + pow(m, 30.0) * 0.06);
  col += vec3(0.95, 0.92, 0.85) * ring * 0.18;
  float f = 1.0 - exp(-pow(dist * uFogK, 2.0));
  col = mix(col, uFog, f * 0.75);
  gl_FragColor = vec4(col, mix(0.7, 0.97, fres));
}`;
/* ---------- หมอก: แผ่นโปร่งแสง noise เลื่อนช้า ๆ เหนือผิวน้ำ ---------- */
const MIST_FS = `
uniform float uTime, uAlpha; uniform vec3 uColor; varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
void main(){
  vec2 p = vUv * vec2(9.0, 2.0) + vec2(uTime * 0.025, 0.0);
  float n = vn(p) * 0.6 + vn(p * 2.1 + 3.7) * 0.4;
  float band = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y)) * smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  gl_FragColor = vec4(uColor, n * band * uAlpha);
}`;
const MIST_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
/* ---------- กระทงไกล: Points + sprite atlas (3 ภาพฐานจากไฟล์ร่าง) ---------- */
const FAR_VS = `
attribute float aBase, aFade, aSize;
uniform float uScale, uFogK;
varying float vBase, vFade, vFog;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z;
  vBase = aBase; vFade = aFade;
  float d = -mv.z * uFogK; vFog = 1.0 - exp(-d * d);
}`;
const FAR_FS = `
uniform sampler2D uAtlas; uniform vec3 uFog;
varying float vBase, vFade, vFog;
void main(){
  vec4 c = texture2D(uAtlas, vec2((vBase + gl_PointCoord.x) / 3.0, 1.0 - gl_PointCoord.y));
  if (c.a * vFade < 0.45) discard;
  gl_FragColor = vec4(mix(c.rgb * 0.92, uFog, vFog * 0.7), 1.0);
}`;
/* ---------- แสงเทียน (kind 0) + แสงสะท้อนบนน้ำ (kind 1): Points additive ชุดเดียว ---------- */
const GLOW_VS = `
attribute float aSize, aPh, aKind, aAmp;
uniform float uScale, uTime;
varying float vKind, vAmp;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float flick = 0.86 + 0.14 * sin(uTime * 11.0 + aPh) * sin(uTime * 7.3 + aPh * 1.7);
  gl_PointSize = aSize * uScale / -mv.z * (aKind > 0.5 ? 1.0 : flick);
  vKind = aKind; vAmp = aAmp * flick;
}`;
const GLOW_FS = `
uniform float uTime;
varying float vKind, vAmp;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  vec3 c;
  if (vKind < 0.5) {
    float r2 = dot(p, p);
    float halo = exp(-r2 * 4.5) * 0.55;
    float core = exp(-(p.x * p.x * 80.0 + (p.y - 0.05) * (p.y - 0.05) * 22.0));
    c = vec3(1.0, 0.68, 0.32) * halo + vec3(1.0, 0.9, 0.65) * core * 1.3;
  } else {
    float band = 0.55 + 0.45 * sin(p.y * 26.0 - uTime * 4.0);
    float a = exp(-p.x * p.x * 36.0) * smoothstep(1.0, -0.2, p.y) * smoothstep(-1.0, -0.6, p.y) * band;
    c = vec3(1.0, 0.7, 0.36) * a * 0.55;
  }
  gl_FragColor = vec4(c * vAmp, 1.0);
}`;

/** atlas ภาพกระทงไกล: SVG จากไฟล์ร่าง 3 แบบ วาดลง canvas ครั้งเดียว */
function farAtlas(onReady) {
  const c = document.createElement("canvas"); c.width = 384; c.height = 128;
  const x = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let left = 3;
  for (let i = 0; i < 3; i++) {
    const img = new Image();
    img.onload = () => { x.drawImage(img, i * 128 + 4, 14, 120, 100); tex.needsUpdate = true; if (--left === 0 && onReady) onReady(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(krathongSVG(i).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  }
  return tex;
}

/* ======================================================================
 *  สร้างฉาก
 * ====================================================================== */
export function createRiver3D(stage, api) {
  const canvas = stage.querySelector(".loy3d__gl");
  const layer = stage.querySelector(".loy3d__boats");
  const small = stage.clientWidth < 700;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: "high-performance" });
  } catch (e) { return null; }
  renderer.setClearColor(0x050b16, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070d1c);
  scene.fog = new THREE.FogExp2(0x0d1830, 0.016);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 260);
  const clock = new THREE.Clock();

  /* ---------- แสง (ไม่มี PointLight: แสงเทียนเป็น Points additive) ---------- */
  scene.add(new THREE.HemisphereLight(0x9fb2e0, 0x1a2236, 2.0));
  scene.add(new THREE.AmbientLight(0xfff2dc, 0.55));
  const moonLight = new THREE.DirectionalLight(0xdfe6ff, 1.4);
  moonLight.position.set(18, 30, -30);
  scene.add(moonLight);
  const fill = new THREE.DirectionalLight(0xffe6c4, 1.1);       // แสงไฟริมน้ำส่องด้านหน้ากระทง (สีของดอกไม้ไม่หม่น)
  fill.position.set(-4, 6, 14);
  scene.add(fill);

  /* ---------- ฉากหลัง + ผิวน้ำ ---------- */
  const texURL = small ? "./images/campus-night@1x.webp" : "./images/campus-night.webp";
  const tex = new THREE.TextureLoader().load(texURL, () => { backTex.needsUpdate = true; api.onReady && api.onReady(); });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.anisotropy = 4;
  const backTex = tex.clone();
  backTex.wrapS = THREE.MirroredRepeatWrapping;
  backTex.repeat.y = WATER_V; backTex.offset.y = 1 - WATER_V;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: backTex, fog: false, toneMapped: false }));
  scene.add(back);
  const B = { x0: -20, w: 40, h: 23 };
  const waterU = {
    uTex: { value: tex }, uB: { value: new THREE.Vector4() }, uTime: { value: 0 },
    uRip: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uMoon: { value: new THREE.Vector3() }, uSky: { value: new THREE.Color(0x0a1426) }, uDeep: { value: new THREE.Color(0x040914) },
    uFog: { value: new THREE.Color(0x0d1830) }, uFogK: { value: 0.012 },
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: waterU, transparent: true, depthWrite: false }));
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  scene.add(water);
  const mists = [[ZB + 4, 7, 0.32], [-14, 3.2, 0.2]].map(([z, h, a]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: a }, uColor: { value: new THREE.Color(0x9fb0d6) } } }));
    m.position.set(0, h * 0.42, z); m.scale.set(140, h, 1); m.renderOrder = 2;
    scene.add(m); return m;
  });

  /* ---------- กระทงใกล้: InstancedMesh ต่อชนิดชิ้นส่วน (material เดียว) ---------- */
  const kraMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const WHITE = new THREE.Color(1, 1, 1), DARK = new THREE.Color(0.3, 0.32, 0.42);
  function instanced(geo, cap) {
    const m = new THREE.InstancedMesh(geo, kraMat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, WHITE);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  const baseInst = [0, 1, 2].map((b) => instanced(M.baseGeometry(b), NEAR_MAX * 2 + 8));
  const itemInst = M.ITEMS.map((_, k) => { const g = M.itemInstanceGeometries(k); return { tint: instanced(g.tint, PART_CAP), fixed: g.fixed ? instanced(g.fixed, PART_CAP) : null }; });

  /* ---------- กระทงไกล + แสงเทียน: Points ---------- */
  function pointsGeo(n, attrs) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    for (const a of attrs) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    return g;
  }
  const farU = { uAtlas: { value: farAtlas() }, uScale: { value: 1 }, uFogK: { value: 0.012 }, uFog: { value: new THREE.Color(0x0d1830) } };
  const farGeo = pointsGeo(POOL_MAX, ["aBase", "aFade", "aSize"]);
  const farPts = new THREE.Points(farGeo, new THREE.ShaderMaterial({ vertexShader: FAR_VS, fragmentShader: FAR_FS, uniforms: farU }));
  farPts.frustumCulled = false;
  scene.add(farPts);
  const glowU = { uScale: { value: 1 }, uTime: { value: 0 } };
  const glowGeo = pointsGeo(GLOW_MAX, ["aSize", "aPh", "aKind", "aAmp"]);
  const glowPts = new THREE.Points(glowGeo, new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, uniforms: glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowPts.frustumCulled = false; glowPts.renderOrder = 3;
  scene.add(glowPts);

  /* ======================================================================
   *  กล้อง + ขนาด + คุณภาพ
   * ====================================================================== */
  const view = { w: 1, h: 1, level: 0, panel: { x: 0, y: 0 }, blend: 0, mode: "river", tween: false };
  const target0 = TEST_N || (small ? 280 : 500);          // จำนวนใบที่ตั้งใจไว้ ก่อนปรับตามเครื่อง
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, LOCK_N ? 1.5 : LEVELS[view.level].pr);
  const targetCount = () => (LOCK_N ? LOCK_N : Math.round(target0 * LEVELS[view.level].f));
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const riverPose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const builderPose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const orbit = { yaw: 0, pitch: 0.34, dist: 2.6 };
  function computePoses() {
    const portrait = view.w / view.h < 0.9;
    camera.fov = portrait ? 54 : 44;
    camera.aspect = view.w / view.h;
    const cx = portrait ? 6 : 0;
    riverPose.pos.set(cx, portrait ? 3.4 : 3.6, 12);
    riverPose.target.set(cx, portrait ? -0.6 : -0.4, ZB);
    const d = riverPose.pos.z - ZB, hh = d * Math.tan((camera.fov * Math.PI) / 360), hw = hh * camera.aspect;
    // ภาพฉากหลัง: แสดงตั้งแต่ใต้ป้ายวิทยาลัยลงมาถึงแนวน้ำ เต็มความกว้างจอ (ด้านข้างเกินภาพ = ภาพสะท้อนกลับ)
    const VT = portrait ? 0.2 : 0.27;
    const BH = (hh + riverPose.target.y) * WATER_V / (WATER_V - VT);
    const BW = BH * CROP_ASPECT;
    const PW = Math.max(BW, (hw + 30) * 2.2);
    B.w = BW; B.h = BH; B.x0 = cx - BW * (portrait ? 0.64 : 0.5);
    back.scale.set(PW, BH, 1);
    back.position.set(cx, BH / 2, ZB);
    backTex.repeat.x = PW / BW;
    backTex.offset.x = (cx - PW / 2 - B.x0) / BW;
    water.scale.set(PW * 1.6, 140, 1);
    water.position.set(cx, 0, ZB + 70);
    waterU.uB.value.set(B.x0, B.w, B.h, ZB);
    // ทางแสงจันทร์: จันทร์จริงอยู่สูงเกินขอบภาพ เงาสะท้อนจะตกนอกจอ → ใช้จันทร์สมมติที่ตำแหน่งเดียวกันแต่ต่ำลง ทางแสงจึงอยู่กลางผิวน้ำ
    waterU.uMoon.value.set(B.x0 + MOON_UV[0] * BW, BH * 0.16, ZB);
    mists.forEach((m) => { m.position.x = cx; });
    orbit.dist = portrait ? 3.1 : 2.6;
    updateBuilderPose();
  }
  function updateBuilderPose() {
    const t = BUILD_AT;
    builderPose.target.set(t.x, 0.2, t.z);
    builderPose.pos.set(t.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, 0.2 + Math.sin(orbit.pitch) * orbit.dist, t.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
  }
  // ระหว่างแต่งกระทง แผงควบคุมบังจอส่วนหนึ่ง → เลื่อนภาพให้กระทงอยู่กลางพื้นที่ที่เหลือ
  function applyViewOffset() {
    const ox = view.panel.x * view.blend, oy = view.panel.y * view.blend;
    if (Math.abs(ox) + Math.abs(oy) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(view.w, view.h, -ox, oy, view.w, view.h);
    camera.updateProjectionMatrix();
  }
  function setPixelRatio() {
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(view.w, view.h, false);
    // ขนาดจุดเป็นพิกเซลจริง: ความสูงบัฟเฟอร์ / (2 tan(fov/2))
    farU.uScale.value = glowU.uScale.value = (view.h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  function resize() {
    view.w = Math.max(1, stage.clientWidth); view.h = Math.max(1, stage.clientHeight);
    computePoses();
    setPixelRatio();
    if (view.mode === "river") { camPos.copy(riverPose.pos); camTarget.copy(riverPose.target); }
    else if (!view.tween) { camPos.copy(builderPose.pos); camTarget.copy(builderPose.target); }
    applyViewOffset();
  }

  /* ======================================================================
   *  ข้อมูล → pool ของกระทง
   * ====================================================================== */
  const feed = [];                  // ข้อมูลกระทงที่โหลดมาแล้ว (เรียงตามที่จะได้ลอย)
  const shown = new Map();          // id → slot ที่กำลังแสดง
  let ptr = 0, wraps = 0, moreBusy = false;
  const halfWidthAt = (z) => Math.max(2, riverPose.pos.z - z) * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect + 1.4;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function shapeOf(k) {
    if (k.shape) return k.shape;
    let s = k.base != null && Array.isArray(k.parts) ? { base: Math.min(2, Math.max(0, k.base | 0)), parts: M.cleanParts(k.parts) } : M.fromLegacy(k);
    if (!s.parts.length) s.parts = M.defaultParts();
    // เตรียมครั้งเดียวต่อข้อมูล: เมทริกซ์ของแต่ละชิ้นเทียบกับตัวกระทง สี และปลายไส้เทียน
    s.items = s.parts.map((p) => {
      tmpQ.setFromAxisAngle(UP, (p.r * Math.PI) / 180); tmpS.setScalar(p.s); tmpP.set(p.x, p.y, p.z);
      return { k: p.k, m: new THREE.Matrix4().compose(tmpP, tmpQ, tmpS), c: new THREE.Color(p.c) };
    });
    s.wicks = s.parts.filter((p) => p.k === M.CANDLE).map((p) => new THREE.Vector3(p.x, p.y + M.WICK_Y * p.s + 0.035, p.z));
    k.shape = s;
    return s;
  }
  const DECOR = Array.from({ length: 12 }, (_, i) => ({ id: "decor" + i, decor: true, style: i % 4 }));
  function nextRecord() {
    for (let tries = 0; tries < feed.length; tries++) {
      if (ptr >= feed.length) { ptr = 0; wraps++; }
      const k = feed[ptr++];
      if (!k.gone && !shown.has(k.id)) return k;
    }
    return null;
  }
  // ข้อมูลในคิวแสดงไปครบรอบแล้ว → ขอหน้าถัดไป (เก่ากว่า) จาก Firestore
  function maybeMore() {
    if (moreBusy || !api.more || wraps === 0) return;
    moreBusy = true;
    Promise.resolve(api.more()).then((n) => { if (n) wraps = 0; }).finally(() => { setTimeout(() => { moreBusy = false; }, 4000); });
  }
  const pool = Array.from({ length: POOL_MAX }, (_, i) => ({ i, active: false, k: null, x: 0, z: 0, lane: 0, speed: 0, ph: Math.random() * 6.28, yaw: Math.random() * 6.28,
    scale: 1, fade: 0, out: false, held: false, near: false, sx: null, sy: 0, sr: 0, dist: 99 }));
  let activeN = 0;
  function laneZ(l) { return Z_FAR + l * (Z_NEAR - Z_FAR); }
  function assign(slot, k, x) {
    if (slot.k && !slot.k.decor) shown.delete(slot.k.id);
    slot.k = k; slot.shape = shapeOf(k);
    if (!k.decor) shown.set(k.id, slot);
    slot.lane = k.mine && k.fresh ? 0.94 : Math.pow(Math.random(), 0.75);
    slot.z = laneZ(slot.lane);
    slot.x = x != null ? x : riverPose.pos.x + (Math.random() * 2 - 1) * halfWidthAt(slot.z);
    slot.speed = 0.12 + Math.random() * 0.22;
    slot.scale = 0.92 + Math.random() * 0.2;
    slot.fade = 0; slot.out = false; slot.held = false; slot.near = false;
    k.fresh = false;
  }
  const fillRecord = (decorOk) => nextRecord() || (decorOk ? DECOR[(Math.random() * DECOR.length) | 0] : null);
  // จำนวนใบที่ลอยอยู่ = เป้าตามคุณภาพ แต่ไม่เกินข้อมูลที่มี (เติมกระทงประดับให้ถึงขั้นต่ำ)
  const wantCount = () => Math.min(targetCount(), Math.max(LOCK_N || AMBIENCE, feed.length));
  function updateActive() {
    const want = wantCount();
    while (activeN < want) {
      const s = pool[activeN], k = fillRecord(feed.length < want);
      if (!k) break;
      assign(s, k); s.active = true; activeN++;
    }
    while (activeN > want) {
      const s = pool[--activeN];
      if (s.k && !s.k.decor) shown.delete(s.k.id);
      s.active = false; s.k = null;
      if (cardSlot === s) closeCard(false);
    }
  }
  function recycle(slot) {
    if (slot.k && !slot.k.decor) shown.delete(slot.k.id);     // ใบเดิมกลับเข้าคิวได้ (ข้อมูลน้อยกว่าช่องก็ยังวนได้)
    const k = fillRecord(feed.length < wantCount());
    if (!k) { slot.x = riverPose.pos.x - halfWidthAt(slot.z) - 1; slot.fade = 0; return; }
    assign(slot, k, null);
    slot.x = riverPose.pos.x - halfWidthAt(slot.z) - 1;   // เข้าทางซ้าย
    if (wraps > 0) maybeMore();
  }
  // ข้อมูลเข้ามา: load/page = ต่อคิว · arrive (ใบใหม่ของคนอื่น) / own = แทรกให้ลอยออกมาเร็ว ๆ
  function feedRecord(k, how) {
    if (feed.some((x) => x.id === k.id)) return;
    feed.push(k);
    if (feed.length > 2000) { feed.splice(0, feed.length - 2000); ptr = 0; }
    if (how === "arrive" || how === "own") {
      // เปลี่ยนใบที่ใกล้หลุดขอบขวาที่สุดให้เป็นใบใหม่ทันที (ของคนอื่นเข้าจากซ้าย · ของเราลอยแถวหน้า)
      k.fresh = how === "own";
      let best = null, bestEdge = -Infinity;
      for (let i = 0; i < activeN; i++) {
        const s = pool[i];
        if (s.held || s === cardSlot) continue;
        const e = s.x - (riverPose.pos.x + halfWidthAt(s.z));
        if (e > bestEdge) { bestEdge = e; best = s; }
      }
      if (best) assign(best, k, how === "own" ? riverPose.pos.x - 1.2 : riverPose.pos.x - halfWidthAt(laneZ(0.5)) - 1);
    }
    updateActive();
  }
  function dropRecord(id) {
    const s = shown.get(id), i = feed.findIndex((x) => x.id === id);
    if (i >= 0) { feed[i].gone = true; feed.splice(i, 1); if (ptr > i) ptr--; }
    if (s) { s.out = true; if (cardSlot === s) closeCard(false); }
    updateActive();
  }

  /* ---------- ปุ่ม DOM 24 ปุ่ม: วางทับใบที่ใกล้ที่สุด (Tab/ลูกศร/screen reader) ---------- */
  const btns = Array.from({ length: BUTTONS }, () => {
    const el = document.createElement("button");
    el.type = "button"; el.className = "loy3d__boat"; el.tabIndex = -1; el.hidden = true;
    el.innerHTML = '<span class="loy3d__tag" hidden>กระทงของคุณ</span>';
    layer.appendChild(el);
    const b = { el, slot: null };
    el.addEventListener("click", () => { if (b.slot) openCard(b.slot); });
    el.addEventListener("focus", () => { if (b.slot) b.slot.held = true; roving(b); });
    el.addEventListener("blur", () => { if (b.slot && cardSlot !== b.slot) b.slot.held = false; });
    return b;
  });
  btns[0].el.tabIndex = 0;
  function roving(b) { for (const o of btns) o.el.tabIndex = o === b ? 0 : -1; }
  function bindButton(b, s) {
    b.slot = s;
    const k = s.k;
    b.el.setAttribute("aria-label", `กระทง${k.mine ? "ของคุณ" : ""} ${k.name || "ไม่ระบุชื่อ"}: ${k.wish}`);
    b.el.classList.toggle("is-mine", !!k.mine);
    b.el.firstChild.hidden = !k.mine;
  }
  let assignTick = 0;
  function assignButtons() {
    const cand = [];
    for (let i = 0; i < activeN; i++) { const s = pool[i]; if (s.sx != null && s.k && !s.k.decor && s.fade > 0.5 && !s.out) cand.push(s); }
    cand.sort((a, b) => a.dist - b.dist);
    const want = new Set(cand.slice(0, BUTTONS));
    for (const b of btns) if (b.slot && (!want.has(b.slot) || !b.slot.active) && document.activeElement !== b.el) b.slot = null;
    const used = new Set(btns.map((b) => b.slot).filter(Boolean));
    for (const s of want) {
      if (used.has(s)) continue;
      const free = btns.find((b) => !b.slot);
      if (!free) break;
      bindButton(free, s);
    }
    for (const b of btns) if (b.slot && b.slot.k && b.slot.k.decor) b.slot = null;
  }
  layer.addEventListener("keydown", (e) => {
    if (!/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
    const list = btns.filter((b) => b.slot && !b.el.hidden).sort((a, b) => a.slot.sx - b.slot.sx);
    if (!list.length) return;
    e.preventDefault();
    const at = list.findIndex((b) => b.el === document.activeElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length;
    if (list[at] && list[at].slot) list[at].slot.held = false;
    list[next].el.focus();
  });

  /* ---------- การ์ดคำอธิษฐาน (ตามไฟล์ร่าง: กล่องสีแสงจันทร์เหนือกระทง) ---------- */
  const cardEl = stage.querySelector(".loy__card");
  let cardSlot = null;
  function openCard(s) {
    if (cardSlot && cardSlot !== s) cardSlot.held = false;
    cardSlot = s; s.held = true;
    api.fillCard(cardEl, s.k);
    cardEl.hidden = false;
    addRipple(s.x, s.z, 0.7);
    placeCard();
    if (gsap) gsap.fromTo(cardEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "opacity,transform" });
    cardEl.querySelector('[data-act="close"]').focus({ preventScroll: true });
  }
  function closeCard(focusBack) {
    const s = cardSlot;
    cardEl.hidden = true; cardSlot = null;
    if (!s) return;
    const b = btns.find((x) => x.slot === s);
    s.held = !!(b && document.activeElement === b.el);
    if (focusBack && b) b.el.focus({ preventScroll: true });
  }
  function placeCard() {
    const s = cardSlot;
    if (!s || s.sx == null) return;
    const cw = cardEl.offsetWidth, ch = cardEl.offsetHeight;
    const x = Math.min(Math.max(10, s.sx - cw / 2), view.w - cw - 10);
    let y = s.sy - s.sr - ch - 14;
    if (y < 60) y = Math.min(view.h - ch - 10, s.sy + s.sr * 0.6 + 12);
    cardEl.style.left = x.toFixed(0) + "px"; cardEl.style.top = y.toFixed(0) + "px";
    cardEl.style.setProperty("--ax", (s.sx - x - cw / 2).toFixed(0) + "px");
  }
  cardEl.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeCard(true); } });
  api.bindCard(cardEl, () => cardSlot && { k: cardSlot.k, el: (btns.find((b) => b.slot === cardSlot) || { el: document.body }).el }, (focus) => closeCard(focus));

  /* ---------- ระลอกน้ำ ---------- */
  let ripI = 0;
  function addRipple(x, z, k = 1) {
    waterU.uRip.value[ripI].set(x, z, clock.elapsedTime, k);
    ripI = (ripI + 1) % 8;
  }

  /* ======================================================================
   *  แต่งกระทง (ชิ้นส่วนเป็น mesh ของตัวเอง แก้ไขทีละชิ้นได้ · ไม่เกิน 24 ชิ้น)
   * ====================================================================== */
  const build = { group: new THREE.Group(), base: 0, parts: [], meshes: [], baseMesh: null, sel: -1, armed: -1, history: [], spin: 0, lit: new Set(), litAmp: 0, lift: 0 };
  build.group.position.copy(BUILD_AT);
  build.group.visible = false;
  scene.add(build.group);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(M.RADIUS + 0.06, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
  disk.position.y = M.TOP + 0.003;
  build.group.add(disk);
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf5c518, fog: false, toneMapped: false }));
  selRing.visible = false;
  build.group.add(selRing);
  const buildReflect = new THREE.Group();          // เงาใต้น้ำของกระทงที่กำลังแต่ง
  buildReflect.scale.y = -1;
  build.group.add(buildReflect);
  const reflMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, color: 0x4a5a80, transparent: true, opacity: 0.55 });

  function setBase(kind) {
    build.base = kind;
    if (build.baseMesh) { build.group.remove(build.baseMesh); build.baseMesh.geometry.dispose(); buildReflect.remove(build.baseRefl); }
    const g = M.baseGeometry(kind);
    build.baseMesh = new THREE.Mesh(g, kraMat);
    build.baseRefl = new THREE.Mesh(g, reflMat);
    build.group.add(build.baseMesh);
    buildReflect.add(build.baseRefl);
  }
  function partMesh(p) {
    const g = M.itemGeometry(p.k, p.c);
    const mesh = new THREE.Mesh(g, kraMat), refl = new THREE.Mesh(g, reflMat);
    mesh.userData.refl = refl;
    return mesh;
  }
  function syncPart(i) {
    const p = build.parts[i], mesh = build.meshes[i];
    mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = (p.r * Math.PI) / 180; mesh.scale.setScalar(p.s);
    mesh.userData.refl.position.copy(mesh.position); mesh.userData.refl.rotation.copy(mesh.rotation); mesh.userData.refl.scale.copy(mesh.scale);
  }
  function rebuildParts() {
    for (const m of build.meshes) { build.group.remove(m); buildReflect.remove(m.userData.refl); m.geometry.dispose(); }
    build.meshes = build.parts.map((p) => partMesh(p));
    build.meshes.forEach((m, i) => { build.group.add(m); buildReflect.add(m.userData.refl); syncPart(i); });
    select(Math.min(build.sel, build.parts.length - 1));
    api.onParts && api.onParts(build.parts.length);
  }
  function snapshot() { build.history.push(JSON.stringify({ base: build.base, parts: build.parts })); if (build.history.length > 60) build.history.shift(); api.onHistory && api.onHistory(build.history.length); }
  function undo() {
    const s = build.history.pop();
    if (!s) return false;
    const d = JSON.parse(s);
    if (d.base !== build.base) setBase(d.base);
    build.parts = d.parts;
    rebuildParts();
    api.onHistory && api.onHistory(build.history.length);
    return true;
  }
  function select(i) {
    build.sel = i;
    const m = build.meshes[i];
    selRing.visible = !!m;
    if (m) { selRing.position.set(m.position.x, m.position.y + 0.004, m.position.z); selRing.scale.setScalar(Math.max(0.8, m.scale.x)); }
    api.onSelect && api.onSelect(i >= 0 ? { index: i, part: build.parts[i], count: build.parts.length } : null);
  }
  // ช่องว่างถัดไปบนกระทง (ใช้ตอนวางด้วยคีย์บอร์ด): เกลียวมุมทองคำ หลบชิ้นที่มีอยู่
  function autoSlot() {
    for (let n = 1; n < 80; n++) {
      const a = n * 2.39996, r = Math.min(M.RADIUS - 0.04, 0.07 + 0.035 * Math.sqrt(n) * 2.4);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (build.parts.every((p) => Math.hypot(p.x - x, p.z - z) > 0.085)) return [x, z];
    }
    return [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4];
  }
  function addPart(k, x, z) {
    if (build.parts.length >= M.MAX_PARTS) { api.onLimit && api.onLimit(); return false; }
    if (x == null) [x, z] = autoSlot();
    const r = Math.hypot(x, z), lim = M.RADIUS;
    if (r > lim) { x *= lim / r; z *= lim / r; }
    snapshot();
    const p = { k, x, y: M.TOP, z, r: Math.round((Math.random() * 2 - 1) * 40), s: 1, c: M.ITEMS[k].colors[0] };
    build.parts.push(p);
    const mesh = partMesh(p);
    build.meshes.push(mesh); build.group.add(mesh); buildReflect.add(mesh.userData.refl);
    syncPart(build.parts.length - 1);
    select(build.parts.length - 1);
    if (gsap) gsap.from(mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.45, ease: "back.out(2)", onUpdate: () => { mesh.userData.refl.scale.copy(mesh.scale); } });
    api.onParts && api.onParts(build.parts.length);
    return true;
  }
  function editSel(fn) {
    const i = build.sel;
    if (i < 0) return;
    snapshot();
    fn(build.parts[i]);
    const p = build.parts[i];
    p.s = Math.min(M.SIZE[1], Math.max(M.SIZE[0], Math.round(p.s * 100) / 100));
    p.r = ((((p.r + 180) % 360) + 360) % 360) - 180;
    if (fn.recolor) { const old = build.meshes[i]; build.group.remove(old); buildReflect.remove(old.userData.refl); old.geometry.dispose(); build.meshes[i] = partMesh(p); build.group.add(build.meshes[i]); buildReflect.add(build.meshes[i].userData.refl); }
    syncPart(i); select(i);
  }
  function removeSel() {
    const i = build.sel;
    if (i < 0) return;
    snapshot();
    build.parts.splice(i, 1);
    const m = build.meshes.splice(i, 1)[0];
    build.group.remove(m); buildReflect.remove(m.userData.refl); m.geometry.dispose();
    select(build.parts.length ? Math.min(i, build.parts.length - 1) : -1);
    api.onParts && api.onParts(build.parts.length);
  }

  /* ---------- โหมด: แม่น้ำ ↔ แต่งกระทง (กล้องเคลื่อนนุ่ม ๆ ด้วย GSAP · tween เดียวต่อการเปลี่ยนโหมด) ---------- */
  function tweenCamera(toPos, toTarget, blendTo, dur, done) {
    const from = { p: camPos.clone(), t: camTarget.clone(), b: view.blend }, o = { k: 0 };
    view.tween = true;
    const step = () => { camPos.lerpVectors(from.p, toPos(), o.k); camTarget.lerpVectors(from.t, toTarget(), o.k); view.blend = from.b + (blendTo - from.b) * o.k; applyViewOffset(); };
    if (!gsap) { o.k = 1; step(); view.tween = false; done && done(); return; }
    gsap.to(o, { k: 1, duration: dur, ease: "power3.inOut", onUpdate: step, onComplete: () => { view.tween = false; done && done(); } });
  }
  function openBuilder(state) {
    if (state) { build.parts = M.cleanParts(state.parts); setBase(state.base | 0); }
    else if (!build.baseMesh) { setBase(0); build.parts = M.defaultParts(); }
    rebuildParts();
    build.group.visible = true;
    build.group.position.copy(BUILD_AT);
    build.group.rotation.set(0, build.spin, 0);
    view.mode = "builder";
    closeCard(false);
    tweenCamera(() => builderPose.pos, () => builderPose.target, 1, 1.4);
  }
  function closeBuilder() {
    view.mode = "river";
    select(-1);
    tweenCamera(() => riverPose.pos, () => riverPose.target, 0, 1.2, () => { if (view.mode === "river") build.group.visible = false; });
  }

  /* ---------- ปล่อยกระทงลงน้ำ → กล้องตาม → ส่งต่อให้ pool ของแม่น้ำ (สลับแบบไม่เห็นรอยต่อ) ---------- */
  function handoff(k, x, z) {
    if (!feed.some((r) => r.id === k.id)) feed.push(k);
    let best = null, bestEdge = -Infinity;
    for (let i = 0; i < activeN; i++) {
      const s = pool[i];
      if (s.held || s === cardSlot) continue;
      const e = s.x - (riverPose.pos.x + halfWidthAt(s.z));
      if (e > bestEdge) { bestEdge = e; best = s; }
    }
    if (!best) { updateActive(); return; }
    assign(best, k, x);
    best.z = z; best.scale = 1; best.fade = 1; best.speed = 0.16;
    best.yaw = build.group.rotation.y - clock.elapsedTime * 0.03;
  }
  function release(k, done) {
    select(-1); build.armed = -1;
    const g = build.group, f = { x: g.position.x, y: g.position.y, z: g.position.z, cam: true };
    view.follow = f; view.mode = "follow";
    const finish = () => {
      handoff(k, f.x, f.z);
      g.visible = false; view.follow = null; build.lift = 0;
      view.mode = "river";
      tweenCamera(() => riverPose.pos, () => riverPose.target, 0, 1.6, done);
    };
    if (!gsap) { addRipple(f.x, f.z, 1.4); finish(); return; }
    gsap.timeline({ onComplete: finish })
      .to(f, { y: 0, duration: 0.55, ease: "bounce.out", onComplete: () => { addRipple(f.x, f.z, 1.5); setTimeout(() => addRipple(f.x, f.z, 0.9), 380); } })
      .to(f, { z: f.z - 8, x: riverPose.pos.x + 0.6, duration: 5.2, ease: "power1.inOut" }, ">-0.05")   // จบกลางมุมแม่น้ำ (จอตั้งกล้องอยู่ x=6)
      .to(view, { blend: 0, duration: 1, onUpdate: applyViewOffset }, "<")
      .call(() => { f.cam = false; }, null, "<3.6");
  }
  function resetBuild() {
    build.parts = M.defaultParts(); build.history = []; build.lit.clear(); build.litAmp = 0; build.spin = 0;
    setBase(0); rebuildParts();
    api.onHistory && api.onHistory(0);
  }

  /* ---------- การแตะ / ลาก บนฉาก ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (view.mode === "follow") return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: build.group.rotation.y, pitch: orbit.pitch };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.drag && Math.hypot(dx, dy) > 7 && view.mode === "builder") { down.drag = true; canvas.setPointerCapture(e.pointerId); stage.classList.add("is-dragging"); }
    if (down.drag) {
      build.spin = down.yaw + dx * 0.012;
      build.group.rotation.y = build.spin;
      orbit.pitch = Math.min(1.15, Math.max(0.12, down.pitch + dy * 0.004));
      updateBuilderPose();
    }
  });
  const endDrag = (e) => {
    if (!down || (e && e.pointerId !== down.id)) return;
    const wasDrag = down.drag;
    down = null; stage.classList.remove("is-dragging");
    if (wasDrag || !e || e.type === "pointercancel") return;
    tap(e);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  function tap(e) {
    const at = pick(e);
    if (view.mode === "builder" && build.group.visible) {
      if (api.onWickTap && build.parts.some((p) => p.k === M.CANDLE)) {
        const wi = wickHit();
        if (wi >= 0) { api.onWickTap(wi); return; }
      }
      const hits = ray.intersectObjects(build.meshes, false);
      if (hits.length) { select(build.meshes.indexOf(hits[0].object)); return; }
      const d = ray.intersectObject(disk);
      if (d.length && build.armed >= 0) {
        const lp = build.group.worldToLocal(d[0].point.clone());
        addPart(build.armed, lp.x, lp.z);
        return;
      }
      if (d.length) { select(-1); return; }
    } else if (view.mode === "river") {
      // เลือกกระทงจากตำแหน่งบนจอ (ใบใกล้กล้องที่สุดที่แตะโดน) — ไม่ต้องมีปุ่ม DOM ครบทุกใบ
      let best = null;
      for (let i = 0; i < activeN; i++) {
        const s = pool[i];
        if (s.sx == null || !s.k || s.k.decor || s.out) continue;
        const r = Math.max(22, s.sr);
        if (Math.hypot(s.sx - at.x, s.sy - at.y) < r && (!best || s.dist < best.dist)) best = s;
      }
      if (best) { openCard(best); return; }
    }
    if (ray.ray.intersectPlane(plane, hit)) addRipple(hit.x, hit.z, 1);
    if (cardSlot) closeCard(false);
  }
  // ไส้เทียน: ทรงกลมรอบปลายไส้ใหญ่พอให้นิ้วแตะโดน
  function wickHit() {
    let best = -1, bestD = Infinity;
    build.meshes.forEach((m, i) => {
      if (build.parts[i].k !== M.CANDLE) return;
      const w = m.localToWorld(new THREE.Vector3(0, M.WICK_Y, 0));
      const d = ray.ray.distanceToPoint(w);
      if (d < 0.09 * Math.max(1, build.parts[i].s) && d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ======================================================================
   *  loop เดียว: ขยับทุกใบ → เขียน instance/Points → เรนเดอร์
   * ====================================================================== */
  const W = new THREE.Matrix4(), WM = new THREE.Matrix4(), PM = new THREE.Matrix4(), FLIP = new THREE.Matrix4().makeScale(1, -1, 1);
  const e3 = new THREE.Euler(), v3 = new THREE.Vector3(), cTint = new THREE.Color(), cDark = new THREE.Color();
  const farPos = farGeo.attributes.position.array, farBase = farGeo.attributes.aBase.array, farFade = farGeo.attributes.aFade.array, farSize = farGeo.attributes.aSize.array;
  const gPos = glowGeo.attributes.position.array, gSize = glowGeo.attributes.aSize.array, gPh = glowGeo.attributes.aPh.array, gKind = glowGeo.attributes.aKind.array, gAmp = glowGeo.attributes.aAmp.array;
  const stats = { fps: 0, n: 0, near: 0, far: 0, calls: 0, tris: 0, js: 0, level: 0, pr: 1, glows: 0 };
  let gi = 0;
  function glow(x, y, z, size, ph, kind, amp) {
    if (gi >= GLOW_MAX) return;
    gPos[gi * 3] = x; gPos[gi * 3 + 1] = y; gPos[gi * 3 + 2] = z;
    gSize[gi] = size; gPh[gi] = ph; gKind[gi] = kind; gAmp[gi] = amp; gi++;
  }
  function putInst(mesh, idx, m, c) { if (idx >= mesh.instanceMatrix.count) return; mesh.setMatrixAt(idx, m); mesh.setColorAt(idx, c); }
  const counts = new Int32Array(3), tc = new Int32Array(6), fc = new Int32Array(6);
  function updateBoats(t, dt) {
    counts.fill(0); tc.fill(0); fc.fill(0);
    let farN = 0, nearN = 0;
    gi = 0;
    const cx = riverPose.pos.x, river = view.mode === "river";
    for (let i = 0; i < activeN; i++) {
      const s = pool[i];
      // ขยับ + วนกลับ (object pool)
      if (!s.held) {
        s.x += s.speed * dt;
        if (s.x > cx + halfWidthAt(s.z) + 1.5) recycle(s);
      }
      if (s.out) { s.fade -= dt * 1.4; if (s.fade <= 0) { recycle(s); } }
      else if (s.fade < 1) s.fade = Math.min(1, s.fade + dt * 0.9);
      const fade = Math.max(0, s.fade), sh = s.shape;
      const bob = Math.sin(t * 1.2 + s.ph) * 0.02 - (s.out ? (1 - fade) * 0.4 : 0);
      const tilt = Math.sin(t * 0.9 + s.ph) * 0.06;
      e3.set(tilt * 0.6, s.yaw + t * 0.03, tilt);
      tmpQ.setFromEuler(e3);
      const sc = s.scale * (0.4 + 0.6 * fade);
      tmpP.set(s.x, bob, s.z);
      W.compose(tmpP, tmpQ, tmpS.setScalar(sc));
      const dx = s.x - camPos.x, dz = s.z - camPos.z;
      s.dist = Math.sqrt(dx * dx + dz * dz + camPos.y * camPos.y);
      const wantNear = s.dist < NEAR_DIST + (s.near ? 1.5 : 0);
      s.near = wantNear && nearN < NEAR_MAX && fade > 0.02;
      const ph = s.i * 1.7;
      if (s.near) {
        nearN++;
        WM.multiplyMatrices(FLIP, W);
        putInst(baseInst[sh.base], counts[sh.base]++, W, WHITE);
        putInst(baseInst[sh.base], counts[sh.base]++, WM, DARK);
        for (const it of sh.items) {
          const T = itemInst[it.k];
          PM.multiplyMatrices(W, it.m);
          cDark.copy(it.c).multiply(DARK);
          putInst(T.tint, tc[it.k]++, PM, it.c);
          if (T.fixed) putInst(T.fixed, fc[it.k]++, PM, WHITE);
          PM.multiplyMatrices(WM, it.m);
          putInst(T.tint, tc[it.k]++, PM, cDark);
          if (T.fixed) putInst(T.fixed, fc[it.k]++, PM, DARK);
        }
        for (const w of sh.wicks) {
          v3.copy(w).applyMatrix4(W);
          glow(v3.x, v3.y, v3.z, 0.55 * sc, ph + v3.x * 3, 0, fade);
        }
        if (sh.wicks.length) glow(s.x, -0.42 * sc, s.z, 2.2 * sc, ph, 1, fade);
      } else if (fade > 0.02 && farN < POOL_MAX) {
        const o = farN * 3;
        farPos[o] = s.x; farPos[o + 1] = bob + 0.28 * sc; farPos[o + 2] = s.z;
        farBase[farN] = sh.base; farFade[farN] = fade; farSize[farN] = 1.45 * sc;
        farN++;
        glow(s.x, bob + 0.62 * sc, s.z, 0.75 * sc, ph, 0, fade * 0.9);
        glow(s.x, -0.4 * sc, s.z, 2.0 * sc, ph, 1, fade * 0.8);
      }
      // ตำแหน่งบนจอ (ใช้กับปุ่ม DOM และการแตะเลือก)
      if (river) {
        v3.set(s.x, 0.25 * sc, s.z).project(camera);
        if (v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
          s.sx = (v3.x * 0.5 + 0.5) * view.w; s.sy = (-v3.y * 0.5 + 0.5) * view.h;
          s.sr = Math.max(8, Math.min(80, (sc * 0.62 * farU.uScale.value) / renderer.getPixelRatio() / s.dist));
        } else s.sx = null;
      } else s.sx = null;
    }
    // ไฟเทียนของกระทงที่กำลังแต่ง (จุดแล้วเท่านั้น)
    if (build.group.visible && build.lit.size) {
      build.meshes.forEach((m, i) => {
        if (!build.lit.has(i)) return;
        v3.set(0, M.WICK_Y + 0.035, 0); m.localToWorld(v3);
        glow(v3.x, v3.y, v3.z, 0.5 * build.parts[i].s * build.litAmp, i * 2.1, 0, Math.min(1, build.litAmp));
      });
      if (build.litAmp > 0.1) glow(build.group.position.x, -0.45, build.group.position.z, 2.4 * Math.min(1.2, build.litAmp), 3, 1, Math.min(1, build.litAmp));
    }
    for (let b = 0; b < 3; b++) { baseInst[b].count = Math.min(counts[b], baseInst[b].instanceMatrix.count); baseInst[b].instanceMatrix.needsUpdate = true; baseInst[b].instanceColor.needsUpdate = true; }
    for (let k = 0; k < 6; k++) {
      // shortcut: เกิน PART_CAP ชิ้นต่อชนิด ชิ้นที่เกินจะไม่ถูกวาด (ต้องมีใบใกล้ ~180 ใบที่แต่ง 8+ ชิ้นชนิดเดียวกันพร้อมกัน), ถ้าเจอบ่อยให้เพิ่ม PART_CAP
      const T = itemInst[k];
      T.tint.count = Math.min(tc[k], PART_CAP); T.tint.instanceMatrix.needsUpdate = T.tint.instanceColor.needsUpdate = true;
      if (T.fixed) { T.fixed.count = Math.min(fc[k], PART_CAP); T.fixed.instanceMatrix.needsUpdate = T.fixed.instanceColor.needsUpdate = true; }
    }
    farGeo.setDrawRange(0, farN);
    for (const a of ["position", "aBase", "aFade", "aSize"]) farGeo.attributes[a].needsUpdate = true;
    glowGeo.setDrawRange(0, gi);
    for (const a of ["position", "aSize", "aPh", "aKind", "aAmp"]) glowGeo.attributes[a].needsUpdate = true;
    stats.near = nearN; stats.far = farN; stats.glows = gi;
  }
  function placeButtons() {
    if (view.mode !== "river") { for (const b of btns) if (!b.el.hidden) b.el.hidden = true; return; }
    if (++assignTick % 8 === 0) assignButtons();
    for (const b of btns) {
      const s = b.slot;
      if (!s || s.sx == null || !s.active) { if (!b.el.hidden && document.activeElement !== b.el) b.el.hidden = true; continue; }
      const r = Math.max(22, s.sr);
      b.el.style.transform = `translate3d(${(s.sx - r).toFixed(1)}px,${(s.sy - r).toFixed(1)}px,0)`;
      if (b.r !== r) { b.r = r; b.el.style.width = b.el.style.height = (r * 2).toFixed(0) + "px"; }
      if (b.el.hidden) b.el.hidden = false;
    }
    // ต้องมีปุ่มที่ Tab เข้าได้เสมอ 1 ปุ่ม (ปุ่มเดิมถูกซ่อน → ย้ายไปปุ่มที่มองเห็น)
    const cur = btns.find((b) => b.el.tabIndex === 0);
    if (cur && cur.el.hidden) { const vis = btns.find((b) => !b.el.hidden); if (vis) roving(vis); }
  }

  /* ---------- ปรับคุณภาพตามเครื่อง: FPS < 50 ติดกัน 2 วินาที → ลดขั้น (จำนวนใบ + DPR) ---------- */
  const fpsWin = { t0: 0, n: 0, low: 0, settle: 0 };
  function watchFps(now) {
    if (!fpsWin.t0) { fpsWin.t0 = now; fpsWin.n = 0; return; }
    fpsWin.n++;
    const span = now - fpsWin.t0;
    if (span < 1000) return;
    stats.fps = Math.round((fpsWin.n * 1000) / span);
    fpsWin.t0 = now; fpsWin.n = 0;
    if (LOCK_N || now < fpsWin.settle) return;
    fpsWin.low = stats.fps < 50 ? fpsWin.low + 1 : 0;
    if (fpsWin.low >= 2 && view.level < LEVELS.length - 1) {
      view.level++; fpsWin.low = 0; fpsWin.settle = now + 1500;
      setPixelRatio();
      updateActive();
    }
  }
  let dbg = null;
  if (DEBUG) {
    dbg = document.createElement("p");
    dbg.className = "loy3d__debug";
    dbg.setAttribute("aria-hidden", "true");
    stage.appendChild(dbg);
    window.__LOY3D = { stats, setLevel(l) { view.level = l; setPixelRatio(); updateActive(); } };
  }
  let dbgT = 0;

  function frame() {
    const t0 = performance.now();
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    waterU.uTime.value = glowU.uTime.value = t;
    mists.forEach((m) => { m.material.uniforms.uTime.value = t; });
    if (view.mode === "builder" && !view.tween) { camPos.copy(builderPose.pos); camTarget.copy(builderPose.target); }
    const f = view.follow;
    if (f) {
      // ปล่อยกระทงแล้ว: กระทงลอยออกไป กล้องตามไปด้านหลังสักพัก
      build.group.position.set(f.x, f.y + Math.sin(t * 1.3) * 0.01, f.z);
      if (f.cam) {
        const k = 1 - Math.exp(-dt * 2.4);
        camTarget.lerp(v3.set(f.x, 0.25, f.z), k);
        camPos.lerp(v3.set(f.x + 0.5, 1.4, f.z + 3.4), k);
      }
    } else if (build.group.visible) build.group.position.y = BUILD_AT.y + build.lift * 0.3 + Math.sin(t * 1.3) * 0.01;
    camera.position.copy(camPos); camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    if (api.tick) api.tick(t, dt);
    updateBoats(t, dt);
    placeButtons();
    if (cardSlot) placeCard();
    stats.js = stats.js * 0.9 + (performance.now() - t0) * 0.1;
    renderer.render(scene, camera);
    watchFps(performance.now());
    if (dbg && t - dbgT > 0.5) {
      dbgT = t;
      stats.n = activeN; stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; stats.level = view.level; stats.pr = renderer.getPixelRatio();
      dbg.textContent = `FPS ${stats.fps} · กระทง ${activeN} (ใกล้ ${stats.near} · ไกล ${stats.far}) · ระดับ ${view.level + 1}/${LEVELS.length}${LOCK_N ? " ล็อก" : ""} · DPR ${stats.pr.toFixed(2)} · draw ${stats.calls} · JS ${stats.js.toFixed(1)} ms`;
    }
  }
  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    fpsWin.t0 = 0; fpsWin.low = 0; fpsWin.settle = performance.now() + 2500;   // ช่วงเริ่ม (คอมไพล์ shader/อัปโหลดภาพ) ไม่นับ
    clock.getDelta();
    renderer.setAnimationLoop(on ? frame : null);
  }

  new ResizeObserver(resize).observe(stage);
  resize();
  camPos.copy(riverPose.pos); camTarget.copy(riverPose.target);
  let visible = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; setActive(visible && !document.hidden); }, { rootMargin: "80px 0px" }).observe(stage);
  document.addEventListener("visibilitychange", () => setActive(visible && !document.hidden));
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setActive(false); api.onLost && api.onLost(); });
  updateActive();

  return {
    renderer, scene, camera, clock, build, three: THREE,
    feed: feedRecord, drop: dropRecord, has: (id) => shown.has(id) || feed.some((k) => k.id === id), count: () => activeN, closeCard,
    openBuilder, closeBuilder, setBase, addPart, undo, select, editSel, removeSel, release, resetBuild,
    arm(k) { build.armed = k; },
    selectStep(d) { if (build.parts.length) select(((build.sel < 0 ? (d > 0 ? -1 : 0) : build.sel) + d + build.parts.length) % build.parts.length); },
    spin(d) { build.spin += d; if (gsap) gsap.to(build.group.rotation, { y: build.spin, duration: 0.5, ease: "power2.out" }); else build.group.rotation.y = build.spin; },
    state: () => ({ base: build.base, parts: build.parts.map(M.packPart) }),
    setPanel(x, y) { view.panel.x = x; view.panel.y = y; applyViewOffset(); },
    addRipple, tweenCamera, camPos, camTarget, riverPose, builderPose, view, stats,
    project(vec) { const p = vec.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * view.w, y: (-p.y * 0.5 + 0.5) * view.h }; },
    setActive, get active() { return active; },
    dispose() { setActive(false); renderer.dispose(); },
  };
}
