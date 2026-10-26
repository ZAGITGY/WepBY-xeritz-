/* ============================================================================
 * campus-backdrop.js — LVC v10 พื้นหลังหน้าแรก: ภาพวิทยาลัยแบบสีน้ำที่ "หายใจ" อยู่ตลอด
 *
 *  • ด้านขวา (มือถือ: ด้านล่าง หลังประติมากรรม) เป็นภาพสี ขอบสีน้ำค่อย ๆ ขยับ เมฆมีแสงเคลื่อน ภาพเลื่อนช้า ๆ
 *  • ด้านที่มีตัวหนังสือเป็นภาพจางแบบหุ่นจำลองสีขาวบนกระดาษ อ่านง่ายเหมือนเดิม
 *  • คอม: ชี้เมาส์ตรงไหน สีจะซึมออกมาตรงนั้น · มือถือ/แท็บเล็ต: แตะแล้วมีวงสีแผ่ออกแล้วจางกลับ
 *  • มีแสงอ่อน ๆ กวาดผ่านภาพเป็นระยะ · เลื่อนเข้าเรื่องเล่าช่วงถัดไป (คอม) พื้นหลังจางออกเอง
 *  • ออกนอกจอ / สลับแท็บ = หยุดวาด · เครื่องสเปกต่ำ / Reduced Motion = ภาพนิ่ง ไม่วาดซ้ำ
 * ไม่มี WebGL → ภาพนิ่งด้วย CSS (campus.css .is-fallback) · ปรับได้ที่ CFG · ใช้ campus-gl.js
 * ============================================================================ */
(function () {
  "use strict";

  var CFG = {
    fps: 30,          // อัตราวาดตอนไม่มีการโต้ตอบ (ตอนขยับเมาส์ / เปิดตัวใช้เต็มอัตรา)
    enter: 1.8,       // วินาที สีแผ่ออกตอนกลับมาหน้าแรกจากหน้าอื่น (ครั้งนั้นไม่มีฉากเข้าเว็บ)
    pointer: true,    // คอม: สีซึมตามเมาส์ · จอสัมผัส: แตะแล้วสีแผ่
    sweep: 14,        // วินาที ระยะห่างของแสงที่กวาดผ่านภาพ (0 = ปิด)
    dpr: [1, 1.25]    // ความละเอียดสูงสุด [คอม, มือถือ] ภาพสีน้ำไม่ต้องคมเท่าตัวหนังสือ
  };

  var C = window.LVCCampus;
  var root = document.documentElement;
  var stage = document.querySelector(".story-stage");
  if (!C || !stage || stage.querySelector(".lvc-campus")) return;

  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var fine = window.matchMedia ? matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };
  // ไม่เดาสเปกจาก hardwareConcurrency (Safari บน iPhone/iPad รายงานค่าต่ำกว่าจริง) — ใช้ตัววัดเฟรมจริงด้านล่างแทน
  var lite = !!(navigator.connection && navigator.connection.saveData) || !!(navigator.deviceMemory && navigator.deviceMemory <= 1);
  // ตัวเฝ้าความลื่น: ถ้าเบราว์เซอร์วาดได้ต่ำกว่า ~22 เฟรม/วินาทีต่อเนื่อง ลดความละเอียด/อัตราวาด แล้วค่อยเป็นภาพนิ่ง
  var Q = { level: 2, avg: 0, n: 0, since: 0 };

  var box = document.createElement("div");
  box.className = "lvc-campus";
  box.setAttribute("aria-hidden", "true");
  var canvas = document.createElement("canvas");
  canvas.className = "lvc-campus__gl";
  box.appendChild(canvas);
  stage.insertBefore(box, stage.firstChild);

  var S = {
    ready: false, failed: false, raf: 0, last: 0, lastFrame: 0, t0: 0,
    looping: !root.classList.contains("lvc-loading"),       // ระหว่างฉากเข้าเว็บ วาดครั้งเดียวพอ (ม่านบังอยู่)
    enter: 1, entering: false, enterFrom: 0,
    visible: true, hidden: document.hidden, fade: 1, story: null, paper: "",
    p: { x: 0.7, y: 0.5, r: 0, s: 0 }, pt: { x: 0.7, y: 0.5, r: 0, s: 0 }, lastMove: 0, px: 0, py: 0, ptime: 0,
    tap: null
  };

  function still() { return motion.matches || lite || Q.level === 0; }
  function markReady() {
    if (window.__LVC_BACKDROP_READY) return;
    window.__LVC_BACKDROP_READY = true;
    window.dispatchEvent(new CustomEvent("lvc:backdrop"));
  }
  function fallback() {
    if (S.failed) return;
    S.failed = true;
    box.classList.add("is-fallback");
    cancelAnimationFrame(S.raf); S.raf = 0;
    window.__LVC_BACKDROP = null;
    markReady();
  }

  var R = C.create(canvas, { onLost: fallback });
  if (!R) { fallback(); return; }

  // กลับมาหน้าแรกจากหน้าอื่น (ไม่มีฉากเข้าเว็บ) → สีค่อย ๆ แผ่ออกเป็นการเปิดตัว
  if (S.looping && !still()) { S.enter = 0; S.entering = true; }

  function smooth(a, b, x) { var k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); }
  function readPaper() {
    var bg = getComputedStyle(stage).backgroundColor;
    if (!bg || bg === "transparent" || /,\s*0\)$/.test(bg)) bg = getComputedStyle(root).backgroundColor;
    S.paper = bg;
    return bg;
  }

  /* ---------- ขนาด ---------- */
  function sizeCanvas() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return false;
    var cap = (w > 900 ? CFG.dpr[0] : CFG.dpr[1]) * (Q.level === 1 ? 0.7 : 1);
    R.resize(w, h, Math.min(window.devicePixelRatio || 1, cap));
    return true;
  }

  /* ---------- เรื่องเล่าช่วงแรก (คอม) จางออกเมื่อเลื่อนเข้าช่วงถัดไป ---------- */
  function storyFade() {
    if (!S.story) {
      var ST = window.__LVC && window.__LVC.ScrollTrigger;
      if (ST && ST.getAll) {
        var all = ST.getAll();
        for (var i = 0; i < all.length; i++) if (all[i].pin === stage) { S.story = all[i]; break; }
      }
    }
    if (!S.story) return 1;
    return 1 - smooth(0.06, 0.15, S.story.progress || 0);
  }

  /* ---------- ท่าที่ใช้วาด ---------- */
  // ท่ามาตรฐาน (ไม่มีเมาส์/แสงกวาด) — ฉากเข้าเว็บเรียกใช้ตอนส่งต่อ เพื่อให้ภาพตรงกันทุกพิกเซล
  function pose(frame, now) {
    return C.hero(frame, now / 1000, R.size(), { enter: 1, still: still(), paper: S.paper || readPaper() });
  }
  window.__LVC_BACKDROP = {
    pose: pose,
    get ready() { return S.ready; },
    // สำหรับสคริปต์ทดสอบ
    get state() { return { ready: S.ready, failed: S.failed, looping: S.looping, visible: S.visible, hidden: S.hidden, fade: S.fade, raf: !!S.raf, enter: S.enter, still: still(), story: !!S.story, quality: Q.level, avgMs: Math.round(Q.avg), tap: !!S.tap }; }
  };

  function uniforms(now) {
    var tap = null;
    if (S.tap) {
      var a = (now - S.tap.t) / 1000;
      if (a > 1.8) S.tap = null;
      else {
        var r = (0.05 + 0.2 * smooth(0, 0.6, a)) * (1 - smooth(0.7, 1.8, a));
        var ar = canvas.width / Math.max(1, canvas.height);
        tap = [S.tap.x, S.tap.y, r, r * ar];
      }
    }
    var u = C.hero([0, 0, canvas.width, canvas.height], now / 1000, R.size(), {
      enter: S.enter, still: still(), paper: S.paper || readPaper(),
      pointer: S.p.s > 0.001 ? [S.p.x, S.p.y, S.p.r, S.p.s] : null, tap: tap
    });
    if (!still() && CFG.sweep > 0 && S.t0) {
      var cyc = ((now - S.t0) / 1000 - 5) % CFG.sweep;            // แสงแรกหลังเปิดหน้า 5 วินาที แล้วทุก ~14 วินาที
      if (cyc >= 0 && cyc <= 2.6) u.sweep = -0.3 + cyc / 2.6 * 1.9;
    }
    return u;
  }

  function draw(now) {
    if (!R.ready || !sizeCanvas()) return false;
    var ok = R.draw(uniforms(now));
    if (ok && !S.ready) { S.ready = true; markReady(); }
    return ok;
  }

  /* ---------- วนวาด ---------- */
  // ความจาง (เรื่องเล่าช่วงถัดไป) ไม่อยู่ในเงื่อนไขนี้ — ถ้าอยู่ พอจางหมดแล้วจะไม่มีใครปลุกกลับมาอีก
  function running() { return S.looping && S.ready && !S.failed && S.visible && !S.hidden; }
  function schedule() { if (!S.raf && !S.failed) S.raf = requestAnimationFrame(tick); }
  function tick(now) {
    S.raf = 0;
    if (S.failed || !R.ready || !S.looping) return;
    var fade = storyFade();
    if (Math.abs(fade - S.fade) > 0.0005 || fade === 0 || fade === 1) {
      S.fade = fade;
      box.style.opacity = fade < 0.999 ? fade.toFixed(3) : "";
      box.style.visibility = fade <= 0.001 ? "hidden" : "";
    }
    var raw = now - (S.lastFrame || now), dt = Math.min(0.05, raw / 1000);
    S.lastFrame = now;
    if (S.entering) {
      if (!S.enterFrom) S.enterFrom = now;
      S.enter = Math.min(1, (now - S.enterFrom) / 1000 / CFG.enter);
      if (S.enter >= 1) S.entering = false;
    }
    // เมาส์: วงสีค่อย ๆ ตามไป · หยุดขยับสักพัก วงหดเหลือจุดเล็ก ๆ · ออกจากพื้นที่ = จางหาย
    var p = S.p, pt = S.pt, k = 1 - Math.exp(-dt * 7);
    if (now - S.lastMove > 1100 && pt.s > 0) pt.r = 0.06;
    p.x += (pt.x - p.x) * k; p.y += (pt.y - p.y) * k;
    p.r += (pt.r - p.r) * (1 - Math.exp(-dt * 3)); p.s += (pt.s - p.s) * (1 - Math.exp(-dt * 4));
    var moving = Math.abs(pt.x - p.x) + Math.abs(pt.y - p.y) + Math.abs(pt.r - p.r) + Math.abs(pt.s - p.s) > 0.002;
    var active = S.entering || moving || !!S.tap;
    parallax();
    if (!running()) return;
    if (S.fade <= 0.001) return;                               // จางหมด: หยุดวาด รอการเลื่อนครั้งถัดไปปลุก (kick)
    if (still()) {                                             // ภาพนิ่ง: วาดเฉพาะตอนมีการเปลี่ยนแปลง
      if (active) { draw(now); schedule(); }
      return;
    }
    watch(now, raw);
    var fps = Q.level === 1 ? 20 : CFG.fps;
    if (active || now - S.last >= 1000 / fps - 2) { draw(now); S.last = now; }
    schedule();
  }
  // มือถือ / จอที่ไม่ตรึงเรื่องเล่า: ภาพเลื่อนช้ากว่าหน้าเล็กน้อยตอนเลื่อนผ่าน (ภาพมีมิติ ไม่แข็งทื่อ)
  var shift = -1;
  function parallax() {
    var y = 0;
    if (!S.story && !still()) {
      var top = stage.getBoundingClientRect().top;
      y = Math.round(Math.min(Math.max(0, -top) * 0.28, stage.clientHeight * 0.4));
    }
    if (y !== shift) { shift = y; canvas.style.transform = y ? "translate3d(0," + y + "px,0)" : ""; }
  }
  function watch(now, dtMs) {
    if (Q.level === 0 || window.__LVC_BACKDROP_NO_WATCHDOG || dtMs <= 0 || dtMs > 1000) return;   // >1 วินาที = หยุดพัก ไม่ใช่กระตุก
    if (!Q.since) { Q.since = now; return; }
    if (now - Q.since < 2000) return;                      // ข้าม 2 วินาทีแรก (ชิดเดอร์/โมเดลกำลังอุ่นเครื่อง)
    Q.avg = Q.n ? Q.avg * 0.96 + dtMs * 0.04 : dtMs;
    Q.n++;
    if (Q.n > 30 && now - Q.since > 5000 && Q.avg > 46) {      // วัดต่อเนื่องอย่างน้อย 3 วินาที
      Q.level--; Q.n = 0; Q.avg = 0; Q.since = now;
      if (Q.level === 0) redrawNow();                      // ภาพนิ่งเฟรมสุดท้าย คมเท่าเดิม
    }
  }
  function kick() { if (running()) schedule(); }
  // นอกจอ / แท็บซ่อน: จดไว้ก่อน แล้ววาดครั้งเดียวตอนกลับมาเห็น (มือถือยิง resize ทุกครั้งที่แถบที่อยู่เว็บยุบ/ขยาย)
  var dirty = false;
  function redrawNow() {
    if (!R.ready || S.failed) return;
    if (!S.visible || S.hidden) { dirty = true; return; }
    dirty = false; readPaper(); draw(performance.now()); kick();
  }
  function seen() { if (dirty && S.visible && !S.hidden) redrawNow(); else kick(); }
  function startLoop() {
    if (S.looping) return;
    S.looping = true;
    S.t0 = performance.now();
    S.lastFrame = 0;
    kick();
  }

  R.whenReady.then(function () {
    readPaper();
    if (S.looping) S.t0 = performance.now();
    if (!draw(performance.now())) requestAnimationFrame(function () { draw(performance.now()); });
    kick();
  }).catch(fallback);

  /* ---------- เหตุการณ์ ---------- */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) { S.visible = entries[0].isIntersecting; seen(); }, { rootMargin: "80px 0px" }).observe(stage);
  }
  document.addEventListener("visibilitychange", function () { S.hidden = document.hidden; Q.since = 0; if (!S.hidden) { S.lastFrame = 0; seen(); } });
  if (window.ResizeObserver) new ResizeObserver(function () { if (R.ready) redrawNow(); }).observe(stage);
  window.addEventListener("resize", redrawNow);
  window.addEventListener("scroll", kick, { passive: true });
  // เปลี่ยนโหมดสว่าง/มืด: วาดทันทีในจังหวะเดียวกับที่หน้าเปลี่ยนสี (ทันภาพวงกลมของ View Transitions)
  window.addEventListener("lvc:themechange", redrawNow);
  // ฉากเข้าเว็บเริ่มจาง → เริ่มวนวาดต่อจากภาพเดียวกัน
  window.addEventListener("lvc:reveal", function (e) {
    if (e && e.detail && e.detail.handoff === false && !S.looping && !still()) { S.enter = 0; S.entering = true; S.enterFrom = 0; }
    startLoop();
  });
  window.addEventListener("lvc:loaded", function () { S.story = null; startLoop(); kick(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { S.lastFrame = 0; redrawNow(); } });
  if (motion.addEventListener) motion.addEventListener("change", function () { S.entering = false; S.enter = 1; S.pt.s = 0; S.p.s = 0; redrawNow(); });

  if (CFG.pointer) {
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || !fine.matches || still() || window.innerWidth <= 900) return;
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var now = performance.now(), gap = Math.max(16, now - S.ptime);
      var speed = Math.hypot(e.clientX - S.px, e.clientY - S.py) / gap;     // px ต่อ ms
      S.px = e.clientX; S.py = e.clientY; S.ptime = now; S.lastMove = now;
      S.pt.x = (e.clientX - r.left) / r.width; S.pt.y = (e.clientY - r.top) / r.height; S.pt.s = 1;
      S.pt.r = Math.min(0.17, 0.075 + speed * 0.05);
      kick();
    }, { passive: true });
    stage.addEventListener("pointerleave", function () { S.pt.s = 0; S.pt.r = 0; kick(); });
    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || still() || !S.ready) return;
      // แตะปุ่ม/ลิงก์ หรือแตะบนตัวหนังสือ → ไม่ต้องมีวงสี (สีหลังตัวหนังสือทำให้อ่านยากชั่วขณะ)
      // ระวัง: บนมือถือ .scene-opening คลุมทั้งฉาก จึงกันเฉพาะตัวข้อความ ไม่กันทั้งกล่อง
      if (e.target && e.target.closest && e.target.closest("a, button, h1, h2, h3, p, li, .eyebrow")) return;
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      S.tap = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, t: performance.now() };
      kick();
    }, { passive: true });
  }
})();
