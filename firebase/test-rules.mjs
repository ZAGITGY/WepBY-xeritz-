// ทดสอบ firestore.rules + loy-db.js กับ Firebase Emulator (ไม่แตะโปรเจกต์จริง)
//   cd firebase && npx firebase-tools emulators:exec --only firestore --project demo-loy "node test-rules.mjs"
import assert from "node:assert/strict";

const HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const PROJECT = "demo-loy";
globalThis.window = { __LVC_LOY_CONFIG: { apiKey: "test", projectId: PROJECT, emulatorHost: HOST } };
const db = await import("../loy-db.js");

const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;
const KEY = "correct horse battery staple 2569";
// เขียนแบบเจ้าของ (ข้าม rules) เฉพาะตอนเตรียมข้อมูล
const owner = (path, body, method = "POST") => fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify(body) });
// เขียนแบบผู้ใช้ทั่วไป (ผ่าน rules) ด้วยเอกสารที่กำหนดเอง
const rawCommit = (writes) => fetch(`${BASE}:commit?key=test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ writes }) });
const name = (col, id) => `${ROOT}/${col}/${id}`;
const S = (v) => ({ stringValue: v });

let pass = 0, fail = 0;
async function check(label, fn, ok = true) {
  try { await fn(); if (ok) { pass++; console.log("  ✓", label); } else { fail++; console.log("  ✗ (ควรถูกปฏิเสธ)", label); } }
  catch (e) { if (!ok && (e.status === 403 || e.code === "PERMISSION_DENIED")) { pass++; console.log("  ✓ ปฏิเสธ:", label); } else { fail++; console.log("  ✗", label, e.message); } }
}
const denied = (label, fn) => check(label, fn, false);
async function rawShouldFail(label, fields, transforms = [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }]) {
  const res = await rawCommit([{ update: { name: name("krathongs", db.newId()), fields }, updateTransforms: transforms, currentDocument: { exists: false } }]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ:", label); } else { fail++; console.log("  ✗ (ควรถูกปฏิเสธ)", label, res.status); }
}

await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
await owner(`/admin?documentId=config`, { fields: { key: S(KEY) } });

console.log("ลอยกระทง");
let k1, k2;
await check("กระทงถูกรูปแบบ", async () => { k1 = await db.add({ name: "มะลิ", wish: "ขอให้สอบผ่านทุกวิชา", style: 1 }); });
await check("ไม่ใส่ชื่อ (ชื่อว่าง)", async () => { k2 = await db.add({ name: "", wish: "ขอให้ครอบครัวมีความสุข", style: 0 }); });
await check("คำอธิษฐานยาว 80 ตัวพอดี", () => db.add({ name: "ก".repeat(20), wish: "ข".repeat(80), style: 3 }));
await denied("คำอธิษฐาน 81 ตัว", () => db.add({ name: "", wish: "ข".repeat(81), style: 0 }));
await denied("ชื่อ 21 ตัว", () => db.add({ name: "ก".repeat(21), wish: "สวัสดี", style: 0 }));
await denied("คำอธิษฐานว่าง", () => db.add({ name: "", wish: "", style: 0 }));
await denied("แบบกระทง 4", () => db.add({ name: "", wish: "สวัสดี", style: 4 }));
await denied("มีลิงก์", () => db.add({ name: "", wish: "ดูที่ https://x.co นะ", style: 0 }));
await denied("มีเบอร์โทร", () => db.add({ name: "", wish: "โทร 081-234-5678", style: 0 }));
await denied("เบอร์โทรเลขไทย", () => db.add({ name: "", wish: "โทร ๐๘๑๒๓๔๕๖๗๘", style: 0 }));
const good = { name: S("a"), wish: S("ขอให้โชคดี"), style: { integerValue: "1" }, rnd: { doubleValue: 0.5 }, hidden: { booleanValue: false } };
await rawShouldFail("style เป็นข้อความ", { ...good, style: S("1") });
await rawShouldFail("wish เป็นตัวเลข", { ...good, wish: { integerValue: "5" } });
await rawShouldFail("hidden = true ตั้งแต่แรก", { ...good, hidden: { booleanValue: true } });
await rawShouldFail("มีฟิลด์เกิน", { ...good, admin: { booleanValue: true } });
await rawShouldFail("rnd เกิน 1", { ...good, rnd: { doubleValue: 1.5 } });
await rawShouldFail("ขาดฟิลด์ hidden", { name: good.name, wish: good.wish, style: good.style, rnd: good.rnd });
await rawShouldFail("เวลาจากเครื่องผู้ใช้ (ไม่ใช่เวลาเซิร์ฟเวอร์)", { ...good, at: { timestampValue: "2026-11-24T12:00:00Z" } }, []);

console.log("อ่าน");
await check("ล่าสุด + นับ + สุ่ม", async () => {
  const l = await db.latest(10);
  assert.ok(l.some((d) => d.id === k1.id) && l.every((d) => d.hidden === false));
  assert.equal(await db.count(), 3);
  const r = await db.random(2);
  assert.equal(r.length, 2);
});

console.log("แจ้งซ่อน");
await check("แจ้งครั้งแรก", () => db.report(k1.id));
await check("แจ้งซ้ำ (นับเพิ่ม)", () => db.report(k1.id));
await check("รายการที่ถูกแจ้ง n = 2", async () => { const r = await db.reports(); assert.equal(r.find((x) => x.id === k1.id).n, 2); });
await denied("แจ้งกระทงที่ไม่มีอยู่", () => db.report("doesNotExist123"));
{
  const res = await rawCommit([{ update: { name: name("reports", k1.id), fields: { n: { integerValue: "0" } } }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ: ตั้งจำนวนแจ้งเป็น 0 เอง"); } else { fail++; console.log("  ✗ ตั้งจำนวนแจ้งเป็น 0 เอง", res.status); }
}

console.log("แอดมิน");
await denied("เข้าระบบด้วยรหัสผิด", () => db.adminLogin("wrong"));
await check("เข้าระบบด้วยรหัสถูก", () => db.adminLogin(KEY));
await denied("ซ่อนด้วยรหัสผิด", () => db.setHidden("wrong", k1.id, true));
{
  const res = await rawCommit([{ update: { name: name("krathongs", k2.id), fields: { hidden: { booleanValue: true } } }, updateMask: { fieldPaths: ["hidden"] } }]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ: ซ่อนโดยไม่มีรหัส"); } else { fail++; console.log("  ✗ ซ่อนโดยไม่มีรหัส", res.status); }
}
await check("ซ่อนด้วยรหัสถูก", () => db.setHidden(KEY, k1.id, true));
await check("ใบที่ซ่อนหายจากแม่น้ำ/ตัวเลข และรายการแจ้งถูกล้าง", async () => {
  assert.ok(!(await db.latest(10)).some((d) => d.id === k1.id));
  assert.equal(await db.count(), 2);
  assert.ok((await db.hiddenList()).some((d) => d.id === k1.id));
  assert.ok(!(await db.reports()).some((d) => d.id === k1.id));
});
{
  // ใช้บันทึก mod เก่าที่มีอยู่แล้ว (ไม่ได้เขียนพร้อมกัน) เพื่อแอบแสดงกระทงกลับ → ต้องไม่ได้
  const res = await rawCommit([{ update: { name: name("krathongs", k1.id), fields: { hidden: { booleanValue: false } } }, updateMask: { fieldPaths: ["hidden"] } }]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ: ใช้บันทึกแอดมินเก่าซ้ำ"); } else { fail++; console.log("  ✗ ใช้บันทึกแอดมินเก่าซ้ำ", res.status); }
}
{
  const res = await rawCommit([
    { update: { name: name("mod", k2.id), fields: { key: S(KEY), act: S("hide") } }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] },
    { update: { name: name("krathongs", k2.id), fields: { wish: S("แก้ข้อความ") } }, updateMask: { fieldPaths: ["wish"] } },
  ]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ: แอดมินแก้ข้อความคนอื่น"); } else { fail++; console.log("  ✗ แอดมินแก้ข้อความคนอื่น", res.status); }
}
await check("แสดงกลับด้วยรหัสถูก", () => db.setHidden(KEY, k1.id, false));
await check("ปิดรายงาน (ไม่ผิด)", async () => { await db.report(k2.id); await db.dismissReport(KEY, k2.id); assert.ok(!(await db.reports()).some((d) => d.id === k2.id)); });

console.log("ข้อมูลลับ");
for (const [label, path] of [["อ่านรหัสแอดมิน", "/admin/config"], ["อ่านบันทึกแอดมิน", "/mod/_login"]]) {
  const res = await fetch(`${BASE}${path}?key=test`);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ:", label); } else { fail++; console.log("  ✗", label, res.status); }
}
{
  const res = await rawCommit([{ delete: name("krathongs", k2.id) }]);
  if (res.status === 403) { pass++; console.log("  ✓ ปฏิเสธ: ลบกระทง"); } else { fail++; console.log("  ✗ ลบกระทง", res.status); }
}

console.log(`\n${pass} ผ่าน · ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
