/* loy-db.js — อ่าน/เขียนกระทงใน Cloud Firestore ผ่าน REST API (ไม่โหลด Firebase SDK ~300 KB)
 * ใช้โดย loy.js (แม่น้ำหน้าแรก) และ loy-admin.html (หน้าแอดมิน) · กติกาฝั่งเซิร์ฟเวอร์อยู่ที่ firebase/firestore.rules
 *
 * krathongs/{id}  name ≤20 · wish 1–80 · base 0–2 · parts (ข้อความ JSON ≤24 ชิ้น {k,x,y,z,r,s,c} · k 0–7 ตาม loy-models.js ITEMS) · at (เวลาเซิร์ฟเวอร์) · rnd 0–1 · hidden
 * reports/{id}    n (จำนวนครั้งที่ถูกแจ้ง) · at  — id เดียวกับกระทง
 * mod/{id}        บันทึกการกระทำของแอดมิน (มีรหัส อ่านไม่ได้) เขียนพร้อมกันในคำสั่งเดียวกับการซ่อน/แสดง
 */
import FILE_CONFIG from "./loy-config.js?v=2026-11-20.1";

// window.__LVC_LOY_CONFIG: ใช้ตอนทดสอบกับ Firebase Emulator เท่านั้น (สคริปต์ทดสอบใส่ให้)
const CONFIG = (typeof window !== "undefined" && window.__LVC_LOY_CONFIG) || FILE_CONFIG || {};
export const configured = !!(CONFIG.apiKey && CONFIG.projectId);
const ROOT = `projects/${CONFIG.projectId}/databases/(default)/documents`;
const BASE = (CONFIG.emulatorHost ? `http://${CONFIG.emulatorHost}` : "https://firestore.googleapis.com") + "/v1/" + ROOT;
const KRATHONGS = "krathongs";

async function call(path, body, timeout = 8000) {
  if (!configured) throw Object.assign(new Error("not configured"), { code: "NOT_CONFIGURED" });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}?key=${encodeURIComponent(CONFIG.apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (Array.isArray(data) ? data[0] : data).error || {};
      throw Object.assign(new Error(err.message || "HTTP " + res.status), { status: res.status, code: err.status || "HTTP_" + res.status });
    }
    return data;
  } finally { clearTimeout(timer); }
}

/* ---------- แปลงค่า Firestore ↔ JS ---------- */
const enc = (v) => typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
  : Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
function dec(doc) {
  const f = doc.fields || {}, out = { id: doc.name.split("/").pop() };
  for (const k in f) {
    const v = f[k];
    out[k] = "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue
      : "booleanValue" in v ? v.booleanValue : "timestampValue" in v ? Date.parse(v.timestampValue) : null;
  }
  // ชิ้นส่วนเก็บเป็นข้อความ JSON → แปลงกลับ (เสีย = ไม่มีชิ้นส่วน ฉากจะใส่ชุดเริ่มต้นให้ และกรองค่าอีกชั้นด้วย cleanParts)
  if (typeof out.parts === "string") { try { out.parts = JSON.parse(out.parts); } catch (e) { out.parts = []; } }
  return out;
}
const docName = (col, id) => `${ROOT}/${col}/${id}`;
export function newId() {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => abc[x % 62]).join("");
}

/* ---------- อ่าน ---------- */
const eq = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: enc(value) } });
async function query(sq) {
  const rows = await call(":runQuery", { structuredQuery: Object.assign({ from: [{ collectionId: KRATHONGS }] }, sq) });
  return rows.filter((r) => r.document).map((r) => dec(r.document));
}
/** กระทงล่าสุดที่ยังไม่ถูกซ่อน (ใช้ดัชนี hidden + at) */
export const latest = (n) => query({ where: eq("hidden", false), orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: n });
/** กระทงที่ใหม่กว่าเวลา ms (ใช้ตอนดึงซ้ำทุก 45 วิ: ไม่มีใบใหม่ = เสีย 1 read แทน n reads) */
export const since = (ms, n) => query({
  where: { compositeFilter: { op: "AND", filters: [eq("hidden", false), { fieldFilter: { field: { fieldPath: "at" }, op: "GREATER_THAN", value: { timestampValue: new Date(ms).toISOString() } } }] } },
  orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: n,
});
/** หน้าถัดไป: กระทงที่เก่ากว่าเวลา ms เรียงใหม่ → เก่า (ฉาก 3D ขอเพิ่มเมื่อแสดงครบรอบแล้ว) */
export const page = (beforeMs, n) => query({
  where: { compositeFilter: { op: "AND", filters: [eq("hidden", false), { fieldFilter: { field: { fieldPath: "at" }, op: "LESS_THAN", value: { timestampValue: new Date(beforeMs).toISOString() } } }] } },
  orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: n,
});
/** สุ่มกระทง n ใบ: เริ่มจากจุดสุ่มบนแกน rnd วนกลับต้นแกนถ้าได้ไม่ครบ (ใช้ดัชนี hidden + rnd) */
export async function random(n) {
  const from = (r, k) => query({
    where: { compositeFilter: { op: "AND", filters: [eq("hidden", false), { fieldFilter: { field: { fieldPath: "rnd" }, op: "GREATER_THAN_OR_EQUAL", value: { doubleValue: r } } }] } },
    orderBy: [{ field: { fieldPath: "rnd" } }], limit: k,
  });
  const got = await from(Math.random(), n);
  return got.length < n ? got.concat((await from(0, n - got.length)).filter((d) => !got.some((g) => g.id === d.id))) : got;
}
/** จำนวนกระทงทั้งหมดที่แสดงอยู่ (นับฝั่งเซิร์ฟเวอร์ ไม่โหลดเอกสาร) */
export async function count() {
  const rows = await call(":runAggregationQuery", {
    structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: KRATHONGS }], where: eq("hidden", false) }, aggregations: [{ alias: "n", count: {} }] },
  });
  const f = rows[0] && rows[0].result && rows[0].result.aggregateFields;
  return f && f.n ? Number(f.n.integerValue) : 0;
}

/* ---------- เขียน ---------- */
const commit = (writes) => call(":commit", { writes });
const serverTime = (field) => ({ fieldPath: field, setToServerValue: "REQUEST_TIME" });

/** ชิ้นส่วน → ข้อความ JSON ตามรูปแบบที่ firestore.rules ตรวจ (ลำดับคีย์ k,x,y,z,r,s,c · ปัดทศนิยม · จำกัดช่วง) */
const clamp = (v, lo, hi, d) => { const m = 10 ** d; return Math.round(Math.min(hi, Math.max(lo, Number(v) || 0)) * m) / m; };
export const packParts = (parts) => JSON.stringify((Array.isArray(parts) ? parts : []).slice(0, 24).map((p) => ({
  k: Math.min(7, Math.max(0, p.k | 0)),          // ชนิดของแต่ง 0–7 (loy-models.js ITEMS)
  x: clamp(p.x, -0.6, 0.6, 3), y: clamp(p.y, 0, 0.6, 3), z: clamp(p.z, -0.6, 0.6, 3),
  r: ((Math.round(Number(p.r) || 0) + 540) % 360) - 180 || 0,
  s: clamp(p.s, 0.6, 1.6, 2),
  c: /^#[0-9a-f]{6}$/.test(p.c) ? p.c : "#ffffff",
})));

/** ลอยกระทงใบใหม่ → คืนข้อมูลกระทง (เวลาเป็นเวลาในเครื่องโดยประมาณ) */
export async function add({ name, wish, base = 0, parts = [] }) {
  const id = newId(), rnd = Math.random();
  base = Math.min(2, Math.max(0, base | 0));
  const json = packParts(parts);
  await commit([{
    update: { name: docName(KRATHONGS, id), fields: { name: enc(name), wish: enc(wish), base: enc(base), parts: enc(json), rnd: { doubleValue: rnd }, hidden: enc(false) } },
    updateTransforms: [serverTime("at")],
    currentDocument: { exists: false },
  }]);
  return { id, name, wish, base, parts: JSON.parse(json), rnd, hidden: false, at: Date.now() };
}

/** แจ้งซ่อน: นับจำนวนครั้งใน reports/{id} ให้แอดมินตรวจ */
export const report = (id) => commit([{
  update: { name: docName("reports", id), fields: {} }, updateMask: { fieldPaths: [] },
  updateTransforms: [{ fieldPath: "n", increment: { integerValue: "1" } }, serverTime("at")],
}]);

/* ---------- แอดมิน (loy-admin.html) ---------- */
// ทุกคำสั่งของแอดมินเขียน mod/{id} ที่มีรหัสไปพร้อมกัน — rules เทียบรหัสกับ admin/config ที่ไม่มีใครอ่านได้
const modWrite = (key, id, act) => ({
  update: { name: docName("mod", id), fields: { key: enc(key), act: enc(act) } }, updateTransforms: [serverTime("at")],
});
export const adminLogin = (key) => commit([modWrite(key, "_login", "login")]);
export const setHidden = (key, id, hidden) => commit([
  modWrite(key, id, hidden ? "hide" : "show"),
  { update: { name: docName(KRATHONGS, id), fields: { hidden: enc(hidden) } }, updateMask: { fieldPaths: ["hidden"] }, currentDocument: { exists: true } },
  { delete: docName("reports", id) },
]);
export const dismissReport = (key, id) => commit([modWrite(key, id, "dismiss"), { delete: docName("reports", id) }]);
export async function reports(n = 50) {
  const rows = await call(":runQuery", { structuredQuery: { from: [{ collectionId: "reports" }], orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: n } });
  return rows.filter((r) => r.document).map((r) => dec(r.document));
}
export const hiddenList = (n = 100) => query({ where: eq("hidden", true), limit: n });
export async function getMany(ids) {
  if (!ids.length) return [];
  const rows = await call(":batchGet", { documents: ids.map((id) => docName(KRATHONGS, id)) });
  return rows.filter((r) => r.found).map((r) => dec(r.found));
}
