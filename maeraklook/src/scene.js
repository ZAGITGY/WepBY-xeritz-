// ฉาก 3D ของใช้เด็ก (three.js r187) — build เป็น assets/js/scene.js ด้วย build.sh
// โครง: ทุกชิ้นเป็น holder (ตำแหน่งตามจอ) > inner (GSAP ขยับ) > model
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// สีพาสเทลจากโลโก้ (ตรงกับ token ใน index.html)
const C = {
  pink: 0xF7A8C0, peach: 0xFBC6A4, yellow: 0xF8DF8E, mint: 0xAEE2C6, sky: 0xA9D3F2, lav: 0xCBB7EC,
  cream: 0xFFF6EA, milk: 0xFFFBF3,
};
// สีเข้มของตัวอักษรบนบล็อก (ชุดเดียวกับตัวหนังสือรุ้งในเว็บ)
const INK = { pink: '#D9577F', orange: '#D8732F', blue: '#3A86C8', purple: '#8A63CF' };

/* ================= วัสดุ ================= */
// พลาสติกเงา (ABS/PP) — เคลือบใส เงาสะท้อนนุ่ม
const plastic = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.3, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.14, specularIntensity: 0.5, ...o,
});
// ซิลิโคน — ด้านกว่า มี sheen ที่ขอบให้ดูนุ่ม
const silicone = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4,
  sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), specularIntensity: 0.45, ...o,
});
// พลาสติกขุ่นสีพาสเทล (ตัวขวด โดมของเขย่า) — ขอบทึบกว่ากลางตามมุมมอง (fresnel) เห็นของข้างใน
function frosted(color, { side = THREE.FrontSide, minA = 0.3, maxA = 0.85, roughness = 0.16, iridescence = 0.35 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 0.8,
    iridescence, iridescenceIOR: 1.3, iridescenceThicknessMinimum: 220, iridescenceThicknessMaximum: 420,
    transparent: true, depthWrite: false, side,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMinA = { value: minA };
    sh.uniforms.uMaxA = { value: maxA };
    sh.fragmentShader = 'uniform float uMinA;\nuniform float uMaxA;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'float nvF = abs(dot(normalize(normal), normalize(vViewPosition)));\n' +
      'diffuseColor.a = mix(uMinA, uMaxA, pow(1.0 - nvF, 1.7));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => `frosted-${minA}-${maxA}`;
  return m;
}

/* ================= ตัวช่วยสร้างรูปทรง ================= */
const v2 = ([x, y]) => new THREE.Vector2(x, y);
// เส้นโค้งเรียบผ่านจุดควบคุม (สำหรับกลึงรอบแกน Y)
function profile(ctrl, n = 64) {
  const pts = new THREE.SplineCurve(ctrl.map(v2)).getSpacedPoints(n);
  pts.forEach((p) => { p.x = Math.max(0, p.x); });
  return pts;
}
const lathe = (ctrl, mat, { n = 64, seg = 72 } = {}) => new THREE.Mesh(new THREE.LatheGeometry(profile(ctrl, n), seg), mat);
// รัศมีของโปรไฟล์ที่ความสูง y (ใช้วางขีดบอกปริมาณให้แนบผิวขวด)
function radiusAt(pts, y, yMin, yMax) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.y < yMin || b.y > yMax) continue;
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
  }
  return pts[0].x;
}
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.62);
  s.bezierCurveTo(-0.12, -0.48, -0.62, -0.2, -0.62, 0.15);
  s.bezierCurveTo(-0.62, 0.46, -0.36, 0.62, -0.2, 0.6);
  s.bezierCurveTo(-0.08, 0.6, -0.02, 0.52, 0, 0.42);
  s.bezierCurveTo(0.02, 0.52, 0.08, 0.6, 0.2, 0.6);
  s.bezierCurveTo(0.36, 0.62, 0.62, 0.46, 0.62, 0.15);
  s.bezierCurveTo(0.62, -0.2, 0.12, -0.48, 0, -0.62);
  return s;
}
const puffy = (shape, depth, bevel, mat) => {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 8, curveSegments: 40,
  });
  geo.center();
  return new THREE.Mesh(geo, mat);
};

/* ================= แสงแบบสตูดิโอ =================
   เงาสะท้อนบนพลาสติกเป็นโทนครีม-ม่วงอ่อน เข้ากับพื้นเว็บ (ไม่ใช้ภาพ HDR จากภายนอก) */
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(20, 48, 24);
  const top = new THREE.Color(0xfffcf6), mid = new THREE.Color(0xf4ecf2), bot = new THREE.Color(0xb9abc9);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 20;
    if (t > 0) c.copy(mid).lerp(top, t); else c.copy(mid).lerp(bot, -t);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  box(12, 8, -8, 9, 11, 5);    // ไฟหลัก ซ้ายบนด้านหน้า
  box(8, 5, 11, 3, 7, 2.6);    // ไฟเติม ขวา
  box(16, 4, 0, -1, -14, 2.2); // ไฟหลัง ให้ขอบสว่าง
  box(7, 7, 2, 16, 2, 2.8);    // ไฟบน
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

/* ================= โมเดล ================= */

// ขวดนม: ตัวขวดขุ่นสีม่วงพาสเทล มีนมข้างใน ขีดบอกปริมาณ ฝาเกลียวมีร่องกันลื่น จุกนมซิลิโคน
function bottle() {
  const g = new THREE.Group();
  const outer = [[0, 0], [0.42, 0], [0.6, 0.02], [0.7, 0.08], [0.742, 0.2], [0.75, 0.45], [0.738, 0.78], [0.712, 1.02],
    [0.72, 1.22], [0.745, 1.47], [0.752, 1.7], [0.742, 1.88], [0.71, 1.98], [0.665, 2.05], [0.635, 2.1], [0.63, 2.3], [0, 2.31]];
  const pts = profile(outer, 96);
  const bodyGeo = new THREE.LatheGeometry(pts, 96);
  const back = new THREE.Mesh(bodyGeo, frosted(C.lav, { side: THREE.BackSide, minA: 0.16, maxA: 0.5 }));
  const front = new THREE.Mesh(bodyGeo, frosted(C.lav, { minA: 0.24, maxA: 0.8 }));
  back.renderOrder = 1; front.renderOrder = 2;

  const milk = lathe([[0, 0.06], [0.4, 0.06], [0.58, 0.08], [0.668, 0.14], [0.702, 0.26], [0.71, 0.45], [0.7, 0.78],
    [0.676, 1.0], [0.681, 1.14], [0.69, 1.23], [0.6, 1.247], [0, 1.25]],
  new THREE.MeshPhysicalMaterial({ color: C.milk, roughness: 0.32, clearcoat: 0.2, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), emissive: 0xfff3e2, emissiveIntensity: 0.12 }), { n: 64, seg: 72 });

  // ขีดบอกปริมาณ (นูนเล็กน้อย) หันมาทางกล้อง
  const markMat = plastic(0x9C7EDB, { clearcoat: 0.5, roughness: 0.4 });
  const markGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.3);
  const theta = -0.32;
  for (let i = 0; i < 7; i++) {
    const y = 0.4 + i * 0.19, long = i % 2 === 0;
    const r = radiusAt(pts, y, 0.15, 1.95);
    const m = new THREE.Mesh(markGeo, markMat);
    m.scale.set(long ? 0.26 : 0.15, 0.034, 0.03);
    const off = long ? 0 : -0.055;
    m.position.set(Math.sin(theta) * r + Math.cos(theta) * off, y, Math.cos(theta) * r - Math.sin(theta) * off);
    m.rotation.y = theta;
    g.add(m);
  }
  // หัวใจเล็กบนขวด
  const heart = puffy(heartShape(), 0.02, 0.03, plastic(C.pink));
  heart.scale.setScalar(0.2);
  const rh = radiusAt(pts, 1.76, 0.15, 1.95);
  heart.position.set(Math.sin(theta) * (rh + 0.012), 1.76, Math.cos(theta) * (rh + 0.012));
  heart.rotation.y = theta;
  g.add(heart);

  // ฝาเกลียว + ร่องกันลื่น
  const pinkMat = plastic(C.pink);
  const collar = lathe([[0.58, 2.04], [0.685, 2.04], [0.724, 2.072], [0.738, 2.13], [0.738, 2.42], [0.724, 2.475],
    [0.68, 2.515], [0.6, 2.535], [0.52, 2.535]], plastic(C.pink, { side: THREE.DoubleSide }), { n: 40, seg: 96 });
  const ribGeo = new RoundedBoxGeometry(0.05, 0.25, 0.05, 2, 0.022);
  const ribs = new THREE.InstancedMesh(ribGeo, pinkMat, 44);
  const d = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    d.position.set(Math.sin(a) * 0.74, 2.275, Math.cos(a) * 0.74); d.rotation.set(0, a, 0); d.updateMatrix();
    ribs.setMatrixAt(i, d.matrix);
  }
  // จุกนมซิลิโคน
  const nipple = lathe([[0, 2.5], [0.5, 2.5], [0.53, 2.52], [0.52, 2.56], [0.46, 2.61], [0.37, 2.68], [0.28, 2.76],
    [0.21, 2.85], [0.172, 2.95], [0.166, 3.04], [0.18, 3.12], [0.19, 3.2], [0.17, 3.28], [0.12, 3.34], [0.06, 3.37], [0, 3.38]],
  silicone(C.peach), { n: 90, seg: 72 });
  g.add(milk, back, front, collar, ribs, nipple);
  return g;
}

// ของเขย่า: ครึ่งล่างทึบ ครึ่งบนโดมใสมีลูกปัดข้างใน ด้ามมีลอนกันลื่น ห่วงท้าย
function rattle() {
  const g = new THREE.Group();
  const R = 0.6, cy = 1.2;
  const lower = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 36, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), plastic(C.yellow));
  lower.position.y = cy;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 72), plastic(0xFCEDBE, { roughness: 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = cy + 0.002;
  const domeGeo = new THREE.SphereGeometry(R, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeBack = new THREE.Mesh(domeGeo, frosted(C.sky, { side: THREE.BackSide, minA: 0.08, maxA: 0.35, roughness: 0.08 }));
  const domeFront = new THREE.Mesh(domeGeo, frosted(C.sky, { minA: 0.12, maxA: 0.7, roughness: 0.06 }));
  domeBack.position.y = domeFront.position.y = cy;
  domeBack.renderOrder = 1; domeFront.renderOrder = 2;
  // ลูกปัด [x, z, รัศมี, สี, ชั้น]
  [[-0.22, 0.12, 0.13, C.pink], [0.17, 0.2, 0.12, C.mint], [0.27, -0.12, 0.12, C.lav], [-0.08, -0.25, 0.11, C.peach],
    [0.03, 0.0, 0.135, 0xffffff], [-0.31, -0.15, 0.1, C.sky], [0.05, 0.14, 0.11, C.pink, 1], [-0.12, -0.06, 0.1, C.mint, 1]]
    .forEach(([x, z, r, c, layer]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), plastic(c, { roughness: 0.22 }));
      b.position.set(x, cy + r + (layer ? 0.19 : 0), z);
      g.add(b);
    });
  const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.055, 24, 120), plastic(C.pink));
  band.rotation.x = Math.PI / 2; band.position.y = cy;
  const handle = lathe([[0, -1.0], [0.17, -0.98], [0.225, -0.9], [0.232, -0.8], [0.19, -0.7], [0.15, -0.62], [0.15, -0.5],
    [0.172, -0.42], [0.15, -0.34], [0.172, -0.26], [0.15, -0.18], [0.172, -0.1], [0.15, -0.02], [0.158, 0.14], [0.19, 0.3],
    [0.245, 0.45], [0.3, 0.58], [0.345, 0.7], [0.3, 0.75], [0, 0.77]], plastic(C.mint), { n: 140, seg: 64 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.085, 24, 96), plastic(C.lav));
  ring.position.y = -1.33;
  g.add(lower, floor, band, handle, ring, domeBack, domeFront);
  return g;
}

// จุกหลอก: แผ่นกันทรงผีเสื้อโค้งมีรูระบายอากาศ ปุ่มหน้า ห่วงจับ จุกซิลิโคนทรงแบน
function pacifier() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0.34);
  s.bezierCurveTo(0.18, 0.5, 0.62, 0.56, 0.82, 0.36);
  s.bezierCurveTo(1.0, 0.18, 0.98, -0.2, 0.78, -0.36);
  s.bezierCurveTo(0.58, -0.52, 0.2, -0.44, 0, -0.36);
  s.bezierCurveTo(-0.2, -0.44, -0.58, -0.52, -0.78, -0.36);
  s.bezierCurveTo(-0.98, -0.2, -1.0, 0.18, -0.82, 0.36);
  s.bezierCurveTo(-0.62, 0.56, -0.18, 0.5, 0, 0.34);
  [0.6, -0.6].forEach((cx) => { const h = new THREE.Path(); h.absellipse(cx, 0.01, 0.115, 0.15, 0, Math.PI * 2, true); s.holes.push(h); });
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 6, curveSegments: 48 });
  geo.translate(0, 0, -0.02);
  // ดัดให้โค้งรับหน้า (z += k·x²) และหมุน normal ตาม
  const p = geo.attributes.position, n = geo.attributes.normal, k = 0.2, nv = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) + k * x * x);
    nv.set(n.getX(i) - 2 * k * x * n.getZ(i), n.getY(i), n.getZ(i)).normalize();
    n.setXYZ(i, nv.x, nv.y, nv.z);
  }
  const shield = new THREE.Mesh(geo, plastic(C.lav, { roughness: 0.26 }));
  // ปุ่มหน้า + หัวใจ
  const knob = lathe([[0, 0], [0.3, 0], [0.33, 0.035], [0.33, 0.09], [0.29, 0.15], [0.19, 0.19], [0, 0.2]], plastic(C.cream), { n: 40, seg: 64 });
  knob.rotation.x = Math.PI / 2; knob.position.z = 0.05;
  const heart = puffy(heartShape(), 0.03, 0.05, plastic(C.pink));
  heart.scale.setScalar(0.22); heart.position.z = 0.255;
  // ห่วงจับ
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 24, 96), plastic(C.sky));
  ring.position.set(0, -0.2, 0.3); ring.rotation.x = -0.35;
  // จุกซิลิโคน (ชี้ไปด้านหลัง แบนแบบ orthodontic)
  const teat = lathe([[0, 0], [0.22, 0], [0.19, 0.06], [0.125, 0.14], [0.115, 0.22], [0.16, 0.34], [0.24, 0.5], [0.27, 0.64],
    [0.25, 0.78], [0.18, 0.9], [0.09, 0.97], [0, 0.99]], silicone(C.peach), { n: 70, seg: 64 });
  teat.scale.set(1, 1, 0.72); teat.rotation.x = -Math.PI / 2; teat.position.z = -0.06;
  g.add(teat, shield, knob, heart, ring);
  return g;
}

// บล็อกของเล่น ก ข ค — ขอบกรอบนูน ตัวอักษรและเลขไทยนูน (วาดลง canvas แล้วทำ bump)
const faceJobs = [];
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawGlyph(ctx, size, content, color) {
  ctx.fillStyle = color;
  if (content.text) {
    ctx.font = `700 ${Math.round(size * content.size)}px Mali, Prompt, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(content.text);
    const asc = m.actualBoundingBoxAscent || size * 0.35, desc = m.actualBoundingBoxDescent || 0;
    ctx.fillText(content.text, size / 2, size / 2 + (asc - desc) / 2);
  } else if (content.shape === 'heart') {
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.scale(size * 0.26, -size * 0.26);
    const hs = heartShape(), pts = hs.getPoints(40);
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (content.shape === 'star') {
    ctx.save(); ctx.translate(size / 2, size / 2 + size * 0.015);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = (i % 2 ? 0.115 : 0.25) * size;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.04; ctx.strokeStyle = color; ctx.stroke(); ctx.fill();
    ctx.restore();
  } else if (content.shape === 'dots') {
    [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(size / 2 + dx * size * 0.15, size / 2 + dy * size * 0.15, size * 0.06, 0, Math.PI * 2); ctx.fill();
    });
  }
}
function paintFace(job) {
  const { ctx, bctx, size, base, ink, content } = job;
  const inset = size * 0.165, rr = size * 0.09, lw = size * 0.042;
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, rr); ctx.stroke();
  if (content) drawGlyph(ctx, size, content, ink);
  // bump: ขาว = นูน
  const bs = bctx.canvas.width, k = bs / size;
  bctx.save(); bctx.fillStyle = '#000'; bctx.fillRect(0, 0, bs, bs);
  bctx.scale(k, k);
  if ('filter' in bctx) bctx.filter = `blur(${(size * 0.006).toFixed(1)}px)`;
  bctx.lineWidth = lw; bctx.strokeStyle = '#fff';
  roundRectPath(bctx, inset, inset, size - inset * 2, size - inset * 2, rr); bctx.stroke();
  if (content) drawGlyph(bctx, size, content, '#fff');
  bctx.restore();
  job.map.needsUpdate = true; job.bump.needsUpdate = true;
}
function faceMaterial(base, ink, content) {
  const size = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const bv = document.createElement('canvas'); bv.width = bv.height = 128;
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bv);
  const job = { ctx: cv.getContext('2d'), bctx: bv.getContext('2d'), size, base, ink, content, map, bump };
  paintFace(job);
  if (content && content.text) faceJobs.push(job);
  return plastic(0xffffff, { map, bumpMap: bump, bumpScale: 2.2, roughness: 0.34 });
}
function blocks() {
  const g = new THREE.Group();
  const geo = new RoundedBoxGeometry(1, 1, 1, 5, 0.14);
  // [สีพื้น, สีตัวอักษร, หน้า, ข้าง, บน, ตำแหน่ง, หมุน]
  [['#F7A8C0', INK.pink, 'ก', '๑', 'heart', [-0.54, 0, 0], 0.1],
    ['#A9D3F2', INK.blue, 'ข', '๒', 'star', [0.55, 0, 0.04], -0.08],
    ['#F8DF8E', INK.orange, 'ค', '๓', 'dots', [0.02, 1.0, -0.02], 0.22]].forEach(([base, ink, front, side, top, pos, ry]) => {
    const plain = faceMaterial(base, ink, null);
    // ลำดับหน้า: +x, -x, +y, -y, +z, -z
    const mats = [
      faceMaterial(base, ink, { text: side, size: 0.5 }), plain,
      faceMaterial(base, ink, { shape: top }), plain,
      faceMaterial(base, ink, { text: front, size: 0.62 }), plain,
    ];
    const b = new THREE.Mesh(geo, mats);
    b.position.set(...pos); b.rotation.y = ry;
    g.add(b);
  });
  return g;
}

// ห่วงเรียงสีรุ้ง (สีเดียวกับรุ้งในโลโก้)
function stacker() {
  const g = new THREE.Group();
  const cream = plastic(C.cream, { roughness: 0.34 });
  const base = lathe([[0, 0], [0.58, 0], [0.68, 0.03], [0.72, 0.1], [0.71, 0.17], [0.64, 0.22], [0.5, 0.235], [0, 0.235]], cream, { n: 50, seg: 72 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 32), cream);
  post.position.y = 1.0;
  let y = 0.235;
  [[0.44, 0.2, C.pink], [0.4, 0.185, C.peach], [0.36, 0.17, C.yellow], [0.32, 0.155, C.mint], [0.28, 0.14, C.sky]].forEach(([R, r, c]) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, r, 32, 96), plastic(c));
    t.rotation.x = Math.PI / 2; t.scale.set(1, 1, 0.82);
    const hh = r * 0.82;
    t.position.y = y + hh; y += hh * 2 - 0.015;
    g.add(t);
  });
  const knob = lathe([[0, 0], [0.16, 0], [0.2, 0.05], [0.235, 0.14], [0.225, 0.24], [0.17, 0.32], [0.08, 0.36], [0, 0.37]], plastic(C.lav), { n: 40, seg: 64 });
  knob.position.y = y - 0.03;
  g.add(base, post, knob);
  return g;
}

// เป็ดยาง
function duck() {
  const g = new THREE.Group();
  const yel = plastic(0xF9E19A, { roughness: 0.36, clearcoat: 0.6 });
  const bodyGeo = new THREE.SphereGeometry(0.62, 72, 48);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 1.28, y = p.getY(i) * 0.8;
    const z = p.getZ(i);
    const t = Math.max(0, -x - 0.35);               // หางงอนขึ้น
    y += t * t * 1.7 * (y > -0.1 ? 1 : 0.3);
    x -= t * 0.12;
    if (y < -0.32) y = -0.32 + (y + 0.32) * 0.45;   // ก้นแบนนิดหน่อย
    p.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, yel);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 64, 40), yel);
  head.position.set(0.45, 0.62, 0);
  const beakMat = silicone(0xF9B48A, { roughness: 0.42 });
  const beakTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 24), beakMat);
  beakTop.scale.set(1.25, 0.42, 0.95); beakTop.position.set(0.84, 0.6, 0);
  const beakBot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 20), beakMat);
  beakBot.scale.set(1.1, 0.35, 0.8); beakBot.position.set(0.8, 0.52, 0);
  const eyeMat = plastic(0x4A3B5C, { roughness: 0.12, clearcoat: 1 });
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cheekMat = silicone(0xF7A8C0, { roughness: 0.6 });
  [-1, 1].forEach((sd) => {
    const dir = new THREE.Vector3(0.62, 0.36, 0.62 * sd).normalize();
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 16), eyeMat);
    e.position.copy(head.position).addScaledVector(dir, 0.385);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), hiMat);
    h.position.copy(e.position).add(new THREE.Vector3(0.028, 0.026, 0.03 * sd));
    const cdir = new THREE.Vector3(0.5, 0.06, 0.86 * sd).normalize();
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), cheekMat);
    ck.position.copy(head.position).addScaledVector(cdir, 0.385);
    ck.lookAt(ck.position.clone().add(cdir)); ck.scale.set(1, 0.7, 0.3);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 24), plastic(0xF6D67A, { roughness: 0.4 }));
    w.scale.set(1.15, 0.6, 0.32); w.position.set(-0.08, 0.08, 0.56 * sd); w.rotation.set(0, 0, 0.35);
    g.add(e, h, ck, w);
  });
  g.add(body, head, beakTop, beakBot);
  return g;
}

const heartToy = (color) => puffy(heartShape(), 0.12, 0.16, plastic(color, { roughness: 0.26 }));
const ball = (color, r) => new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), plastic(color, { roughness: 0.24 }));

/* ================= ตำแหน่งบนจอ =================
   [x, y, z, ขนาด] — x, y เป็นสัดส่วนของจอ (-1 = ซ้าย/ล่างสุด, 1 = ขวา/บนสุด), z ยิ่งติดลบยิ่งอยู่ลึก
   ขนาด 0 = ไม่แสดงในจอนั้น
   หลังวางแล้ว ระบบจะดันชิ้นที่ไปทับตัวหนังสือเล็ก/ปุ่ม ออกให้อัตโนมัติ (ดู keepOut ใน index.html) */
const LAYOUT = {
  wide: {
    bottle: [0.6, -0.08, -1, 1.12], rattle: [-0.74, -0.24, -0.6, 0.74], pacifier: [0.22, 0.58, 0.2, 0.78],
    blocks: [0.84, 0.62, -2.6, 0.8], stacker: [-0.16, -0.66, -0.4, 0.74], duck: [0.84, -0.72, 0.3, 0.62],
    heart1: [0.34, -0.04, -1.6, 0.3], heart2: [-0.48, 0.74, -2.2, 0.24], ball1: [0.4, -0.5, -3, 1], ball2: [-0.4, 0.82, -2, 0.8],
  },
  tall: {
    bottle: [0.56, -0.36, -1, 1.0], rattle: [-0.6, -0.34, -0.5, 0.84], pacifier: [0.0, -0.52, 0.4, 0.74],
    blocks: [0.64, 0.68, -2.6, 0.74], stacker: [-0.82, 0.06, -0.8, 0.62], duck: [0.78, 0.06, -0.2, 0.62],
    heart1: [-0.15, -0.16, -1.4, 0.34], heart2: [-0.62, 0.74, -2.2, 0.3], ball1: [0.1, 0.78, -3, 0.9], ball2: [0.84, -0.86, -0.5, 0.9],
  },
};

export function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 1.0;
  const key = new THREE.DirectionalLight(0xfffaf2, 1.5);
  key.position.set(-4, 7, 9);
  const rim = new THREE.DirectionalLight(0xf3e9ff, 0.9);
  rim.position.set(5, 3, -7);
  scene.add(key, rim, new THREE.HemisphereLight(0xfff6ec, 0xe6dcf2, 0.55));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 16);
  const rig = new THREE.Group();
  scene.add(rig);

  // [ชื่อ, ฟังก์ชันสร้าง, การหมุนตั้งต้น, ชิ้นเล็ก]
  const defs = [
    ['bottle', bottle, [0.08, 0.32, -0.24]],
    ['rattle', rattle, [0.12, 0.3, 0.5]],
    ['pacifier', pacifier, [0.3, -0.95, 0.18]],
    ['blocks', blocks, [0.3, -0.42, 0]],
    ['stacker', stacker, [0.16, 0.2, -0.12]],
    ['duck', duck, [0.1, -0.75, 0.04]],
    ['heart1', () => heartToy(C.pink), [0.1, 0.35, 0.22], true],
    ['heart2', () => heartToy(C.lav), [0.05, -0.3, -0.28], true],
    ['ball1', () => ball(C.mint, 0.34), [0, 0, 0], true],
    ['ball2', () => ball(C.sky, 0.28), [0, 0, 0], true],
  ];
  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
  const items = defs.map(([name, make, rot, small]) => {
    const model = make();
    model.rotation.set(...rot);
    model.updateMatrixWorld(true);
    box.setFromObject(model, true); box.getSize(size); box.getCenter(center);
    model.position.sub(center); // ให้จุดหมุนอยู่กลางชิ้น
    const it = { name, model, small: !!small, size: size.clone(), holder: new THREE.Group(), inner: new THREE.Group(), riseFrom: -12 };
    it.inner.add(model); it.holder.add(it.inner); rig.add(it.holder);
    return it;
  });

  // พื้นที่ห้ามทับ (ตัวหนังสือเล็ก ปุ่ม เมนู) — หน้าเว็บส่งเข้ามาด้วย setKeepOut
  let keepOut = () => [];
  let halfH = 1, halfW = 1, W = 1, H = 1, rects = [];
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function layout() {
    const L = camera.aspect >= 1 ? LAYOUT.wide : LAYOUT.tall;
    const s = camera.aspect >= 1 ? Math.min(1, Math.max(0.62, halfW / 7)) : Math.min(0.88, Math.max(0.62, halfW / 3.2));
    const cr = canvas.getBoundingClientRect();
    const zones = keepOut().filter((z) => z.rect.width > 0 && z.rect.height > 0).map((z) => {
      const r = z.rect; const pad = z.pad || 0, sh = z.shrink || 0;
      return {
        l: r.left - cr.left - pad + r.width * sh, r: r.right - cr.left + pad - r.width * sh,
        t: r.top - cr.top - pad + r.height * sh, b: r.bottom - cr.top + pad - r.height * sh,
      };
    }).filter((z) => z.r > z.l && z.b > z.t);
    // ตำแหน่งตั้งต้น (px)
    const P = items.map((it) => {
      const [nx, ny, z, k] = L[it.name];
      const visible = k > 0;
      const sc = Math.max(k, 0.001) * s;
      const ppu = H / (2 * tanHalf * (camera.position.z - z));
      const hw = (it.size.x * sc * ppu * 0.86) / 2, hh = (it.size.y * sc * ppu * 0.86) / 2;
      return { it, z, sc, visible, ppu, hw, hh, cx: ((nx + 1) / 2) * W, cy: ((1 - ny) / 2) * H };
    });
    const bound = (q) => {
      q.cx = Math.min(W - q.hw * 0.3, Math.max(q.hw * 0.3, q.cx));
      q.cy = Math.min(H - q.hh * 0.4, Math.max(q.hh + 6, q.cy));
    };
    const overlap = (a, z) => ({
      x: Math.min(a.cx + a.hw, z.r) - Math.max(a.cx - a.hw, z.l),
      y: Math.min(a.cy + a.hh, z.b) - Math.max(a.cy - a.hh, z.t),
    });
    for (let iter = 0; iter < 12; iter++) {
      // ชิ้นไม่ซ้อนกันเกินไป
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j];
        if (!a.visible || !b.visible) continue;
        const o = overlap(a, { l: b.cx - b.hw, r: b.cx + b.hw, t: b.cy - b.hh, b: b.cy + b.hh });
        if (o.x <= 0 || o.y <= 0) continue;
        const allow = 0.12 * Math.min(a.hw * a.hh, b.hw * b.hh) * 4;
        if (o.x * o.y <= allow) continue;
        const wa = a.it.small ? 1 : b.it.small ? 0 : 0.5, wb = 1 - wa;
        if (o.x < o.y) { const d = (b.cx > a.cx ? 1 : -1) * o.x; a.cx -= d * wa; b.cx += d * wb; }
        else { const d = (b.cy > a.cy ? 1 : -1) * o.y; a.cy -= d * wa; b.cy += d * wb; }
      }
      // ดันออกจากตัวหนังสือเล็ก/ปุ่ม
      for (const q of P) {
        if (!q.visible) continue;
        for (const zz of zones) {
          const o = overlap(q, zz);
          if (o.x <= 0 || o.y <= 0) continue;
          const opts = [
            { dx: zz.l - (q.cx + q.hw), dy: 0 }, { dx: zz.r - (q.cx - q.hw), dy: 0 },
            { dx: 0, dy: zz.t - (q.cy + q.hh) }, { dx: 0, dy: zz.b - (q.cy - q.hh) },
          ].map((m) => {
            const t = { ...q, cx: q.cx + m.dx, cy: q.cy + m.dy }; bound(t);
            const o2 = overlap(t, zz);
            return { m, t, cost: Math.hypot(m.dx, m.dy) + (o2.x > 0 && o2.y > 0 ? 1e5 : 0) };
          }).sort((a, b) => a.cost - b.cost);
          q.cx = opts[0].t.cx; q.cy = opts[0].t.cy;
        }
        bound(q);
      }
    }
    rects = P.map((q) => ({ name: q.it.name, l: q.cx - q.hw, r: q.cx + q.hw, t: q.cy - q.hh, b: q.cy + q.hh, visible: q.visible }));
    rects.zones = zones;
    // แปลงกลับเป็นพิกัด 3D
    P.forEach((q) => {
      const { it, z, sc } = q;
      it.holder.visible = q.visible;
      const hz = tanHalf * (camera.position.z - z);
      const x = ((q.cx / W) * 2 - 1) * hz * camera.aspect, y = (1 - (q.cy / H) * 2) * hz;
      it.holder.position.set(x, y, z);
      it.holder.scale.setScalar(sc);
      // จุดเริ่มลอยขึ้น: ต่ำกว่าขอบล่างจอเสมอ (หน่วยของ inner)
      it.riseFrom = (-hz - y - it.size.y * sc * 0.6) / sc - 1;
    });
  }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.2e6 / (W * H)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = tanHalf * camera.position.z;
    halfW = halfH * camera.aspect;
    layout();
    render();
  }
  function render() { renderer.render(scene, camera); }
  addEventListener('resize', resize);
  resize();

  // วาดตัวอักษรบนบล็อกใหม่เมื่อฟอนต์ Mali พร้อม
  const ready = (document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('700 100px Mali', 'กขค๑๒๓'), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve()).catch(() => {}).then(() => { faceJobs.forEach(paintFace); render(); });

  return {
    items, rig, render, ready,
    get halfH() { return halfH; },
    setKeepOut(fn) { keepOut = fn; resize(); },
    relayout: resize,
    debugRects: () => rects,
  };
}
