/* ============================================================================
 * LVC v9.2 — การเคลื่อนไหวของหน้าเนื้อหา (page-fx.js)
 * ใช้กับ programs.html · news.html · contact.html  (ไม่ต้องใช้ GSAP หรือไลบรารีอื่น)
 *
 * วางท้าย <body> แบบไม่ defer: ใส่คลาสตั้งต้นก่อนหน้าแสดงผลครั้งแรก เนื้อหาจึงไม่กะพริบ
 * ส่วนบนสุดเปิดตัวทันที ส่วนที่เหลือทยอยปรากฏครั้งเดียวเมื่อเลื่อนมาถึง แล้วค้างไว้
 * สไตล์ทั้งหมดอยู่ในส่วน E–F ของ motion.css
 *
 * ไม่เคลื่อนไหวเมื่อ: เปิด Reduced Motion, เบราว์เซอร์ไม่มี IntersectionObserver, สั่งพิมพ์
 * เนื้อหาที่อยู่เหนือจออยู่แล้ว (เช่นกด Back แล้วเบราว์เซอร์คืนตำแหน่งเดิม) หรือถูกโฟกัสด้วยคีย์บอร์ดจะแสดงทันที
 * ============================================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var motion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (!("IntersectionObserver" in window) || !document.querySelector(".page-main") || (motion && motion.matches)) return;

  /* กลุ่ม = ส่วนที่ปรากฏพร้อมกัน · รายการในกลุ่มทยอยตามลำดับ (step วินาที)
   * ชนิด: lift (ยกขึ้น+จาง) · fade (จาง) · lines (แยกบรรทัดตาม <br> ไหลขึ้น) · img/zoom (รูปค่อย ๆ หายซูม)
   * draw: เส้นคั่นของกลุ่มลากเข้า (top / bottom / both) */
  var GROUPS = [
    { group: ".page-intro", step: 0.08, items: [
      [":scope > .back-link", "fade"], [":scope > .page-kicker", "lift"], [":scope > h1", "lines"],
      [":scope > p", "lift"], [":scope > .button, :scope > .text-link", "lift"]
    ] },
    { group: ".level-overview", draw: "both", items: [[":scope > div", "lift"]] },
    { group: ".catalog-tools", items: [[":scope > div", "lift"]] },
    { group: ".catalog-summary", items: [[":scope > *", "fade"]] },
    { group: ".program-detail", draw: "bottom", step: 0.06, items: [
      [".program-detail__heading", "lift"], [".program-level", "lift"], [".program-detail__actions", "fade"]
    ] },
    { group: ".source-section", items: [
      [":scope > .page-kicker", "lift"], [":scope > h2", "lift"], [":scope > p:not(.source-note)", "lift"],
      [".document-links > a", "lift"], [":scope > .source-note", "fade"]
    ] },
    { group: ".news-story", draw: "top", step: 0.1, items: [[".news-story__image", "img"], [":scope > div > *", "lift"]] },
    { group: ".awards-section", step: 0.1, items: [
      [":scope > .page-kicker", "lift"], [":scope > h2", "lift"], [".award-entry", "zoom"]
    ] },
    { group: ".contact-layout", draw: "top", step: 0.07, items: [
      [":scope > div:first-child > *", "lift"], [".contact-channels > a", "lift"]
    ] },
    { group: ".location-section", draw: "top", step: 0.08, items: [
      [":scope > div:first-child > *", "lift"], [".location-mark > strong", "lines"], [".location-mark > span", "fade"]
    ], extraDraw: [[".location-mark", "both"]] },
    { group: ".page-main > .source-note", self: "fade" },
    { group: ".page-footer", draw: "top", step: 0.06, items: [[".wrap > *", "fade"]] }
  ];
  var MAX_STAGGER = 0.7;

  var groups = [];
  var pending = new Set();

  function qa(selector, scope) {
    try { return Array.prototype.slice.call(scope.querySelectorAll(selector)); }
    catch (_) { return []; }
  }

  // แยกหัวข้อตาม <br> เป็นบรรทัด แต่ละบรรทัดอยู่ในกรอบที่ตัดขอบ (เผื่อวรรณยุกต์ไทยบน-ล่าง)
  function splitLines(el, delay) {
    if (!el || el.__pfxLines) return;
    el.__pfxLines = true;
    var lines = [[]];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeName === "BR") lines.push([]);
      else lines[lines.length - 1].push(node);
    });
    lines = lines.filter(function (nodes) {
      return nodes.some(function (n) { return n.nodeType !== 3 || n.textContent.trim(); });
    });
    var fragment = document.createDocumentFragment();
    lines.forEach(function (nodes, index) {
      var outer = document.createElement("span");
      var inner = document.createElement("span");
      outer.className = "fx-line";
      inner.className = "fx-line__in";
      inner.style.setProperty("--pfx-d", (delay + index * 0.1).toFixed(2) + "s");
      nodes.forEach(function (n) { inner.appendChild(n); });
      outer.appendChild(inner);
      fragment.appendChild(outer);
    });
    el.textContent = "";
    el.appendChild(fragment);
    el.classList.add("pfx-lines");
  }

  function markDraw(el, side) {
    el.classList.add("pfx-draw", "pfx-draw--" + side, "pfx-undrawn");
  }

  GROUPS.forEach(function (config) {
    qa(config.group, document).forEach(function (box) {
      if (box.__pfx) return;
      box.__pfx = true;
      var entry = { box: box, items: [], draws: [], revealed: false };
      box.classList.add("pfx-g");

      if (config.self) {
        box.classList.add("pfx-i");
        if (config.self === "fade") box.classList.add("pfx-fade");
        entry.items.push(box);
      }

      var seen = new Set(), ordered = [];
      (config.items || []).forEach(function (pair) {
        qa(pair[0], box).forEach(function (el) {
          if (seen.has(el)) return;
          seen.add(el);
          ordered.push([el, pair[1]]);
        });
      });
      // ทยอยตามลำดับที่อ่านในหน้า ไม่ใช่ลำดับใน config
      ordered.sort(function (a, b) {
        return a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      var step = config.step || 0.07, cursor = 0;
      ordered.forEach(function (pair) {
        var el = pair[0], type = pair[1];
        var delay = Math.min(cursor, MAX_STAGGER);
        cursor += step;
        if (type === "lines") {
          splitLines(el, delay);
          // รายการถัดไปรอให้หัวข้อหลายบรรทัดเริ่มไหลครบก่อน
          cursor += 0.1 * Math.max(0, el.querySelectorAll(".fx-line").length - 1) + 0.06;
          return;
        }
        el.classList.add("pfx-i");
        if (type === "fade") el.classList.add("pfx-fade");
        if (type === "img") el.classList.add("pfx-img");
        if (type === "zoom") el.classList.add("pfx-zoom");
        el.style.setProperty("--pfx-d", delay.toFixed(2) + "s");
        entry.items.push(el);
      });

      if (config.draw) { markDraw(box, config.draw); entry.draws.push(box); }
      (config.extraDraw || []).forEach(function (pair) {
        qa(pair[0], box).forEach(function (el) { markDraw(el, pair[1]); entry.draws.push(el); });
      });

      groups.push(entry);
      pending.add(entry);
    });
  });

  if (!groups.length) return;
  root.classList.add("pfx-on");

  // หลังเล่นจบ คืนคลาสเดิมให้รายการ: hover / transition เดิมของปุ่มและลิงก์ทำงานตามปกติ
  function settle(entry) {
    entry.items.forEach(function (el) {
      el.classList.remove("pfx-i", "pfx-fade", "pfx-img", "pfx-zoom");
      el.style.removeProperty("--pfx-d");
    });
    entry.settled = true;
  }

  function reveal(entry, instant) {
    if (entry.revealed) return;
    entry.revealed = true;
    pending.delete(entry);
    io.unobserve(entry.box);
    if (instant) entry.box.classList.add("pfx-now");
    entry.box.classList.add("pfx-in");
    entry.draws.forEach(function (el) { el.classList.remove("pfx-undrawn"); });
    if (instant) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { entry.box.classList.remove("pfx-now"); }); });
      settle(entry);
      return;
    }
    var last = 0;
    entry.items.forEach(function (el) { last = Math.max(last, parseFloat(el.style.getPropertyValue("--pfx-d")) || 0); });
    setTimeout(function () { settle(entry); }, (last + 1.7) * 1000);
  }

  var io = new IntersectionObserver(function (records) {
    records.forEach(function (record) {
      var entry = record.target.__pfxEntry;
      if (!entry || entry.revealed) return;
      if (record.isIntersecting) reveal(entry, false);
      else if (record.boundingClientRect.bottom < 0 && record.boundingClientRect.height > 0) reveal(entry, true);
    });
  }, { rootMargin: "0px 0px -7% 0px", threshold: 0 });

  groups.forEach(function (entry) { entry.box.__pfxEntry = entry; });
  function startObserving() {
    groups.forEach(function (entry) { if (!entry.revealed) io.observe(entry.box); });
  }

  /* v9.3: Safari บน iPad/iPhone เริ่มการเคลื่อนไหวที่เล่นระหว่างเปลี่ยนหน้า (View Transition) ใหม่อีกรอบ
   * ตอนการเปลี่ยนหน้าจบ หัวข้อจึงไหลขึ้นสองครั้ง → รอให้การเปลี่ยนหน้าจบก่อน แล้วค่อยเปิดตัวเนื้อหาครั้งเดียว
   * (pagereveal เกิดก่อนเฟรมแรกเสมอ จึงรู้ได้ใน requestAnimationFrame แรก) */
  var arriving = null;
  window.addEventListener("pagereveal", function (event) {
    if (event.viewTransition) arriving = event.viewTransition;
  }, { once: true });
  requestAnimationFrame(function () {
    var transition = arriving || document.activeViewTransition || null;
    if (!transition || !transition.finished) { startObserving(); return; }
    var started = false;
    var go = function () { if (started) return; started = true; startObserving(); };
    transition.finished.then(go, go);
    setTimeout(go, 1600);
  });

  function revealAll() {
    pending.forEach(function (entry) { reveal(entry, true); });
  }

  // คีย์บอร์ด / ลิงก์ภายในหน้า / ค้นหาในหน้า ต้องไม่ไปหยุดที่ข้อความโปร่งใส
  document.addEventListener("focusin", function (event) {
    groups.forEach(function (entry) {
      if (!entry.revealed && entry.box.contains(event.target)) reveal(entry, true);
    });
  });
  window.addEventListener("beforeprint", revealAll);
  if (motion) {
    var onMotion = function () {
      if (!motion.matches) return;
      revealAll();
      root.classList.remove("pfx-on");
    };
    if (motion.addEventListener) motion.addEventListener("change", onMotion);
    else if (motion.addListener) motion.addListener(onMotion);
  }

  /* หน้าหลักสูตร: กลุ่มสาขาที่กลับมาแสดงหลังค้นหา/กรอง ค่อย ๆ ปรากฏแทนการโผล่ทันที */
  if (window.MutationObserver && document.querySelector("[data-program]")) {
    var pop = function (el) {
      el.classList.remove("pfx-pop");
      void el.offsetWidth;
      el.classList.add("pfx-pop");
    };
    var popObserver = new MutationObserver(function (records) {
      records.forEach(function (record) {
        var el = record.target;
        if (record.attributeName === "hidden" && record.oldValue !== null && !el.hidden) {
          var entry = el.__pfxEntry || (el.closest(".pfx-g") || {}).__pfxEntry;
          if (!entry || entry.revealed) pop(el);
        }
      });
    });
    qa(".program-detail, .program-level, .empty-results", document).forEach(function (el) {
      popObserver.observe(el, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });
    });
    var count = document.getElementById("result-count");
    if (count) {
      new MutationObserver(function () { pop(count); }).observe(count, { childList: true, characterData: true, subtree: true });
    }
  }

  window.__LVC_PAGE_FX = {
    get pending() { return pending.size; },
    get groups() { return groups.length; },
    revealAll: revealAll
  };
})();
