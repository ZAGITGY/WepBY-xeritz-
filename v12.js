/* ============================================================================
 * v12.js — ส่วนเสริมเล็ก ๆ ของ v12 (2026-11-05)
 *   - ใส่ชั้นแสงสีพื้นหลัง (aurora) ให้ส่วนบริการ ข้อมูลสาธารณะ และหัวหน้าย่อย (สไตล์ใน v12.css)
 *   - การ์ดข่าวหลัก: แสงสะท้อนวิ่งตามเมาส์
 *   ลดการเคลื่อนไหว: aurora นิ่ง (CSS) · แสงสะท้อนไม่ทำงาน · ลบไฟล์นี้ได้โดยหน้าเว็บไม่เสีย
 * ============================================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  // isolate = สร้าง stacking context ให้ส่วนนั้น (ส่วนในหน้าแรก) · หน้าย่อยใส่ใน .page-main แบบไม่ isolate
  var HOSTS = [[".services", 1], [".public-info", 1], [".content-page .page-main", 0]];

  function aurora() {
    var done = 0;
    HOSTS.forEach(function (h) {
      var host = document.querySelector(h[0]);
      if (!host) return;
      done++;
      if (host.querySelector(":scope > .lvc-aurora")) return;
      var a = document.createElement("div");
      a.className = "lvc-aurora";
      a.setAttribute("aria-hidden", "true");
      a.innerHTML = "<i></i><i></i><i></i>";
      if (h[1]) host.classList.add("lvc-aurora-host");
      host.insertBefore(a, host.firstChild);
    });
    return done;
  }

  function glare() {
    var card = document.querySelector(".featured-news");
    if (!card || card.__lvcGlare) return !!card;
    card.__lvcGlare = 1;
    card.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || (reduce && reduce.matches)) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
    return true;
  }

  function run() {
    var a = aurora();
    var g = glare();
    return a >= 1 && (g || !document.getElementById("app"));
  }

  function boot() {
    if (run()) return;
    // หน้าแรกสร้างเนื้อหาด้วย app.js — รอจนส่วนต่าง ๆ มีอยู่จริง
    var app = document.getElementById("app");
    if (!app || !window.MutationObserver) return;
    var mo = new MutationObserver(function () { if (run()) mo.disconnect(); });
    mo.observe(app, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 20000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
