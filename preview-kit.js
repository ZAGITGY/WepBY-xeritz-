/* ============================================================================
 * preview-kit.js — LVC ชุดสำหรับช่วงทดสอบ (เริ่มใน v9.4 · ลบออกได้ทั้งไฟล์ตอนเปิดใช้จริง)
 *   • ป้าย "ฉบับทดลอง · แจ้งปัญหา" กลางขอบล่างของจอ
 *   • หน้าต่างแจ้งปัญหา: แนบข้อมูลเครื่องให้อัตโนมัติ + ข้อผิดพลาด JavaScript ล่าสุด
 *     ผู้ทดสอบกด "คัดลอกรายงาน" หรือ "ส่งทาง LINE" เอง — ไฟล์นี้ไม่ส่งข้อมูลไปที่ไหนเอง
 * ต้องโหลดใน <head> แบบไม่ defer เพื่อจับข้อผิดพลาดของสคริปต์อื่นได้ตั้งแต่ต้น
 * ============================================================================ */
(function () {
  "use strict";

  /* ---------- ตั้งค่า ---------- */
  var CFG = {
    version: "2026-11-01.11.0",
    email: "",          // ใส่อีเมลผู้รับรายงาน เช่น "name@example.com" → มีปุ่ม "ส่งอีเมล"
    formUrl: "",        // ใส่ลิงก์ Google Form (ถ้ามี) → มีปุ่ม "เปิดแบบฟอร์ม"
    line: true,         // ปุ่ม "ส่งทาง LINE" (เปิดหน้าแชร์ของ LINE ให้เลือกแชตเอง) — ใช้เมื่อไม่ได้ใส่ lineAdmin
    // LINE ผู้ดูแล (ลิงก์จาก QR เพิ่มเพื่อน) → ปุ่มเขียวกลายเป็น "ส่งให้ผู้ดูแลทาง LINE": คัดลอกรายงานแล้วเปิดโปรไฟล์ LINE นี้
    // บัญชีส่วนตัวเติมข้อความในแชตให้อัตโนมัติไม่ได้ ผู้ทดสอบต้องกด "วาง" เอง · เว้นว่าง = กลับไปใช้ปุ่มแชร์แบบเดิม
    lineAdmin: "https://line.me/ti/p/6OJ1lFr108"
  };

  if (window.__LVC_PREVIEW_KIT) return;
  window.__LVC_PREVIEW_KIT = true;

  /* ---------- จับข้อผิดพลาดตั้งแต่ต้น ---------- */
  var errors = [];
  function remember(text) {
    text = String(text || "").replace(/\s+/g, " ").slice(0, 220);
    if (!text || errors.indexOf(text) >= 0) return;
    errors.push(text);
    if (errors.length > 6) errors.shift();
  }
  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {
      remember("โหลดไม่สำเร็จ: " + (e.target.src || e.target.href).replace(location.origin, ""));
      return;
    }
    var where = e.filename ? " @" + e.filename.split("/").pop().split("?")[0] + ":" + e.lineno : "";
    remember((e.message || "error") + where);
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    remember("Promise: " + (r && (r.message || r.name) || r));
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  /* ---------- ข้อมูลเครื่อง ---------- */
  function webglState() {
    var d = document.documentElement;
    if (d.classList.contains("static-sculpture")) return "ภาพสำรอง (ไม่มี WebGL)";
    var hero = document.querySelector(".sculpture");
    if (hero) return hero.classList.contains("ready") ? "3D" : "กำลังโหลด/ไม่แน่ชัด";
    return "-";
  }
  // v10: ฉากเข้าเว็บ (intro.js) และพื้นหลังภาพวิทยาลัย (campus-backdrop.js)
  function introState() {
    if (document.documentElement.classList.contains("lvc-loading")) return "กำลังเล่น";
    return window.__LVC_INTRO_RESULT || "ไม่แสดง (กลับจากหน้าอื่น / ลิงก์ #ส่วน / Reduced Motion)";
  }
  function backdropState() {
    var B = window.__LVC_BACKDROP, s;
    if (!document.querySelector(".lvc-campus")) return "-";
    try { s = B && B.state; } catch (e) {}
    if (!s) return "ภาพนิ่ง (CSS)";
    if (s.failed) return "ภาพนิ่ง (WebGL ใช้ไม่ได้)";
    return (s.still ? "ภาพนิ่ง" : "เคลื่อนไหว") + " · ระดับ " + s.quality + " · เฟรมเฉลี่ย " + s.avgMs + " ms";
  }
  function deviceGuess() {
    var ua = navigator.userAgent;
    var m = ua.match(/iPhone|iPad|Android [\d.]+|Windows NT [\d.]+|Mac OS X [\d_]+|CrOS|Linux/);
    var b = ua.match(/(Line|FBAN|FBAV|Instagram|EdgA?|SamsungBrowser|OPR|CriOS|FxiOS|Firefox|Chrome|Version)\/([\d.]+)/);
    var browser = b ? b[1].replace("Version", "Safari").replace("CriOS", "Chrome iOS").replace("FxiOS", "Firefox iOS").replace("FBAN", "Facebook").replace("FBAV", "Facebook") + " " + b[2].split(".")[0] : "?";
    if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !/iPad/.test(ua)) return "iPad (iPadOS) · " + browser;
    return (m ? m[0].replace(/_/g, ".") : "?") + " · " + browser;
  }
  function info() {
    var d = document.documentElement;
    var scrollMax = Math.max(1, d.scrollHeight - innerHeight);
    var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var conn = navigator.connection && navigator.connection.effectiveType;
    var rows = [
      ["เวอร์ชัน", CFG.version],
      ["หน้า", location.pathname.split("/").pop() + location.hash],
      ["ตำแหน่งในหน้า", Math.round(scrollY / scrollMax * 100) + "%"],
      ["อุปกรณ์", deviceGuess()],
      ["จอ", innerWidth + "×" + innerHeight + " @" + (window.devicePixelRatio || 1) + "x · " + (innerWidth > innerHeight ? "แนวนอน" : "แนวตั้ง")],
      ["โหมดหน้าจอ", d.getAttribute("data-theme") || "-"],
      ["Reduced Motion", rm ? "เปิด" : "ปิด"],
      ["ประติมากรรม", webglState()],
      ["ฉากเข้าเว็บ", introState()],
      ["พื้นหลังภาพวิทยาลัย", backdropState()],
      ["เครือข่าย", conn || "-"],
      ["เวลา", new Date().toLocaleString("th-TH")]
    ];
    return rows;
  }
  function reportText(kind, note) {
    var lines = ["[แจ้งปัญหา LVC Preview] " + kind, "", (note || "(ยังไม่ได้เขียนรายละเอียด)").trim(), "", "— ข้อมูลเครื่อง —"];
    info().forEach(function (r) { lines.push(r[0] + ": " + r[1]); });
    lines.push("UA: " + navigator.userAgent);
    if (errors.length) { lines.push("", "— ข้อผิดพลาดที่จับได้ —"); errors.forEach(function (e) { lines.push("• " + e); }); }
    return lines.join("\n");
  }

  /* ---------- หน้าตา ---------- */
  var CSS = [
    ".lvc-kit-pill{position:fixed;z-index:41;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:7px 14px 7px 11px;border:1px solid var(--line,#dfd9d2);border-radius:999px;background:rgba(250,249,246,.9);background:color-mix(in srgb,var(--paper,#faf9f6) 88%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ink,#241f20);font:inherit;font-size:12px;line-height:1.2;cursor:pointer;box-shadow:0 8px 22px -14px rgba(36,25,28,.5);transition:opacity .3s ease,transform .4s cubic-bezier(.22,.8,.25,1);-webkit-tap-highlight-color:transparent}",
    ".lvc-kit-pill i{width:7px;height:7px;border-radius:50%;background:#c9a96a;box-shadow:0 0 0 0 rgba(201,169,106,.6);animation:lvc-kit-ping 2.4s ease-out infinite}",
    "@keyframes lvc-kit-ping{0%{box-shadow:0 0 0 0 rgba(201,169,106,.55)}70%,100%{box-shadow:0 0 0 7px rgba(201,169,106,0)}}",
    ".lvc-kit-pill:active{transform:translateX(-50%) scale(.95)}.lvc-kit-pill:focus-visible{outline:3px solid #b18a00;outline-offset:3px}",
    ".lvc-kit-pill.is-away{opacity:0;pointer-events:none;transform:translate(-50%,10px)}",
    "html.lvc-loading .lvc-kit-pill{display:none}",
    "@media (max-width:520px){.lvc-kit-pill .lvc-kit-long{display:none}}",
    ".lvc-kit{width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line,#dfd9d2);border-radius:14px;background:var(--surface-raised,#fffdf8);color:var(--ink,#241f20);box-shadow:0 30px 80px -30px rgba(20,10,12,.55);overflow:auto;font:inherit}",
    ".lvc-kit::backdrop{background:rgba(20,14,16,.42);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}",
    ".lvc-kit[open]{animation:lvc-kit-in .38s cubic-bezier(.22,.8,.25,1)}@keyframes lvc-kit-in{from{opacity:0;transform:translateY(14px) scale(.98)}}",
    ".lvc-kit form{margin:0;padding:22px 22px 20px;display:grid;gap:14px}",
    ".lvc-kit__top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}",
    ".lvc-kit h2{margin:0;font-size:21px;font-weight:500;line-height:1.35}",
    ".lvc-kit__note{margin:4px 0 0;font-size:13px;line-height:1.6;color:var(--muted,#686d72)}",
    ".lvc-kit__x{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line,#dfd9d2);background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}",
    ".lvc-kit label{display:grid;gap:6px;font-size:13px;color:var(--muted,#686d72)}",
    ".lvc-kit select,.lvc-kit textarea{font:inherit;font-size:16px;color:var(--ink,#241f20);background:var(--surface,#fffefb);border:1px solid var(--theme-border,#d3c9ba);border-radius:10px;padding:10px 12px}",
    ".lvc-kit textarea{min-height:110px;resize:vertical;line-height:1.6}",
    ".lvc-kit select:focus-visible,.lvc-kit textarea:focus-visible{outline:2px solid var(--theme-outline,#8a1527);outline-offset:1px}",
    ".lvc-kit details{font-size:12px;color:var(--muted,#686d72);border-top:1px solid var(--line,#dfd9d2);padding-top:10px}",
    ".lvc-kit summary{cursor:pointer;min-height:32px;display:flex;align-items:center}",
    ".lvc-kit pre{margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font:inherit;font-size:12px;line-height:1.7}",
    ".lvc-kit__actions{display:flex;flex-wrap:wrap;gap:10px}",
    ".lvc-kit__actions button,.lvc-kit__actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border-radius:999px;border:1px solid var(--theme-border,#d3c9ba);background:transparent;color:var(--ink,#241f20);font:inherit;font-size:14px;cursor:pointer;text-decoration:none;transition:transform .12s ease,background-color .2s ease}",
    ".lvc-kit__actions .is-main{background:#a61d2d;border-color:#a61d2d;color:#fff}",
    ".lvc-kit__actions .is-line{background:#06c755;border-color:#06c755;color:#fff}",
    ".lvc-kit__actions button:active,.lvc-kit__actions a:active{transform:scale(.96)}",
    ".lvc-kit__status{min-height:20px;margin:0;font-size:13px;color:#2f7d4f}",
    ".lvc-kit__hint{margin:-4px 0 0;font-size:12px;line-height:1.6;color:var(--muted,#686d72)}",
    "html[data-theme=dark] .lvc-kit__status{color:#8fd3a8}",
    "@media (prefers-reduced-motion:reduce){.lvc-kit-pill i{animation:none}.lvc-kit[open]{animation:none}}",
    "@media print{.lvc-kit-pill,.lvc-kit{display:none!important}}"
  ].join("\n");

  ready(function () {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "lvc-kit-pill";
    pill.setAttribute("aria-haspopup", "dialog");
    pill.innerHTML = '<i aria-hidden="true"></i><span><span class="lvc-kit-long">ฉบับทดลอง · </span>แจ้งปัญหา</span>';
    document.body.appendChild(pill);

    var supportsDialog = typeof HTMLDialogElement === "function";
    var dlg = document.createElement(supportsDialog ? "dialog" : "div");
    dlg.className = "lvc-kit";
    dlg.setAttribute("aria-labelledby", "lvc-kit-title");
    if (!supportsDialog) { dlg.hidden = true; dlg.setAttribute("role", "dialog"); dlg.style.cssText = "position:fixed;z-index:2147483001;left:50%;top:50%;transform:translate(-50%,-50%)"; }
    var extra = (CFG.email ? '<button type="button" data-act="mail">ส่งอีเมล</button>' : "") +
      (CFG.formUrl ? '<a data-act="form" href="' + CFG.formUrl.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">เปิดแบบฟอร์ม</a>' : "");
    dlg.innerHTML =
      '<form method="dialog">' +
        '<div class="lvc-kit__top"><div><h2 id="lvc-kit-title">แจ้งปัญหาหรือข้อเสนอแนะ</h2>' +
        '<p class="lvc-kit__note">เว็บนี้เป็นฉบับทดลอง ยังไม่ใช่เว็บไซต์ทางการของวิทยาลัย ขอบคุณที่ช่วยทดสอบ</p></div>' +
        '<button type="button" class="lvc-kit__x" data-act="close" aria-label="ปิด">×</button></div>' +
        '<label>ประเภท<select name="kind">' +
          '<option>ใช้งานไม่ได้ / กดแล้วไม่ไป</option><option>ภาพหรือข้อความแสดงผิด</option>' +
          '<option>ช้า / กระตุก / ค้าง</option><option>ข้อมูลไม่ถูกต้อง</option><option>ข้อเสนอแนะ</option></select></label>' +
        '<label>เกิดอะไรขึ้น อยู่ส่วนไหนของหน้า และทำอะไรก่อนหน้านั้น<textarea name="note" placeholder="เช่น เลื่อนลงมาถึงตัว V แล้วข้อความหายไป หมุนจอเป็นแนวนอนอยู่"></textarea></label>' +
        '<details><summary>ข้อมูลเครื่องที่แนบให้อัตโนมัติ</summary><pre data-info></pre></details>' +
        '<div class="lvc-kit__actions"><button type="button" class="is-main" data-act="copy">คัดลอกรายงาน</button>' +
        (CFG.lineAdmin ? '<a class="is-line" data-act="line-admin" href="' + CFG.lineAdmin.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">ส่งให้ผู้ดูแลทาง LINE</a>'
          : CFG.line ? '<button type="button" class="is-line" data-act="line">ส่งทาง LINE</button>' : "") + extra + '</div>' +
        (CFG.lineAdmin ? '<p class="lvc-kit__hint">ปุ่มเขียวจะคัดลอกรายงานให้ แล้วเปิด LINE ผู้ดูแล กด “เพิ่มเพื่อน” (ครั้งแรก) แล้ว “แชต” จากนั้นกดค้างในช่องพิมพ์ เลือก “วาง” แล้วส่ง</p>' : "") +
        '<p class="lvc-kit__status" role="status" aria-live="polite"></p>' +
      '</form>';
    document.body.appendChild(dlg);

    var kind = dlg.querySelector("select"), note = dlg.querySelector("textarea");
    var pre = dlg.querySelector("[data-info]"), status = dlg.querySelector(".lvc-kit__status");
    function text() { return reportText(kind.value, note.value); }
    function refreshInfo() {
      pre.textContent = info().map(function (r) { return r[0] + ": " + r[1]; }).join("\n") +
        (errors.length ? "\n\nข้อผิดพลาดที่จับได้:\n• " + errors.join("\n• ") : "\n\nข้อผิดพลาดที่จับได้: ไม่มี");
    }
    function open() {
      refreshInfo();
      status.textContent = "";
      if (supportsDialog) { try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); } }
      else dlg.hidden = false;
      setTimeout(function () { note.focus(); }, 60);
    }
    function close() {
      if (supportsDialog && dlg.open) dlg.close();
      else if (!supportsDialog) dlg.hidden = true;
      pill.focus({ preventScroll: true });
    }
    function copy(value) {
      function legacy() {
        var ta = document.createElement("textarea");
        ta.value = value; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        dlg.appendChild(ta); ta.select(); ta.setSelectionRange(0, value.length);
        var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
        ta.remove();
        return ok ? Promise.resolve() : Promise.reject();
      }
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value).catch(legacy);
      return legacy();
    }
    pill.addEventListener("click", open);
    if (supportsDialog) {
      dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });   // แตะพื้นหลังเพื่อปิด
      dlg.addEventListener("close", function () { pill.focus({ preventScroll: true }); });
    }
    dlg.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "close") close();
      else if (act === "copy") {
        copy(text()).then(function () { status.textContent = "คัดลอกแล้ว นำไปวางในแชตหรืออีเมลที่ต้องการส่งได้เลย"; },
          function () { status.textContent = "คัดลอกอัตโนมัติไม่ได้ เปิด “ข้อมูลเครื่อง” แล้วกดค้างเพื่อคัดลอกเองได้"; refreshInfo(); dlg.querySelector("details").open = true; });
      } else if (act === "line-admin") {
        // คัดลอกในจังหวะที่กดเลย (เบราว์เซอร์ยอมให้เขียนคลิปบอร์ดเฉพาะตอนผู้ใช้กด) แล้วปล่อยให้ลิงก์เปิด LINE ตามปกติ
        status.textContent = "กำลังคัดลอกรายงาน…";
        copy(text()).then(function () { status.textContent = "คัดลอกรายงานแล้ว ไปที่แชต LINE ของผู้ดูแล กดค้างในช่องพิมพ์ แล้วเลือก “วาง”"; },
          function () { status.textContent = "คัดลอกอัตโนมัติไม่ได้ กด “คัดลอกรายงาน” อีกครั้ง หรือเปิด “ข้อมูลเครื่อง” แล้วคัดลอกเอง"; refreshInfo(); dlg.querySelector("details").open = true; });
      } else if (act === "line") {
        window.open("https://line.me/R/share?text=" + encodeURIComponent(text().slice(0, 1800)), "_blank", "noopener");
      } else if (act === "mail") {
        location.href = "mailto:" + CFG.email + "?subject=" + encodeURIComponent("แจ้งปัญหา LVC Preview: " + kind.value) + "&body=" + encodeURIComponent(text());
      }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !supportsDialog && !dlg.hidden) close(); });

    // หน้าหลักสูตร: หลบแถบเปรียบเทียบที่ลอยอยู่ด้านล่าง
    var compare = document.querySelector(".compare-bar");
    if (compare && window.MutationObserver) {
      var sync = function () { pill.classList.toggle("is-away", !compare.hidden); };
      new MutationObserver(sync).observe(compare, { attributes: true, attributeFilter: ["hidden"] });
      sync();
    }
  });

  window.__LVC_PREVIEW = { errors: errors, report: function () { return reportText("ทดสอบ", ""); } };
})();
