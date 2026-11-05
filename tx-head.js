/* ============================================================================
 * tx-head.js — v11.1 เปลี่ยนหน้าด้วยริบบิ้น: ฝั่ง "หน้าที่มาถึง"
 * โหลดแบบไม่ defer ใน <head> (ก่อนหน้าแสดงผลครั้งแรก) คู่กับ transition.css + lvc-transition.js
 *
 * หน้าก่อนหน้าคลุมจอด้วยริบบิ้นแล้วบันทึก sessionStorage "lvc-tx" ก่อนเปลี่ยนหน้า
 * ไฟล์นี้อ่านค่านั้น: ถ้ามาจากการเปลี่ยนหน้าจริง (ไม่ใช่รีโหลด, ไม่เกิน 8 วินาที, ตรงหน้าปลายทาง)
 * จะใส่ html.lvc-tx-in และสร้างริบบิ้นแบบคลุมจอไว้เป็นอย่างแรกใน <body> (สคริปต์บรรทัดแรกของ body เรียก mount)
 * จากนั้น lvc-transition.js ค่อย "แหวก" ริบบิ้นออกเมื่อหน้าพร้อม
 *
 * กันค้าง: ถ้าสคริปต์แหวกไม่ทำงาน หน้าจะเปิดเองภายใน 6 วินาที
 * ============================================================================ */
(function () {
  "use strict";
  var d = document.documentElement;
  var TX = window.__LVC_TX = { arriving: false, el: null, opening: false };
  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  TX.reduce = reduce;
  TX.norm = function (path) { return String(path || "/").replace(/index\.html?$/i, ""); };

  var raw = null;
  try { raw = sessionStorage.getItem("lvc-tx"); sessionStorage.removeItem("lvc-tx"); } catch (e) {}
  if (raw && !reduce) {
    try {
      var data = JSON.parse(raw);
      var nav = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
      var fresh = Date.now() - data.t < 8000;
      var here = !data.to || data.to === TX.norm(location.pathname);
      var reload = nav && nav.type === "reload";
      if (fresh && here && !reload) {
        TX.arriving = true;
        d.classList.add("lvc-tx-in");
      }
    } catch (e) {}
  }

  // ริบบิ้น 7 ผืน + เส้นตัด + ตราวิทยาลัยกลางจอ (ใช้ทั้งตอนออกและตอนมาถึง)
  TX.build = function (state) {
    var el = document.createElement("div");
    el.className = "lvc-tx is-" + state;
    el.setAttribute("aria-hidden", "true");
    var html = '<div class="lvc-tx__stage">';
    for (var i = 0; i < 7; i++) {
      var k = Math.abs(i - 3);
      html += '<i class="lvc-tx__band lvc-tx__band--' + i + '" style="--d:' + k + ';--dir:' + (i % 2 ? 1 : -1) + ';--side:' + (i < 3 ? -1 : i > 3 ? 1 : 0) + '"></i>';
    }
    html += '</div><span class="lvc-tx__slash"></span>' +
      '<div class="lvc-tx__mark"><img src="./images/crest.png" alt="" width="64" height="80"><span>วิทยาลัยอาชีวศึกษาเลย</span></div>';
    el.innerHTML = html;
    return el;
  };

  TX.mount = function () {
    if (!TX.arriving || TX.el || !document.body) return;
    TX.el = TX.build("covered");
    TX.mountedAt = performance.now();
    document.body.insertBefore(TX.el, document.body.firstChild);
  };

  if (!TX.arriving) return;

  // เปลี่ยนหน้าแบบ View Transition ของเบราว์เซอร์ไม่ต้องจางซ้อน: สองหน้าคลุมด้วยริบบิ้นเหมือนกันอยู่แล้ว
  window.addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition;
    if (!vt) return;
    var quiet = function () {};
    if (vt.ready) vt.ready.catch(quiet);
    if (vt.finished) vt.finished.catch(quiet);
    if (vt.updateCallbackDone) vt.updateCallbackDone.catch(quiet);
    try { vt.skipTransition(); } catch (err) {}
  });

  setTimeout(function () {
    if (TX.opening || !d.classList.contains("lvc-tx-in")) return;
    d.classList.remove("lvc-tx-in");
    if (TX.el) { TX.el.remove(); TX.el = null; }
    window.dispatchEvent(new Event("lvc:tx-open"));
  }, 6000);
})();
