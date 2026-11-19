/* loy-filter.js — ตรวจข้อความในกระทงก่อนลอย (ใช้ทั้งหน้าเว็บและสคริปต์ทดสอบ tests/loy-filter.test.mjs)
 *
 * problem(text) → null (ผ่าน) | "rude" | "phone" | "link"
 * - คำหยาบไทย: ตัดช่องว่าง/จุด/อีโมจิที่คั่นตัวอักษรทิ้ง ไม้ตรี/จัตวา = ไม้โท ตัวซ้ำติดกันนับตัวเดียว ("ค ว ยยย" = "ควย")
 *   คำปกติที่มีคำหยาบซ้อนอยู่ข้างใน (หีบ เชี่ยวชาญ กู้ภัย แม่งาน …) ถูกตัดออกก่อนตรวจ
 * - คำหยาบอังกฤษ: แปลง 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s · คำยาวตรวจแบบอยู่ในคำ · คำสั้นตรวจทั้งคำ
 * - เบอร์โทร: ตัวเลข (ไทย/อารบิก) 9 ตัวขึ้นไปติดกัน คั่นด้วยช่องว่าง . - ( ) / ได้
 * - ลิงก์: http(s):// www. ชื่อ.โดเมน line.me t.me bit.ly …
 * shortcut: รายการคำเป็นแบบคงที่ คนตั้งใจเลี่ยงยังหาทางได้ → หน้าแอดมินซ่อนได้ ถ้าเจอคำใหม่บ่อยให้เพิ่มในรายการนี้
 */
const TH_BAD = [
  "เหี้ย", "ควย", "เย็ด", "เยด", "หี", "แตด", "มึง", "กู", "สัส", "ส้นตีน", "แม่ง", "เชี่ย", "ระยำ", "ชิบหาย", "ฉิบหาย",
  "ไอ้ห่า", "อีห่า", "ห่าราก", "ห่ากิน", "อีดอก", "ดอกทอง", "ตอแหล", "ร่าน", "สถุน", "กระหรี่", "เงี่ยน",
  "ไอ้สัตว์", "อีสัตว์", "ไอ้เวร", "อีเวร", "ไอ้ควาย", "อีควาย", "ไอ้หมา", "อีหมา", "ชาติหมา", "โคตรพ่อ", "โคตรแม่",
  "จัญไร", "อัปรีย์", "อีตัว", "ไอ้ชาติชั่ว",
];
// คำปกติที่มีคำข้างบนซ้อนอยู่ (ตัดออกก่อนตรวจ)
const TH_OK = [
  "หีบ", "เหี่ยว", "เหียน", "เหี้ยม", "หีนยาน", "เชี่ยว", "กู้", "กูเกิล", "กูรู", "สัสดี", "ดอกทองอุไร", "ดอกทองกวาว",
];
// "แม่ง" ที่ตามด้วยสระหลัง/อ คือคำปกติ (แม่งาม แม่งาน แม่งอน)
const TH_OK_RX = [/แม่ง(?=[\u0E30-\u0E3A\u0E47อ])/g];
const EN_PART = ["fuck", "shit", "bitch", "cunt", "asshole", "motherf", "pussy", "nigger", "nigga", "faggot", "whore", "slut", "bastard", "dickhead", "cocksuck", "wanker", "porn"];
const EN_WORD = ["dick", "cock", "twat", "tits", "fag", "retard", "ass", "arse", "fck", "fuk", "kuy", "kuay", "yed", "hia"];

const ZW = /[­​-‍⁠﻿]/g;
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** ข้อความที่จะเก็บจริง: ตัดตัวควบคุม/ตัวล่องหน ช่องว่างหลายตัวเหลือตัวเดียว */
export function tidy(s) {
  return String(s == null ? "" : s).normalize("NFC").replace(ZW, "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

const thKey = (s) => s.toLowerCase().replace(/[๊๋]/g, "้").replace(/[^ก-๎a-z]/g, "").replace(/ๆ/g, "").replace(/(.)\1+/g, "$1");
const TH_BAD_K = TH_BAD.map(thKey);
const TH_OK_K = TH_OK.map(thKey).sort((a, b) => b.length - a.length);
// คำอังกฤษ: ตัวอักษรซ้ำได้ (fuuuck) แต่ไม่ยุบตัวซ้ำ เพราะ nigger/niger ต่างกัน
const rx = (w) => new RegExp(w.replace(/(.)/g, "$1+"));
const EN_PART_RX = EN_PART.map(rx);
const EN_WORD_RX = EN_WORD.map((w) => new RegExp("^" + w.replace(/(.)/g, "$1+") + "(?:e?s|ed|ing|er)?$"));

function rudeThai(text) {
  let k = thKey(text);
  for (const ok of TH_OK_K) k = k.split(ok).join("|");
  for (const r of TH_OK_RX) k = k.replace(r, "|");
  return TH_BAD_K.some((w) => k.includes(w));
}
function rudeEnglish(text) {
  const s = text.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c]);
  // คำที่พิมพ์แยกทีละตัว "f u c k" รวมกลับเป็นคำเดียว
  const raw = s.split(/\s+/).map((t) => t.replace(/[^a-z]/g, "")).filter(Boolean);
  const words = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].length === 1) {
      let j = i, w = "";
      while (j < raw.length && raw[j].length === 1) w += raw[j++];
      if (w.length > 1) { words.push(w); i = j - 1; continue; }
    }
    words.push(raw[i]);
  }
  return words.some((w) => EN_PART_RX.some((r) => r.test(w)) || EN_WORD_RX.some((r) => r.test(w)));
}

const thaiDigits = (s) => s.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0E50));
const PHONE = /(?:\d[\s.\-()_/]{0,3}){9,}/;
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]{2,}\s?\.(?:com|net|org|co|th|me|ly|io|app|xyz|info|biz|tk|gg|to|link|site|online|shop|store|live|tv|cc|asia|club|page|dev)\b|\b[a-z0-9-]{2,}\s?(?:dot|จุด)\s?(?:com|net|org|co|th)\b|\b(?:line\.me|t\.me|bit\.ly|fb\.me|youtu\.be|tinyurl|shorturl)\b/i;

export function problem(text) {
  const t = tidy(text);
  if (!t) return null;
  if (LINK.test(t)) return "link";
  if (PHONE.test(thaiDigits(t))) return "phone";
  if (rudeThai(t) || rudeEnglish(t)) return "rude";
  return null;
}

export const MESSAGES = {
  rude: "มีคำที่ไม่เหมาะสม ลองเขียนใหม่ด้วยถ้อยคำสุภาพนะ",
  phone: "ห้ามใส่เบอร์โทรศัพท์ในกระทง",
  link: "ห้ามใส่ลิงก์หรือชื่อเว็บไซต์ในกระทง",
};
