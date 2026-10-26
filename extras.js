/* ============================================================================
 * extras.js — LVC v9.4 การเคลื่อนไหวเสริม (คู่กับ extras.css)
 * ทำงานแยกจาก app.js / scroll-fx.js / page-fx.js: ไม่แตะองค์ประกอบที่ GSAP ควบคุม
 * ปิดทีละอย่างได้ที่ CFG · ลบทั้งไฟล์ได้โดยลบ <script src="extras.js"> และ <link href="extras.css">
 * ============================================================================ */
(function () {
  "use strict";

  var CFG = {
    progress: true,     // เส้นความคืบหน้าใต้แถบเมนู
    backToTop: true,    // ปุ่มกลับด้านบนลอยมุมขวาล่าง
    imageFade: true,    // รูปจางเข้าเมื่อโหลดเสร็จ
    footerMark: true,   // ตัวอักษร LVC ใหญ่ท้ายหน้า
    spotlight: true,    // แสงตามเมาส์ในช่วงผลงาน (คอม)
    prefetch: true,     // โหลดหน้าถัดไปล่วงหน้าเมื่อชี้/แตะลิงก์ เปลี่ยนหน้าเร็วขึ้น
    searchHints: true   // ช่องค้นหาสาขาเปลี่ยนตัวอย่างคำค้น
  };

  if (window.__LVC_EXTRAS) return;
  window.__LVC_EXTRAS = true;

  var root = document.documentElement;
  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var finePointer = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };
  function syncMotion() { root.classList.toggle("lvcx-on", !motion.matches); }
  syncMotion();
  if (motion.addEventListener) motion.addEventListener("change", syncMotion);

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function scrollTop(smooth) {
    try { window.scrollTo({ top: 0, left: 0, behavior: smooth ? "smooth" : "instant" }); }
    catch (e) { window.scrollTo(0, 0); }
  }

  /* ---------- สถานะการเลื่อน (อ่านค่าครั้งเดียวต่อเฟรม) ---------- */
  var maxScroll = 1, frame = 0, listeners = [];
  function measure() { maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function onScroll() { if (!frame) frame = requestAnimationFrame(flush); }
  function flush() {
    frame = 0;
    var y = window.scrollY || window.pageYOffset || 0;
    var p = Math.min(1, Math.max(0, y / maxScroll));
    for (var i = 0; i < listeners.length; i++) listeners[i](y, p);
  }
  function startScrollLoop() {
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { measure(); onScroll(); });
    window.addEventListener("lvc:loaded", function () { measure(); onScroll(); });
    window.addEventListener("load", function () { measure(); onScroll(); });
    window.addEventListener("pageshow", function () { measure(); onScroll(); });
    // ช่วงตรึงจอของ GSAP เพิ่มความสูงหน้าเว็บภายหลัง → วัดใหม่เมื่อ body เปลี่ยนขนาด
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); onScroll(); }).observe(document.body);
    onScroll();
  }

  /* ---------- 1) เส้นความคืบหน้า ---------- */
  function setupProgress() {
    var header = $(".site-header");
    if (!header || $(".lvc-progress", header)) return;
    var bar = document.createElement("div");
    bar.className = "lvc-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<i></i>";
    header.appendChild(bar);
    var fill = bar.firstChild, last = -1;
    listeners.push(function (y, p) {
      var v = Math.round(p * 1000) / 1000;
      if (v === last) return;
      last = v;
      fill.style.transform = "scaleX(" + v + ")";
    });
  }

  /* ---------- 2) ปุ่มกลับด้านบน ---------- */
  function setupBackToTop() {
    if ($(".lvc-top")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lvc-top";
    btn.setAttribute("aria-label", "กลับขึ้นด้านบนสุด");
    btn.innerHTML =
      '<svg class="lvc-top__ring" viewBox="0 0 50 50" aria-hidden="true"><circle class="lvc-top__track" cx="25" cy="25" r="24"/>' +
      '<circle class="lvc-top__bar" cx="25" cy="25" r="24"/></svg>' +
      '<svg class="lvc-top__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);
    var ring = $(".lvc-top__bar", btn), shown = false, lastP = -1, chapters = null;
    listeners.push(function (y, p) {
      // ช่วงประติมากรรมตรึงจอ: ข้อความอยู่มุมขวาล่าง (จอเตี้ย/มือถือแนวนอน) → หลบปุ่มออกระหว่างช่วงนั้น
      var show = window.__LVC_SHOWCASE && window.__LVC_SHOWCASE.trigger;
      var inShow = !!show && y >= show.start - 2 && y <= show.end + 2;
      // v10: เรื่องเล่าช่วงแรก (คอม) มีชื่อช่วง "เริ่มต้น … ก้าวต่อไป" อยู่มุมขวาล่าง ปุ่มเคยทับคำว่า "ก้าวต่อไป" → หลบเหมือนกัน
      if (!chapters || !chapters.isConnected) chapters = $(".chapters");
      var inStory = false;
      if (chapters && chapters.offsetWidth) { var cr = chapters.getBoundingClientRect(); inStory = cr.bottom > 0 && cr.top < window.innerHeight; }
      var want = y > window.innerHeight * 1.2 && !inShow && !inStory;
      if (want !== shown) { shown = want; btn.classList.toggle("is-on", want); }
      var v = Math.round(p * 500) / 500;
      if (v !== lastP) { lastP = v; ring.style.strokeDashoffset = (150.8 * (1 - v)).toFixed(2); }   // 2π×24
    });
    btn.addEventListener("click", function (event) {
      var keyboard = event.detail === 0;
      btn.classList.remove("is-going");
      void btn.offsetWidth;
      btn.classList.add("is-going");
      setTimeout(function () { btn.classList.remove("is-going"); }, 700);
      scrollTop(!motion.matches);
      if (keyboard) {
        var first = $(".site-header .brand") || $(".site-header a");
        if (first) first.focus({ preventScroll: true });
      }
    });
    // หน้าหลักสูตร: แถบเปรียบเทียบลอยอยู่ด้านล่าง → ยกปุ่มขึ้นเหนือแถบ
    var compare = $(".compare-bar");
    if (compare && window.MutationObserver) {
      var lift = function () {
        var h = compare.hidden ? 0 : compare.getBoundingClientRect().height;
        btn.style.bottom = h ? "calc(" + Math.round(h + 34) + "px + env(safe-area-inset-bottom))" : "";
      };
      new MutationObserver(lift).observe(compare, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
      window.addEventListener("resize", lift);
      lift();
    }
  }

  /* ---------- 3) รูปจางเข้าเมื่อโหลดเสร็จ ---------- */
  function setupImageFade() {
    if (motion.matches) return;
    $$("main img").forEach(function (img) {
      if (img.dataset.lvcxImg || img.id === "gallery-image" || img.closest("#lvc-document-folders, .lvc-show, .sculpture, dialog")) return;
      img.dataset.lvcxImg = "1";
      if (img.complete) return;                            // โหลดเสร็จแล้ว หรือยังไม่เริ่มแต่จะไม่ซ่อนรูปที่พังไว้
      img.classList.add("lvc-img-wait");
      var timer = 0;
      var done = function () {
        clearTimeout(timer);
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        img.classList.remove("lvc-img-wait");
        // ใช้ Web Animations แทน transition: ไม่ทับ transition เดิมของรูป (เช่น ซูมตอนชี้)
        if (img.animate && !motion.matches) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out" });
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
      // รูป lazy ที่อยู่ไกลยังไม่เริ่มโหลด: นับเวลากันค้างเมื่อใกล้ถึงเท่านั้น
      if (window.IntersectionObserver) {
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          timer = setTimeout(done, 9000);
        }, { rootMargin: "300px 0px" });
        io.observe(img);
      } else timer = setTimeout(done, 9000);
    });
  }

  /* ---------- 4) ตัวอักษร LVC ท้ายหน้า ---------- */
  function setupFooterMark() {
    var footer = $("footer.footer") || $("footer.page-footer");
    if (!footer || $(".lvc-mark", footer)) return;
    var mark = document.createElement("div");
    mark.className = "lvc-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = "<span>L</span><span>V</span><span>C</span>";
    footer.appendChild(mark);
    if (!window.IntersectionObserver) { mark.classList.add("is-in"); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      mark.classList.add("is-in");
      io.disconnect();
    }, { threshold: 0.35 });
    io.observe(mark);
  }

  /* ---------- 5) แสงตามเมาส์ในช่วงผลงาน ---------- */
  function setupSpotlight() {
    var section = $(".achievement");
    if (!section || $(".lvc-spot", section)) return;
    var spot = document.createElement("div");
    spot.className = "lvc-spot";
    spot.setAttribute("aria-hidden", "true");
    section.insertBefore(spot, section.firstChild);
    var px = 0, py = 0, raf = 0;
    function paint() {
      raf = 0;
      var r = section.getBoundingClientRect();
      spot.style.setProperty("--sx", (px - r.left).toFixed(0) + "px");
      spot.style.setProperty("--sy", (py - r.top).toFixed(0) + "px");
    }
    section.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || !finePointer.matches || motion.matches) return;
      px = e.clientX; py = e.clientY;
      if (!spot.classList.contains("is-on")) spot.classList.add("is-on");
      if (!raf) raf = requestAnimationFrame(paint);
    });
    section.addEventListener("pointerleave", function () { spot.classList.remove("is-on"); });
  }

  /* ---------- 6) โหลดหน้าถัดไปล่วงหน้า ---------- */
  function setupPrefetch() {
    if (!/^https?:$/.test(location.protocol)) return;
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;
    var done = {};
    function warm(event) {
      var a = event.target && event.target.closest && event.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin || !/\.html$/.test(url.pathname)) return;
      var key = url.pathname;
      if (done[key] || key === location.pathname) return;
      done[key] = true;
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url.pathname + url.search;
      document.head.appendChild(link);
    }
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("touchstart", warm, { passive: true });
    document.addEventListener("focusin", warm);
  }

  /* ---------- 7) ตัวอย่างคำค้นในช่องค้นหาสาขา ---------- */
  function setupSearchHints() {
    var input = $("#program-search");
    if (!input || motion.matches) return;
    var hints = [input.getAttribute("placeholder") || "",
      "ลองพิมพ์ “คอมพิวเตอร์เกม”", "ลองพิมพ์ “อาหารและโภชนาการ”",
      "ลองพิมพ์ “การท่องเที่ยว”", "ลองพิมพ์ “แฟชั่น”", "ลองพิมพ์ “โลจิสติกส์”"].filter(Boolean);
    var i = 0, visible = true;
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(input);
    setInterval(function () {
      if (!visible || document.hidden || input.value || document.activeElement === input || motion.matches) return;
      input.classList.add("is-swapping");
      setTimeout(function () {
        i = (i + 1) % hints.length;
        input.setAttribute("placeholder", hints[i]);
        input.classList.remove("is-swapping");
      }, 350);
    }, 3200);
  }

  function run(name, fn) {
    if (!CFG[name]) return;
    try { fn(); } catch (error) { if (window.console) console.warn("[extras] " + name, error); }
  }
  function init() {
    run("progress", setupProgress);
    run("backToTop", setupBackToTop);
    run("imageFade", setupImageFade);
    run("footerMark", setupFooterMark);
    run("spotlight", setupSpotlight);
    run("prefetch", setupPrefetch);
    run("searchHints", setupSearchHints);
    if (CFG.progress || CFG.backToTop) startScrollLoop();
    // หน้าแรกสร้างเนื้อหาด้วย app.js: รูปที่เพิ่มภายหลังยังได้จางเข้า
    window.addEventListener("lvc:loaded", function () { run("imageFade", setupImageFade); });
  }
  // รอ DOMContentLoaded: หน้าแรกให้ app.js (defer ก่อนไฟล์นี้) สร้างแถบเมนู/ส่วนท้ายเสร็จก่อน
  var started = false;
  function start() { if (started) return; started = true; init(); }
  if (document.readyState === "complete") start();
  else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
    window.addEventListener("load", start, { once: true });
  }
})();
