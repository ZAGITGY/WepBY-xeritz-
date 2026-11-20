/* loy-models.js — ชุดโมเดลกระทง (assets/krathong · GLB จาก krathong-kit.js) + ข้อมูลชิ้นส่วนที่บันทึกลง Firestore
 *
 * หน่วยโมเดล: 1 ≈ 1 ฟุต · ทุกชิ้นตั้งบน y = 0 หันขึ้น +Y · ขนาด/จุดวาง/ชื่อ mesh อยู่ใน assets/krathong/manifest.json
 * ฐาน (base): 0 ใบตอง (small.glb) · 1 ดอกบัว (lotus.glb) · 2 ขนมปัง (bread.glb) — เลขเดียวกับรุ่นแรก ข้อมูลเดิมยังอ่านได้
 * ชิ้นส่วน (part) = { k: ชนิด 0–7, x, y, z: ตำแหน่งบนฐาน (หน่วยโมเดล), r: มุมรอบแกนตั้ง (องศา), s: ขนาด, c: สี "#rrggbb" }
 *   k 0–5 ความหมายเดิม (ดาวเรือง มะลิ กุหลาบ บัวตูม เทียน ธูป) · 6 เบญจมาศ · 7 กล้วยไม้
 *   เปลี่ยนลำดับหรือเพิ่มชนิด ต้องแก้ firebase/firestore.rules (partsOk) และ loy-db.js (packParts) ให้ตรงกัน
 * โหลดแต่ละไฟล์ครั้งเดียว (cache) แล้ว clone ใช้ซ้ำ: geometry ใช้ร่วมกัน · material ของส่วนที่เปลี่ยนสีได้ clone ต่อชิ้น
 */
import * as THREE from "./vendor/three/three.module.min.js";
import { GLTFLoader } from "./vendor/three/addons/GLTFLoader.min.js";

export const KIT = "./assets/krathong/";
export const BASES = [
  { id: "small", name: "ใบตอง", note: "อันเล็ก พับใบตองรอบหยวก" },
  { id: "lotus", name: "ดอกบัว", note: "กลีบบัวซ้อนสี่ชั้น" },
  { id: "bread", name: "ขนมปัง", note: "ลอยแล้วปลาได้กิน" },
];
// colors[0] = สีตั้งต้นตาม manifest · ธูปไม่มีส่วนที่เปลี่ยนสี (colors ว่าง → ไม่มีแถวจุดสี)
export const ITEMS = [
  { id: "marigold", name: "ดาวเรือง", colors: ["#f7a51c", "#f7c531", "#e2581b", "#fff1d6"] },
  { id: "jasmine", name: "มะลิ", colors: ["#fffdf6", "#ffe1ea", "#f4ead2"] },
  { id: "rose", name: "กุหลาบ", colors: ["#c8243a", "#ef7f9b", "#fff4f0", "#f7c531", "#e2581b"] },
  { id: "lotus_bud", name: "บัวตูม", colors: ["#ec8aab", "#fff0f3", "#c74f86"] },
  { id: "candle", name: "เทียน", colors: ["#f4cf2c", "#f4ead2", "#c8243a", "#fff8ec"] },
  { id: "incense", name: "ธูป", colors: [] },
  { id: "chrysanthemum", name: "เบญจมาศ", colors: ["#9b6fd6", "#f3f0ff", "#f7c531", "#ef7f9b", "#6c3aa8"] },
  { id: "orchid", name: "กล้วยไม้", colors: ["#c03fa8", "#b04ad0", "#f3f0ff", "#f7c531"] },
];
export const CANDLE = 4, INCENSE = 5;
export const MAX_PARTS = 24;
export const SIZE = [0.6, 1.6];
export const ITEM_INDEX = Object.fromEntries(ITEMS.map((it, k) => [it.id, k]));
export const thumb = (id) => `${KIT}thumbs/${id}.webp`;

/* ---------- manifest + โหลดโมเดล ---------- */
let manP = null;
export const manifest = () => (manP ||= fetch(`${KIT}manifest.json`).then((r) => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); }));
const loader = new GLTFLoader();
const cache = new Map();
function glb(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene));
  return cache.get(url);
}
/** ชุดโมเดล: lod = true → lod/ (เบา ใช้ในแม่น้ำ) · false → โมเดลเต็ม (หน้าแต่งกระทง)
 *  คืน { man, bases[3], items[8], flame, tint[8] (ชื่อ mesh ที่เปลี่ยนสีได้ หรือ null) } */
export async function loadKit(lod) {
  const man = await manifest(), dir = KIT + (lod ? "lod/" : "");
  const [bases, items, flame] = await Promise.all([
    Promise.all(BASES.map((b) => glb(dir + man.bases[b.id].file))),
    Promise.all(ITEMS.map((it) => glb(dir + man.decor[it.id].file))),
    glb(dir + man.decor.flame.file),
  ]);
  const tint = ITEMS.map((it) => (it.colors.length ? man.decor[it.id].meshes[0].mesh : null));
  return { man, bases, items, flame, tint };
}
/** ชิ้นใหม่จาก cache: geometry ใช้ร่วม · material ของ mesh ที่เปลี่ยนสีได้ clone แยกแล้วใส่สี */
export function cloneItem(kit, k, hex) {
  const o = kit.items[k].clone(true), name = kit.tint[k];
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.material = m.material.clone();
    if (m.name === name) m.material.color.set(hex || ITEMS[k].colors[0]);
  });
  return o;
}
export function setItemColor(kit, obj, k, hex) {
  const name = kit.tint[k];
  if (name) obj.traverse((m) => { if (m.isMesh && m.name === name) m.material.color.set(hex); });
}
export const placeOf = (man, base) => man.bases[BASES[base].id].place;

/* ---------- ตรวจ/แก้ข้อมูลชิ้นส่วน (ข้อมูลจาก Firestore เป็นของคนอื่น เชื่อไม่ได้) ---------- */
const num = (v, a, b, d) => (typeof v === "number" && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
export function cleanPart(p) {
  if (!p || typeof p !== "object") return null;
  const k = p.k | 0;
  if (k < 0 || k >= ITEMS.length || p.k !== k) return null;
  const c = typeof p.c === "string" && /^#[0-9a-f]{6}$/.test(p.c) ? p.c : ITEMS[k].colors[0] || "#ffffff";
  return { k, x: num(p.x, -0.6, 0.6, 0), y: num(p.y, 0, 0.6, 0.1), z: num(p.z, -0.6, 0.6, 0), r: num(p.r, -180, 180, 0), s: num(p.s, SIZE[0], SIZE[1], 1), c };
}
export const cleanParts = (list) => (Array.isArray(list) ? list.slice(0, MAX_PARTS).map(cleanPart).filter(Boolean) : []);
/** ให้ชิ้นอยู่ในวงวางของฐานนั้น (place.radius) และสูงพอดีผิวฐาน (กันข้อมูลแปลก ๆ ลอยกลางอากาศ) */
export function fitPart(place, p) {
  const r = Math.hypot(p.x, p.z);
  if (r > place.radius) { p.x *= place.radius / r; p.z *= place.radius / r; }
  p.y = Math.min(place.y + 0.06, Math.max(place.y - 0.04, p.y));
  return p;
}
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
/** ทำให้ตัวเลขสั้นก่อนบันทึก (มุมเป็นจำนวนเต็ม ขนาด 2 ตำแหน่ง ตำแหน่ง 3 ตำแหน่ง) */
export const packPart = (p) => ({ k: p.k, x: round(p.x), y: round(p.y), z: round(p.z), r: Math.round(p.r), s: round(p.s, 2), c: p.c });
/** กระทงไอเดียจาก manifest.presets: [ชนิด, [x, ยกจากผิว, z], มุม (เรเดียน), ขนาด, สี?] */
export function presetParts(man, base) {
  const place = placeOf(man, base);
  return (man.presets[BASES[base].id] || []).map(([id, [x, y, z], rad, s, c]) => {
    const k = ITEM_INDEX[id];
    return { k, x, y: place.y + y, z, r: Math.round(((rad * 180) / Math.PI + 540) % 360 - 180), s, c: c || ITEMS[k].colors[0] || "#ffffff" };
  });
}
/** ชุดเริ่มต้น: เทียน + ธูปตามตำแหน่งในไอเดียของฐานนั้น (ของจำเป็นของกระทง) */
export const defaultParts = (man, base) => presetParts(man, base).filter((p) => p.k === CANDLE || p.k === INCENSE);
/** กระทงรุ่น 2D (style 0–3, ไม่มีชิ้นส่วน) → ฐาน + ไอเดียของฐานนั้น */
export function fromLegacy(man, k) {
  const base = [0, 1, 2, 0][k.style | 0] || 0;
  return { base, parts: presetParts(man, base) };
}
