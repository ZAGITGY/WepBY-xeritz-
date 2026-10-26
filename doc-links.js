/* LVC v9.2 — เอกสารในชุดเว็บไซต์ (doc-links.js)
 *
 * ลิงก์เอกสารชี้ไปที่ไฟล์ในโฟลเดอร์ documents/ ก่อนเสมอ (อ่านออฟไลน์ได้)
 * ถ้าไฟล์นั้นไม่อยู่ในชุดที่เปิด เช่น ลบคู่มือ 25.5 MB ออกเพื่อให้ ZIP เล็กลง
 * ลิงก์จะเปลี่ยนไปเปิดต้นฉบับบนเว็บไซต์วิทยาลัยแทน ไม่ขึ้นหน้า 404
 *
 * ทำงานกับลิงก์ที่ app.js และแฟ้มเอกสาร React สร้างภายหลังด้วย (ดักที่ document)
 * เปิดผ่าน file:// ตรวจไฟล์ไม่ได้ จึงคงลิงก์ในเครื่องไว้ตามเดิม
 */
(function () {
  "use strict";
  if (window.__LVC_DOCS) return;

  var SOURCES = {
    "student-handbook-2569.pdf": "https://lvc.ac.th/www2026/ita2569/oit-13/Student_Handbook_2569.pdf",
    "certificate-plan-2569.pdf": "https://lvc.ac.th/www2026/ita2569/oit-22/Vocational_Certificate_Curriculum_Plan_2569.pdf",
    "diploma-plan-2569.pdf": "https://lvc.ac.th/www2026/ita2569/oit-22/Vocational_Diploma_Curriculum_Plan_2569.pdf",
    "no-gift-policy-2569.pdf": "https://lvc.ac.th/www2026/ita2569/oit-20/No_Gift_Policy.pdf",
    "dos-and-donts-2569.pdf": "https://lvc.ac.th/www2026/ita2569/oit-17/Do's_and_Don't.pdf",
    "complaints-guide-2569.png": "https://lvc.ac.th/www2026/ita2569/oit-18/Complaints_step.png"
  };
  var checks = {};   // filename -> Promise<true | false | null>
  var known = {};    // filename -> true (มีไฟล์) | false (ไม่มี) | null (ตรวจไม่ได้)
  var canCheck = /^https?:$/.test(location.protocol) && !!window.fetch;

  function docOf(link) {
    if (!link || !link.getAttribute) return null;
    var href = link.getAttribute("data-local-href") || link.getAttribute("href") || "";
    var match = /(?:^|\/)documents\/([^\/?#]+)(#[^]*)?$/.exec(href);
    if (!match || !SOURCES[match[1]]) return null;
    return { file: match[1], hash: match[2] || "", local: href };
  }

  function check(file) {
    if (checks[file]) return checks[file];
    if (!canCheck) { known[file] = null; return (checks[file] = Promise.resolve(null)); }
    var url = new URL("documents/" + file, document.baseURI).href;
    checks[file] = fetch(url, { method: "HEAD", cache: "no-cache" })
      .then(function (response) { return response.ok; }, function () { return null; })
      .then(function (result) { known[file] = result; return result; });
    return checks[file];
  }

  function resolve(link, doc) {
    if (known[doc.file] === false) {
      if (!link.hasAttribute("data-local-href")) link.setAttribute("data-local-href", doc.local);
      link.href = SOURCES[doc.file] + doc.hash;
      link.setAttribute("data-doc-source", "online");
      link.rel = "noopener";
    }
  }

  function prepare(event) {
    var link = event.target.closest && event.target.closest("a[href]");
    var doc = docOf(link);
    if (!doc) return;
    if (doc.file in known) resolve(link, doc);
    else check(doc.file).then(function () { resolve(link, doc); });
  }

  // ชี้ / โฟกัส / แตะ: ตรวจไว้ล่วงหน้า ลิงก์ที่แสดงตอนชี้จึงตรงกับที่จะเปิดจริง
  ["pointerover", "focusin", "touchstart"].forEach(function (name) {
    document.addEventListener(name, prepare, { capture: true, passive: true });
  });

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    var link = event.target.closest && event.target.closest("a[href]");
    var doc = docOf(link);
    if (!doc) return;
    if (doc.file in known) { resolve(link, doc); return; }
    // ยังตรวจไม่เสร็จ: รอผลสั้น ๆ แล้วเปิดปลายทางที่ใช้ได้จริง
    event.preventDefault();
    var newTab = event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank";
    check(doc.file).then(function () {
      resolve(link, doc);
      if (newTab) window.open(link.href, "_blank", "noopener");
      else window.location.assign(link.href);
    });
  }, true);

  // ตรวจเอกสารที่หน้านี้อ้างถึงตอนเครื่องว่าง (ไฟล์ละครั้ง ใช้ HEAD ไม่ดาวน์โหลดเนื้อไฟล์)
  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="documents/"]'), function (link) {
      var doc = docOf(link);
      if (doc) check(doc.file).then(function () { resolve(link, doc); });
    });
  }
  function idle(fn) { (window.requestIdleCallback || function (cb) { return setTimeout(cb, 600); })(fn, { timeout: 2500 }); }
  if (document.readyState === "complete") idle(scan);
  else window.addEventListener("load", function () { idle(scan); }, { once: true });

  window.__LVC_DOCS = { status: function () { return JSON.parse(JSON.stringify(known)); }, check: check };
})();
