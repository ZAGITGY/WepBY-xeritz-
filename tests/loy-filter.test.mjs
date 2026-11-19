// node --test tests/  — ตัวกรองข้อความในกระทง (loy-filter.js)
import test from "node:test";
import assert from "node:assert/strict";
import { problem, tidy } from "../loy-filter.js";

const pass = [
  "ขอให้สอบผ่านทุกวิชา", "ขอให้ครอบครัวมีความสุข สุขภาพแข็งแรง", "ขอให้แม่งามตลอดไป", "ขอให้แม่งานราบรื่น",
  "ขอให้เชี่ยวชาญการทำอาหาร", "ทีมกู้ภัยปลอดภัย", "ดอกไม้ไม่เหี่ยว", "รักสัตว์ทุกตัว", "เสือกระโดดข้ามคลอง",
  "ขอให้ได้งานที่กูเกิล", "แกงกะหรี่อร่อย", "หีบสมบัติ", "ปี 2569 ขอให้ดีกว่าเดิม", "24/11/2569 ลอยกระทงกับเพื่อน",
  "I wish my class passes the exam", "Happy Loy Krathong 2026!", "peacock and cocktail", "assess my skills",
  "มีดอกไม้สวย", "สีหน้าสดใส", "Thank you so much. Co-workers rock",
];
const rude = [
  "เหี้ย", "ไอ้เหี๊ย", "ค ว ย", "ควยยยย", "เ-ห-ี้-ย", "มึงอะ", "แม่งเอ้ย", "อีดอก", "fuck", "f u c k", "FUUUCK you",
  "sh1t", "b!tch", "motherfucker", "you ass", "dickhead", "kuy", "ไอ้สัส", "สัส",
];
const phone = ["โทร 081-234-5678", "0812345678", "๐๘๑๒๓๔๕๖๗๘", "+66 81 234 5678", "0 8 1 2 3 4 5 6 7 8"];
const link = ["ดูที่ www.example.com", "https://x.co", "เข้า line.me/ti/p/abc", "bit.ly/abc", "example.com", "google dot com", "เว็บ abc จุด com"];

test("ข้อความปกติผ่าน", () => { for (const t of pass) assert.equal(problem(t), null, t); });
test("คำหยาบไม่ผ่าน", () => { for (const t of rude) assert.equal(problem(t), "rude", t); });
test("เบอร์โทรไม่ผ่าน", () => { for (const t of phone) assert.equal(problem(t), "phone", t); });
test("ลิงก์ไม่ผ่าน", () => { for (const t of link) assert.equal(problem(t), "link", t); });
test("tidy ตัดตัวล่องหนและช่องว่างซ้ำ", () => {
  assert.equal(tidy("  ขอ​ให้\n\nสุข   ใจ  "), "ขอให้ สุข ใจ");
});
