/* ============================================================================
 * refine.js — v11 การเปิดเผยหัวข้อและภาพบนหน้าแรก (คู่กับ refine.css ส่วนที่ 4)
 *   หัวข้อหมวด: ม่านเปิดจากล่างขึ้นบน (ทำงานพร้อมการยกขึ้นของ scroll-fx.js)
 *   ภาพ: ม่านเปิดจากล่าง + ซูมออกช้า ๆ
 * หน้าย่อยใช้ page-fx.js เดิม (refine.css เติมม่านภาพให้ทาง CSS อย่างเดียว)
 *
 * ปลอดภัยไว้ก่อน: ซ่อนเฉพาะสิ่งที่ยังอยู่ใต้จอตอนเริ่ม · โฟกัสคีย์บอร์ด/สั่งพิมพ์/เปิด Reduced Motion = แสดงทันที
 * ไม่แก้ข้อความใน DOM ที่ app.js สร้าง (แค่ใส่คลาส)
 * ============================================================================ */
(function () {
  "use strict";
  var root = document.documentElement;
  var app = document.getElementById("app");
  if (!app || !("IntersectionObserver" in window)) return;
  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var HEADINGS = ".section-heading h2, .achievement h2, .public-info h2";
  var IMAGES = ".program-photo, .featured-news .image-wrap";
  var armed = [];
  var done = false;
  // ม่าน clip-path ปิดทั้งชิ้นทำให้ IntersectionObserver มองไม่เห็นตัวมันเอง จึงเฝ้ากล่องแม่แทน
  var boxes = new Map();
  function boxOf(el) {
    return el.closest(".section-heading, .achievement-layout > div, .public-layout > div, .program-image, .featured-news") || el.parentElement;
  }
  function open(el) { el.classList.add("is-in"); }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      (boxes.get(e.target) || []).forEach(open);
      boxes.delete(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });

  // กระโดดข้ามด้วยลิงก์ในเมนู: ส่วนที่เลยผ่านไปแล้ว (อยู่เหนือจอ) เปิดไว้เลย ไม่ต้องรอเลื่อนกลับ
  var ticking = false;
  function sweep() {
    ticking = false;
    boxes.forEach(function (els, box) {
      if (box.getBoundingClientRect().bottom > 0) return;
      els.forEach(open);
      boxes.delete(box);
      io.unobserve(box);
    });
    if (!boxes.size) window.removeEventListener("scroll", onScroll);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }

  function showAll() {
    armed.forEach(open);
    boxes.forEach(function (_, box) { io.unobserve(box); });
    boxes.clear();
  }

  function arm() {
    if (done || motion.matches) return;
    var heads = document.querySelectorAll(HEADINGS);
    var imgs = document.querySelectorAll(IMAGES);
    if (!heads.length) return;
    done = true;
    var vh = window.innerHeight || root.clientHeight;
    function add(el, cls) {
      var r = el.getBoundingClientRect();
      if (!r.width || r.top < vh * 0.92) return; // อยู่บนจออยู่แล้ว: ไม่ซ่อน
      el.classList.add(cls);
      armed.push(el);
      var box = boxOf(el);
      if (!boxes.has(box)) { boxes.set(box, []); io.observe(box); }
      boxes.get(box).push(el);
    }
    Array.prototype.forEach.call(heads, function (el) { add(el, "lvc-rv-h"); });
    Array.prototype.forEach.call(imgs, function (el) { add(el, "lvc-rv-img"); });
    root.classList.add("lvc-rv-on");
    if (boxes.size) window.addEventListener("scroll", onScroll, { passive: true });
  }

  // โฟกัสด้วยคีย์บอร์ดเข้าไปในส่วนที่ยังไม่เปิด → เปิดทันที
  document.addEventListener("focusin", function (e) {
    armed.forEach(function (el) {
      var box = el.closest("section") || el;
      if (box.contains(e.target)) open(el);
    });
  });
  window.addEventListener("beforeprint", showAll);
  if (motion.addEventListener) motion.addEventListener("change", function (e) { if (e.matches) showAll(); });

  if (document.querySelector(HEADINGS)) arm();
  else {
    var mo = new MutationObserver(function () {
      if (document.querySelector(HEADINGS)) { mo.disconnect(); requestAnimationFrame(arm); }
    });
    mo.observe(app, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 15000);
  }
})();
