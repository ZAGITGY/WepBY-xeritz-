/* ============================================================================
 * lvc-transition.js — v11.1 เปลี่ยนหน้าด้วยริบบิ้น (ฝั่งกดลิงก์ + ฝั่งแหวกเมื่อมาถึง)
 *   กดลิงก์ไปหน้าอื่นในเว็บ (.html) → ริบบิ้นตัดเฉียงคลุมจอ ~1 วินาที → เปลี่ยนหน้า
 *   หน้าใหม่เปิดมาแบบคลุมอยู่ (tx-head.js) → รอหน้าพร้อม → ริบบิ้นค่อย ๆ แหวกออก ~1.6 วินาที
 *
 * ไม่ทำงานกับ: ลิงก์ในหน้าเดียวกัน (#ส่วน) · ลิงก์ภายนอก · ไฟล์ PDF/รูป · เปิดแท็บใหม่ / กด Ctrl, ⌘, Shift
 *   · ลิงก์ที่สคริปต์อื่นจัดการไปแล้ว · Reduced Motion
 * กลับด้วยปุ่ม Back (หน้าจากแคช bfcache) → ริบบิ้นแหวกออกให้เอง ไม่ค้างคลุมจอ
 * เปลี่ยนหน้าไม่สำเร็จ (เช่นดาวน์โหลด) → เปิดหน้าเดิมกลับให้ภายใน 8 วินาที
 * ============================================================================ */
(function () {
  "use strict";
  var TX = window.__LVC_TX;
  if (!TX || window.__LVC_TX_JS) return;
  window.__LVC_TX_JS = true;

  var d = document.documentElement;
  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var COVER_MS = 1150;   // ต้องตรงกับ transition.css: .08s + 3×65ms + .85s (+ เผื่อ)
  var PART_MS = 2150;    // .05s + 3×125ms + 1.6s (+ เผื่อ)
  var busy = false;

  function later(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) {
    return new Promise(function (r) {
      (function step(k) { if (!k) r(); else requestAnimationFrame(function () { step(k - 1); }); })(n);
    });
  }

  /* ---------- แหวกออก ---------- */
  function part(el, done) {
    if (!el || el.__parting) return;
    el.__parting = true;
    el.classList.remove("is-covering", "is-go", "is-covered");
    void el.offsetWidth;
    el.classList.add("is-parting");
    setTimeout(function () {
      try { if (el.hidePopover && el.matches(":popover-open")) el.hidePopover(); } catch (e) {}
      el.remove();
      if (done) done();
    }, PART_MS);
  }

  /* ---------- มาถึงหน้าใหม่ ---------- */
  function arrive() {
    if (!TX.arriving) return;
    if (!TX.el) TX.mount();
    var hold = Math.max(0, 380 - (performance.now() - (TX.mountedAt || 0)));
    var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, later(700)]) : later(0);
    // หน้าแรกสร้างเนื้อหาด้วย app.js: รอให้มีเนื้อหาจริงก่อน (นานสุด 1.6 วินาที)
    var app = document.getElementById("app");
    var content = !app ? Promise.resolve() : new Promise(function (resolve) {
      var t0 = performance.now();
      (function check() {
        if (app.querySelector("main") || performance.now() - t0 > 1600) resolve();
        else requestAnimationFrame(check);
      })();
    });
    Promise.all([fonts, content, later(hold)]).then(function () { return frames(2); }).then(function () {
      if (TX.opening || !TX.el) return;
      TX.opening = true;
      var el = TX.el;
      part(el, function () { if (TX.el === el) TX.el = null; TX.opening = false; });
      // ให้หน้าใหม่เริ่มเปิดตัวตามจังหวะที่ริบบิ้นเริ่มแยก
      setTimeout(function () {
        d.classList.remove("lvc-tx-in");
        window.dispatchEvent(new Event("lvc:tx-open"));
      }, 240);
    });
  }
  arrive();

  /* ---------- ออกจากหน้า ---------- */
  function target(a, e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    if (motion.matches || busy) return null;
    if (a.target && a.target !== "_self") return null;
    if (a.hasAttribute("download") || a.closest("[data-no-tx]")) return null;
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    if (TX.norm(url.pathname) === TX.norm(location.pathname)) return null;   // ลิงก์ในหน้าเดียวกัน
    if (!/(\.html?|\/)$/i.test(url.pathname)) return null;                    // PDF รูป ไฟล์อื่น
    return url;
  }

  function prefetch(href) {
    try {
      if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
      var l = document.createElement("link");
      l.rel = "prefetch"; l.href = href;
      document.head.appendChild(l);
    } catch (e) {}
  }

  function leave(url) {
    busy = true;
    prefetch(url.href);
    // ให้ส่วนอื่น (เช่นตัวการ์ตูน lvc-pet.js) รู้ว่ากำลังจะคลุมจอเปลี่ยนหน้า
    window.dispatchEvent(new CustomEvent("lvc:tx-leave", { detail: { href: url.href, coverMs: COVER_MS } }));
    var el = TX.build("covering");
    document.body.appendChild(el);
    // ชั้นบนสุด: คลุมเมนูมือถือ (dialog) ได้ด้วย
    if (el.showPopover) {
      el.setAttribute("popover", "manual");
      try { el.showPopover(); } catch (e) {}
    }
    TX.leaving = el;
    void el.offsetWidth;
    requestAnimationFrame(function () { el.classList.add("is-go"); });
    setTimeout(function () {
      if (TX.leaving !== el) return;
      try { sessionStorage.setItem("lvc-tx", JSON.stringify({ t: Date.now(), to: TX.norm(url.pathname) })); } catch (e) {}
      location.assign(url.href);
      TX.fail = setTimeout(function () { restore(); }, 8000);
    }, COVER_MS);
  }

  function restore() {
    clearTimeout(TX.fail);
    var el = TX.leaving;
    TX.leaving = null;
    busy = false;
    try { sessionStorage.removeItem("lvc-tx"); } catch (e) {}
    if (el) part(el);
    window.dispatchEvent(new Event("lvc:tx-cancel"));   // เปลี่ยนหน้าไม่สำเร็จ/กลับมาจาก bfcache
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var url = target(a, e);
    if (!url) return;
    e.preventDefault();
    leave(url);
  });

  // กลับมาด้วย Back/Forward จากแคช: หน้าเดิมยังคลุมอยู่ → แหวกออก
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && TX.leaving) restore();
  });
})();
