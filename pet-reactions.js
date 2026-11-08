/* pet-reactions.js — ท่าทางทั้งหมดของตัวการ์ตูน เขียนเป็นข้อมูล (เพิ่มท่าใหม่ได้โดยไม่ต้องแตะ logic ใน lvc-pet.js)
 *
 * แต่ละท่า
 *   cat     หมวด: tap · idle · enter · exit · web · group (หน้าหลักสูตร) · drag
 *   w       น้ำหนักตอนสุ่ม (ค่าเริ่ม 1) · rare: true = ท่าหายาก (น้ำหนักเริ่ม 0.5 ≈ 5–10% ของหมวด)
 *   dur     ความยาว (วินาที) · เกินเวลา dur + 1.2 วิ ตัวกันค้างจะพากลับท่ายืนเอง
 *   tx      true = เล่นตอนเปลี่ยนหน้าได้ (ต้องจบภายใน ~1.2 วิ)
 *   clip    คลิปเริ่ม [ชื่อ, เวลาผสม, ความเร็ว] ใช้ได้แค่ Idle / Walk / Happy / Held
 *   face    สีหน้า (morph 8 ตัว 0–1): happyEyes blink smile laugh squeeze open browsUp blush
 *   yaw     หันตัว (เรเดียน): 0 = หันหน้าเข้าจอ · "back" = หันหลัง · "keep" = คงเดิม · "travel" = หันตามทางที่ไป
 *   spin    หมุนตัว (รอบ) ช่วง spinAt: [เริ่ม, จบ]
 *   origin  "center" = หมุน/ย่อ DOM รอบกลางตัว (ค่าเริ่มคือที่เท้า)
 *   move    keyframe ชั้น DOM: { t, dx, db, rot, sx, sy, op, e } · dx/db หน่วย "ความสูงตัว" (db บวก = ลอยขึ้น)
 *           ค่าพิเศษ: "E"/"-E" = เลยขอบจอด้านที่ใกล้ (แนวนอน) · "P" = ขอบจอพอดี (เห็นครึ่งตัว) · "T" = เลยขอบบนจอ
 *           rel: true = dx/rot คิดตามทิศที่หัน/ทิศที่เดินทาง
 *   osc     สั่น/แกว่งเพิ่มบนชั้น DOM: { p: rot|db|dx|sy, amp, hz, from, to, decay }
 *   head    หันหัว/เอียง (หลัง mixer ทุกเฟรม ไม่สะสม): { yaw|pitch|roll: ค่า หรือ [amp, hz], from, to }
 *   steps   ลำดับขั้น: { at, clip, face, fx: [ชนิด, จำนวน, ที่], say: "คีย์ใน pet-lines.js", look, yaw }
 *           สัญลักษณ์: heart bang q note spark orbit zz sweat dust drop · ที่: head side feet around
 *   say     พูดตอนเริ่ม (คีย์ใน pet-lines.js)
 *   then    ท่าต่อไปเมื่อจบ · sleep: true = ค้างไว้จนผู้ใช้ขยับ แล้วเล่น wake
 * Reduced Motion: ตัดคลิป/การเคลื่อนที่/การหมุนทั้งหมด เหลือสีหน้า ข้อความ และสัญลักษณ์แบบจาง
 * ตัดทิ้ง (ไม่มีคลิปรองรับ ดูไม่เป็นธรรมชาติ): โบกมือ (ทั้งท่าออกและท่าว่าง) · ท่าเข้า #8 ไถลตามริบบิ้น
 */
const HAPPY = { happyEyes: 1, laugh: 1, blush: 1 };

export default {
  /* ===================== แตะ (8 แบบ + ตามจุดที่แตะ) ===================== */
  "tap.happy": {
    cat: "tap", dur: 1.15, clip: ["Happy", 0.12], face: HAPPY, say: "tap.body",
    steps: [{ at: 0.1, fx: ["heart", 3, "head"] }],
  },
  "tap.giggle": {
    cat: "tap", dur: 1.4, clip: ["Idle", 0.2], face: { happyEyes: 1, laugh: 0.7, blush: 0.6 }, say: "tap.body",
    osc: [{ p: "rot", amp: 2.6, hz: 9, from: 0.05, to: 1.3 }],
    head: [{ roll: [0.1, 4.5], from: 0.05, to: 1.3 }],
  },
  "tap.shy": {
    cat: "tap", dur: 1.9, clip: ["Idle", 0.2], face: { blush: 1, smile: 0.6, happyEyes: 0.35 },
    head: [{ yaw: 0.62, pitch: 0.2, from: 0.1, to: 1.7 }],
    move: [{ t: 0, rot: 0 }, { t: 0.35, rot: -4 }, { t: 1.6, rot: -4 }, { t: 1.9, rot: 0 }],
    steps: [{ at: 0.3, fx: ["heart", 1, "side"] }],
  },
  "tap.spin": {
    cat: "tap", dur: 1.05, clip: ["Happy", 0.12], face: { happyEyes: 1, smile: 1 }, spin: 1, spinAt: [0.1, 0.75],
    steps: [{ at: 0.2, fx: ["spark", 4, "around"] }],
  },
  "tap.flip": {
    cat: "tap", rare: true, dur: 1.15, clip: ["Held", 0.1], face: { happyEyes: 1, laugh: 0.8 }, origin: "center", say: "tap.body",
    move: [
      { t: 0, db: 0, rot: 0, sx: 1, sy: 1 }, { t: 0.14, sx: 1.08, sy: 0.88 }, { t: 0.26, sx: 1, sy: 1 },
      { t: 0.26, rot: 0 }, { t: 0.82, rot: -360, e: "lin" },
      { t: 0.24, db: 0 }, { t: 0.55, db: 0.62, e: "out" }, { t: 0.86, db: 0, e: "in" },
      { t: 0.9, sx: 1.12, sy: 0.86 }, { t: 1.1, sx: 1, sy: 1 },
    ],
    steps: [{ at: 0.86, clip: ["Idle", 0.12] }, { at: 0.86, fx: ["dust", 3, "feet"] }],
  },
  "tap.startle": {
    cat: "tap", dur: 1.5, clip: ["Idle", 0.15], face: { browsUp: 1, open: 0.8 },
    move: [{ t: 0, dx: 0, db: 0 }, { t: 0.14, dx: -0.12, db: 0.1, e: "out" }, { t: 0.3, dx: -0.16, db: 0, e: "in" }, { t: 1.5, dx: -0.16 }],
    steps: [{ at: 0, fx: ["bang", 1, "head"] }, { at: 0.6, face: { happyEyes: 1, laugh: 0.8 }, say: "tap.body" }],
    osc: [{ p: "rot", amp: 2, hz: 8, from: 0.6, to: 1.3 }],
    ends: { dx: -0.16 },
  },
  "tap.dance": {
    cat: "tap", dur: 1.8, clip: ["Idle", 0.2], face: { happyEyes: 0.7, smile: 1 },
    osc: [{ p: "db", amp: 0.05, hz: 1.7, from: 0.1, to: 1.75 }, { p: "rot", amp: 6, hz: 0.85, from: 0.1, to: 1.75 }],
    head: [{ roll: [0.18, 0.85], from: 0.1, to: 1.75 }],
    steps: [{ at: 0.1, fx: ["note", 1, "side"] }, { at: 0.65, fx: ["note", 1, "side"] }, { at: 1.2, fx: ["note", 1, "side"] }],
  },
  "tap.stretch": {
    cat: "tap", dur: 1.5, clip: ["Held", 0.15], face: { squeeze: 0.6, open: 0.5, smile: 0.4 },
    move: [{ t: 0, sy: 1 }, { t: 0.45, sy: 1.06 }, { t: 1.1, sy: 1.06 }, { t: 1.4, sy: 1 }],
    steps: [{ at: 1.05, clip: ["Idle", 0.25], face: { smile: 0.8, happyEyes: 0.6 } }],
  },
  /* ตามจุดที่แตะ */
  "tap.pat": {
    cat: "zone", dur: 1.7, clip: ["Idle", 0.2], face: { happyEyes: 1, smile: 1, blush: 0.7 }, say: "tap.head",
    head: [{ pitch: 0.16, from: 0.05, to: 1.5 }, { roll: [0.08, 1.6], from: 0.1, to: 1.5 }],
    steps: [{ at: 0.15, fx: ["heart", 2, "head"] }],
  },
  "tap.rub": {
    cat: "zone", dur: 2.1, clip: ["Idle", 0.2], face: { happyEyes: 1, laugh: 0.45, blush: 1 }, say: "tap.head",
    head: [{ pitch: 0.18, from: 0.05, to: 1.9 }, { roll: [0.14, 1.8], from: 0.05, to: 1.9 }],
    steps: [{ at: 0.05, fx: ["heart", 3, "head"] }, { at: 0.7, fx: ["heart", 3, "head"] }],
  },
  "tap.foot": {
    cat: "zone", dur: 1.25, clip: ["Happy", 0.08], face: { squeeze: 0.8, open: 1, browsUp: 1 }, say: "tap.foot",
    move: [{ t: 0, db: 0 }, { t: 0.18, db: 0.24, e: "out" }, { t: 0.4, db: 0, e: "in" }, { t: 0.46, sy: 0.9, sx: 1.08 }, { t: 0.6, sy: 1, sx: 1 }],
    steps: [{ at: 0, fx: ["bang", 1, "head"] }, { at: 0.75, face: { happyEyes: 1, laugh: 0.6 } }],
  },
  "tap.hold": {
    cat: "zone", dur: 1.8, clip: ["Idle", 0.2], face: { browsUp: 0.8, smile: 0.3 }, say: "tap.hold",
    head: [{ roll: 0.36, from: 0.05, to: 1.6 }],
    steps: [{ at: 0.1, fx: ["q", 1, "head"] }],
  },
  "tap.dizzy": {
    cat: "zone", dur: 2.3, clip: ["Idle", 0.2], face: { squeeze: 0.7, open: 0.6 }, say: "tap.dizzy",
    head: [{ yaw: [0.24, 2.2], from: 0.05, to: 2.1 }, { roll: [0.14, 1.6], from: 0.05, to: 2.1 }],
    osc: [{ p: "rot", amp: 4.5, hz: 1.1, from: 0.05, to: 2.1 }],
    steps: [{ at: 0.05, fx: ["orbit", 3, "head"] }],
  },
  "tap.sulk": {
    cat: "zone", dur: 5, clip: ["Idle", 0.3], face: { smile: 0, browsUp: 0, squeeze: 0.2 }, yaw: "back", say: "tap.sulk",
    then: "tap.sulkEnd",
  },
  "tap.sulkEnd": {
    cat: "zone", dur: 1.5, clip: ["Happy", 0.15], face: { happyEyes: 1, smile: 1, blush: 0.5 }, yaw: 0, say: "tap.sulkEnd",
    steps: [{ at: 0.3, fx: ["heart", 1, "head"] }],
  },

  /* ===================== ตอนว่าง (สุ่มทุก ~8–20 วิ) ===================== */
  "idle.look": {
    cat: "idle", dur: 2.6, clip: ["Idle", 0.2], face: { browsUp: 0.3 },
    head: [{ yaw: -0.6, from: 0.15, to: 1.15 }, { yaw: 0.6, from: 1.3, to: 2.4 }],
  },
  "idle.tilt": {
    cat: "idle", dur: 1.9, clip: ["Idle", 0.2], face: { browsUp: 0.5, smile: 0.3 },
    head: [{ roll: 0.34, from: 0.1, to: 1.7 }],
  },
  "idle.stretch": {
    cat: "idle", dur: 1.6, clip: ["Held", 0.2], face: { squeeze: 0.7, open: 0.7 },
    move: [{ t: 0, sy: 1 }, { t: 0.5, sy: 1.06 }, { t: 1.2, sy: 1.06 }, { t: 1.5, sy: 1 }],
    steps: [{ at: 1.15, clip: ["Idle", 0.3], face: { smile: 0.6 } }],
  },
  "idle.hum": {
    cat: "idle", dur: 2.6, clip: ["Idle", 0.2], face: { smile: 1, happyEyes: 0.5 }, say: "idle.hum",
    head: [{ roll: [0.14, 1.1], from: 0.1, to: 2.5 }],
    osc: [{ p: "db", amp: 0.025, hz: 2.2, from: 0.1, to: 2.5 }],
    steps: [{ at: 0.2, fx: ["note", 1, "side"] }, { at: 1.0, fx: ["note", 1, "side"] }, { at: 1.8, fx: ["note", 1, "side"] }],
  },
  "idle.sneeze": {
    cat: "idle", dur: 1.7, clip: ["Idle", 0.2], face: { open: 0.5, squeeze: 0.3, browsUp: 0.7 },
    head: [{ pitch: -0.22, from: 0.1, to: 0.72 }, { pitch: 0.28, from: 0.75, to: 1.05 }],
    move: [{ t: 0.74, rot: 0 }, { t: 0.8, rot: -5 }, { t: 1.15, rot: 0 }],
    steps: [{ at: 0.75, face: { squeeze: 1, open: 1 }, say: "idle.sneeze", fx: ["sweat", 1, "head"] }, { at: 1.2, face: { smile: 0.6, happyEyes: 0.5 } }],
  },
  "idle.sparkle": {
    cat: "idle", dur: 2.4, clip: ["Idle", 0.2], face: { browsUp: 0.8, open: 0.4 },
    steps: [
      { at: 0, fx: ["spark", 1, "chase"], look: "chase" },
      { at: 1.15, clip: ["Happy", 0.12], face: { happyEyes: 1, laugh: 0.7 } },
      { at: 1.5, say: "idle.sparkle", fx: ["spark", 3, "head"], look: "clear" },
    ],
  },
  "idle.dance": {
    cat: "idle", dur: 1.6, clip: ["Idle", 0.2], face: { happyEyes: 0.6, smile: 1 },
    osc: [{ p: "db", amp: 0.035, hz: 1.9, from: 0.1, to: 1.5 }, { p: "rot", amp: 4, hz: 0.95, from: 0.1, to: 1.5 }],
    head: [{ roll: [0.14, 0.95], from: 0.1, to: 1.5 }],
    steps: [{ at: 0.2, fx: ["note", 1, "side"] }],
  },
  "idle.kick": {
    cat: "idle", dur: 1.4, clip: ["Idle", 0.2], face: { smile: 0.5 },
    head: [{ pitch: 0.3, from: 0.05, to: 1.2 }],
    move: [{ t: 0.3, db: 0 }, { t: 0.42, db: 0.06, e: "out" }, { t: 0.55, db: 0, e: "in" }],
    steps: [{ at: 0.52, fx: ["dust", 3, "feet"] }],
  },
  "idle.yawn": {
    cat: "idle", dur: 2.0, clip: ["Idle", 0.2], face: { open: 1, squeeze: 0.6, browsUp: 0.3 },
    head: [{ pitch: -0.2, from: 0.2, to: 1.5 }],
    move: [{ t: 0, sy: 1 }, { t: 0.8, sy: 1.04 }, { t: 1.6, sy: 1 }],
    steps: [{ at: 1.5, face: { smile: 0.3, blink: 0.3 } }],
  },
  "idle.ping": {
    cat: "ping", dur: 2.2, clip: ["Idle", 0.2], face: { browsUp: 0.6, smile: 0.3 }, say: "idle.ping",
    head: [{ roll: 0.2, pitch: -0.08, from: 0.1, to: 2.0 }],
    steps: [{ at: 0.1, look: "clear" }],
  },
  "idle.stumble": {
    cat: "idle", rare: true, dur: 1.7, clip: ["Idle", 0.15], face: { open: 0.8, browsUp: 1 },
    move: [{ t: 0.1, rot: 0, dx: 0 }, { t: 0.32, rot: 13, dx: 0.08, e: "out" }, { t: 0.55, rot: -5, dx: 0.1 }, { t: 0.85, rot: 0, dx: 0.1 }, { t: 1.7, dx: 0.1 }],
    rel: true, ends: { dx: 0.1 },
    steps: [{ at: 0.55, fx: ["sweat", 1, "head"] }, { at: 0.9, face: { laugh: 0.5, happyEyes: 1, blush: 0.5 } }],
  },
  "idle.showoff": {
    cat: "idle", rare: true, dur: 1.2, clip: ["Held", 0.1], face: { happyEyes: 1, smile: 1 }, origin: "center",
    move: [
      { t: 0, db: 0, rot: 0, sx: 1, sy: 1 }, { t: 0.14, sx: 1.08, sy: 0.88 }, { t: 0.26, sx: 1, sy: 1 },
      { t: 0.26, rot: 0 }, { t: 0.82, rot: 360, e: "lin" },
      { t: 0.24, db: 0 }, { t: 0.55, db: 0.6, e: "out" }, { t: 0.86, db: 0, e: "in" },
      { t: 0.9, sx: 1.12, sy: 0.86 }, { t: 1.1, sx: 1, sy: 1 },
    ],
    steps: [{ at: 0.86, clip: ["Idle", 0.12], fx: ["spark", 3, "around"] }],
  },
  "idle.sleepy": {
    cat: "sleep", dur: 2.2, clip: ["Idle", 0.3], face: { open: 1, squeeze: 0.6 }, say: "idle.sleepy",
    head: [{ pitch: -0.18, from: 0.2, to: 1.4 }],
    steps: [{ at: 1.4, face: { blink: 0.6, smile: 0.2 } }],
    then: "idle.sleep",
  },
  "idle.sleep": {
    cat: "sleep", dur: 1, sleep: true, wake: "idle.wake", clip: ["Idle", 0.4], face: { blink: 1, smile: 0.2 },
    head: [{ pitch: 0.28, roll: 0.1, from: 0, to: 1e9 }],
    osc: [{ p: "sy", amp: 0.012, hz: 0.33, from: 0, to: 1e9 }],
  },
  "idle.wake": {
    cat: "sleep", dur: 1.5, clip: ["Happy", 0.08], face: { browsUp: 1, open: 0.7 }, say: "idle.wake",
    move: [{ t: 0, db: 0 }, { t: 0.18, db: 0.2, e: "out" }, { t: 0.4, db: 0, e: "in" }],
    steps: [{ at: 0, fx: ["bang", 1, "head"] }, { at: 0.8, face: { smile: 0.8, blush: 0.6 } }],
  },

  /* ===================== ท่าเข้า ===================== */
  "enter.pop": {
    cat: "enter", tx: true, dur: 1.0, clip: ["Held", 0], face: { happyEyes: 1, open: 0.6 }, say: "enter.pop",
    move: [
      { t: 0, db: -1.25, sx: 1, sy: 1 }, { t: 0.36, db: 0.42, e: "out" }, { t: 0.6, db: 0, e: "in" },
      { t: 0.6, sx: 1, sy: 1 }, { t: 0.7, sx: 1.12, sy: 0.86, e: "out" }, { t: 0.86, sx: 0.97, sy: 1.04 }, { t: 1.0, sx: 1, sy: 1 },
    ],
    steps: [{ at: 0.6, clip: ["Idle", 0.12], face: { smile: 1, blush: 0.3 }, fx: ["dust", 4, "feet"] }],
  },
  "enter.drop": {
    cat: "enter", tx: true, dur: 1.2, clip: ["Held", 0], face: { squeeze: 0.5, open: 0.6 },
    move: [
      { t: 0, db: "T", sx: 1, sy: 1 }, { t: 0.42, db: 0, e: "in" },
      { t: 0.42, sx: 1, sy: 1 }, { t: 0.48, sx: 1.18, sy: 0.78 }, { t: 0.58, sx: 0.96, sy: 1.05 },
      { t: 0.6, db: 0.14, e: "out" }, { t: 0.74, db: 0, e: "in" }, { t: 0.78, sx: 1.06, sy: 0.93 }, { t: 0.9, sx: 1, sy: 1 },
    ],
    head: [{ yaw: [0.3, 2.6], from: 0.78, to: 1.2 }],
    steps: [
      { at: 0.42, clip: ["Idle", 0.06], fx: ["dust", 4, "feet"] },
      { at: 0.76, fx: ["orbit", 2, "head"], face: { squeeze: 0.4, smile: 0.5 }, say: "enter.drop" },
    ],
  },
  "enter.run": {
    cat: "enter", tx: true, dur: 1.15, clip: ["Walk", 0, 2.6], face: { smile: 0.8, open: 0.3 }, yaw: "travel", rel: true,
    move: [{ t: 0, dx: "E", rot: 0 }, { t: 0.66, dx: 0.06, rot: 0, e: "out" }, { t: 0.74, rot: -9 }, { t: 0.86, dx: 0 }, { t: 1.05, rot: 0 }],
    steps: [{ at: 0.66, clip: ["Idle", 0.15], fx: ["dust", 3, "feet"] }, { at: 0.95, yaw: 0, face: { smile: 1, happyEyes: 0.6 } }],
  },
  "enter.peek": {
    cat: "enter", tx: true, dur: 1.2, clip: ["Idle", 0], face: { browsUp: 1, open: 0.5 }, yaw: "travel",
    move: [{ t: 0, dx: "P", db: 0 }, { t: 0.45, dx: "P", db: 0 }, { t: 0.75, db: 0.32, e: "out" }, { t: 0.98, dx: 0, db: 0, e: "in" }, { t: 1.02, sx: 1.08, sy: 0.9 }, { t: 1.15, sx: 1, sy: 1 }],
    steps: [{ at: 0.05, fx: ["bang", 1, "head"] }, { at: 0.45, clip: ["Happy", 0.1] }, { at: 0.98, clip: ["Idle", 0.1], yaw: 0, face: { smile: 1, happyEyes: 0.7 } }],
  },
  "enter.sparkle": {
    cat: "enter", tx: true, dur: 1.0, clip: ["Happy", 0.05], face: { happyEyes: 1, smile: 1 }, spin: 2, spinAt: [0, 0.72],
    move: [{ t: 0, sx: 0.08, sy: 0.08, op: 0 }, { t: 0.08, op: 1 }, { t: 0.45, sx: 1.14, sy: 1.14, e: "out" }, { t: 0.62, sx: 1, sy: 1 }],
    steps: [{ at: 0, fx: ["spark", 5, "around"] }],
  },
  "enter.feather": {
    cat: "enter", long: true, dur: 2.3, clip: ["Held", 0], face: { happyEyes: 0.5, smile: 1 },
    move: [{ t: 0, db: "T" }, { t: 1.9, db: 0.05, e: "out" }, { t: 2.05, db: 0 }, { t: 2.05, sy: 1 }, { t: 2.12, sy: 0.95 }, { t: 2.25, sy: 1 }],
    osc: [{ p: "dx", amp: 0.12, hz: 0.55, from: 0, to: 1.95, decay: true }, { p: "rot", amp: 8, hz: 0.55, from: 0, to: 1.95, decay: true }],
    steps: [{ at: 1.95, clip: ["Idle", 0.25] }],
  },
  "enter.flip": {
    cat: "enter", tx: true, rare: true, dur: 1.15, clip: ["Held", 0], face: { happyEyes: 1, laugh: 0.7 }, origin: "center", yaw: "travel", rel: true,
    move: [
      { t: 0, dx: "E", db: 0.1, rot: 0 }, { t: 0.4, dx: "E*0.45", db: 0.75, e: "out" }, { t: 0.82, dx: 0, db: 0, e: "in" },
      { t: 0.1, rot: 0 }, { t: 0.8, rot: 360, e: "lin" }, { t: 0.82, sx: 1, sy: 1 }, { t: 0.9, sx: 1.12, sy: 0.86 }, { t: 1.05, sx: 1, sy: 1 },
    ],
    steps: [{ at: 0.82, clip: ["Idle", 0.1], fx: ["dust", 3, "feet"], yaw: 0, say: "enter.flip" }],
  },
  "enter.sleep": {
    cat: "enter-special", dur: 0.5, sleep: true, wake: "enter.wake", clip: ["Idle", 0], face: { blink: 1, smile: 0.2 },
    move: [{ t: 0, op: 0 }, { t: 0.5, op: 1, e: "lin" }],
    head: [{ pitch: 0.28, roll: 0.1, from: 0, to: 1e9 }],
    osc: [{ p: "sy", amp: 0.012, hz: 0.33, from: 0, to: 1e9 }],
  },
  "enter.wake": {
    cat: "enter-special", dur: 1.5, clip: ["Happy", 0.08], face: { browsUp: 1, open: 0.7 }, say: "enter.wake",
    move: [{ t: 0, db: 0 }, { t: 0.18, db: 0.2, e: "out" }, { t: 0.4, db: 0, e: "in" }],
    steps: [{ at: 0, fx: ["bang", 1, "head"] }, { at: 0.8, face: { smile: 1, happyEyes: 0.8 } }],
  },

  /* ===================== ท่าออก (≤ 0.8 วิ ก่อนริบบิ้นคลุมจอ) ===================== */
  "exit.hop": {
    cat: "exit", dur: 0.62, clip: ["Happy", 0.1], face: { happyEyes: 1, smile: 1 }, say: "exit.hop",
    move: [{ t: 0, db: 0, sx: 1, sy: 1, op: 1 }, { t: 0.1, sx: 1.1, sy: 0.88 }, { t: 0.3, sx: 0.95, sy: 1.06, db: 0.32, e: "out" }, { t: 0.45, op: 1 }, { t: 0.62, db: 0.5, op: 0, e: "in" }],
  },
  "exit.run": {
    cat: "exit", dur: 0.75, clip: ["Walk", 0.08, 2.8], face: { smile: 0.8, open: 0.4 }, yaw: "travel", rel: true, say: "exit.run",
    move: [{ t: 0, dx: 0, rot: 0 }, { t: 0.1, rot: 6 }, { t: 0.75, dx: "E", e: "in" }],
    steps: [{ at: 0.05, fx: ["dust", 3, "feet"] }],
  },
  "exit.up": {
    cat: "exit", dur: 0.65, clip: ["Held", 0.08], face: { happyEyes: 1, open: 0.6 },
    move: [{ t: 0, db: 0, sx: 1, sy: 1 }, { t: 0.12, sx: 1.12, sy: 0.85 }, { t: 0.22, sx: 0.92, sy: 1.12 }, { t: 0.65, db: "T", e: "in" }],
    steps: [{ at: 0.12, fx: ["dust", 3, "feet"] }],
  },
  "exit.spin": {
    cat: "exit", dur: 0.72, clip: ["Happy", 0.1], face: { happyEyes: 1, smile: 1 }, spin: 2, spinAt: [0, 0.72],
    move: [{ t: 0, sx: 1, sy: 1, op: 1 }, { t: 0.25, sx: 1.08, sy: 1.08 }, { t: 0.72, sx: 0.05, sy: 0.05, op: 0, e: "in" }],
    steps: [{ at: 0.45, fx: ["spark", 5, "around"] }],
  },
  "exit.cheer": {
    cat: "exit-special", dur: 0.8, clip: ["Happy", 0.08], face: HAPPY, say: "exit.cheer",
    move: [{ t: 0, db: 0, op: 1 }, { t: 0.3, db: 0.3, e: "out" }, { t: 0.55, db: 0.05, e: "in" }, { t: 0.62, op: 1 }, { t: 0.8, db: 0.25, op: 0 }],
    steps: [{ at: 0.05, fx: ["spark", 3, "around"] }, { at: 0.2, fx: ["heart", 2, "head"] }],
  },
  "exit.bye": {
    cat: "bye", dur: 1.5, clip: ["Happy", 0.1], face: { happyEyes: 1, smile: 1 }, say: "exit.bye",
    move: [{ t: 0, db: 0 }, { t: 0.75, db: 0 }, { t: 0.82, sx: 1.08, sy: 0.9 }, { t: 0.9, sx: 1, sy: 1, db: 0.2, e: "out" }, { t: 1.5, db: -1.35, e: "in" }],
  },
  "exit.byeSpin": {
    cat: "bye", dur: 1.5, clip: ["Happy", 0.1], face: { happyEyes: 1, smile: 1 }, say: "exit.bye", spin: 2, spinAt: [0.75, 1.5],
    move: [{ t: 0, sx: 1, sy: 1, op: 1 }, { t: 0.75, sx: 1, sy: 1 }, { t: 1.5, sx: 0.05, sy: 0.05, op: 0, e: "in" }],
    steps: [{ at: 1.1, fx: ["spark", 5, "around"] }],
  },

  /* ===================== ตอบสนองกับเว็บ ===================== */
  "web.fast": {
    cat: "web", dur: 1.4, clip: ["Held", 0.1], face: { open: 0.8, browsUp: 1 }, say: "scroll.fast",
    osc: [{ p: "rot", amp: 7, hz: 2.2, from: 0, to: 1.1, decay: true }],
    steps: [{ at: 0, fx: ["sweat", 1, "head"] }, { at: 0.9, clip: ["Idle", 0.3], face: { smile: 0.6, browsUp: 0.4 } }],
  },
  "web.top": {
    cat: "web", dur: 1.2, clip: ["Held", 0.1], face: { happyEyes: 1, open: 0.7 }, say: "scroll.top",
    move: [{ t: 0, sy: 1 }, { t: 0.25, sy: 1.12, sx: 0.94 }, { t: 0.7, sy: 1, sx: 1 }],
    steps: [{ at: 0, look: "up", fx: ["spark", 2, "head"] }, { at: 0.8, clip: ["Idle", 0.3], look: "clear" }],
  },
  "web.bottom": {
    cat: "web", dur: 1.8, clip: ["Idle", 0.2], face: { browsUp: 0.6, smile: 0.5 }, say: "scroll.bottom",
    head: [{ pitch: -0.22, from: 0.1, to: 1.6 }],
  },
  "web.dark": {
    cat: "web", dur: 2.0, clip: ["Idle", 0.2], face: { open: 1, squeeze: 0.6 }, say: "theme.dark",
    head: [{ pitch: -0.2, from: 0.2, to: 1.5 }],
    steps: [{ at: 1.4, face: { blink: 0.5, smile: 0.3 }, fx: ["zz", 1, "head"] }],
  },
  "web.light": {
    cat: "web", dur: 1.6, clip: ["Idle", 0.2], face: { squeeze: 0.85, smile: 0.3 }, say: "theme.light",
    head: [{ yaw: 0.45, pitch: 0.15, from: 0.05, to: 1.3 }],
  },
  "web.tabBack": {
    cat: "web", dur: 2.0, clip: ["Idle", 0], face: { blink: 1 },
    head: [{ pitch: 0.28, from: 0, to: 0.7 }],
    steps: [
      { at: 0, fx: ["zz", 1, "head"] },
      { at: 0.7, clip: ["Happy", 0.08], face: { browsUp: 1, open: 0.7, blink: 0 }, fx: ["bang", 1, "head"], say: "tab.back" },
      { at: 1.3, face: { smile: 1, happyEyes: 0.6 } },
    ],
  },
  "web.rotate": {
    cat: "web", dur: 1.3, clip: ["Held", 0.1], face: { open: 0.7, browsUp: 1 }, say: "rotate",
    osc: [{ p: "rot", amp: 10, hz: 2, from: 0, to: 1.1, decay: true }],
    steps: [{ at: 0.1, fx: ["sweat", 1, "head"] }, { at: 0.9, clip: ["Idle", 0.3], face: { smile: 0.6 } }],
  },
  "web.saved": {
    cat: "web", dur: 1.2, clip: ["Happy", 0.1], face: HAPPY, say: "search.saved",
    steps: [{ at: 0.1, fx: ["heart", 3, "head"] }],
  },
  "web.noResult": {
    cat: "web", dur: 1.7, clip: ["Idle", 0.2], face: { browsUp: 0.8, smile: 0.2 },
    head: [{ roll: 0.32, from: 0.05, to: 1.5 }],
    steps: [{ at: 0.05, fx: ["q", 1, "head"] }],
  },

  /* ===================== หน้าหลักสูตร: เลื่อนถึงแต่ละกลุ่มสาขา ===================== */
  "group.food": {
    cat: "group", dur: 1.8, clip: ["Idle", 0.2], face: { open: 0.6, smile: 0.6, browsUp: 0.5 }, say: "group.food",
    head: [{ pitch: 0.12, roll: 0.12, from: 0.1, to: 1.6 }],
    steps: [{ at: 0.4, fx: ["sweat", 1, "head"] }],
  },
  "group.tourism": {
    cat: "group", dur: 2.0, clip: ["Idle", 0.2], face: { happyEyes: 0.6, smile: 1 }, say: "group.tourism",
    head: [{ pitch: -0.2, from: 0.1, to: 1.8 }, { yaw: [0.35, 0.7], from: 0.2, to: 1.8 }],
  },
  "group.fashion": {
    cat: "group", dur: 1.4, clip: ["Happy", 0.12], face: { happyEyes: 1, smile: 1, blush: 0.4 }, say: "group.fashion", spin: 1, spinAt: [0.1, 0.9],
    steps: [{ at: 0.6, fx: ["spark", 3, "around"] }],
  },
  "group.digital": {
    cat: "group", dur: 1.5, clip: ["Idle", 0.2], face: { happyEyes: 1, smile: 1 }, say: "group.digital",
    steps: [{ at: 0.1, fx: ["spark", 2, "head"] }],
  },
  "group.arts": {
    cat: "group", dur: 1.7, clip: ["Idle", 0.2], face: { happyEyes: 0.8, smile: 1, browsUp: 0.4 }, say: "group.arts",
    head: [{ roll: 0.25, from: 0.1, to: 1.5 }],
    steps: [{ at: 0.2, fx: ["spark", 2, "side"] }],
  },
  "group.business": {
    cat: "group", dur: 1.4, clip: ["Happy", 0.12], face: { smile: 1, browsUp: 0.6 }, say: "group.business",
    steps: [{ at: 0.2, fx: ["spark", 1, "head"] }],
  },
  "group.home-economics": {
    cat: "group", dur: 1.5, clip: ["Idle", 0.2], face: { happyEyes: 1, smile: 1, blush: 0.4 }, say: "group.home-economics",
    steps: [{ at: 0.2, fx: ["heart", 1, "head"] }],
  },
  "group.logistics": {
    cat: "group", dur: 1.3, clip: ["Happy", 0.1], face: { smile: 1, open: 0.4 }, say: "group.logistics",
    move: [{ t: 0, db: 0 }, { t: 0.2, db: 0.15, e: "out" }, { t: 0.42, db: 0, e: "in" }],
    steps: [{ at: 0.42, fx: ["dust", 3, "feet"] }],
  },
};
