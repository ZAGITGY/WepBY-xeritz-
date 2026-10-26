/* ============================================================================
 * alive.js — LVC v10 ให้หน้าแรก "มีชีวิต" หลังโหลดเสร็จ (คู่กับ alive.css)
 *   1) แถบข่าวล่าสุดจากเว็บวิทยาลัย เลื่อนเปลี่ยนเรื่องเอง (หยุดได้ / ข้ามได้)
 *   2) บริการอื่นที่หน้าเว็บวิทยาลัยลิงก์ไว้ (ศธ.02 · ศูนย์กำลังคนอาชีวศึกษา · หลักสูตรต้านทุจริตศึกษา)
 *   3) แถบชื่อกลุ่มสาขาวิ่งสวนกัน ยิ่งเลื่อนหน้าเร็วยิ่งวิ่งเร็วและเอียงตาม
 *   4) แกลเลอรีผลงานเปลี่ยนภาพเองทุก 6 วินาที มีปุ่มหยุด และหยุดเองเมื่อชี้/โฟกัส/ออกนอกจอ
 * ข้อมูลข่าวอ้างอิง https://lvc.ac.th/www2026/ (ตรวจ 26 ต.ค. 2569) · ปิดทีละส่วนได้ที่ CFG
 * Reduced Motion: ไม่มีอะไรเลื่อนเอง (ยังกดเปลี่ยนเองได้)
 * ============================================================================ */
(function () {
  "use strict";

  var CFG = { ticker: true, eservice: true, ribbon: true, gallery: true, tickerEvery: 4.6, galleryEvery: 6 };
  if (window.__LVC_ALIVE) return;
  window.__LVC_ALIVE = true;

  var NEWS = [
    { tag: "บริการสังคม", date: "24 เม.ย. 2569", title: "วิทยาลัยออกหน่วยบริการประชาชน โครงการหน่วยแพทย์เคลื่อนที่ พอ.สว. จังหวัดเลย", url: "https://lvc.ac.th/www2026/activities/activities-24-04-69/activity-detail-24-04-69.html" },
    { tag: "วัฒนธรรม", date: "3 เม.ย. 2569", title: "กิจกรรมสืบสานประเพณีสงกรานต์ ประจำปี 2569", url: "https://lvc.ac.th/www2026/activities/activities-03-04-69/activity-detail-03-04-69.html" },
    { tag: "ความโปร่งใส", date: "25 มี.ค. 2569", title: "รับประกาศเกียรติคุณสถานศึกษาผ่านเกณฑ์การประเมิน ITA ประจำปีงบประมาณ 2568", url: "https://lvc.ac.th/www2026/activities/activities-25-03-69/activity-detail-25-03-69.html" },
    { tag: "รางวัล", date: "23 มี.ค. 2569", title: "การประเมินเพื่อรับรางวัลโรงเรียนพระราชทานระดับอาชีวศึกษา จังหวัดเลย ประจำปี 2569", url: "https://lvc.ac.th/www2026/activities/activities-23-03-69/activity-detail-23-03-69.html" },
    { tag: "ประกาศ", date: "16 มี.ค. 2569", title: "กำหนดวันเปิดและปิดภาคเรียน ปีการศึกษา 2569", url: "https://lvc.ac.th/www2026/announcement-news/announce-16-03-69/announce-detail-16-03-69.html" }
  ];
  var ESERVICE = [
    { title: "ศธ.02 ออนไลน์", url: "https://std2018.vec.go.th/" },
    { title: "ศูนย์กำลังคนอาชีวศึกษา", url: "https://v-cop.go.th/" },
    { title: "หลักสูตรต้านทุจริตศึกษา", url: "https://aced.nacc.go.th/" }
  ];
  var GROUPS = ["บริหารธุรกิจ", "ดิจิทัลและเทคโนโลยีสารสนเทศ", "ศิลปกรรมและเศรษฐกิจสร้างสรรค์", "คหกรรม", "อุตสาหกรรมท่องเที่ยว", "อุตสาหกรรมอาหาร", "อุตสาหกรรมแฟชั่นสิ่งทอ", "อุตสาหกรรมโลจิสติกส์"];
  var WORDS = ["ปวช.", "ปวส.", "ปริญญาตรี", "เรียนรู้", "ลงมือทำ", "สร้างสรรค์", "LEARN", "CREATE", "GROW"];

  var ARROW = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
  var root = document.documentElement;
  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function $(s, c) { return (c || document).querySelector(s); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function onView(el, fn, opts) {
    if (!window.IntersectionObserver) { fn(true); return; }
    new IntersectionObserver(function (entries) { fn(entries[0].isIntersecting); }, opts || {}).observe(el);
  }
  // ปรากฏตัวครั้งเดียวเมื่อเลื่อนถึง (ใช้กับส่วนที่ไฟล์นี้เพิ่มเข้าไปเอง)
  function revealOnce(el) {
    if (motion.matches || !window.IntersectionObserver) { el.classList.add("is-in"); return; }
    el.classList.add("lvc-alive-hide");
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      el.classList.add("is-in");
      io.disconnect();
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    el.addEventListener("focusin", function () { el.classList.add("is-in"); });
  }

  /* ---------- 1) ข่าวล่าสุด ---------- */
  function setupTicker() {
    var services = $("#services .wrap");
    if (!services || $(".lvc-tk")) return;
    var box = document.createElement("div");
    box.className = "lvc-tk";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "ข่าวล่าสุดจากวิทยาลัย");
    box.innerHTML =
      '<span class="lvc-tk__label"><i aria-hidden="true"></i>ล่าสุดจากวิทยาลัย</span>' +
      '<div class="lvc-tk__viewport"><ul class="lvc-tk__list">' +
      NEWS.map(function (n, i) {
        return '<li class="lvc-tk__item' + (i === 0 ? " is-current" : "") + '"><a href="' + esc(n.url) + '">' +
          '<span class="lvc-tk__tag">' + esc(n.tag) + '</span><time>' + esc(n.date) + '</time>' +
          '<span class="lvc-tk__title">' + esc(n.title) + '</span></a></li>';
      }).join("") + '</ul></div>' +
      '<div class="lvc-tk__ctrl">' +
        '<span class="lvc-tk__count" aria-hidden="true"><b>1</b>/' + NEWS.length + '</span>' +
        '<button type="button" class="lvc-tk__btn lvc-tk__pause" aria-pressed="false" aria-label="หยุดเลื่อนข่าวอัตโนมัติ">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M9 6v12M15 6v12"/><path class="i-play" d="M8 5.5v13l11-6.5z"/></svg></button>' +
        '<button type="button" class="lvc-tk__btn lvc-tk__next" aria-label="ข่าวถัดไป"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<a class="lvc-tk__all external" href="https://lvc.ac.th/www2026/activities/all-activities.html">ข่าวทั้งหมด ' + ARROW + '</a>' +
      '</div>' +
      '<span class="lvc-tk__time" aria-hidden="true"><i></i></span>';
    services.insertBefore(box, services.firstChild);
    revealOnce(box);

    var items = Array.prototype.slice.call(box.querySelectorAll(".lvc-tk__item"));
    var countEl = $(".lvc-tk__count b", box), pauseBtn = $(".lvc-tk__pause", box), nextBtn = $(".lvc-tk__next", box);
    var timeBar = $(".lvc-tk__time i", box);
    var index = 0, timer = 0, userPaused = motion.matches, hover = false, visible = false;
    function sync() {
      items.forEach(function (li, i) {
        var on = i === index;
        li.classList.toggle("is-current", on);
        li.classList.toggle("is-prev", i === (index - 1 + items.length) % items.length && !on);
        li.setAttribute("aria-hidden", on ? "false" : "true");
        var a = li.querySelector("a");
        if (on) a.removeAttribute("tabindex"); else a.setAttribute("tabindex", "-1");
      });
      countEl.textContent = String(index + 1);
    }
    function playing() { return !userPaused && !hover && visible && !document.hidden && !motion.matches; }
    function restartBar() {
      timeBar.style.animation = "none";
      void timeBar.offsetWidth;
      timeBar.style.animation = "";
      box.classList.toggle("is-running", playing());
      timeBar.style.animationDuration = CFG.tickerEvery + "s";
    }
    function schedule() {
      clearTimeout(timer);
      restartBar();
      if (playing()) timer = setTimeout(function () { go(index + 1); }, CFG.tickerEvery * 1000);
    }
    function go(i) {
      index = (i + items.length) % items.length;
      sync();
      schedule();
    }
    sync();
    nextBtn.addEventListener("click", function () { go(index + 1); });
    pauseBtn.addEventListener("click", function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute("aria-pressed", String(userPaused));
      pauseBtn.setAttribute("aria-label", userPaused ? "เล่นเลื่อนข่าวอัตโนมัติ" : "หยุดเลื่อนข่าวอัตโนมัติ");
      box.classList.toggle("is-paused", userPaused);
      schedule();
    });
    if (userPaused) { pauseBtn.setAttribute("aria-pressed", "true"); pauseBtn.setAttribute("aria-label", "เล่นเลื่อนข่าวอัตโนมัติ"); box.classList.add("is-paused"); }
    box.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hover = true; schedule(); } });
    box.addEventListener("pointerleave", function () { hover = false; schedule(); });
    box.addEventListener("focusin", function () { hover = true; schedule(); });
    box.addEventListener("focusout", function (e) { if (!box.contains(e.relatedTarget)) { hover = false; schedule(); } });
    onView(box, function (v) { visible = v; schedule(); });
    document.addEventListener("visibilitychange", schedule);
  }

  /* ---------- 2) บริการอื่นจากเว็บวิทยาลัย ---------- */
  function setupEservice() {
    var grid = $("#services .service-grid");
    if (!grid || $(".lvc-es")) return;
    var box = document.createElement("div");
    box.className = "lvc-es";
    box.innerHTML = '<span class="lvc-es__label">บริการอื่นที่เว็บวิทยาลัยแนะนำ</span>' +
      ESERVICE.map(function (s) { return '<a class="lvc-es__chip external" href="' + esc(s.url) + '"><span>' + esc(s.title) + '</span>' + ARROW + '</a>'; }).join("");
    grid.insertAdjacentElement("afterend", box);
    revealOnce(box);
  }

  /* ---------- 3) แถบชื่อกลุ่มสาขาวิ่งสวนกัน ---------- */
  function setupRibbon() {
    var programs = $("#programs");
    if (!programs || $(".lvc-rb")) return;
    var box = document.createElement("div");
    box.className = "lvc-rb";
    box.setAttribute("aria-hidden", "true");
    function row(cls, words) {
      var unit = '<span class="lvc-rb__unit">' + words.map(function (w) { return '<span>' + esc(w) + '</span><i class="lvc-rb__dot"></i>'; }).join("") + '</span>';
      return '<div class="lvc-rb__row ' + cls + '"><div class="lvc-rb__track">' + unit + unit + unit + '</div></div>';
    }
    box.innerHTML = row("lvc-rb__row--a", GROUPS) + row("lvc-rb__row--b", WORDS);
    programs.parentNode.insertBefore(box, programs);
    var rows = Array.prototype.slice.call(box.querySelectorAll(".lvc-rb__row")).map(function (r, i) {
      return { el: r, track: r.firstChild, unit: r.querySelector(".lvc-rb__unit"), w: 0, x: 0, dir: i === 0 ? -1 : 1, speed: i === 0 ? 34 : 24 };
    });
    var visible = false, raf = 0, last = 0, lastY = window.scrollY, boost = 0, skew = 0;
    function measure() { rows.forEach(function (r) { r.w = r.unit.getBoundingClientRect().width || r.w; }); }
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      var y = window.scrollY, dy = y - lastY;
      lastY = y;
      // ความเร็วการเลื่อนหน้า → เร่งและเอียงตาม แล้วค่อย ๆ คืนตัว
      boost += (Math.max(-900, Math.min(900, dy / Math.max(dt, 0.008))) - boost) * 0.12;
      boost *= Math.exp(-dt * 2.4);
      skew += (Math.max(-7, Math.min(7, boost * 0.012)) - skew) * Math.min(1, dt * 8);
      rows.forEach(function (r) {
        if (!r.w) return;
        var v = (r.speed + Math.abs(boost) * 0.32) * r.dir * (boost < 0 ? -1 : 1);
        r.x = (r.x + v * dt) % r.w;
        if (r.x > 0) r.x -= r.w;
        r.track.style.transform = "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + (-skew * r.dir).toFixed(2) + "deg)";
      });
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && visible && !motion.matches) { last = 0; lastY = window.scrollY; raf = requestAnimationFrame(frame); } }
    rows[1].x = -rows[1].w / 2;
    measure();
    rows.forEach(function (r, i) { r.x = i === 1 ? -r.w * 0.37 : 0; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    onView(box, function (v) { visible = v; if (v) { measure(); start(); } }, { rootMargin: "60px 0px" });
    document.addEventListener("visibilitychange", start);
    if (motion.addEventListener) motion.addEventListener("change", function () { if (motion.matches) rows.forEach(function (r) { r.track.style.transform = ""; }); else start(); });
    revealOnce(box);
  }

  /* ---------- 4) แกลเลอรีผลงานเปลี่ยนภาพเอง ---------- */
  function setupGallery() {
    var section = $("#achievements"), controls = $("#achievements .gallery-controls");
    var next = controls && $(".next", controls), count = controls && $(".gallery-count", controls);
    if (!section || !next || $(".lvc-gal-play")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-button lvc-gal-play";
    // วงนับเวลาเป็น SVG ความยาวจริง (ไม่ใช้ pathLength ร่วมกับ non-scaling-stroke ซึ่ง Safari วาดผิด)
    btn.innerHTML = '<svg class="lvc-gal-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M9 6v12M15 6v12"/><path class="i-play" d="M8 5.5v13l11-6.5z"/></svg>' +
      '<svg class="lvc-gal-ring" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="23"/></svg>';
    controls.insertBefore(btn, count);
    var timer = 0, userPaused = motion.matches, hover = false, visible = false;
    function playing() { return !userPaused && !hover && visible && !document.hidden && !motion.matches && !document.querySelector(".poster-dialog[open]"); }
    function label() {
      btn.setAttribute("aria-pressed", String(userPaused));
      btn.setAttribute("aria-label", userPaused ? "เล่นภาพผลงานอัตโนมัติ" : "หยุดเปลี่ยนภาพผลงานอัตโนมัติ");
      btn.classList.toggle("is-paused", userPaused);
      // ระหว่างเปลี่ยนภาพเอง ไม่ต้องให้โปรแกรมอ่านหน้าจออ่านเลขภาพทุก 6 วินาที
      if (count) count.setAttribute("aria-live", playing() ? "off" : "polite");
    }
    function schedule() {
      clearTimeout(timer);
      var ring = btn.querySelector(".lvc-gal-ring circle");
      ring.style.animation = "none"; void ring.getBoundingClientRect(); ring.style.animation = "";   // SVG ไม่มี offsetWidth
      ring.style.animationDuration = CFG.galleryEvery + "s";
      btn.classList.toggle("is-running", playing());
      label();
      if (playing()) timer = setTimeout(function () { next.click(); }, CFG.galleryEvery * 1000);
    }
    btn.addEventListener("click", function () { userPaused = !userPaused; schedule(); });
    // กดเปลี่ยนภาพเองแล้วนับเวลาใหม่
    if (count && window.MutationObserver) new MutationObserver(schedule).observe(count, { childList: true, characterData: true, subtree: true });
    var area = $(".achievement-layout", section) || section;
    area.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hover = true; schedule(); } });
    area.addEventListener("pointerleave", function () { hover = false; schedule(); });
    area.addEventListener("focusin", function () { hover = true; schedule(); });
    area.addEventListener("focusout", function (e) { if (!area.contains(e.relatedTarget)) { hover = false; schedule(); } });
    onView(section, function (v) { visible = v; schedule(); }, { threshold: 0.35 });
    document.addEventListener("visibilitychange", schedule);
    var dlg = document.querySelector(".poster-dialog");
    if (dlg && window.MutationObserver) new MutationObserver(schedule).observe(dlg, { attributes: true, attributeFilter: ["open"] });
    label();
  }

  function run(name, fn) {
    if (!CFG[name]) return;
    try { fn(); } catch (error) { if (window.console) console.warn("[alive] " + name, error); }
  }
  function init() {
    run("ticker", setupTicker);
    run("eservice", setupEservice);
    run("ribbon", setupRibbon);
    run("gallery", setupGallery);
  }
  var started = false;
  function start() { if (started) return; started = true; init(); }
  if (document.readyState === "complete") start();
  else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
    window.addEventListener("load", start, { once: true });
  }
})();
