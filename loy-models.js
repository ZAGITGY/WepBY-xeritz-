/* loy-models.js — กระทงและของแต่งแบบ low-poly สร้างด้วยโค้ด (ไม่ใช้ไฟล์ GLB)
 *
 * หน่วย: กระทงกว้างราว 1.1 · จุดกำเนิดอยู่ที่ระดับน้ำ (y = 0) · ผิวที่วางของอยู่สูง TOP
 * ทุกรูปทรงเป็น BufferGeometry แบบไม่มี index พร้อมสีต่อหน้า (vertex color) ใช้กับ MeshLambertMaterial flatShading
 *
 * ชิ้นส่วน (part) = { k: ชนิด 0–5, x, y, z: ตำแหน่ง, r: มุมหมุนรอบแกนตั้ง (องศา), s: ขนาด, c: สี "#rrggbb" }
 * คือรูปแบบเดียวกับที่บันทึกลง Firestore (ดู loy-db.js / firebase/firestore.rules)
 */
import * as THREE from "./vendor/three/three.module.min.js";
import { mergeGeometries } from "./vendor/three/addons/BufferGeometryUtils.min.js";

export const BASES = [
  { id: "leaf", name: "ใบตอง", note: "พับกลีบซ้อนเป็นชั้น แบบดั้งเดิม" },
  { id: "lotus", name: "กลีบบัว", note: "พับจากกลีบดอกบัว" },
  { id: "bread", name: "ขนมปัง", note: "ปั้นเป็นกลีบดอกไม้ ปลาได้กิน" },
];
export const ITEMS = [
  { id: "marigold", name: "ดาวเรือง", colors: ["#f29b26", "#f7c531", "#e2581b"] },
  { id: "jasmine", name: "มะลิ", colors: ["#fffaf0", "#f4ead2", "#ffe1ea"] },
  { id: "rose", name: "กุหลาบ", colors: ["#c8203c", "#ef7f9b", "#fff4f0", "#f7c531"] },
  { id: "bud", name: "บัวตูม", colors: ["#e47f98", "#fff0f3", "#c74f86"] },
  { id: "candle", name: "เทียน", colors: ["#f4ead2", "#c8203c", "#f5c518"] },
  { id: "incense", name: "ธูป", colors: ["#8a5a3c", "#c8203c", "#d9b25e"] },
];
export const CANDLE = 4, INCENSE = 5;
export const TOP = 0.2;          // ระดับผิวที่วางของ
export const RADIUS = 0.34;      // วางของได้ในวงนี้
export const MAX_PARTS = 24;
export const SIZE = [0.6, 1.6];
export const WICK_Y = 0.235;     // ปลายไส้เทียน (ก่อนคูณขนาด)

const col = new THREE.Color();
/** ใส่สีให้ทุกหน้า (สุ่มสว่าง/มืดเล็กน้อยต่อหน้า ให้ดูเป็น low-poly) */
function paint(geo, hex, jitter = 0.07, shade) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  col.set(hex);
  for (let f = 0; f < n; f += 3) {
    let k = 1 + (Math.sin(f * 12.9898) * 43758.5453 % 1) * jitter;
    if (shade) k *= shade(g.attributes.position.getY(f));
    for (let v = 0; v < 3; v++) { arr[(f + v) * 3] = col.r * k; arr[(f + v) * 3 + 1] = col.g * k; arr[(f + v) * 3 + 2] = col.b * k; }
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}
function merge(list) {
  const g = mergeGeometries(list.map((x) => { x.deleteAttribute("normal"); return x; }));
  g.computeVertexNormals();
  return g;
}
/** สามเหลี่ยมจากจุด [x,y,z] ทีละ 3 จุด */
function tris(points, hex, jitter) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
  return paint(g, hex, jitter);
}
const polar = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];

/* ---------- กลีบ: ใบตองพับแหลม (สองหน้า มีสันกลาง) ---------- */
function foldedPetals(n, r0, r1, y0, y1, w, colors, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const L = polar(a - w, r0, y0), R = polar(a + w, r0, y0), T = polar(a, r1, y1), B = polar(a, r0 - 0.05, y0 + 0.06);
    out.push(tris([L, T, B, B, T, R, L, B, T, B, R, T], colors[i % colors.length], 0.05));
  }
  return out;
}
/* ---------- กลีบมน (บัว): แผ่นโค้งออกด้านนอก ---------- */
function roundPetals(n, r0, len, y0, lift, width, hex, tipHex, phase = 0) {
  const out = [], S = 4;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2, rows = [];
    for (let s = 0; s <= S; s++) {
      const t = s / S, w = width * Math.pow(Math.sin(Math.PI * Math.min(0.98, t * 0.9 + 0.05)), 0.8) * (1 - 0.35 * t);
      const r = r0 + len * Math.sin(t * 1.2) * 0.85, y = y0 + lift * t;
      rows.push([polar(a - w / r, r, y), polar(a, r + 0.012, y + 0.01), polar(a + w / r, r, y)]);
    }
    const pts = [];
    for (let s = 0; s < S; s++) {
      const A = rows[s], B = rows[s + 1];
      pts.push(A[0], B[0], A[1], A[1], B[0], B[1], A[1], B[1], A[2], A[2], B[1], B[2]);
    }
    const tip = rows[S];
    pts.push(tip[0], polar(a, r0 + len * 0.95, y0 + lift * 1.08), tip[1], tip[1], polar(a, r0 + len * 0.95, y0 + lift * 1.08), tip[2]);
    const g = tris(pts, hex, 0.05);
    // ปลายกลีบเข้มขึ้น
    const c = g.attributes.color, p = g.attributes.position, base = new THREE.Color(hex), tipc = new THREE.Color(tipHex);
    for (let v = 0; v < p.count; v++) {
      const t = Math.min(1, Math.max(0, (p.getY(v) - y0) / lift));
      const m = base.clone().lerp(tipc, t * t);
      c.setXYZ(v, m.r, m.g, m.b);
    }
    out.push(g);
  }
  return out;
}

/** ฐานกระทง: 0 ใบตอง · 1 กลีบบัว · 2 ขนมปัง */
export function baseGeometry(kind) {
  const parts = [];
  if (kind === 2) {
    const prof = [[0, 0.02], [0.4, 0.0], [0.5, 0.05], [0.52, 0.12], [0.46, 0.19], [0.36, 0.205], [0, 0.205]].map(([x, y]) => new THREE.Vector2(x, y));
    parts.push(paint(new THREE.LatheGeometry(prof, 16), "#d9a46a", 0.08, (y) => 0.8 + y * 1.4));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.12, 0);
      g.scale(1, 0.62, 1.25); g.rotateY(-a); g.translate(Math.cos(a) * 0.47, 0.16, Math.sin(a) * 0.47);
      parts.push(paint(g, i % 2 ? "#e8bb80" : "#c07f40", 0.09));
    }
    const top = new THREE.CircleGeometry(0.37, 14); top.rotateX(-Math.PI / 2); top.translate(0, TOP + 0.004, 0);
    parts.push(paint(top, "#edc995", 0.05));
  } else {
    const core = new THREE.CylinderGeometry(0.44, 0.4, 0.2, 14); core.translate(0, 0.1, 0);
    parts.push(paint(core, kind === 1 ? "#7f9c5c" : "#8aa463", 0.06));
    const top = new THREE.CircleGeometry(0.43, 14); top.rotateX(-Math.PI / 2); top.translate(0, TOP + 0.002, 0);
    parts.push(paint(top, "#b5c98c", 0.05));
    if (kind === 1) {
      parts.push(...roundPetals(12, 0.4, 0.22, 0.05, 0.34, 0.11, "#e47f98", "#c74f86", 0));
      parts.push(...roundPetals(10, 0.36, 0.16, 0.12, 0.3, 0.09, "#f7d2dc", "#e47f98", 0.31));
    } else {
      parts.push(...foldedPetals(12, 0.44, 0.6, 0.05, 0.34, 0.2, ["#2e6a3b", "#5b9b56"], 0));
      parts.push(...foldedPetals(10, 0.38, 0.47, 0.14, 0.42, 0.24, ["#5b9b56", "#3f7f45"], 0.31));
    }
  }
  return merge(parts);
}

/* ---------- ของแต่ง (จุดกำเนิดที่ฐานของชิ้น) ----------
 * แต่ละชิ้นแยกเป็น 2 ส่วน: tint = ส่วนที่เปลี่ยนสีได้ (ระบายเป็นเทาอ่อน/เข้ม แล้วคูณด้วยสีที่เลือก)
 * กับ fixed = ส่วนสีคงที่ (ก้าน ใบ ไส้เทียน ปลายธูป) → ฉากแม่น้ำวาดทุกใบด้วย InstancedMesh ต่อชนิดชิ้นส่วน + instanceColor */
function lathe(points, segs, hex, jitter, shade) {
  return paint(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs), hex, jitter, shade);
}
const gray = (f) => "#" + new THREE.Color(f, f, f).getHexString();
function itemPieces(k) {
  const tint = [], fixed = [];
  if (k === 0) {                 // ดาวเรือง: กลีบฟู + ใจกลางเข้ม
    const g = new THREE.IcosahedronGeometry(0.085, 1); g.scale(1, 0.72, 1); g.translate(0, 0.062, 0);
    tint.push(paint(g, "#ffffff", 0.16));
    const m = new THREE.IcosahedronGeometry(0.03, 0); m.translate(0, 0.118, 0);
    tint.push(paint(m, gray(0.7), 0.05));
  } else if (k === 1) {          // มะลิ: ดอกเล็ก 5 ดอกรอบวง + ตรงกลาง
    for (let i = 0; i < 6; i++) {
      const g = new THREE.OctahedronGeometry(0.026, 0), a = (i / 5) * Math.PI * 2, r = i === 5 ? 0 : 0.045;
      g.scale(1, 0.8, 1); g.translate(Math.cos(a) * r, i === 5 ? 0.05 : 0.03, Math.sin(a) * r);
      tint.push(paint(g, "#ffffff", 0.05));
    }
    const leaf = new THREE.CircleGeometry(0.07, 6); leaf.rotateX(-Math.PI / 2); leaf.translate(0, 0.006, 0);
    fixed.push(paint(leaf, "#4f8a4a", 0.05));
  } else if (k === 2) {          // กุหลาบ: ถ้วยกลีบ + กลีบซ้อนด้านใน + กลีบเลี้ยง
    tint.push(lathe([[0, 0], [0.035, 0.012], [0.058, 0.05], [0.052, 0.09], [0.03, 0.105]], 7, "#ffffff", 0.08));
    const inner = new THREE.ConeGeometry(0.03, 0.07, 6, 1, true); inner.rotateX(Math.PI); inner.translate(0, 0.08, 0);
    tint.push(paint(inner, gray(0.78), 0.05));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      fixed.push(tris([polar(a - 0.35, 0.03, 0.004), polar(a, 0.085, 0.002), polar(a + 0.35, 0.03, 0.004)], "#3f7f45", 0.05));
    }
  } else if (k === 3) {          // บัวตูม: หยดน้ำตั้ง ปลายเข้มขึ้น + ก้านสั้น
    tint.push(lathe([[0, 0.025], [0.032, 0.04], [0.05, 0.09], [0.04, 0.16], [0.016, 0.215], [0, 0.235]], 7, "#ffffff", 0.05, (y) => 1 - Math.max(0, (y - 0.12) / 0.115) * 0.22));
    const st = new THREE.CylinderGeometry(0.01, 0.012, 0.03, 5); st.translate(0, 0.015, 0);
    fixed.push(paint(st, "#3f7f45", 0.03));
  } else if (k === CANDLE) {     // เทียน + ขอบน้ำตาเทียน + ไส้ (เปลวไฟเป็นแสงใน Points ของฉาก)
    const g = new THREE.CylinderGeometry(0.034, 0.038, 0.2, 8); g.translate(0, 0.1, 0);
    tint.push(paint(g, "#ffffff", 0.05));
    const drip = new THREE.TorusGeometry(0.03, 0.008, 4, 8); drip.rotateX(Math.PI / 2); drip.translate(0, 0.198, 0);
    tint.push(paint(drip, gray(1), 0.03, () => 1.12));
    const wick = new THREE.CylinderGeometry(0.004, 0.004, 0.035, 4); wick.translate(0, 0.217, 0);
    fixed.push(paint(wick, "#3b2c22", 0));
  } else {                       // ธูป 3 ดอก กางเป็นพัด ปลายแดง
    for (let i = -1; i <= 1; i++) {
      const s = new THREE.CylinderGeometry(0.0045, 0.0045, 0.3, 4); s.translate(0, 0.15, 0); s.rotateZ(i * 0.2); s.rotateY(i * 0.25);
      tint.push(paint(s, "#ffffff", 0.04));
      const t = new THREE.OctahedronGeometry(0.009, 0), a = i * 0.2;
      t.translate(-Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0); t.rotateY(i * 0.25);
      fixed.push(paint(t, "#ff5a2a", 0));
    }
    const holder = new THREE.CylinderGeometry(0.02, 0.026, 0.03, 6); holder.translate(0, 0.015, 0);
    fixed.push(paint(holder, "#5b9b56", 0.04));
  }
  return { tint, fixed };
}
/** ชิ้นเดียวพร้อมสี (กระทงที่กำลังแต่ง) */
export function itemGeometry(k, hex) {
  const { tint, fixed } = itemPieces(k), c = new THREE.Color(hex || ITEMS[k].colors[0]);
  for (const g of tint) { const a = g.attributes.color; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b); }
  return merge(tint.concat(fixed));
}
/** geometry สำหรับ InstancedMesh: { tint, fixed|null } (สีจริงมาจาก instanceColor) */
export function itemInstanceGeometries(k) {
  const { tint, fixed } = itemPieces(k);
  return { tint: merge(tint), fixed: fixed.length ? merge(fixed) : null };
}

/* ---------- ตรวจ/แก้ข้อมูลชิ้นส่วน (ข้อมูลจาก Firestore เป็นของคนอื่น เชื่อไม่ได้) ---------- */
const num = (v, a, b, d) => (typeof v === "number" && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
export function cleanPart(p) {
  if (!p || typeof p !== "object") return null;
  const k = p.k | 0;
  if (k < 0 || k >= ITEMS.length || p.k !== k) return null;
  const c = typeof p.c === "string" && /^#[0-9a-f]{6}$/.test(p.c) ? p.c : ITEMS[k].colors[0];
  return { k, x: num(p.x, -0.6, 0.6, 0), y: num(p.y, 0, 0.6, TOP), z: num(p.z, -0.6, 0.6, 0), r: num(p.r, -180, 180, 0), s: num(p.s, SIZE[0], SIZE[1], 1), c };
}
export const cleanParts = (list) => (Array.isArray(list) ? list.slice(0, MAX_PARTS).map(cleanPart).filter(Boolean) : []);
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
/** ทำให้ตัวเลขสั้นก่อนบันทึก (มุมเป็นจำนวนเต็ม ขนาด 2 ตำแหน่ง ตำแหน่ง 3 ตำแหน่ง) */
export const packPart = (p) => ({ k: p.k, x: round(p.x), y: round(p.y), z: round(p.z), r: Math.round(p.r), s: round(p.s, 2), c: p.c });
/** ชุดเริ่มต้น: เทียนกลาง + ธูป (ของจำเป็นของกระทง) */
export const defaultParts = () => [
  { k: CANDLE, x: 0, y: TOP, z: 0, r: 0, s: 1, c: ITEMS[CANDLE].colors[0] },
  { k: INCENSE, x: -0.12, y: TOP, z: 0.05, r: 20, s: 1, c: ITEMS[INCENSE].colors[0] },
];
/** กระทงเก่า (รุ่น 2D: style 0–3) → ฐาน + ของแต่งแบบเดียวกับภาพ 2D */
export function fromLegacy(k) {
  const base = [0, 1, 2, 0][k.style | 0] || 0;
  const parts = defaultParts().concat([
    { k: 0, x: -0.18, y: TOP, z: 0.14, r: 0, s: 1, c: ITEMS[0].colors[0] },
    { k: 0, x: 0.18, y: TOP, z: 0.14, r: 0, s: 1, c: ITEMS[0].colors[(k.style | 0) === 3 ? 1 : 0] },
    { k: 1, x: 0.05, y: TOP, z: -0.2, r: 0, s: 1, c: ITEMS[1].colors[0] },
  ]);
  return { base, parts };
}

/* ---------- ไอคอน SVG ของปุ่มเลือกของแต่ง ---------- */
export const ITEM_ICONS = [
  '<circle cx="12" cy="12" r="6.5" fill="#f29b26"/><circle cx="12" cy="12" r="2.6" fill="#c96512"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" stroke="#f7c531" stroke-width="1.6" stroke-linecap="round"/>',
  '<g fill="#fffaf0"><circle cx="12" cy="7" r="2.6"/><circle cx="16.8" cy="10.4" r="2.6"/><circle cx="15" cy="16" r="2.6"/><circle cx="9" cy="16" r="2.6"/><circle cx="7.2" cy="10.4" r="2.6"/></g><circle cx="12" cy="11.6" r="2" fill="#f5c518"/>',
  '<circle cx="12" cy="11" r="7" fill="#c8203c"/><path d="M12 11c2-2.5 4-1 3 1.5-1 2.5-5 2.8-6.2 0-1.3-3 1.5-6 4.7-5.2" fill="none" stroke="#8e1028" stroke-width="1.4" stroke-linecap="round"/><path d="M8 19l4-2 4 2" fill="none" stroke="#4f8a4a" stroke-width="1.6" stroke-linecap="round"/>',
  '<path d="M12 3c4 4.5 5 9 3.4 13.2C14.6 18.4 9.4 18.4 8.6 16.2 7 12 8 7.5 12 3Z" fill="#e47f98"/><path d="M12 3c-1 4.5-1 9 0 14" stroke="#c74f86" stroke-width="1.2" fill="none"/><path d="M12 18v3" stroke="#4f8a4a" stroke-width="1.6" stroke-linecap="round"/>',
  '<rect x="9.5" y="9" width="5" height="12" rx="1.4" fill="#f4ead2"/><path d="M12 9V7.4" stroke="#3b2c22" stroke-width="1"/><path d="M12 1.8c2.2 2.4 2.4 4.3 0 5.6-2.4-1.3-2.2-3.2 0-5.6Z" fill="#ffc24a"/>',
  '<path d="M12 21V6M12 21L7.5 7M12 21l4.5-14" stroke="#8a5a3c" stroke-width="1.4" stroke-linecap="round"/><g fill="#ff5a2a"><circle cx="12" cy="5.6" r="1.4"/><circle cx="7.3" cy="6.6" r="1.4"/><circle cx="16.7" cy="6.6" r="1.4"/></g>',
];
