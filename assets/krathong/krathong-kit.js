// LVC Krathong Kit — โมเดลกระทงแบบ low-poly สร้างด้วยโค้ด (three.js r180)
// หน่วย: 1 = ประมาณ 1 ฟุตในฉาก · ทุกชิ้นตั้งอยู่บนพื้น y = 0 และหันขึ้นแกน +Y
// ของแต่ง (ดอกไม้) ใช้ vertex color เป็นแค่แสงเงาขาว-เทา → เปลี่ยนสีได้ด้วย material.color
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const col = (h) => new THREE.Color(h);
// ระดับรายละเอียด: 1 = โมเดลเต็ม (bases/ decor/) · ต่ำกว่า 1 = โมเดลเบาสำหรับกระทงในแม่น้ำ (lod/) สร้างด้วย export-lod.mjs
let DETAIL = 1;
export function setDetail(d) { DETAIL = d; }
const q = (n, min = 2) => (DETAIL >= 1 ? n : Math.max(min, Math.round(n * DETAIL)));
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- กลีบ: งอกตามแกน +Y กว้างตามแกน X ด้านในถ้วยหันไป +Z ---------- */
export function petalGeo(o) {
  const { L = 0.3, W = 0.1, cup = 0.4, crease = 0, curl = 0, ruffle = 0, shape = 0.75, start = 0.12,
    uSeg = 10, vSeg = 6, c0 = "#ffffff", c1 = "#ffffff", stripes = 0, vein = 0, seed = 1 } = o;
  const r = rng(seed), a = col(c0), b = col(c1), t = new THREE.Color();
  const pos = [], cols = [], idx = [];
  const uN = q(uSeg), vN = q(vSeg);
  for (let i = 0; i <= uN; i++) {
    const u = i / uN;
    const w = W * Math.pow(Math.max(0, Math.sin(Math.PI * (start + (1 - start) * u))), shape);
    for (let j = 0; j <= vN; j++) {
      const v = (j / vN) * 2 - 1;
      const x = v * w;
      const y = L * u;
      let z = (cup * v * v + crease * Math.abs(v)) * w + curl * L * u * u;
      if (ruffle) z += ruffle * W * 0.25 * Math.sin(v * 5 + u * 7 + seed);
      pos.push(x, y, z);
      t.copy(a).lerp(b, Math.pow(u, 1.1));
      let k = 1 + (r() - 0.5) * 0.06;
      if (stripes) k *= 1 - stripes * 0.5 * (0.5 + 0.5 * Math.cos(v * Math.PI * 7));
      if (vein) k *= 1 + vein * Math.exp(-v * v * 60);
      cols.push(t.r * k, t.g * k, t.b * k);
    }
  }
  const row = vN + 1;
  for (let i = 0; i < uN; i++) for (let j = 0; j < vN; j++) {
    const p = i * row + j;
    idx.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// วางกลีบเป็นวง: tilt = องศาที่เอนออกจากแนวตั้ง · กลีบหันด้านในเข้าหาศูนย์กลาง
function ring(make, n, radius, tiltDeg, y, phase = 0, jitter = 0, seed = 1) {
  const r = rng(seed), out = [];
  for (let k = 0; k < n; k++) {
    const g = make(k);
    const tl = THREE.MathUtils.degToRad(tiltDeg + (r() - 0.5) * jitter);
    g.rotateX(-tl);
    g.translate(0, y, -radius);
    g.rotateY(((k + phase) / n) * Math.PI * 2 + (r() - 0.5) * jitter * 0.01);
    out.push(g);
  }
  return mergeGeometries(out);
}

// ทรงกลึง (ฐาน แว่นหยวก เทียน) จากจุด [r, y] พร้อมสีตามความชันผิว
function lathe(points, seg, colorFn) {
  const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), q(seg, 8));
  g.computeVertexNormals();
  const n = g.attributes.normal, p = g.attributes.position, c = [];
  const t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { colorFn(t, p.getX(i), p.getY(i), p.getZ(i), n.getY(i)); c.push(t.r, t.g, t.b); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  return g.toNonIndexed ? g : g;
}

function paint(g, hex) {
  const c = col(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}
function shade(g, top = 1, bottom = 0.7) { // ไล่เทาบน-ล่าง สำหรับของที่เปลี่ยนสีได้
  g.computeBoundingBox();
  const p = g.attributes.position, b = g.boundingBox, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = bottom + (top - bottom) * ((p.getY(i) - b.min.y) / (b.max.y - b.min.y || 1)); a.fill(k, i * 3, i * 3 + 3); }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}
function clean(g) { // ให้ทุก geometry มี attribute ชุดเดียวกันก่อน merge
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
const merge = (list) => mergeGeometries(list.map(clean));
function dough(g, amt, seed) { // ผิวขนมปังเป็นก้อนนุ่ม ๆ
  const r = rng(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amt * (Math.sin(x * 61 + seed) * Math.sin(z * 53) + (r() - 0.5) * 0.4);
    p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.5), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- วัสดุ ---------- */
export function materials() {
  return {
    leaf: new THREE.MeshStandardMaterial({ name: "leaf", vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    petal: new THREE.MeshStandardMaterial({ name: "petal", vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ name: "trunk", vertexColors: true, roughness: 0.8 }),
    bread: new THREE.MeshStandardMaterial({ name: "bread", vertexColors: true, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ name: "pin", color: 0x8a7a5a, roughness: 0.4, metalness: 0.6 }),
    wax: (hex) => new THREE.MeshStandardMaterial({ name: "wax", color: hex, vertexColors: true, roughness: 0.45 }),
    tint: (hex, name) => new THREE.MeshStandardMaterial({ name, color: hex, vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    glow: (hex, name, strength = 4) => { const m = new THREE.MeshStandardMaterial({ name, color: hex, emissive: hex, emissiveIntensity: strength, roughness: 1 }); return m; },
  };
}
const mesh = (g, m, name) => { const o = new THREE.Mesh(g, m); o.name = name; return o; };
const group = (name, ...kids) => { const o = new THREE.Group(); o.name = name; kids.forEach((k) => o.add(k)); return o; };

/* ---------- ส่วนที่ใช้ร่วม: ฐานหยวกกล้วยหุ้มใบตอง ---------- */
function trunkBase(R, H, M, seed) {
  const r = rng(seed);
  const top = col("#efe5c4"), ring2 = col("#e2d6ab"), side = col("#3f7232"), sideDark = col("#2c5524");
  const g = lathe([[0, 0], [R * 0.96, 0], [R, 0.01], [R, H - 0.008], [R * 0.985, H], [0, H]], 48, (t, x, y, z, ny) => {
    if (ny > 0.6) { const d = Math.hypot(x, z) / R; t.copy(top).lerp(ring2, 0.5 + 0.5 * Math.sin(d * 28)); }
    else if (ny < -0.6) t.copy(top).multiplyScalar(0.8);
    else { const a = Math.atan2(z, x); t.copy(side).lerp(sideDark, 0.5 + 0.5 * Math.sin(a * 60 + y * 40)); t.multiplyScalar(0.92 + r() * 0.12); }
  });
  return mesh(g, M.trunk, "base_trunk");
}
function pins(R, y, n, M) {
  const list = [];
  for (let k = 0; k < n; k++) { const g = new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6); g.rotateZ(Math.PI / 2 * 0.15); g.translate(0, y, -R - 0.002); g.rotateY((k / n) * Math.PI * 2 + 0.3); list.push(g); }
  return mesh(merge(list), M.metal, "pins");
}

/* ===================== ฐาน 1: กระทงดอกบัว ===================== */
export function lotusBase(M = materials()) {
  const H = 0.09, root = group("krathong_lotus");
  root.add(trunkBase(0.27, H, M, 3));
  root.add(pins(0.27, H * 0.55, 6, M));
  // ใบตองรองกลีบ (แผ่ออกเกือบแบน)
  root.add(mesh(ring((k) => petalGeo({ L: 0.11, W: 0.07, cup: -0.1, crease: 0.35, c0: "#2f5c26", c1: "#5f9440", stripes: 0.25, vein: 0.2, seed: k, uSeg: 6, vSeg: 4 }), 18, 0.25, 82, H - 0.01, 0, 6, 11), M.leaf, "leaf_skirt"));
  // กลีบบัว 4 ชั้น
  const pink = (k, L, W, curl) => petalGeo({ L, W, cup: 0.6, curl, shape: 0.6, start: 0.1, c0: "#fff1f4", c1: "#e46a9c", stripes: 0.12, vein: 0.08, seed: k * 7 + L * 100, uSeg: 12, vSeg: 8 });
  root.add(mesh(ring((k) => pink(k, 0.26, 0.115, -0.08), 14, 0.22, 74, H, 0.5, 4, 21), M.petal, "petals_outer"));
  root.add(mesh(ring((k) => pink(k, 0.25, 0.11, -0.01), 12, 0.18, 56, H + 0.01, 0, 4, 22), M.petal, "petals_middle"));
  root.add(mesh(ring((k) => pink(k, 0.22, 0.1, 0.04), 10, 0.155, 38, H + 0.02, 0.5, 4, 23), M.petal, "petals_inner"));
  root.add(mesh(ring((k) => pink(k, 0.17, 0.09, 0.08), 8, 0.145, 22, H + 0.03, 0, 4, 24), M.petal, "petals_core"));
  // เกสรกลางดอก (พื้นที่วางของ)
  const disc = paint(new THREE.CylinderGeometry(0.15, 0.13, 0.07, q(32, 8)), "#e8b93a"); disc.translate(0, H + 0.075, 0);
  const st = []; const r = rng(5);
  for (let i = 0, n = q(70, 0); i < n; i++) { const a = r() * Math.PI * 2, d = 0.06 + r() * 0.07, s = new THREE.CylinderGeometry(0.002, 0.002, 0.025, 4); s.translate(Math.cos(a) * d, H + 0.115, Math.sin(a) * d); st.push(paint(s, i % 3 ? "#f2c94c" : "#f7e3a1")); }
  root.add(mesh(merge([disc, ...st]), M.trunk, "stamen_center"));
  root.userData = { place: { y: H + 0.11, radius: 0.13 } };
  return root;
}

/* ===================== ฐาน 2: กระทงอันเล็ก (ใบตองพับแหลม) ===================== */
export function smallBase(M = materials()) {
  const H = 0.1, R = 0.2, root = group("krathong_small");
  root.add(trunkBase(R, H, M, 7));
  // แถบใบตองพันรอบข้าง
  const band = lathe([[R + 0.006, -0.002], [R + 0.008, H * 0.85]], 48, (t, x, y, z) => { const a = Math.atan2(z, x); t.set("#3d6e2c").lerp(col("#5a8f3c"), 0.5 + 0.5 * Math.sin(a * 90)); });
  band.deleteAttribute("uv");
  root.add(mesh(band, M.leaf, "leaf_band"));
  root.add(pins(R + 0.009, H * 0.45, 4, M));
  const fold = (k, L, W, s) => petalGeo({ L, W, cup: 0, crease: 0.55, curl: -0.05, shape: 0.9, start: 0.02, c0: "#2b5523", c1: "#62993f", stripes: 0.3, vein: 0.25, seed: k + s, uSeg: 6, vSeg: 4 });
  root.add(mesh(ring((k) => fold(k, 0.13, 0.065, 1), 12, R - 0.005, 14, H - 0.03, 0, 4, 31), M.leaf, "folds_outer"));
  root.add(mesh(ring((k) => fold(k, 0.1, 0.055, 9), 12, R - 0.03, 6, H - 0.02, 0.5, 4, 32), M.leaf, "folds_inner"));
  root.userData = { place: { y: H, radius: 0.15 } };
  return root;
}

/* ===================== ฐาน 3: กระทงขนมปัง ===================== */
export function breadBase(M = materials()) {
  const H = 0.08, R = 0.36, root = group("krathong_bread");
  const crust = col("#c98b4a"), dark = col("#8a5326"), r0 = rng(4);
  const base = lathe([[0, 0], [R - 0.03, 0], [R, 0.02], [R + 0.005, H * 0.6], [R - 0.01, H], [0, H]], 48, (t, x, y, z, ny) => {
    t.copy(crust).lerp(dark, Math.max(0, Math.sin(x * 23) * Math.sin(z * 19)) * 0.45 + (ny < -0.5 ? 0.25 : 0)); t.multiplyScalar(0.9 + r0() * 0.15);
  });
  dough(base, 0.02, 2);
  root.add(mesh(base, M.bread, "bread_base"));
  // ขอบเปียสองเส้นพันกัน
  const braid = (ph, hex) => {
    const pts = []; for (let i = 0; i <= 200; i++) { const t = (i / 200) * Math.PI * 2, w = Math.sin(t * 18 + ph); pts.push(new THREE.Vector3(Math.cos(t) * (R - 0.025 + 0.018 * w), H + 0.012 * Math.cos(t * 18 + ph), Math.sin(t) * (R - 0.025 + 0.018 * w))); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), q(180, 24), 0.028, q(6, 3), true);
    return dough(paint(g, hex), 0.015, ph * 10 + 1);
  };
  root.add(mesh(merge([braid(0, "#c98a4b"), braid(Math.PI, "#b77a3d")]), M.bread, "bread_braid"));
  // ก้อนขนมปังม้วนหลากสี
  const hues = ["#d9483b", "#ee8a2c", "#f2c230", "#7aa443", "#7a4a2b", "#ee8a2c", "#d9483b", "#f2c230", "#7aa443", "#e7d3a6"];
  const swirls = [];
  hues.forEach((h, k) => {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.4, rad = 0.058 * (1 - t); pts.push(new THREE.Vector3(Math.cos(a) * rad, t * 0.03, Math.sin(a) * rad)); }
    let g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), q(40, 8), 0.036, q(7, 3), false);
    g.scale(1, 0.85, 1); dough(g, 0.04, k + 3); paint(g, h);
    const a = (k / hues.length) * Math.PI * 2; g.rotateY(-a * 1.3); g.translate(Math.cos(a) * 0.21, H + 0.018, Math.sin(a) * 0.21);
    swirls.push(g);
  });
  // ขนมปังรูปดอกไม้ 3 ดอก
  [["#d9483b", 0.6], ["#ee8a2c", 2.7], ["#f2c230", 4.6]].forEach(([h, a], k) => {
    for (let i = 0; i < 5; i++) { const s = new THREE.SphereGeometry(0.03, q(10, 5), q(8, 3)); s.scale(1, 0.55, 1); const b = (i / 5) * Math.PI * 2; s.translate(Math.cos(b) * 0.035 + Math.cos(a) * 0.11, H + 0.05, Math.sin(b) * 0.035 + Math.sin(a) * 0.11); swirls.push(dough(paint(s, h), 0.05, k * 9 + i)); }
    const c = new THREE.SphereGeometry(0.018, q(10, 5), q(8, 3)); c.scale(1, 0.7, 1); c.translate(Math.cos(a) * 0.11, H + 0.06, Math.sin(a) * 0.11); swirls.push(paint(c, "#7a4a2b"));
  });
  root.add(mesh(merge(swirls), M.bread, "bread_toppings"));
  const mound = new THREE.SphereGeometry(0.075, q(16, 6), q(10, 3), 0, Math.PI * 2, 0, Math.PI / 2); mound.scale(1, 0.5, 1); mound.translate(0, H + 0.01, 0);
  root.add(mesh(dough(paint(mound, "#5b3a22"), 0.05, 77), M.bread, "bread_center"));
  root.userData = { place: { y: H + 0.04, radius: 0.07 } };
  return root;
}

/* ===================== ของแต่ง (เปลี่ยนสีได้) ===================== */
function fib(n) { const out = [], ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 0.95, rr = Math.sqrt(1 - y * y), t = ga * i; out.push(new THREE.Vector3(Math.cos(t) * rr, y, Math.sin(t) * rr)); } return out; }
const UP = new THREE.Vector3(0, 1, 0);
function orientTo(g, dir, at) { const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()); g.applyQuaternion(q); g.translate(at.x, at.y, at.z); return g; }

export function marigold(M = materials(), color = "#f7a51c") {
  const R = 0.055, parts = [];
  fib(q(200, 30)).forEach((n, i) => {
    const g = petalGeo({ L: 0.024, W: 0.02, cup: 0.7, ruffle: 0.5, shape: 0.25, start: 0.45, c0: "#c9c9c9", c1: "#ffffff", seed: i, uSeg: 3, vSeg: 3 });
    g.rotateY(i * 2.3);
    orientTo(g, n, n.clone().multiplyScalar(R * 0.75).add(new THREE.Vector3(0, 0.012, 0)));
    parts.push(g);
  });
  const core = shade(new THREE.SphereGeometry(R * 0.8, q(14, 6), q(10, 4)), 0.85, 0.6); core.scale(1, 0.85, 1); core.translate(0, 0.02, 0);
  parts.push(core);
  return group("marigold", mesh(merge(parts), M.tint(color, "marigold"), "marigold"));
}
export function chrysanthemum(M = materials(), color = "#9b6fd6") {
  const parts = [];
  [[30, 82, 0.05, 0.0], [26, 66, 0.047, 0.4], [22, 50, 0.043, 0.1], [18, 34, 0.037, 0.6], [12, 20, 0.03, 0.3], [7, 8, 0.022, 0.5]].forEach(([n, tilt, L, ph], ri) => {
    parts.push(ring((k) => petalGeo({ L, W: 0.009, cup: 0.9, curl: 0.05, shape: 0.4, start: 0.2, c0: "#cfcfcf", c1: "#ffffff", seed: k + ri * 40, uSeg: 5, vSeg: 3 }), n, 0.006, tilt, 0.012, ph, 8, 50 + ri));
  });
  return group("chrysanthemum", mesh(merge(parts), M.tint(color, "chrysanthemum"), "chrysanthemum"));
}
export function orchid(M = materials(), color = "#c03fa8") {
  const parts = [];
  const p = (L, W, c0, s) => petalGeo({ L, W, cup: 0.25, curl: -0.08, shape: 0.6, start: 0.15, c0, c1: "#ffffff", seed: s, uSeg: 8, vSeg: 5 });
  parts.push(ring((k) => p(0.045, 0.026, "#e0e0e0", k), 3, 0.004, 80, 0.012, 0.25, 0, 61)); // กลีบเลี้ยง
  parts.push(ring((k) => p(0.04, 0.034, "#f0f0f0", k + 9), 2, 0.004, 76, 0.014, 0.0, 0, 62).rotateY(Math.PI / 2)); // กลีบดอก
  const lip = petalGeo({ L: 0.03, W: 0.018, cup: 0.9, curl: 0.15, c0: "#8a8a8a", c1: "#bdbdbd", seed: 3, uSeg: 6, vSeg: 4 });
  lip.rotateX(-1.1); lip.translate(0, 0.016, 0.004); parts.push(lip);
  const col2 = shade(new THREE.SphereGeometry(0.006, 8, 6), 1, 1); col2.translate(0, 0.02, 0); parts.push(col2);
  return group("orchid", mesh(merge(parts), M.tint(color, "orchid"), "orchid"));
}
export function jasmine(M = materials(), color = "#fffdf6") {
  const parts = [];
  const flower = (x, z, s, seed) => { const g = ring((k) => petalGeo({ L: 0.018 * s, W: 0.009 * s, cup: 0.3, shape: 0.5, c0: "#d8d8d8", c1: "#ffffff", seed: k + seed, uSeg: 4, vSeg: 3 }), 6, 0.002, 70, 0.006, 0, 6, seed); g.translate(x, 0, z); return g; };
  parts.push(flower(0, 0, 1.2, 1), flower(0.028, 0.012, 1, 7), flower(-0.02, 0.024, 0.9, 13));
  const bud = shade(new THREE.SphereGeometry(0.008, 8, 6), 1, 0.85); bud.scale(1, 1.6, 1); bud.translate(0.004, 0.012, -0.026); parts.push(bud);
  return group("jasmine", mesh(merge(parts), M.tint(color, "jasmine"), "jasmine"));
}
export function rose(M = materials(), color = "#c8243a") {
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const g = petalGeo({ L: 0.026 + i * 0.0016, W: 0.022 + i * 0.0006, cup: 1.1, curl: i < 6 ? 0.35 : -0.05, shape: 0.5, start: 0.25, c0: "#9a9a9a", c1: "#ffffff", seed: i, uSeg: 6, vSeg: 5 });
    g.rotateX(-THREE.MathUtils.degToRad(6 + i * 4.2)); g.translate(0, 0.008, -(0.002 + i * 0.0016)); g.rotateY(i * 2.4);
    parts.push(g);
  }
  return group("rose", mesh(merge(parts), M.tint(color, "rose"), "rose"));
}
export function lotusBud(M = materials(), color = "#ec8aab") {
  const petals = merge([
    ring((k) => petalGeo({ L: 0.12, W: 0.038, cup: 1.2, curl: 0.3, shape: 0.7, start: 0.12, c0: "#ffffff", c1: "#cfcfcf", seed: k, uSeg: 12, vSeg: 6 }), 5, 0.01, 4, 0.006, 0, 3, 71),
    ring((k) => petalGeo({ L: 0.085, W: 0.04, cup: 0.9, curl: -0.04, shape: 0.6, start: 0.12, c0: "#f2f2f2", c1: "#bdbdbd", seed: k + 5, uSeg: 8, vSeg: 5 }), 3, 0.016, 30, 0.004, 0.5, 6, 72)]);
  const stem = paint(new THREE.CylinderGeometry(0.009, 0.011, 0.012, 8), "#4e7a34"); stem.translate(0, 0.006, 0);
  const m = mesh(petals, M.tint(color, "lotus_bud"), "lotus_bud");
  return group("lotus_bud", m, mesh(stem, M.leaf, "lotus_bud_stem"));
}
export function candle(M = materials(), color = "#f4cf2c") {
  const H = 0.26;
  const body = lathe([[0, 0], [0.021, 0], [0.021, 0.004], [0.018, H - 0.004], [0.016, H], [0, H]], 18, (t, x, y) => t.setScalar(0.88 + 0.12 * (y / H)));
  const drips = [];
  [[0.4, 0.04], [2.1, 0.06], [4.0, 0.03]].forEach(([a, len]) => { const d = shade(new THREE.CapsuleGeometry(0.004, len, 3, 6), 1, 0.95); d.translate(Math.cos(a) * 0.017, H - len / 2 - 0.006, Math.sin(a) * 0.017); drips.push(d); });
  const wick = paint(new THREE.CylinderGeometry(0.0014, 0.0014, 0.014, 5), "#2a211b"); wick.translate(0, H + 0.007, 0);
  return group("candle", mesh(merge([body, ...drips]), M.wax(color), "candle_body"), mesh(wick, new THREE.MeshStandardMaterial({ name: "wick", color: 0x2a211b, roughness: 1 }), "candle_wick"));
}
// เปลวไฟแยกชิ้น: วางที่ y = ยอดไส้เทียน (manifest: candle.flameY) · ทำ shader ไหวเองได้
export function flame(M = materials()) {
  const g = new THREE.LatheGeometry([[0, 0], [0.006, 0.004], [0.011, 0.016], [0.009, 0.032], [0.004, 0.046], [0, 0.056]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  g.deleteAttribute("uv");
  const inner = new THREE.LatheGeometry([[0, 0.002], [0.004, 0.006], [0.006, 0.016], [0.003, 0.028], [0, 0.034]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
  inner.deleteAttribute("uv");
  return group("flame", mesh(g, M.glow("#ffb02e", "flame_outer", 3), "flame_outer"), mesh(inner, M.glow("#fff4c2", "flame_core", 6), "flame_core"));
}
export function incense(M = materials()) {
  const sticks = [], reds = [], tips = [];
  [-1, 0, 1].forEach((s, i) => {
    const tilt = s * 0.06, L = 0.42;
    const st = paint(new THREE.CylinderGeometry(0.0035, 0.0035, L * 0.72, 6), "#8c6a4a"); st.translate(0, L * 0.28 + L * 0.36, 0);
    const rd = paint(new THREE.CylinderGeometry(0.0038, 0.0038, L * 0.28, 6), "#b8233a"); rd.translate(0, L * 0.14, 0);
    const tp = new THREE.SphereGeometry(0.0045, 8, 6); tp.translate(0, L, 0);
    [st, rd, tp].forEach((g) => { g.rotateZ(tilt); g.rotateX(s * 0.02); g.translate(s * 0.008, 0, 0); });
    sticks.push(st); reds.push(rd); tips.push(tp);
  });
  const wood = new THREE.MeshStandardMaterial({ name: "incense", vertexColors: true, roughness: 0.9 });
  return group("incense", mesh(merge([...sticks, ...reds]), wood, "incense_sticks"), mesh(merge(tips), M.glow("#ff4a1a", "incense_ember", 5), "incense_ember"));
}

export const BASES = { lotus: lotusBase, small: smallBase, bread: breadBase };
export const DECOR = { marigold, chrysanthemum, orchid, jasmine, rose, lotus_bud: lotusBud, candle, flame, incense };
