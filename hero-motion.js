/* ============================================================================
 * LVC — โมเดลหน้าแรกตอบสนองเมาส์ (hero-motion.js)
 *
 * เมื่อขยับเมาส์ในฉากหน้าแรก ประติมากรรม LVC จะเอียงตามเมาส์เล็กน้อย (ไม่เกิน ~5°) และแสงหลักขยับตาม
 * ทำให้ประกายบนขอบโลหะสีแชมเปญเลื่อนผ่านเหมือนเรากำลังหมุนดูชิ้นงานจริงในมือ
 *
 * หลักการ: เป็นการตอบสนองต่อการกระทำของผู้ใช้เท่านั้น ไม่มีอะไรขยับเองเมื่อไม่มีเมาส์
 * และ render ใหม่เฉพาะตอนที่ค่ายังเปลี่ยนอยู่ (เมาส์หยุด = ไม่กิน GPU)
 *
 * เปิดเฉพาะ: เมาส์จริง (hover + pointer fine), จอ > 900px, ไม่เปิด Reduced Motion
 * ต้องใช้ window.__LVC.hero / lights ที่ app.js เปิดให้ (ดู PATCH-NOTES.md ข้อ 5–6)
 * ============================================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!window.matchMedia) return;
  var motion = matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

  /* ---------- ค่าปรับแต่ง ---------- */
  var CFG = {
    tiltY: 0.09,      // เรเดียน หมุนซ้าย-ขวาสูงสุด (0.09 ≈ 5°)
    tiltX: 0.04,      // เรเดียน เงยก้มสูงสุด
    lightX: 2.6,      // หน่วยโลก 3D แสงหลักเลื่อนซ้าย-ขวาสูงสุด
    lightY: 1.3,      // เลื่อนขึ้น-ลง
    follow: 4.5       // ยิ่งมากยิ่งตามเมาส์เร็ว
  };

  var hero = null, g = null, tiltGroup = null, key = null, keyBase = null;
  var stage = null;
  var tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  var active = false;
  var scrollingUntil = 0;

  function ready() {
    var L = window.__LVC;
    if (!L || !L.hero || !L.gsap) return false;
    hero = L.hero; g = L.gsap;
    tiltGroup = hero.root && hero.root.children && hero.root.children[0];   // กลุ่มตัวอักษร+แท่น (ไม่รวมเงาบนพื้น)
    key = hero.lights && hero.lights.key;
    if (!tiltGroup || !key) return false;
    keyBase = { x: key.position.x, y: key.position.y, z: key.position.z };
    stage = document.querySelector(".story-stage");
    return !!stage;
  }

  function onMove(e) {
    if (window.innerWidth <= 900 || e.pointerType === "touch" || performance.now() < scrollingUntil) {
      tgt.x = tgt.y = 0;
      return;
    }
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    tgt.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    tgt.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
  }
  function onLeave() { tgt.x = tgt.y = 0; }
  function onScroll() {
    // Let scroll control the pose. Resume tilt only after a fresh pointer move.
    scrollingUntil = performance.now() + 140;
    onLeave();
  }

  function tick(time, deltaMs) {
    if (!active) return;
    var dt = Math.min(deltaMs / 1000, 0.05);
    var k = 1 - Math.exp(-dt * CFG.follow);
    var dx = tgt.x - cur.x, dy = tgt.y - cur.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4 && cur.x === tgt.x && cur.y === tgt.y) return;   // นิ่งแล้ว ไม่ต้อง render
    cur.x += dx * k; cur.y += dy * k;
    if (Math.abs(tgt.x - cur.x) < 1e-4 && Math.abs(tgt.y - cur.y) < 1e-4) { cur.x = tgt.x; cur.y = tgt.y; }
    tiltGroup.rotation.set(cur.y * CFG.tiltX, cur.x * CFG.tiltY, 0);
    key.position.set(keyBase.x + cur.x * CFG.lightX, keyBase.y - cur.y * CFG.lightY, keyBase.z);
    hero.invalidate();
  }

  function activate() {
    if (active || !motion.matches || !ready()) return;
    active = true;
    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    g.ticker.add(tick, false, true); // Apply the tilt before the sculpture renders.
    window.__LVC_HERO_MOTION = { get tilt() { return { x: cur.x, y: cur.y }; } };
  }

  function deactivate() {
    if (!active) return;
    active = false;
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onScroll);
    g.ticker.remove(tick);
    scrollingUntil = 0;
    tgt.x = tgt.y = cur.x = cur.y = 0;
    tiltGroup.rotation.set(0, 0, 0);
    key.position.set(keyBase.x, keyBase.y, keyBase.z);
    hero.invalidate();
  }

  // รอให้ทั้ง "โมเดลหน้าแรกพร้อม" และ "หน้าโหลดจบ" ก่อนค่อยเริ่มฟัง (ไม่แย่งทรัพยากรตอนโหลด)
  var heroUp = false, loadDone = !root.classList.contains("lvc-loading");
  function tryStart() {
    if (heroUp && loadDone && motion.matches) activate();
    else deactivate();
  }
  // เปลี่ยน Reduced Motion ระหว่างเปิดหน้า: คืนโมเดลและแสงทันที แล้วถอด ticker จนกว่าจะเปิดการเคลื่อนไหวอีกครั้ง
  if (motion.addEventListener) motion.addEventListener("change", tryStart);
  else motion.addListener(tryStart);
  window.addEventListener("lvc:hero", function () { heroUp = true; tryStart(); }, { once: true });
  window.addEventListener("lvc:loaded", function () { loadDone = true; tryStart(); }, { once: true });
  if (window.__LVC && window.__LVC.hero) heroUp = true;
  setTimeout(function () { loadDone = true; tryStart(); }, 22000);      // กันพลาด
  tryStart();
})();
