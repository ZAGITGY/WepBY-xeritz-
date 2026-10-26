/* ============================================================================
 * intro.js — LVC v10 ฉากเข้าเว็บ (แทนหน้าโหลดโลโก้หมุนของรุ่นก่อน)
 *
 *   1) ภาพวิทยาลัยปรากฏเป็น "หุ่นจำลองสีขาว" จาง ๆ บนกระดาษ (แบบคลิปอ้างอิง)
 *   2) สีซึมออกจากป้ายชื่อวิทยาลัย แล้วจากต้นไม้ ผนังกระเบื้อง เสาธง ทีละจุดแบบสีน้ำ จนภาพมีสีเต็มจอ
 *      ชื่อวิทยาลัยขึ้นมุมซ้ายล่าง แสงอ่อน ๆ กวาดผ่านหนึ่งครั้ง
 *   3) ภาพเลื่อนเข้าไปเป็นพื้นหลังหน้าแรกพอดีกรอบ สีถอยไปอยู่หลังประติมากรรม ม่านจางออก
 *      เมนู หัวข้อ และประติมากรรม LVC เปิดตัวต่อทันที
 *
 * ข้ามได้ด้วยปุ่ม "ข้ามฉากเปิด" หรือ Esc · Reduced Motion / ลิงก์ #ส่วน / กลับมาจากหน้าอื่นในเว็บ = ไม่แสดง (ดู index.html)
 * เปิดซ้ำในแท็บเดิม (รีโหลด) ฉากจะเร็วขึ้น · ไม่มี WebGL หรือภาพโหลดไม่ทัน → แบบภาพซ้อนด้วย CSS
 * ใช้ campus-gl.js (ท่าภาพ) และ campus-backdrop.js (ท่าสุดท้ายที่ต้องต่อให้ตรง) · ปรับเวลาได้ที่ CFG
 * ============================================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var el = document.getElementById("lvc-intro");
  if (!el) return;
  if (!root.classList.contains("lvc-loading")) { el.remove(); return; }

  var CFG = {
    hold: 0.3,        // วินาที ค้างภาพสีเต็มจออย่างน้อย
    handoff: 1.15,    // วินาที ภาพเลื่อนเข้าเป็นพื้นหลังหน้าแรก
    fadeAt: 0.74,     // สัดส่วนของช่วงส่งต่อที่ม่านเริ่มจาง
    fade: 0.55,       // วินาที ม่านจางออก
    maxWait: 9,       // วินาที รอทรัพยากร (ฟอนต์ / โมเดล / พื้นหลัง) นานสุดนับจากเปิดหน้า
    texWait: 3.5,     // วินาที รอภาพวิทยาลัยนานสุดก่อนเปลี่ยนไปใช้แบบ CSS
    repeat: 1.6       // เปิดซ้ำในแท็บเดิม: เล่นเร็วขึ้นกี่เท่า
  };

  var C = window.LVCCampus;
  var app = document.getElementById("app");
  var $ = function (s) { return el.querySelector(s); };
  var canvas = $(".lvc-intro__gl");
  var skipBtn = $(".lvc-intro__skip");
  var labelEl = $(".lvc-intro__label");
  var countEl = $(".lvc-intro__count b");
  var barEl = $(".lvc-intro__bar i");
  var motionQuery = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");

  var speed = 1;
  try { if (sessionStorage.getItem("lvc.intro") === "1") speed = CFG.repeat; sessionStorage.setItem("lvc.intro", "1"); } catch (e) {}
  if (window.__LVC_INTRO_SPEED > 0) speed = window.__LVC_INTRO_SPEED;     // ใช้ตอนทดสอบเท่านั้น (เล่นช้าเพื่อถ่ายภาพทีละช่วง)

  var t0 = performance.now();
  var phase = "boot";                 // boot → play → hold → handoff → fade → done
  var finished = false, skipping = false, autoSkip = false, revealed = false, fading = false, fallbackMode = false, cssMode = false;
  var R = null, start = 0, raf = 0, hand = null, heroTl = null, timers = [], hold0 = 0, lastNow = 0, paperCss = "";
  var gates = { fonts: false, load: false, tex: false };
  var shown = 0, lastCount = -1, lastLabel = "";

  el.classList.add("is-live");

  /* ---------- กันเลื่อน / ปุ่มข้าม ---------- */
  function stop(e) { e.preventDefault(); }
  el.addEventListener("wheel", stop, { passive: false });
  el.addEventListener("touchmove", stop, { passive: false });
  window.scrollTo(0, 0);
  function onKey(e) { if (e.key === "Escape") skip(); }
  function onMotion(e) { if (e.matches) finish(true, "Reduced Motion"); }
  window.addEventListener("keydown", onKey);
  if (skipBtn) skipBtn.addEventListener("click", skip);
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener("change", onMotion);

  // ใช้โดยตัวกันค้างใน index.html และสคริปต์ทดสอบ
  window.__LVC_SKIP_LOADER = function () { finish(true); };
  window.__LVC_LOADER = {
    get phase() { return phase; },
    get fallback() { return fallbackMode; },
    get t() { return start ? (performance.now() - start) / 1000 * speed : 0; },
    skip: skip, finish: function () { finish(true); },
    auto: function () { if (finished || phase === "fade") return; autoSkip = true; skip(); }      // ตัวกันค้าง
  };
  if (motionQuery && motionQuery.matches) { finish(true, "Reduced Motion"); return; }
  // กดข้ามไว้ตั้งแต่ก่อนสคริปต์นี้โหลดเสร็จ (ปุ่มจดไว้ใน window.__LVC_SKIP_REQ)
  function pendingSkip() { if (window.__LVC_SKIP_REQ && !skipping && !finished) skip(); }

  /* ---------- ความพร้อม ---------- */
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(function () { gates.fonts = true; }, function () { gates.fonts = true; });
  if (document.readyState === "complete") gates.load = true;
  else window.addEventListener("load", function () { gates.load = true; }, { once: true });

  function heroOK() {
    var hero = document.querySelector(".sculpture");
    if (hero && hero.classList.contains("ready")) return true;
    var hp = document.querySelector(".sculpture-poster");
    return !!(root.classList.contains("static-sculpture") && hp && hp.complete && hp.naturalWidth);
  }
  function backdropOK() { return !!window.__LVC_BACKDROP_READY || !document.querySelector(".story-stage"); }
  function allReady() { return gates.fonts && gates.load && heroOK() && backdropOK(); }

  /* ---------- เครื่องมือ ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function seg(t, a, d) { return clamp((t - a) / d, 0, 1); }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function introTime(now) { return start ? Math.max(0, (now - start) / 1000 * speed) : 0; }

  /* ---------- HUD: เปอร์เซ็นต์ตามความพร้อมจริง ไม่ใช่นับเวลาเปล่า ๆ ---------- */
  function hud(dt) {
    var target = 0.08 + (gates.fonts ? 0.17 : 0) + (gates.load ? 0.17 : 0) + (gates.tex || fallbackMode ? 0.18 : 0) + (heroOK() ? 0.25 : 0) + (backdropOK() ? 0.15 : 0);
    target = Math.min(1, target);
    shown += (target - shown) * (1 - Math.exp(-dt * 6));
    if (target >= 1 && shown > 0.995) shown = 1;
    var n = Math.min(target >= 1 ? 100 : 99, Math.round(shown * 100));
    if (countEl && n !== lastCount) { countEl.textContent = (n < 10 ? "00" : n < 100 ? "0" : "") + n; lastCount = n; }
    if (barEl) barEl.style.transform = "scaleX(" + shown.toFixed(4) + ")";
    var t = introTime(performance.now());
    var label = phase === "handoff" || phase === "fade" || (phase === "hold" && allReady()) ? "พร้อมแล้ว · ยินดีต้อนรับ"
      : start && t >= (C ? C.INTRO.bloomAt : 1) ? "กำลังเติมสีให้ภาพมีชีวิต" : "กำลังเตรียมภาพวิทยาลัย";
    if (labelEl && label !== lastLabel) { labelEl.textContent = label; lastLabel = label; }
  }

  /* ---------- กรอบภาพ ---------- */
  // ภาพสีน้ำไม่ต้องคมเท่าตัวหนังสือ: คอม 1x · มือถือ 1.5x · เครื่องที่วาดไม่ทัน (เฟรมช้าเกิน ~40ms) ลดลงอีก 30%
  var dprScale = 1, slow = { n: 0, sum: 0 };
  function dpr() { return Math.min(window.devicePixelRatio || 1, window.innerWidth > 900 ? 1 : 1.5) * dprScale; }
  function watchFrames(dtMs) {
    if (dprScale < 1 || phase !== "play" || dtMs <= 0 || dtMs > 1000) return;
    slow.n++; slow.sum += dtMs;
    if (slow.n >= 20 && slow.sum / slow.n > 40) dprScale = 0.7;
  }
  function sizeCanvas() { return R.resize(window.innerWidth, window.innerHeight, dpr()); }
  function paper() {
    if (!paperCss || phase === "play") paperCss = getComputedStyle(el).backgroundColor;
    return paperCss;
  }
  // กรอบพื้นหลังหน้าแรก (.story-stage) ในพิกเซลของ canvas ฉากเข้าเว็บ
  function stageFrame() {
    var stage = document.querySelector(".story-stage");
    var k = canvas.width / Math.max(1, window.innerWidth);
    if (!stage) return [0, 0, canvas.width, canvas.height];
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return [0, 0, canvas.width, canvas.height];
    return [r.left * k, r.top * k, r.width * k, r.height * k];
  }
  function heroPose(frame, now) {
    var B = window.__LVC_BACKDROP;
    if (B && B.pose) return B.pose(frame, now);
    return C.hero(frame, now / 1000, R.size(), { enter: 1, paper: paper() });
  }

  /* ---------- เดินฉาก ---------- */
  function frame(now) {
    raf = 0;
    if (finished) return;
    var raw = now - (lastNow || now), dt = Math.min(0.05, raw / 1000);
    lastNow = now;
    watchFrames(raw);
    hud(dt);
    var t = introTime(now);
    var elapsed = (now - t0) / 1000;
    var I = C ? C.INTRO : { title: 1.5, full: 3.2 };

    if (phase === "play") {
      if (t >= I.title) el.classList.add("is-title");
      if (t >= I.full) { phase = "hold"; hold0 = now; }
    }
    if (phase === "hold") {
      if (((now - hold0) / 1000 * speed >= CFG.hold && allReady()) || elapsed * Math.min(1, speed) > CFG.maxWait || skipping) beginHandoff(now);
    }

    if (!fallbackMode && R) {
      sizeCanvas();
      var W = canvas.width, H = canvas.height, u;
      if (phase === "handoff" || phase === "fade") {
        var h = clamp((now - hand.t) / 1000 / hand.dur, 0, 1);
        var a = C.intro([0, 0, W, H], hand.tIntro, R.size(), paper(), now);
        var b = heroPose(stageFrame(), now);
        u = C.mix(a, b, ease(h), ease(seg(h, 0.08, 0.74)), ease(seg(h, 0.22, 0.75)));
        if (h >= CFG.fadeAt) beginFade();
      } else {
        u = C.intro([0, 0, W, H], t, R.size(), paper(), now);
      }
      R.draw(u);
    } else if (phase === "handoff") {
      beginFade();
    }
    raf = requestAnimationFrame(frame);
  }

  function beginHandoff(now) {
    if (phase === "handoff" || phase === "fade" || finished) return;
    el.classList.add("is-title", "is-leaving");
    if (fallbackMode || !R) { phase = "handoff"; return; }
    hand = { t: now, tIntro: introTime(now), dur: (skipping ? CFG.handoff * 0.45 : CFG.handoff) / speed };
    phase = "handoff";
    paperCss = "";
  }

  function beginFade() {
    if (fading || finished) return;
    fading = true;
    phase = "fade";
    var fast = skipping;
    var dur = fast ? 0.3 : CFG.fade / Math.sqrt(speed);
    announceReveal();
    introHero(fast);
    el.style.transition = "opacity " + dur.toFixed(2) + "s cubic-bezier(.4,0,.2,1)";
    el.style.opacity = "0";
    // จบด้วยตัวจับเวลา ไม่พึ่ง transitionend อย่างเดียว (บางเบราว์เซอร์ไม่ยิงเมื่อแท็บอยู่เบื้องหลัง)
    var done = false;
    var end = function () {
      if (done) return;
      done = true;
      el.style.pointerEvents = "none";
      if (skipping && heroTl) heroTl.timeScale(2.5);   // กดข้าม: ให้หัวข้อเปิดตัวจบไว ๆ แต่ยังลื่น ไม่กระโดด
      waitHero(performance.now());
    };
    el.addEventListener("transitionend", function (e) { if (e.target === el && e.propertyName === "opacity") end(); });
    later(end, (dur + 0.25) * 1000);
  }
  // ปลดล็อกการเลื่อนหลังหัวข้อหน้าแรกเปิดตัวเกือบครบ (กันค่าของ GSAP สองชุดชนกันบนหัวข้อเดียวกัน)
  // ใช้ setTimeout ไม่ใช่ rAF: เครื่องที่เฟรมกระตุกหนัก ๆ จะได้ไม่ต้องรอนานเกินเพดาน
  function waitHero(since) {
    if (finished) return;
    var p = heroTl ? heroTl.progress() : 1;
    if (p >= 0.97 || performance.now() - since > (skipping ? 450 : 1200) || document.hidden) { finish(false); return; }
    setTimeout(function () { waitHero(since); }, 40);
  }

  function skip() {
    if (finished) return;
    skipping = true;
    if (phase === "fade") return;
    if (phase === "handoff" && hand) {
      var gone = (performance.now() - hand.t) / 1000;
      hand.dur = Math.min(hand.dur, gone + 0.3);
      return;
    }
    if (phase === "boot") {                 // ภาพยังไม่พร้อม → ไม่ต้องรอ จางเข้าหน้าเว็บเลย
      fallbackMode = true;
      phase = "handoff";
      el.classList.add("is-leaving");
      if (!raf) raf = requestAnimationFrame(frame);
      return;
    }
    beginHandoff(performance.now());
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /* ---------- หน้าแรกเปิดตัวตอนม่านจาง ---------- */
  function announceReveal() {
    if (revealed) return;
    revealed = true;
    // handoff: ภาพเลื่อนเข้าเป็นพื้นหลังแล้วหรือยัง (ข้ามตั้งแต่ก่อนภาพพร้อม / แบบ CSS = ยัง → พื้นหลังค่อย ๆ แผ่สีเอง)
    window.dispatchEvent(new CustomEvent("lvc:reveal", { detail: { handoff: !!hand && !fallbackMode } }));
  }
  function introHero(fast) {
    var L = window.__LVC, gsap = L && L.gsap;
    if (!gsap || heroTl) return;
    var k = fast ? 0.5 : 1;
    var tl = heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    function enter(selector, y, at, duration, stagger) {
      var targets = Array.prototype.slice.call(document.querySelectorAll(selector));
      if (!targets.length) return;
      gsap.set(targets, { y: y, opacity: 0 });
      tl.to(targets, { y: 0, opacity: 1, duration: duration * k, stagger: (stagger || 0) * k, clearProps: "opacity,transform" }, at * k);
    }
    enter(".site-header .header-inner", -10, 0, 0.7);
    enter(".hero-meta span, .scene-opening .eyebrow", 0, 0.08, 0.7);
    enter(".scene-opening h1 > span", 28, 0.12, 0.95, 0.1);
    enter(".scene-opening > p:not(.hero-note)", 12, 0.34, 0.8);
    enter(".scene-opening .hero-actions", 10, 0.46, 0.8);
    enter(".scene-opening .hero-note, .hero-bottom", 0, 0.6, 0.7);
    var sculpt = document.querySelector(".sculpture");
    if (sculpt) {
      gsap.set(sculpt, { opacity: 0, y: 40, scale: 0.95, transformOrigin: "50% 80%" });
      tl.to(sculpt, { opacity: 1, y: 0, scale: 1, duration: 1.3 * k, ease: "power3.out", clearProps: "opacity,transform,transformOrigin" }, 0.05 * k);
    }
  }

  /* ---------- แบบภาพซ้อนด้วย CSS (ไม่มี WebGL / ภาพโหลดไม่ทัน) ---------- */
  function placeFallbackBloom() {
    // จุดเริ่มวงสี = ป้ายชื่อวิทยาลัยบนภาพ (ภาพ object-fit: cover, object-position 55% 42%)
    var vw = window.innerWidth, vh = window.innerHeight, iw = 1536, ih = 1024;
    var s = Math.max(vw / iw, vh / ih), w = iw * s, h = ih * s;
    var x = (vw - w) * 0.55 + w * 0.80, y = (vh - h) * 0.42 + h * 0.40;
    el.style.setProperty("--fb-x", (x / vw * 100).toFixed(1) + "%");
    el.style.setProperty("--fb-y", (y / vh * 100).toFixed(1) + "%");
  }
  function useFallback() {
    if (fallbackMode || finished) return;
    fallbackMode = true;
    cssMode = true;                         // แบบภาพซ้อนด้วย CSS จริง (ต่างจากการกดข้ามก่อนภาพพร้อม ซึ่งใช้ fallbackMode เพื่อข้ามการวาด)
    if (R) { try { R.dispose(); } catch (e) {} R = null; }
    el.classList.add("is-fallback");
    placeFallbackBloom();
    var ghost = $(".lvc-intro__ghost"), color = $(".lvc-intro__color");
    var src = (ghost && ghost.getAttribute("data-src")) || "./images/campus.webp";
    var shown2 = false;
    function go() {
      if (shown2 || finished || skipping) return;
      shown2 = true;
      start = performance.now();
      phase = "play";
      later(function () { el.classList.add("fb-ghost"); }, 40);
      later(function () { el.classList.add("fb-bloom"); }, 900 / speed);
      later(function () { el.classList.add("is-title"); }, 1500 / speed);
      later(function () { if (phase === "play") { phase = "hold"; hold0 = performance.now(); } }, 3200 / speed);
    }
    if (color) { color.onload = go; color.onerror = go; color.src = src; }
    if (ghost) ghost.src = src;
    later(go, 2500);                        // ภาพเสียหรือช้ามาก ก็ไปต่อ
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function boot() {
    R = C.create(canvas, { onLost: function () { if (!finished && phase !== "fade" && phase !== "handoff") useFallback(); } });
    if (!R) { useFallback(); return; }
    var waited = later(function () { if (!gates.tex && !finished) useFallback(); }, CFG.texWait * 1000);
    R.whenReady.then(function () {
      if (finished || fallbackMode) return;
      clearTimeout(waited);
      gates.tex = true;
      sizeCanvas();
      if (phase === "boot") {
        start = performance.now();
        phase = "play";
        if (skipping) beginHandoff(start);
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }).catch(function () { useFallback(); });
    // HUD ทำงานตั้งแต่ก่อนภาพพร้อม
    (function idle() {
      if (finished || phase !== "boot" || fallbackMode) return;
      hud(0.016);
      requestAnimationFrame(idle);
    })();
  }

  /* ---------- จบ ---------- */
  function finish(forced, why) {
    if (finished) return;
    finished = true;
    phase = "done";
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);
    if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener("change", onMotion);
    if (skipBtn) skipBtn.removeEventListener("click", skip);
    el.removeEventListener("wheel", stop);
    el.removeEventListener("touchmove", stop);
    if (heroTl) heroTl.progress(1);
    try { if (R) R.dispose(); } catch (e) {}
    var restoreFocus = el.contains(document.activeElement);
    el.remove();
    root.classList.remove("lvc-loading");
    if (app) app.inert = false;
    if ("scrollRestoration" in history) history.scrollRestoration = window.__LVC_PREV_SCROLL_RESTORATION || "auto";
    window.__LVC_LOADER_DONE = true;
    window.__LVC_INTRO_RESULT = why || ((cssMode ? "แบบ CSS · " : "") + (autoSkip ? "ตัวกันค้างสั่งข้าม" : skipping ? "กดข้าม" : forced ? "ปิดโดยตัวกันค้าง" : "เล่นจบ"));
    announceReveal();
    window.dispatchEvent(new CustomEvent("lvc:loaded"));
    if (restoreFocus) {
      var first = document.querySelector(".site-header a");
      if (first) first.focus({ preventScroll: true });
    }
    try {
      var L = window.__LVC;
      L.ScrollTrigger.clearScrollMemory(window.__LVC_PREV_SCROLL_RESTORATION || "auto");
      L.ScrollTrigger.refresh();
    } catch (e) {}
  }

  window.addEventListener("resize", function () { if (!finished && !raf && phase !== "boot") raf = requestAnimationFrame(frame); });
  if (skipBtn) skipBtn.removeAttribute("onclick");
  later(function () { window.__LVC_LOADER.auto(); }, (CFG.maxWait + 4) * 1000 / Math.min(1, speed));   // กันค้างขั้นสุดท้าย
  if (C) boot(); else useFallback();
  pendingSkip();
})();
