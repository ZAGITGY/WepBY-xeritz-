/* ============================================================================
 * lvc-interact.js — v11.1 เว็บตอบสนองการสัมผัสและเมาส์ (คู่กับ refine.css ส่วน v11.1)
 * ปิดทีละอย่างได้ที่ CFG · ไม่แตะ transform ที่ GSAP/สคริปต์อื่นใช้อยู่
 *   (ใช้คุณสมบัติ translate / rotate / scale แยก ซึ่งซ้อนกับ transform เดิมได้)
 *
 *   ripple   แตะ/คลิกปุ่มและการ์ด → วงคลื่นแผ่ออกจากจุดที่แตะ
 *   magnet   ปุ่มกลม/ปุ่มหลักขยับตามเมาส์เล็กน้อย (คอม)
 *   parallax ภาพข่าว/หลักสูตร/ผลงานเลื่อนตามเมาส์ในกรอบ · มือถือ: แตะแล้วภาพขยับเข้าหานิ้ว
 *   mark     ตัวอักษร LVC ท้ายเว็บเอียงตามเมาส์ · แตะแล้วเด้งเป็นคลื่น
 *   cursor   วงแหวนตามเมาส์ ขยายเมื่ออยู่บนสิ่งที่กดได้ (คอมที่มีเมาส์เท่านั้น)
 *   tilt     การ์ดบริการ/สาขาเอียงรับแสงตามนิ้วตอนกดค้าง (มือถือ)
 *
 * Reduced Motion: ปิดทุกอย่างยกเว้นวงคลื่นแบบจางเร็ว (ยังบอกได้ว่ากดโดนแล้ว)
 * ============================================================================ */
(function () {
  "use strict";
  if (window.__LVC_INTERACT) return;
  window.__LVC_INTERACT = true;

  var CFG = { ripple: true, magnet: true, parallax: true, mark: true, cursor: true, tilt: true };

  var root = document.documentElement;
  var mq = function (q) { return window.matchMedia ? matchMedia(q) : { matches: false }; };
  var motion = mq("(prefers-reduced-motion: reduce)");
  var fine = mq("(hover: hover) and (pointer: fine)");
  var still = function () { return motion.matches; };

  var RIPPLE = [
    ".button", ".service-link", ".program-row", ".news-item", ".featured-news", ".lvc-es__chip",
    ".icon-button", ".theme-toggle", ".menu-toggle", ".quiet-button", ".save-program", ".lvc-tk__btn",
    ".lvc-top", ".page-nav a", ".desktop-nav a", ".menu-content > a", ".footer-social a",
    ".contact-channels > a", ".document-links a", ".public-links summary",
    ".level-overview > div", ".award-entry > a", ".news-story__image", ".poster-button"
  ].join(",");
  var MAGNET = ".button:not(.lvc-metal), .icon-button, .theme-toggle, .lvc-tk__btn, .lvc-top, .lvc-es__chip, .quiet-button";
  var PARALLAX = ".featured-news .image-wrap, .program-photo, .news-item, .news-story__image, .award-entry > a";
  var TILT = ".service-link, .program-row, .news-item, .level-overview > div, .contact-channels > a";
  var HOT = "a, button, summary, label, select, input, textarea, [role='button'], [tabindex]:not([tabindex='-1'])";

  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }

  /* ค่อย ๆ ไหลไปยังค่าเป้าหมาย (translate / rotate / scale แยก) ด้วย rAF เดียว
   * ไม่ต้องแก้ transition ของแต่ละองค์ประกอบ จึงไม่ชนกับแอนิเมชันเดิม */
  var gliding = new Set(), glideRaf = 0;
  function glide(el, x, y, r, s) {
    var g = el.__lvcG || (el.__lvcG = { x: 0, y: 0, r: 0, s: 1 });
    g.tx = x || 0; g.ty = y || 0; g.tr = r || 0; g.ts = s || 1;
    gliding.add(el);
    if (!glideRaf) glideRaf = requestAnimationFrame(glideStep);
  }
  function glideStep() {
    glideRaf = 0;
    gliding.forEach(function (el) {
      var g = el.__lvcG, k = 0.14;
      g.x += (g.tx - g.x) * k; g.y += (g.ty - g.y) * k; g.r += (g.tr - g.r) * k; g.s += (g.ts - g.s) * k;
      var rest = Math.abs(g.tx - g.x) + Math.abs(g.ty - g.y) + Math.abs(g.tr - g.r) * 4 + Math.abs(g.ts - g.s) * 60 < 0.05;
      if (rest) { g.x = g.tx; g.y = g.ty; g.r = g.tr; g.s = g.ts; gliding.delete(el); }
      var home = !g.x && !g.y && !g.r && g.s === 1;
      el.style.translate = home ? "" : g.x.toFixed(2) + "px " + g.y.toFixed(2) + "px";
      el.style.rotate = home || !g.r ? "" : g.r.toFixed(2) + "deg";
      el.style.scale = home || g.s === 1 ? "" : g.s.toFixed(4);
    });
    if (gliding.size) glideRaf = requestAnimationFrame(glideStep);
  }

  /* ---------- ripple ---------- */
  function ripple(e) {
    if (!CFG.ripple || e.button > 0) return;
    var host = closest(e.target, RIPPLE);
    if (!host || host.classList.contains("lvc-metal") || host.closest(".lvc-tx, .lvc-kit")) return;
    var cs = getComputedStyle(host);
    if (cs.position === "static") host.style.position = "relative";
    var layer = host.querySelector(":scope > .lvc-rp");
    if (!layer) {
      layer = document.createElement("span");
      layer.className = "lvc-rp";
      layer.setAttribute("aria-hidden", "true");
      host.appendChild(layer);
    }
    var r = host.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var size = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
    var dot = document.createElement("i");
    dot.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + size + "px;height:" + size + "px";
    if (still()) dot.className = "is-still";
    layer.appendChild(dot);
    var done = function () { dot.classList.add("is-out"); setTimeout(function () { dot.remove(); }, 700); };
    var up = function () { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); setTimeout(done, 120); };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    setTimeout(done, 2400);
  }
  document.addEventListener("pointerdown", ripple, { passive: true });

  /* ---------- magnet (คอม) ---------- */
  var magnetEl = null;
  function magnetMove(e) {
    if (!CFG.magnet || !fine.matches || still() || e.pointerType !== "mouse") return;
    var el = closest(e.target, MAGNET);
    if (magnetEl && magnetEl !== el) { glide(magnetEl, 0, 0); magnetEl = null; }
    if (!el) return;
    magnetEl = el;
    var r = el.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    var k = Math.min(8, Math.max(4, r.width * 0.06));
    glide(el, dx * k, dy * k * 0.7);
  }
  document.addEventListener("pointermove", magnetMove, { passive: true });
  document.addEventListener("pointerout", function (e) {
    if (magnetEl && (!e.relatedTarget || !magnetEl.contains(e.relatedTarget))) {
      glide(magnetEl, 0, 0); magnetEl = null;
    }
  }, { passive: true });

  /* ---------- parallax ภาพในกรอบ ---------- */
  function shift(host, cx, cy, amount) {
    var img = host.querySelector("img");
    if (!img) return;
    var r = host.getBoundingClientRect();
    var dx = (cx - (r.left + r.width / 2)) / r.width;
    var dy = (cy - (r.top + r.height / 2)) / r.height;
    glide(img, -dx * amount, -dy * amount, 0, 1.06);
  }
  function unshift(host) {
    var img = host && host.querySelector("img");
    if (img) glide(img, 0, 0, 0, 1);
  }
  var pxHost = null;
  document.addEventListener("pointermove", function (e) {
    if (!CFG.parallax || still() || e.pointerType !== "mouse") return;
    var host = closest(e.target, PARALLAX);
    if (pxHost && pxHost !== host) { unshift(pxHost); pxHost = null; }
    if (!host) return;
    pxHost = host;
    shift(host, e.clientX, e.clientY, host.classList.contains("news-item") ? 6 : 16);
  }, { passive: true });
  document.addEventListener("pointerout", function (e) {
    if (pxHost && (!e.relatedTarget || !pxHost.contains(e.relatedTarget))) { unshift(pxHost); pxHost = null; }
  }, { passive: true });
  // มือถือ: แตะภาพ → ภาพขยับเข้าหานิ้วเล็กน้อยแล้วคืนตัว
  document.addEventListener("pointerdown", function (e) {
    if (!CFG.parallax || still() || e.pointerType === "mouse") return;
    var host = closest(e.target, PARALLAX);
    if (!host) return;
    shift(host, e.clientX, e.clientY, -10);
    setTimeout(function () { unshift(host); }, 520);
  }, { passive: true });

  /* ---------- การ์ดเอียงตามนิ้ว (มือถือ) ---------- */
  document.addEventListener("pointerdown", function (e) {
    if (!CFG.tilt || still() || e.pointerType === "mouse") return;
    var card = closest(e.target, TILT);
    if (!card) return;
    var r = card.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    card.classList.add("lvc-tilt");
    card.style.setProperty("--tx", (dx * 3).toFixed(2) + "deg");
    card.style.setProperty("--ty", (-dy * 4).toFixed(2) + "deg");
    var off = function () {
      card.style.removeProperty("--tx"); card.style.removeProperty("--ty");
      window.removeEventListener("pointerup", off); window.removeEventListener("pointercancel", off);
      setTimeout(function () { card.classList.remove("lvc-tilt"); }, 450);
    };
    window.addEventListener("pointerup", off);
    window.addEventListener("pointercancel", off);
  }, { passive: true });

  /* ---------- ตัวอักษร LVC ท้ายเว็บ ---------- */
  function setupMark() {
    var mark = document.querySelector(".lvc-mark");
    if (!CFG.mark || !mark || mark.__lvcInteract) return !!mark;
    mark.__lvcInteract = true;
    var letters = Array.prototype.slice.call(mark.querySelectorAll("span"));
    var zone = mark.parentElement;
    zone.addEventListener("pointermove", function (e) {
      if (still() || e.pointerType !== "mouse") return;
      letters.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        var near = Math.max(0, 1 - Math.abs(e.clientY - (r.top + r.height / 2)) / (r.height * 1.4));
        glide(s, 0, -near * 14, dx * 10, 1);
      });
    }, { passive: true });
    zone.addEventListener("pointerleave", function () {
      letters.forEach(function (s) { glide(s, 0, 0, 0, 1); });
    });
    zone.addEventListener("pointerdown", function (e) {
      if (still() || closest(e.target, "a, button")) return;
      mark.classList.remove("is-wave");
      void mark.offsetWidth;
      mark.classList.add("is-wave");
      setTimeout(function () { mark.classList.remove("is-wave"); }, 1300);
    }, { passive: true });
    return true;
  }

  /* ---------- วงแหวนตามเมาส์ ---------- */
  function setupCursor() {
    if (!CFG.cursor || !fine.matches || still() || document.querySelector(".lvc-cursor")) return;
    var ring = document.createElement("div");
    ring.className = "lvc-cursor";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    var x = -100, y = -100, tx = -100, ty = -100, raf = 0, shown = false;
    function loop() {
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      ring.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
    }
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || still()) return;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { x = tx; y = ty; shown = true; ring.classList.add("is-on"); }
      var hot = closest(e.target, HOT);
      ring.classList.toggle("is-hot", !!hot && !closest(e.target, "input, textarea, select"));
      ring.classList.toggle("is-text", !!closest(e.target, "input, textarea"));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") ring.classList.add("is-down"); }, { passive: true });
    document.addEventListener("pointerup", function () { ring.classList.remove("is-down"); }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { ring.classList.remove("is-on"); shown = false; });
    if (motion.addEventListener) motion.addEventListener("change", function () { if (still()) ring.remove(); });
  }

  function boot() {
    setupCursor();
    if (!setupMark()) {
      // หน้าแรก: ท้ายเว็บสร้างโดย app.js / extras.js — รอจนมี
      var app = document.getElementById("app") || document.body;
      var mo = new MutationObserver(function () { if (setupMark()) mo.disconnect(); });
      mo.observe(app, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); }, 20000);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
