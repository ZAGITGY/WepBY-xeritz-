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
const P = (k = 4, o = {}) => ({ k, x: 0.1, y: 0.2, z: -0.05, r: 30, s: 1, c: "#f29b26", ...o });
const PARTS = [P(4, { x: 0, z: 0, r: 0 }), P(5, { x: -0.05, z: -0.09 }), P(0, { x: -0.18, s: 1.25 }), P(1, { c: "#ffffff", r: -180 })];
await check("กระทงถูกรูปแบบ (ฐาน + 4 ชิ้น)", async () => { k1 = await db.add({ name: "มะลิ", wish: "ขอให้สอบผ่านทุกวิชา", base: 1, parts: PARTS }); });
await check("ไม่ใส่ชื่อ (ชื่อว่าง) + ไม่มีชิ้นส่วน", async () => { k2 = await db.add({ name: "", wish: "ขอให้ครอบครัวมีความสุข", base: 0, parts: [] }); });
await check("คำอธิษฐาน 80 ตัวพอดี + 24 ชิ้นพอดี", () => db.add({ name: "ก".repeat(20), wish: "ข".repeat(80), base: 2, parts: Array.from({ length: 24 }, (_, i) => P(i % 6, { x: -0.6 + i * 0.05, s: 0.6 + (i % 3) * 0.5 })) }));
await denied("คำอธิษฐาน 81 ตัว", () => db.add({ name: "", wish: "ข".repeat(81) }));
await denied("ชื่อ 21 ตัว", () => db.add({ name: "ก".repeat(21), wish: "สวัสดี" }));
await denied("คำอธิษฐานว่าง", () => db.add({ name: "", wish: "" }));
await denied("มีลิงก์", () => db.add({ name: "", wish: "ดูที่ https://x.co นะ" }));
await denied("มีเบอร์โทร", () => db.add({ name: "", wish: "โทร 081-234-5678" }));
await denied("เบอร์โทรเลขไทย", () => db.add({ name: "", wish: "โทร ๐๘๑๒๓๔๕๖๗๘" }));
const J = (...ps) => S(JSON.stringify(ps));      // parts เก็บเป็นข้อความ JSON
const good = { name: S("a"), wish: S("ขอให้โชคดี"), base: { integerValue: "1" }, parts: J(P()), rnd: { doubleValue: 0.5 }, hidden: { booleanValue: false } };
await check("เอกสารดิบที่ถูกรูปแบบผ่าน (ตัวตั้งต้นของชุดทดสอบด้านล่าง)", async () => {
  const res = await rawCommit([{ update: { name: name("krathongs", db.newId()), fields: good }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }]);
  assert.equal(res.status, 200);
});
await rawShouldFail("base เป็นข้อความ", { ...good, base: S("1") });
await rawShouldFail("ฐานแบบที่ 3 (มีแค่ 0–2)", { ...good, base: { integerValue: "3" } });
await rawShouldFail("แบบเก่า style แทน base/parts", { name: good.name, wish: good.wish, style: { integerValue: "1" }, rnd: good.rnd, hidden: good.hidden });
await rawShouldFail("ขาดฟิลด์ parts", { name: good.name, wish: good.wish, base: good.base, rnd: good.rnd, hidden: good.hidden });
await rawShouldFail("parts เป็น list แทนข้อความ JSON", { ...good, parts: { arrayValue: { values: [] } } });
await rawShouldFail("25 ชิ้น", { ...good, parts: J(...Array.from({ length: 25 }, () => P())) });
await rawShouldFail("ชิ้นชนิด 6", { ...good, parts: J(P(), P(6)) });
await rawShouldFail("ชนิดเป็นทศนิยม", { ...good, parts: J(P(1.5)) });
await rawShouldFail("สีไม่ใช่ #rrggbb", { ...good, parts: J(P(0, { c: "red" })) });
await rawShouldFail("ตำแหน่งนอกกระทง (x = 2)", { ...good, parts: J(P(0, { x: 2 })) });
await rawShouldFail("x = 0.61", { ...good, parts: J(P(0, { x: 0.61 })) });
await rawShouldFail("ทศนิยม 4 ตำแหน่ง", { ...good, parts: J(P(0, { x: 0.1234 })) });
await rawShouldFail("ขนาด 5 เท่า", { ...good, parts: J(P(0, { s: 5 })) });
await rawShouldFail("ขนาด 0.5", { ...good, parts: J(P(0, { s: 0.5 })) });
await rawShouldFail("มุม 720 องศา", { ...good, parts: J(P(0, { r: 720 })) });
await rawShouldFail("มุม 181 องศา", { ...good, parts: J(P(0, { r: 181 })) });
await rawShouldFail("ชิ้นมีคีย์เกิน", { ...good, parts: J({ ...P(), url: "x" }) });
await rawShouldFail("ชิ้นขาดคีย์ (ไม่มีสี)", { ...good, parts: J({ k: 1, x: 0, y: 0.2, z: 0, r: 0, s: 1 }) });
await rawShouldFail("ชิ้นที่ 24 ผิด (ตรวจถึงช่องสุดท้าย)", { ...good, parts: J(...Array.from({ length: 23 }, () => P()), P(0, { c: "#zzzzzz" })) });
await rawShouldFail("ชิ้นเป็นข้อความแทนวัตถุ", { ...good, parts: J("ดาวเรือง") });
await rawShouldFail("ข้อความต่อท้าย JSON", { ...good, parts: S(JSON.stringify([P()]) + "<script>") });
await rawShouldFail("ข้อความอื่นแทน JSON", { ...good, parts: S("ดูที่ https://x.co") });
await rawShouldFail("wish เป็นตัวเลข", { ...good, wish: { integerValue: "5" } });
await rawShouldFail("hidden = true ตั้งแต่แรก", { ...good, hidden: { booleanValue: true } });
await rawShouldFail("มีฟิลด์เกิน", { ...good, admin: { booleanValue: true } });
await rawShouldFail("rnd เกิน 1", { ...good, rnd: { doubleValue: 1.5 } });
await rawShouldFail("ขาดฟิลด์ hidden", { name: good.name, wish: good.wish, base: good.base, parts: good.parts, rnd: good.rnd });
await rawShouldFail("เวลาจากเครื่องผู้ใช้ (ไม่ใช่เวลาเซิร์ฟเวอร์)", { ...good, at: { timestampValue: "2026-11-24T12:00:00Z" } }, []);

console.log("อ่าน");
await check("ล่าสุด + นับ + สุ่ม", async () => {
  const l = await db.latest(10);
  assert.ok(l.some((d) => d.id === k1.id) && l.every((d) => d.hidden === false));
  assert.equal(await db.count(), 4);
  // อ่านชิ้นส่วนกลับมาได้ครบ (list ของ map)
  const got = l.find((d) => d.id === k1.id);
  assert.equal(got.base, 1);
  assert.deepEqual(got.parts, PARTS);
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
  assert.equal(await db.count(), 3);
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
