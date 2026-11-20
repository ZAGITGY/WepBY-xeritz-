/* ============================================================================
 * loy3d.js — แม่น้ำ 3D + แต่งกระทง (โหลดเมื่อเลื่อนใกล้ section #loy เท่านั้น · three.js r180 ใน vendor/three)
 *
 * ฉาก: ภาพวิทยาลัยกลางคืน (มือถือใช้ @1x) เป็นฉากหลัง ครึ่งล่างเป็นผิวน้ำ: เงาสะท้อนคือภาพฉากหลังกลับหัวใน shader
 *   (ยิงรังสีสะท้อนจากผิวน้ำไปชนระนาบภาพ ไม่ใช้ Reflector ที่เรนเดอร์ฉากซ้ำ) คลื่นอ่อน ๆ ระลอกตอนแตะ หมอกบาง ๆ สองชั้น
 *
 * โมเดลกระทง: assets/krathong (GLB · ดู loy-models.js) หน่วยโมเดล × KS = หน่วยฉาก
 * กระทงหลายร้อยใบ:
 *   - ใบใกล้กล้อง: โมเดลเบา (assets/krathong/lod) ครบทุกชิ้น วาดด้วย InstancedMesh ต่อ mesh ของแต่ละชนิด
 *     ส่วนที่เปลี่ยนสีได้ใช้ instanceColor (material สีขาว) · เงาใต้น้ำ = instance กลับหัวสีหม่นใน mesh เดียวกัน
 *     เปลวเทียนทุกใบ = InstancedMesh ของ decor/flame.glb กับ shader ไหว · ธูปมีถ่านแดง (incense_ember) เรืองแสงในตัว
 *   - ใบไกล: Points ชุดเดียว (sprite จาก thumbs/preset-*.webp ภาพกระทงไอเดียของแต่ละฐาน)
 *   - แสงเทียน + แสงสะท้อนบนน้ำของทุกใบ: Points แบบ additive ชุดเดียวทั้งฉาก (ไม่มี PointLight ในแม่น้ำ) กระพริบใน shader
 *   - ทุกใบอัปเดตใน loop เดียว · object pool: ใบที่ลอยพ้นขอบขวาวนกลับมาทางซ้ายพร้อมข้อมูลใบถัดไป · ข้อมูลหมดคิว → api.more
 *   - ปุ่ม DOM 24 ปุ่มวางทับใบที่ใกล้ที่สุดให้ Tab/ลูกศร/screen reader ใช้ได้ · แตะที่ฉากเลือกใบไหนก็ได้ (คำนวณจากตำแหน่งบนจอ)
 *   - ปรับคุณภาพเอง: FPS < 50 ติดกัน 2 วินาที → ลดจำนวนใบ ใบเต็มรายละเอียด และ DPR ทีละขั้น · ?debug=1 แสดง FPS (?n=300 ล็อกจำนวน)
 * แต่งกระทง: โมเดลเต็ม (assets/krathong/bases, decor) โหลดเมื่อเปิดหน้าแต่งครั้งแรก
 *   วางของ = raycast บนฐาน แล้ว clamp ไม่ให้เกิน manifest.bases[x].place.radius · เปลวเทียนเป็นลูกของเทียนที่ y = flameY
 *   แสง: ACES + hemisphere โทนน้ำเงิน + แสงอุ่นจากเทียน 1 ดวง · เปลวไฟมี sprite เรืองแสง (bloom เฉพาะเปลว)
 * เรนเดอร์เฉพาะตอนฉากอยู่ในจอและแท็บแสดงอยู่ · DPR สูงสุด 1.5
 * ============================================================================ */
import * as THREE from "./vendor/three/three.module.min.js";
import * as M from "./loy-models.js?v=2026-11-22.1";

const L = window.__LVC || {};
const gsap = L.gsap || null;
const ZB = -46;                       // ระนาบภาพฉากหลัง
const IMG_ASPECT = 1536 / 1024;
const WATER_V = 0.86;                 // แนวน้ำในภาพ (ใต้นี้คือลานอิฐ ไม่แสดง)
const CROP_ASPECT = IMG_ASPECT / WATER_V;
const MOON_UV = [0.8835, 0.1353];     // พระจันทร์ในภาพ (ใช้ทำทางแสงจันทร์บนน้ำ)
const KS = 1.45;                      // หน่วยโมเดล (≈ ฟุต) → หน่วยฉาก (ดอกบัวกว้าง ~1.4 · ขนาดใกล้กระทงรุ่นก่อน)
const BUILD_AT = new THREE.Vector3(0, 0, 3.2);
const Z_FAR = -36, Z_NEAR = 1;        // ช่วงลำน้ำที่กระทงลอย (หลังจุดแต่งกระทงที่ z = 3.2 จึงไม่ลอยชนกระทงของเรา)
const NEAR_DIST = 15;                 // ใกล้กว่านี้ = แสดงครบทุกชิ้น
const NEAR_CAP = 160;                 // ใบเต็มรายละเอียดพร้อมกันสูงสุด (จอเล็กเริ่มที่ 70 · ลดตามระดับคุณภาพ)
const PART_CAP = 2048;                // instance ต่อชนิดชิ้น (รวมเงาใต้น้ำ)
const POOL_MAX = 900;
const GLOW_MAX = POOL_MAX * 2 + NEAR_CAP * 6 + 64;
const AMBIENCE = 80;                  // ข้อมูลน้อยกว่านี้ เติมกระทงประดับ (ไม่มีข้อความ กดไม่ได้) ให้ลำน้ำไม่โล่ง
const BUTTONS = 24;
// ฐาน 0 ใบตอง · 1 ดอกบัว · 2 ขนมปัง: ความกว้างโมเดล (หน่วยโมเดล) · ภาพไกลกินกรอบ 0.88 ของความกว้าง (วัดจาก thumbs)
const BASE_W = [0.47, 0.95, 0.77];
const FIT_W = [0.62, 0.95, 0.8];       // ขนาดที่ใช้จัดกล้องตอนแต่ง (ใบตองเล็กแต่ธูปสูง → นับเผื่อความสูง)
const FAR_W = BASE_W.map((w) => (w / 0.88) * KS);
const FAR_FLAME = [0.62, 0.66, 0.58];  // ความสูงเปลวเทียนในภาพไกล (สัดส่วนของ FAR_W)
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
uniform float uTime, uDim;  // uDim: หน้าแต่งกระทงทำน้ำให้มืดลง กระทงเด่นขึ้น
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
  float far = 1.0 / (1.0 + dist * 0.05);
  vec2 g = vec2(0.0);
  g += vec2(0.20, 0.55) * cos(dot(P.xz, vec2(0.6, 1.5)) - uTime * 1.1) * 0.05;
  g += vec2(-0.45, 0.30) * cos(dot(P.xz, vec2(-1.3, 0.9)) - uTime * 0.8) * 0.04;
  g += (vec2(vn(P.xz * vec2(2.4, 5.0) + uTime * vec2(0.1, 0.35)), vn(P.xz * vec2(2.4, 5.0) * 1.3 - uTime * 0.2)) - 0.5) * 0.12;
  g *= far;
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
  vec3 col = mix(uDeep, refl * 1.12 * (1.0 - uDim * 0.7), fres);
  vec3 Lm = normalize(uMoon - P);
  float m = max(dot(R, Lm), 0.0);
  col += vec3(1.0, 0.92, 0.78) * (pow(m, 500.0) * 2.4 + pow(m, 30.0) * 0.06) * (1.0 - uDim * 0.6);
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
/* ---------- กระทงไกล: Points + sprite atlas (ภาพกระทงไอเดียของ 3 ฐาน) ---------- */
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
// ภาพ sRGB → เขียนค่า sRGB ตรง ๆ (ผิวน้ำ/หมอกก็เขียนค่าดิบแบบเดียวกัน สีจึงเข้ากัน)
const FAR_FS = `
uniform sampler2D uAtlas; uniform vec3 uFog;
varying float vBase, vFade, vFog;
void main(){
  vec4 c = texture2D(uAtlas, vec2((vBase + gl_PointCoord.x) / 3.0, 1.0 - gl_PointCoord.y));
  if (c.a * vFade < 0.45) discard;
  vec3 s = pow(c.rgb, vec3(0.4545)) * 0.78;
  gl_FragColor = vec4(mix(s, uFog, vFog * 0.7), 1.0);
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
/* ---------- เปลวเทียน (decor/flame.glb): ไหวตามเวลา ยอดไหวมากกว่าโคน · ใช้ได้ทั้ง mesh เดี่ยวและ InstancedMesh ---------- */
const FLAME_VS = `
uniform float uTime;
varying float vH; varying vec3 vN, vV;
void main(){
  vec3 p = position;
  float h = clamp(p.y / 0.056, 0.0, 1.0);
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif
  float ph = im[3].x * 13.0 + im[3].z * 7.0 + modelMatrix[3].x * 5.0;
  float s = sin(uTime * 7.3 + ph) * 0.6 + sin(uTime * 12.1 + ph * 1.7) * 0.4;
  p.x += s * 0.0045 * h * h;
  p.z += cos(uTime * 9.1 + ph) * 0.003 * h * h;
  p.y *= 1.0 + 0.07 * sin(uTime * 10.7 + ph * 0.6);
  vH = h;
  vec4 mv = modelViewMatrix * im * vec4(p, 1.0);
  vN = normalize(normalMatrix * mat3(im) * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FS = `
uniform vec3 uColor; uniform float uAmp, uRim;
varying float vH; varying vec3 vN, vV;
void main(){
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = mix(1.0, pow(f, 1.4), uRim) * (1.0 - smoothstep(0.75, 1.0, vH) * 0.6);
  gl_FragColor = vec4(uColor * (1.3 - vH * 0.5) * a * uAmp, 1.0);
}`;

/** atlas ภาพกระทงไกล: thumbs/preset-{small,lotus,bread}.webp วาดลง canvas ครั้งเดียว (ลำดับเดียวกับเลขฐาน) */
function farAtlas() {
  const c = document.createElement("canvas"); c.width = 480; c.height = 160;
  const x = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  M.BASES.forEach((b, i) => {
    const img = new Image();
    img.onload = () => { x.drawImage(img, i * 160, 0, 160, 160); tex.needsUpdate = true; };
    img.src = M.thumb("preset-" + b.id);
  });
  return tex;
}
/** วงแสงเรืองรอบเปลวเทียน (sprite additive) */
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,236,190,1)"); g.addColorStop(0.18, "rgba(255,190,100,.55)"); g.addColorStop(0.5, "rgba(255,150,60,.14)"); g.addColorStop(1, "rgba(255,140,50,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;          // มีผลกับโมเดลกระทงเท่านั้น (shader น้ำ/ฉากหลังไม่ใช้ tone mapping)
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070d1c);
  scene.fog = new THREE.FogExp2(0x0d1830, 0.016);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 260);
  const clock = new THREE.Clock();

  /* ---------- แสง: แม่น้ำ (จันทร์ + ไฟริมน้ำ) ↔ หน้าแต่งกระทง (hemisphere น้ำเงิน + เทียน 1 ดวง) ผสมตาม view.blend ---------- */
  const HEMI_SKY = [new THREE.Color(0x9fb2e0), new THREE.Color(0x6f8fe0)], HEMI_GROUND = [new THREE.Color(0x1a2236), new THREE.Color(0x0b1224)];
  const hemi = new THREE.HemisphereLight(0x9fb2e0, 0x1a2236, 2.0);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xfff2dc, 0.55);
  scene.add(amb);
  const moonLight = new THREE.DirectionalLight(0xdfe6ff, 1.4);
  moonLight.position.set(18, 30, -30);
  scene.add(moonLight);
  const fill = new THREE.DirectionalLight(0xffe6c4, 1.1);       // แสงไฟริมน้ำส่องด้านหน้ากระทง (สีของดอกไม้ไม่หม่น)
  fill.position.set(-4, 6, 14);
  scene.add(fill);
  const candleLight = new THREE.PointLight(0xffa04a, 0, 4, 2);   // อยู่ในฉากตลอด (เปลี่ยนแค่ความแรง → shader ไม่คอมไพล์ใหม่)
  scene.add(candleLight);

  /* ---------- ฉากหลัง + ผิวน้ำ ---------- */
  const texURL = small ? "./images/campus-night@1x.webp" : "./images/campus-night.webp";
  let texDone;
  const texReady = new Promise((res) => { texDone = res; });
  const tex = new THREE.TextureLoader().load(texURL, () => { backTex.needsUpdate = true; texDone(); }, undefined, () => texDone());
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
    uTex: { value: tex }, uB: { value: new THREE.Vector4() }, uTime: { value: 0 }, uDim: { value: 0 },
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
    m.position.set(0, h * 0.42, z); m.scale.set(140, h, 1); m.renderOrder = 2; m.userData.a = a;
    scene.add(m); return m;
  });

  /* ---------- เปลวเทียน: material ใช้ร่วม (เวลาเดียวกันทั้งฉาก) ---------- */
  const timeU = { value: 0 };
  function flameMat(name, amp) {
    const outer = name === "flame_outer";
    return new THREE.ShaderMaterial({
      vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: timeU, uAmp: amp, uColor: { value: new THREE.Color(outer ? 0xff9a2e : 0xfff1c0) }, uRim: { value: outer ? 1 : 0.5 } },
    });
  }
  const glowSpriteMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb35c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false });

  /* ---------- กระทงใกล้: InstancedMesh ต่อ mesh ของแต่ละชนิด (สร้างเมื่อโหลดโมเดลเบาเสร็จ) ---------- */
  const WHITE = new THREE.Color(1, 1, 1), DARK = new THREE.Color(0.3, 0.32, 0.42);
  const RI = { bases: [], items: [], flame: [] };
  function instanced(geo, mat, cap) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, WHITE);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  function instSet(src, cap, tintName) {
    const out = [];
    src.traverse((o) => {
      if (!o.isMesh) return;
      const tint = o.name === tintName, mat = o.material.clone();
      mat.side = THREE.DoubleSide;               // เงาใต้น้ำกลับหัวอยู่ใน mesh เดียวกัน (ด้านหน้า/หลังสลับ)
      if (tint) mat.color.set(0xffffff);         // สีจริงมาจาก instanceColor
      out.push({ m: instanced(o.geometry, mat, cap), tint });
    });
    return out;
  }
  let man = null, kitReady = false, FLAME_T = new THREE.Matrix4();
  const riverKitP = M.loadKit(true).then((kit) => {
    man = kit.man;
    FLAME_T = new THREE.Matrix4().makeTranslation(0, man.flameY, 0);
    RI.bases = kit.bases.map((b) => instSet(b, NEAR_CAP * 2 + 8, null));
    RI.items = kit.items.map((it, k) => instSet(it, PART_CAP, kit.tint[k]));
    const fa = { value: 1 };
    kit.flame.traverse((o) => { if (o.isMesh) RI.flame.push(instanced(o.geometry, flameMat(o.name, fa), PART_CAP / 2)); });
    kitReady = true;
    updateActive();
  });
  let fullKit = null, fullKitP = null;
  const builderKit = () => (fullKitP ||= M.loadKit(false).then((k) => { fullKit = k; return k; }));
  const ready = Promise.all([texReady, riverKitP]);

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
  const nearCap = () => Math.round((small ? 70 : NEAR_CAP) * (LOCK_N ? 1 : LEVELS[view.level].f));
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const riverPose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const builderPose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const orbit = { yaw: 0, pitch: 0.62, dist: 2.6 };
  let portrait = false;
  function computePoses() {
    portrait = view.w / view.h < 0.9;
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
    updateBuilderPose();
  }
  // ระยะกล้องตอนแต่ง: กระทงกว้างราว 70% ของพื้นที่เหนือแผง (ไม่เกิน 560px) ทุกขนาดจอ · ฐานใหญ่ถอยไกลกว่า
  function buildDist() {
    const free = view.h - view.panel.y * 2, px = Math.max(180, Math.min(view.w * 0.7, free * 0.78, 560));
    return (FIT_W[build.base] * KS * view.h) / (2 * Math.tan((camera.fov * Math.PI) / 360) * px) + 0.25;
  }
  function updateBuilderPose() {
    const t = BUILD_AT, ty = (man ? M.placeOf(man, build.base).y : 0.15) * KS * 0.75;
    orbit.dist = buildDist();
    builderPose.target.set(t.x, ty, t.z);
    builderPose.pos.set(t.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, ty + Math.sin(orbit.pitch) * orbit.dist, t.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
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
    else if (!view.tween && view.mode === "builder") { camPos.copy(builderPose.pos); camTarget.copy(builderPose.target); }
    applyViewOffset();
  }

  /* ======================================================================
   *  ข้อมูล → pool ของกระทง
   * ====================================================================== */
  const feed = [];                  // ข้อมูลกระทงที่โหลดมาแล้ว (เรียงตามที่จะได้ลอย)
  const shown = new Map();          // id → slot ที่กำลังแสดง
  let ptr = 0, wraps = 0, moreBusy = false;
  const halfWidthAt = (z) => Math.max(2, riverPose.pos.z - z) * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect + 1.4;
  const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function shapeOf(k) {
    if (k.shape) return k.shape;
    const s = k.base != null && Array.isArray(k.parts) ? { base: Math.min(2, Math.max(0, k.base | 0)), parts: M.cleanParts(k.parts) } : M.fromLegacy(man, k);
    if (!s.parts.length) s.parts = M.presetParts(man, s.base);   // ลอยจากแบบ 2D (ไม่มีชิ้นส่วน) → ไอเดียของฐานนั้น
    const place = M.placeOf(man, s.base);
    // เตรียมครั้งเดียวต่อข้อมูล: เมทริกซ์ของแต่ละชิ้นเทียบกับตัวกระทง สี และปลายไส้เทียน
    s.items = s.parts.map((p) => {
      M.fitPart(place, p);
      tmpQ.setFromAxisAngle(UP, (p.r * Math.PI) / 180); tmpS.setScalar(p.s); tmpP.set(p.x, p.y, p.z);
      const c = new THREE.Color(p.c);
      return { k: p.k, m: new THREE.Matrix4().compose(tmpP, tmpQ, tmpS), c, cd: c.clone().multiply(DARK) };
    });
    s.wicks = s.parts.filter((p) => p.k === M.CANDLE).map((p) => new THREE.Vector3(p.x, p.y + (man.flameY + 0.03) * p.s, p.z));
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
  // จำนวนใบที่ลอยอยู่ = เป้าตามคุณภาพ แต่ไม่เกินข้อมูลที่มี (เติมกระทงประดับให้ถึงขั้นต่ำ) · ยังโหลดโมเดลไม่เสร็จ = ยังไม่ลอย
  const wantCount = () => (kitReady ? Math.min(targetCount(), Math.max(LOCK_N || AMBIENCE, feed.length)) : 0);
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
    const inPlace = slot.swap;
    slot.swap = false;
    const k = fillRecord(feed.length < wantCount());
    if (!k) { slot.x = riverPose.pos.x - halfWidthAt(slot.z) - 1; slot.fade = 0; return; }
    assign(slot, k, null);
    if (!inPlace) slot.x = riverPose.pos.x - halfWidthAt(slot.z) - 1;   // เข้าทางซ้าย (ใบที่สลับแทนกระทงประดับ = ผุดขึ้นกลางแม่น้ำ)
    if (wraps > 0) maybeMore();
  }
  // ข้อมูลเข้ามา: load/page = ต่อคิว · arrive (ใบใหม่ของคนอื่น) / own = แทรกให้ลอยออกมาเร็ว ๆ
  function feedRecord(k, how) {
    if (feed.some((x) => x.id === k.id)) return;
    feed.push(k);
    if (feed.length > 2000) { feed.splice(0, feed.length - 2000); ptr = 0; }
    if (!kitReady) return;                       // โหลดโมเดลเสร็จแล้ว updateActive จะหยิบจากคิวเอง
    if (how === "load" || how === "page") {
      // ฉากเติมกระทงประดับไว้ก่อนข้อมูลมาถึง → ใบจริงแต่ละใบมาแทนกระทงประดับ 1 ใบ (ใบเดิมจมหาย ใบจริงผุดขึ้น)
      for (let i = 0; i < activeN; i++) {
        const s = pool[i];
        if (s.k && s.k.decor && !s.out) { s.out = true; s.swap = true; break; }
      }
    }
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
   *  แต่งกระทง: โมเดลเต็ม แยกชิ้นเป็น Object3D ของตัวเอง (≤ 24 ชิ้น) · ตำแหน่งชิ้นอยู่ในหน่วยโมเดล (กลุ่มย่อขยายด้วย KS)
   * ====================================================================== */
  const build = { group: new THREE.Group(), base: 1, parts: [], objs: [], baseObj: null, baseRefl: null, sel: -1, history: [], spin: 0,
    lit: new Set(), litAmp: 0, lift: 0, flameAmp: { value: 0 } };
  build.group.position.copy(BUILD_AT);
  build.group.scale.setScalar(KS);
  build.group.visible = false;
  scene.add(build.group);
  const buildReflect = new THREE.Group();          // เงาใต้น้ำของกระทงที่กำลังแต่ง
  buildReflect.scale.y = -1;
  build.group.add(buildReflect);
  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  selRing.renderOrder = 10; selRing.visible = false;
  build.group.add(selRing);
  const place = () => M.placeOf(man, build.base);
  const itemR = (k) => man.decor[M.ITEMS[k].id].radius;

  // เงาใต้น้ำ: สำเนาที่ใช้ geometry ร่วม · material มืดลงและโปร่งแสง (เปลวไฟไม่สะท้อนแบบ mesh: มีแสงบนน้ำจาก Points อยู่แล้ว)
  function reflOf(obj) {
    const r = obj.clone(true);
    r.traverse((m) => {
      if (!m.isMesh) return;
      const mt = m.material.clone();
      mt.transparent = true; mt.opacity = 0.42; mt.depthWrite = false;
      mt.color.multiplyScalar(0.55);
      if (mt.emissive) mt.emissiveIntensity = 0;
      m.material = mt;
    });
    return r;
  }
  function setBase(kind, refit) {
    build.base = kind;
    if (build.baseObj) { build.group.remove(build.baseObj); buildReflect.remove(build.baseRefl); }
    build.baseObj = fullKit.bases[kind].clone(true);
    build.baseRefl = reflOf(build.baseObj);
    build.group.add(build.baseObj); buildReflect.add(build.baseRefl);
    build.group.updateMatrixWorld(true);
    if (refit) { for (const p of build.parts) setXZ(p, p.x, p.z); rebuildParts(); }
    updateBuilderPose();
  }
  function addFlame(obj) {
    const f = fullKit.flame.clone(true);
    f.traverse((m) => { if (m.isMesh) m.material = flameMat(m.name, build.flameAmp); });
    f.position.y = man.flameY;
    const glow = new THREE.Sprite(glowSpriteMat);
    glow.scale.setScalar(0.26); glow.position.y = 0.026;
    glow.raycast = () => {};
    f.add(glow);
    f.visible = false;
    obj.add(f);
    obj.userData.flame = f;
  }
  function partObj(p) {
    const o = M.cloneItem(fullKit, p.k, p.c);
    o.userData.refl = reflOf(o);
    if (p.k === M.CANDLE) addFlame(o);
    if (p.k === M.INCENSE) o.traverse((m) => { if (m.isMesh && m.name === "incense_ember") { o.userData.ember = m.material; m.material.userData.col = m.material.color.clone(); } });
    return o;
  }
  function syncPart(i) {
    const p = build.parts[i], o = build.objs[i], r = o.userData.refl;
    o.position.set(p.x, p.y, p.z); o.rotation.y = (p.r * Math.PI) / 180; o.scale.setScalar(p.s);
    r.position.copy(o.position); r.rotation.copy(o.rotation); r.scale.copy(o.scale);
  }
  function rebuildParts() {
    for (const o of build.objs) { build.group.remove(o); buildReflect.remove(o.userData.refl); }
    build.objs = build.parts.map((p) => partObj(p));
    build.objs.forEach((o, i) => { build.group.add(o); buildReflect.add(o.userData.refl); syncPart(i); });
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
    const o = build.objs[i];
    selRing.visible = !!o;
    if (o) {
      const p = build.parts[i];
      selRing.position.set(p.x, p.y + 0.003, p.z);
      selRing.scale.setScalar(itemR(p.k) * p.s + 0.012);
    }
    api.onSelect && api.onSelect(i >= 0 && o ? { index: i, part: build.parts[i], count: build.parts.length } : null);
  }

  /* ---------- วางบนผิวฐาน: ยิงรังสีลงตรง ๆ หาความสูงผิว · ไม่เกินวงวางของฐาน ---------- */
  const vray = new THREE.Raycaster(), vo = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), lv = new THREE.Vector3();
  function surfaceY(x, z) {
    build.group.updateMatrixWorld(true);
    build.group.localToWorld(vo.set(x, 1.2, z));
    vray.set(vo, DOWN);
    const h = vray.intersectObject(build.baseObj, true)[0];
    return h ? build.group.worldToLocal(lv.copy(h.point)).y : place().y;
  }
  function setXZ(p, x, z) {
    const R = place().radius, r = Math.hypot(x, z);
    if (r > R) { x *= R / r; z *= R / r; }
    p.x = x; p.z = z; p.y = surfaceY(x, z);
  }
  // จุดว่างถัดไปบนฐาน (กดปุ่มของแต่ง = วางทันที): ลองจุดเกลียวมุมทองคำในวงวาง เลือกจุดที่ห่างชิ้นอื่นที่สุด · เทียนชอบตรงกลาง
  function autoSlot(k) {
    const R = place().radius, rk = itemR(k);
    let best = [0, 0], bestScore = -Infinity;
    for (let n = 0; n < 64; n++) {
      const a = n * 2.39996, r = n ? R * Math.sqrt(n / 63) : 0;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let gap = Infinity;
      for (const p of build.parts) gap = Math.min(gap, Math.hypot(p.x - x, p.z - z) - (itemR(p.k) * p.s + rk) * 0.7);
      const score = Math.min(gap, 1) - (k === M.CANDLE ? r * 0.5 : r * 0.05);
      if (score > bestScore) { bestScore = score; best = [x, z]; }
    }
    return best;
  }
  function addPart(k, x, z) {
    if (build.parts.length >= M.MAX_PARTS) { api.onLimit && api.onLimit(); return false; }
    if (x == null) [x, z] = autoSlot(k);
    snapshot();
    const p = { k, x: 0, y: 0, z: 0, r: k === M.CANDLE || k === M.INCENSE ? 0 : Math.round((Math.random() * 2 - 1) * 40), s: 1, c: M.ITEMS[k].colors[0] || "#ffffff" };
    setXZ(p, x, z);
    build.parts.push(p);
    const o = partObj(p);
    build.objs.push(o); build.group.add(o); buildReflect.add(o.userData.refl);
    syncPart(build.parts.length - 1);
    select(build.parts.length - 1);
    if (gsap) {
      const s = p.s;
      gsap.fromTo(o.position, { y: p.y + 0.12 }, { y: p.y, duration: 0.45, ease: "bounce.out", onUpdate: () => { o.userData.refl.position.y = o.position.y; } });
      gsap.from(o.scale, { x: s * 0.6, y: s * 0.6, z: s * 0.6, duration: 0.35, ease: "back.out(2)", onUpdate: () => { o.userData.refl.scale.copy(o.scale); } });
    }
    api.onParts && api.onParts(build.parts.length);
    return true;
  }
  /** แก้ชิ้นที่เลือก: fn(part) · snap = เก็บประวัติก่อนแก้ (slider เก็บครั้งเดียวตอนเริ่มลาก) */
  function editSel(fn, snap = true) {
    const i = build.sel;
    if (i < 0) return;
    if (snap) snapshot();
    const p = build.parts[i];
    fn(p);
    p.s = Math.min(M.SIZE[1], Math.max(M.SIZE[0], Math.round(p.s * 100) / 100));
    p.r = ((((Math.round(p.r) + 180) % 360) + 360) % 360) - 180;
    syncPart(i); select(i);
  }
  function setSelColor(hex) {
    const i = build.sel;
    if (i < 0 || build.parts[i].c === hex) return;
    snapshot();
    const p = build.parts[i], o = build.objs[i];
    p.c = hex;
    M.setItemColor(fullKit, o, p.k, hex);
    M.setItemColor(fullKit, o.userData.refl, p.k, hex);
    const name = fullKit.tint[p.k];
    o.userData.refl.traverse((m) => { if (m.isMesh && m.name === name) m.material.color.multiplyScalar(0.55); });
    select(i);
  }
  function removeSel() {
    const i = build.sel;
    if (i < 0) return;
    snapshot();
    build.parts.splice(i, 1);
    const o = build.objs.splice(i, 1)[0];
    build.group.remove(o); buildReflect.remove(o.userData.refl);
    build.lit.delete(i);
    select(-1);
    api.onParts && api.onParts(build.parts.length);
  }
  function loadPreset() {
    snapshot();
    build.parts = M.presetParts(man, build.base);
    rebuildParts();
    select(-1);
  }

  /* ---------- โหมด: แม่น้ำ ↔ แต่งกระทง (กล้องเคลื่อนนุ่ม ๆ ด้วย GSAP · tween เดียวต่อการเปลี่ยนโหมด) ---------- */
  function tweenCamera(toPos, toTarget, blendTo, dur, done) {
    const from = { p: camPos.clone(), t: camTarget.clone(), b: view.blend }, o = { k: 0 };
    view.tween = true;
    const step = () => { camPos.lerpVectors(from.p, toPos(), o.k); camTarget.lerpVectors(from.t, toTarget(), o.k); view.blend = from.b + (blendTo - from.b) * o.k; applyViewOffset(); };
    if (!gsap) { o.k = 1; step(); view.tween = false; done && done(); return; }
    gsap.to(o, { k: 1, duration: dur, ease: "power3.inOut", onUpdate: step, onComplete: () => { view.tween = false; done && done(); } });
  }
  /** เตรียมหน้าแต่ง (โหลดโมเดลเต็มครั้งแรก) → resolve เมื่อพร้อม */
  async function prepare() {
    await Promise.all([builderKit(), riverKitP]);
    if (!build.baseObj) { setBase(1); build.parts = M.defaultParts(man, 1); rebuildParts(); }
  }
  function openBuilder() {
    rebuildParts();
    build.group.visible = true;
    build.group.position.copy(BUILD_AT);
    build.group.rotation.set(0, build.spin, 0);
    updateBuilderPose();
    view.mode = "builder";
    closeCard(false);
    tweenCamera(() => builderPose.pos, () => builderPose.target, 1, 1.2);
  }
  function closeBuilder() {
    view.mode = "river";
    select(-1);
    tweenCamera(() => riverPose.pos, () => riverPose.target, 0, 1.1, () => { if (view.mode === "river") build.group.visible = false; });
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
    select(-1);
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
    build.parts = M.defaultParts(man, 1); build.history = []; build.lit.clear(); build.litAmp = 0; build.spin = 0; build.sel = -1;
    setBase(1); rebuildParts();
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
  // ชิ้นที่รังสีโดนก่อน (เดินขึ้นหา Object3D ของชิ้น)
  function hitPiece() {
    const h = ray.intersectObjects(build.objs, true)[0];
    if (!h) return -1;
    for (let o = h.object; o; o = o.parent) { const i = build.objs.indexOf(o); if (i >= 0) return i; }
    return -1;
  }
  function movePiece() {
    const h = ray.intersectObject(build.baseObj, true)[0];
    if (!h) return;
    const p = build.parts[build.sel], lp = build.group.worldToLocal(h.point.clone());
    setXZ(p, lp.x, lp.z);
    syncPart(build.sel); select(build.sel);
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (view.mode === "follow" || (e.pointerType === "mouse" && e.button)) return;
    let piece = -1;
    if (view.mode === "builder" && build.group.visible && api.canMove && api.canMove()) { pick(e); piece = hitPiece(); }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, move: piece >= 0 && piece === build.sel, yaw: build.group.rotation.y, pitch: orbit.pitch };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.drag && Math.hypot(dx, dy) > 7 && view.mode === "builder") {
      down.drag = true; canvas.setPointerCapture(e.pointerId);
      if (down.move) snapshot();
      stage.classList.add(down.move ? "is-moving" : "is-dragging");
    }
    if (!down.drag) return;
    if (down.move) { pick(e); movePiece(); return; }
    build.spin = down.yaw + dx * 0.012;
    build.group.rotation.y = build.spin;
    orbit.pitch = Math.min(1.2, Math.max(0.15, down.pitch + dy * 0.004));
    updateBuilderPose();
  });
  const endDrag = (e) => {
    if (!down || (e && e.pointerId !== down.id)) return;
    const wasDrag = down.drag;
    down = null; stage.classList.remove("is-dragging", "is-moving");
    if (wasDrag || !e || e.type === "pointercancel") return;
    tap(e);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  function tap(e) {
    const at = pick(e);
    if (view.mode === "builder" && build.group.visible) {
      if (api.onWickTap && wickHit() >= 0) { api.onWickTap(); return; }
      const i = hitPiece();
      if (i >= 0) { select(i); return; }
      if (ray.intersectObject(build.baseObj, true).length) { select(-1); return; }
      select(-1);
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
  const wv = new THREE.Vector3();
  function wickWorld(i) { return build.objs[i].localToWorld(wv.set(0, man.flameY + 0.01, 0)); }
  function wickHit() {
    let best = -1, bestD = Infinity;
    build.parts.forEach((p, i) => {
      if (p.k !== M.CANDLE) return;
      const d = ray.ray.distanceToPoint(wickWorld(i));
      if (d < 0.16 * Math.max(1, p.s) && d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ======================================================================
   *  loop เดียว: ขยับทุกใบ → เขียน instance/Points → เรนเดอร์
   * ====================================================================== */
  const W = new THREE.Matrix4(), WM = new THREE.Matrix4(), PM = new THREE.Matrix4(), FM = new THREE.Matrix4(), FLIP = new THREE.Matrix4().makeScale(1, -1, 1);
  const e3 = new THREE.Euler(), v3 = new THREE.Vector3();
  const farPos = farGeo.attributes.position.array, farBase = farGeo.attributes.aBase.array, farFade = farGeo.attributes.aFade.array, farSize = farGeo.attributes.aSize.array;
  const gPos = glowGeo.attributes.position.array, gSize = glowGeo.attributes.aSize.array, gPh = glowGeo.attributes.aPh.array, gKind = glowGeo.attributes.aKind.array, gAmp = glowGeo.attributes.aAmp.array;
  const stats = { fps: 0, n: 0, near: 0, far: 0, calls: 0, tris: 0, js: 0, level: 0, pr: 1, glows: 0 };
  let gi = 0;
  function glow(x, y, z, size, ph, kind, amp) {
    if (gi >= GLOW_MAX) return;
    gPos[gi * 3] = x; gPos[gi * 3 + 1] = y; gPos[gi * 3 + 2] = z;
    gSize[gi] = size; gPh[gi] = ph; gKind[gi] = kind; gAmp[gi] = amp; gi++;
  }
  function putInst(mesh, idx, m, c) { if (idx >= mesh.instanceMatrix.count) return; mesh.setMatrixAt(idx, m); if (c) mesh.setColorAt(idx, c); }
  const bc = new Int32Array(3), ic = new Int32Array(M.ITEMS.length);
  let fc = 0;
  function updateBoats(t, dt) {
    bc.fill(0); ic.fill(0); fc = 0;
    let farN = 0, nearN = 0;
    gi = 0;
    const cx = riverPose.pos.x, river = view.mode === "river", cap = nearCap();
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
      W.compose(tmpP, tmpQ, tmpS.setScalar(sc * KS));
      const dx = s.x - camPos.x, dz = s.z - camPos.z;
      s.dist = Math.sqrt(dx * dx + dz * dz + camPos.y * camPos.y);
      const wantNear = s.dist < NEAR_DIST + (s.near ? 1.5 : 0);
      s.near = wantNear && nearN < cap && fade > 0.02;
      const ph = s.i * 1.7;
      if (s.near) {
        nearN++;
        WM.multiplyMatrices(FLIP, W);
        const bi = bc[sh.base];
        for (const e of RI.bases[sh.base]) { putInst(e.m, bi, W, WHITE); putInst(e.m, bi + 1, WM, DARK); }
        bc[sh.base] += 2;
        for (const it of sh.items) {
          const set = RI.items[it.k], ii = ic[it.k];
          PM.multiplyMatrices(W, it.m);
          for (const e of set) putInst(e.m, ii, PM, e.tint ? it.c : WHITE);
          if (it.k === M.CANDLE) { FM.multiplyMatrices(PM, FLAME_T); for (const f of RI.flame) putInst(f, fc, FM, null); fc++; }
          PM.multiplyMatrices(WM, it.m);
          for (const e of set) putInst(e.m, ii + 1, PM, e.tint ? it.cd : DARK);
          ic[it.k] += 2;
        }
        for (const w of sh.wicks) {
          v3.copy(w).applyMatrix4(W);
          glow(v3.x, v3.y, v3.z, 0.42 * sc, ph + v3.x * 3, 0, fade);
        }
        if (sh.wicks.length) glow(s.x, -0.42 * sc, s.z, 2.2 * sc, ph, 1, fade);
      } else if (fade > 0.02 && farN < POOL_MAX) {
        const o = farN * 3, fw = FAR_W[sh.base] * sc;
        farPos[o] = s.x; farPos[o + 1] = bob + fw * 0.42; farPos[o + 2] = s.z;
        farBase[farN] = sh.base; farFade[farN] = fade; farSize[farN] = fw;
        farN++;
        glow(s.x, bob + fw * FAR_FLAME[sh.base], s.z, 0.6 * sc, ph, 0, fade * 0.9);
        glow(s.x, -0.4 * sc, s.z, 2.0 * sc, ph, 1, fade * 0.8);
      }
      // ตำแหน่งบนจอ (ใช้กับปุ่ม DOM และการแตะเลือก)
      if (river) {
        v3.set(s.x, 0.2 * sc * KS, s.z).project(camera);
        if (v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
          s.sx = (v3.x * 0.5 + 0.5) * view.w; s.sy = (-v3.y * 0.5 + 0.5) * view.h;
          s.sr = Math.max(8, Math.min(80, (sc * BASE_W[sh.base] * KS * 0.6 * farU.uScale.value) / renderer.getPixelRatio() / s.dist));
        } else s.sx = null;
      } else s.sx = null;
    }
    // ไฟเทียนของกระทงที่กำลังแต่ง: แสงสะท้อนบนน้ำ (เปลวไฟ + วงเรืองเป็น mesh/sprite ของกระทงเอง)
    if (build.group.visible && build.lit.size && build.litAmp > 0.1) {
      const a = Math.min(1, build.litAmp);
      glow(build.group.position.x, -0.45, build.group.position.z, 2.4 * Math.min(1.2, build.litAmp), 3, 1, a);
    }
    const flag = (m, n) => { n = Math.min(n, m.instanceMatrix.count); if (n || m.count) { m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } };
    RI.bases.forEach((set, b) => { for (const e of set) flag(e.m, bc[b]); });
    // shortcut: เกิน PART_CAP ชิ้นต่อชนิด ชิ้นที่เกินจะไม่ถูกวาด (ต้องมีใบใกล้ ~160 ใบที่แต่งชนิดเดียวกัน 6+ ชิ้นพร้อมกัน), ถ้าเจอบ่อยให้เพิ่ม PART_CAP
    RI.items.forEach((set, k) => { for (const e of set) flag(e.m, ic[k]); });
    for (const f of RI.flame) { const n = Math.min(fc, f.instanceMatrix.count); if (n || f.count) { f.count = n; f.instanceMatrix.needsUpdate = true; } }
    farGeo.setDrawRange(0, farN);
    for (const a of ["position", "aBase", "aFade", "aSize"]) farGeo.attributes[a].needsUpdate = true;
    glowGeo.setDrawRange(0, gi);
    for (const a of ["position", "aSize", "aPh", "aKind", "aAmp"]) glowGeo.attributes[a].needsUpdate = true;
    stats.near = nearN; stats.far = farN; stats.glows = gi;
  }
  // หน้าแต่ง: แสง + เปลวไฟ + ถ่านธูป ตามการจุดเทียน
  const flick = (t) => 0.88 + 0.12 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3);
  const EMBER_OFF = new THREE.Color(0x3a2418);
  function updateBuilder(t) {
    const b = view.blend, lit = Math.min(1, build.litAmp);
    hemi.color.lerpColors(HEMI_SKY[0], HEMI_SKY[1], b); hemi.groundColor.lerpColors(HEMI_GROUND[0], HEMI_GROUND[1], b);
    hemi.intensity = 2.0 - 0.55 * b;
    amb.intensity = 0.55 * (1 - b); moonLight.intensity = 1.4 * (1 - b); fill.intensity = 1.1 * (1 - b);
    waterU.uDim.value = 0.45 * b;
    back.material.color.setScalar(1 - 0.55 * b);
    mists.forEach((m) => { m.material.uniforms.uAlpha.value = m.userData.a * (1 - 0.7 * b); });
    if (!build.group.visible) { candleLight.intensity = 0; return; }
    // แสงอุ่นจากเทียน 1 ดวง: อยู่ที่ไส้เทียนเล่มแรก (ไม่มีเทียน = เหนือกลางกระทง) · ยังไม่จุด = แสงอุ่นอ่อน ๆ ให้เห็นสีดอกไม้
    // ยกเหนือไส้เทียนเล็กน้อย: แสงจุดใกล้ผิวมากจะสว่างจ้าเฉพาะจุด (ธูปข้าง ๆ ขาวโพลน)
    const ci = build.parts.findIndex((p) => p.k === M.CANDLE);
    if (ci >= 0 && build.objs[ci]) candleLight.position.copy(wickWorld(ci));
    else build.group.localToWorld(candleLight.position.set(0, place().y + 0.3, 0));
    candleLight.position.lerp(camera.position, 0.3).y += 0.3;     // ค่อนมาทางกล้อง: ด้านที่เห็นได้แสงอุ่น (ไม่ใช่แค่ยอดเทียน)
    candleLight.intensity = b * (1.6 + 3.2 * lit * flick(t)) * (1 + build.lift * 0.5);
    build.flameAmp.value = lit * (1 + build.lift * 0.4);
    glowSpriteMat.opacity = lit * flick(t + 0.4);
    build.objs.forEach((o, i) => {
      const f = o.userData.flame;
      if (f) { f.visible = build.lit.has(i) && build.litAmp > 0.01; if (f.visible) f.scale.setScalar(0.35 + 0.65 * lit); }
      const em = o.userData.ember;
      if (em) { em.emissiveIntensity = (build.lit.size ? lit : 0) * 4.5 * flick(t * 0.5 + i); em.color.lerpColors(EMBER_OFF, em.userData.col, build.lit.size ? lit : 0); }
    });
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

  /* ---------- ปรับคุณภาพตามเครื่อง: FPS < 50 ติดกัน 2 วินาที → ลดขั้น (จำนวนใบ + ใบเต็มรายละเอียด + DPR) ---------- */
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
    waterU.uTime.value = glowU.uTime.value = timeU.value = t;
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
    updateBuilder(t);
    placeButtons();
    if (cardSlot) placeCard();
    stats.js = stats.js * 0.9 + (performance.now() - t0) * 0.1;
    renderer.render(scene, camera);
    watchFps(performance.now());
    if (dbg && t - dbgT > 0.5) {
      dbgT = t;
      stats.n = activeN; stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; stats.level = view.level; stats.pr = renderer.getPixelRatio();
      dbg.textContent = `FPS ${stats.fps} · กระทง ${activeN} (ใกล้ ${stats.near} · ไกล ${stats.far}) · ระดับ ${view.level + 1}/${LEVELS.length}${LOCK_N ? " ล็อก" : ""} · DPR ${stats.pr.toFixed(2)} · draw ${stats.calls} · ${(stats.tris / 1000).toFixed(0)}k tri · JS ${stats.js.toFixed(1)} ms`;
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

  return {
    renderer, scene, camera, clock, build, three: THREE, ready,
    feed: feedRecord, drop: dropRecord, has: (id) => shown.has(id) || feed.some((k) => k.id === id), count: () => activeN, closeCard,
    prepare, openBuilder, closeBuilder, setBase, addPart, undo, select, editSel, setSelColor, removeSel, release, resetBuild, loadPreset, snapshot,
    selectStep(d) { if (build.parts.length) select(((build.sel < 0 ? (d > 0 ? -1 : 0) : build.sel) + d + build.parts.length) % build.parts.length); },
    state: () => ({ base: build.base, parts: build.parts.map(M.packPart) }),
    setPanel(x, y) { view.panel.x = x; view.panel.y = y; updateBuilderPose(); applyViewOffset(); },
    /** ปลายไส้เทียนเล่มแรกบนจอ (px) หรือ null */
    wickOnScreen() {
      const i = build.parts.findIndex((p) => p.k === M.CANDLE);
      if (i < 0 || !build.objs[i]) return null;
      const p = wickWorld(i).project(camera);
      return { x: (p.x * 0.5 + 0.5) * view.w, y: (-p.y * 0.5 + 0.5) * view.h };
    },
    get man() { return man; },
    addRipple, tweenCamera, camPos, camTarget, riverPose, builderPose, view, stats,
    setActive, get active() { return active; },
    dispose() { setActive(false); renderer.dispose(); },
  };
}
