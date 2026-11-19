/* LVC appearance: runs before styles to prevent a flash, then mounts the controls.
 * No network request, account or framework needed. The default follows the device.
 */
(function () {
  "use strict";
  if (window.LVCTheme) return;

  var root = document.documentElement;
  var key = "lvc.theme";
  var allowed = ["system", "light", "dark"];
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var preference = "system";
  var controls = [];
  var labels = { system: "ตามเครื่อง", light: "สว่าง", dark: "มืด", loy: "ลอยกระทง" };
  var icons = {
    loy: '<path d="M16.5 3.5a4.5 4.5 0 1 0 4 6.6 3.6 3.6 0 0 1-4-6.6Z"/><path d="M3 16h18l-2.2 3.2a2 2 0 0 1-1.6.8H6.8a2 2 0 0 1-1.6-.8Z"/><path d="M7 16l1.6-3.2L10.5 16M10.5 16l1.5-4 1.5 4M13.5 16l1.9-3.2L17 16"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
    dark: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>'
  };
  function icon(mode) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' + icons[mode] + '</svg>';
  }
  function valid(value) { return allowed.indexOf(value) >= 0 ? value : "system"; }
  try { preference = valid(localStorage.getItem(key)); } catch (_) {}

  /* ลอยกระทง 2569: เวลาไทย (UTC+7) 20 พ.ย. 2569 00:00 → 25 พ.ย. 2569 06:00 เปิด/ปิดเอง
   * ระหว่างเทศกาลบังคับโหมดมืด + data-loy โดยไม่แตะค่า lvc.theme ที่ผู้ใช้เลือกไว้ หมดเทศกาลจึงกลับเป็นแบบเดิมเอง
   * ทดสอบ: ?loy=1 (เปิด) / ?loy=0 (ปิด) จำไว้ในแท็บนี้ · ?loy=auto กลับไปใช้วันที่ · ผู้ใช้เลือกสว่าง/มืด/ตามเครื่องในเมนูได้ (จำใน lvc.loy2569) */
  var LOY_START = Date.UTC(2026, 10, 19, 17), LOY_END = Date.UTC(2026, 10, 24, 23);
  var loyOffKey = "lvc.loy2569";
  var loyForce = null, loyOff = false;
  (function () {
    var m = /[?&]loy=([01]|auto)(?:&|$)/.exec(location.search);
    try {
      if (m) { if (m[1] === "auto") sessionStorage.removeItem("lvc.loy"); else sessionStorage.setItem("lvc.loy", m[1]); }
      loyForce = sessionStorage.getItem("lvc.loy");
      if (m && m[1] === "1") localStorage.removeItem(loyOffKey);
      loyOff = localStorage.getItem(loyOffKey) === "off";
    } catch (_) { loyForce = m && m[1] !== "auto" ? m[1] : null; }
  })();
  function loyWindow() { return loyForce === "1" || (loyForce !== "0" && Date.now() >= LOY_START && Date.now() < LOY_END); }
  function loyOn() { return loyWindow() && !loyOff; }
  function resolved() {
    if (loyOn()) return "dark";
    return preference === "system" ? (media && media.matches ? "dark" : "light") : preference;
  }
  function apply(announce) {
    var theme = resolved(), loy = loyOn();
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-preference", preference);
    if (loy) root.setAttribute("data-loy", "2569"); else root.removeAttribute("data-loy");
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", loy ? "#0f1b2e" : theme === "dark" ? "#181619" : "#fbfaf7");
    controls.forEach(function (control) { control.update(); });
    window.dispatchEvent(new CustomEvent("lvc:themechange", { detail: { preference: preference, theme: theme, loy: loy } }));
    if (announce) controls.forEach(function (control) {
      control.status.textContent = "ตั้งค่าหน้าจอ: " + (loy ? labels.loy : labels[preference] + (preference === "system" ? " · ขณะนี้โหมด" + labels[theme] : ""));
    });
  }
  function setLoyOff(off) {
    loyOff = off;
    try { if (off) localStorage.setItem(loyOffKey, "off"); else localStorage.removeItem(loyOffKey); } catch (_) {}
  }
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var switching = null;
  function setPreference(value, origin) {
    var before = resolved() + loyOn();
    if (value === "loy") setLoyOff(false);
    else {
      if (loyWindow()) setLoyOff(true);
      preference = valid(value);
      try { localStorage.setItem(key, preference); } catch (_) {}
    }
    var after = resolved() + loyOn();
    // v9.2: เปลี่ยนโหมดแล้วสีใหม่ค่อย ๆ แผ่ออกเป็นวงจากปุ่มที่กด (View Transitions)
    // เบราว์เซอร์ที่ไม่รองรับ หรือเปิด Reduced Motion จะเปลี่ยนทันทีเหมือนเดิม
    if (before === after || !document.startViewTransition || (motionQuery && motionQuery.matches) || switching) {
      apply(true);
      return;
    }
    var x = window.innerWidth - 40, y = 40;
    if (origin && origin.getBoundingClientRect) {
      var box = origin.getBoundingClientRect();
      if (box.width) { x = box.left + box.width / 2; y = box.top + box.height / 2; }
    }
    var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty("--theme-x", x + "px");
    root.style.setProperty("--theme-y", y + "px");
    root.style.setProperty("--theme-r", Math.ceil(radius) + "px");
    root.classList.add("theme-switching");
    try {
      switching = document.startViewTransition(function () { apply(true); });
      switching.finished.then(done, done);
    } catch (_) { apply(true); done(); }
    function done() {
      switching = null;
      root.classList.remove("theme-switching");
    }
  }
  window.LVCTheme = {
    getState: function () { return { preference: preference, theme: resolved(), loy: loyOn() }; },
    setPreference: setPreference
  };
  apply(false);
  var changed = function () { if (preference === "system") apply(false); };
  if (media) {
    if (media.addEventListener) media.addEventListener("change", changed);
    else if (media.addListener) media.addListener(changed);
  }
  window.addEventListener("storage", function (event) {
    if (event.key === loyOffKey) { loyOff = event.newValue === "off"; apply(false); return; }
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue);
    apply(false);
  });
  // เปิดหน้าค้างไว้ข้ามเวลาเริ่ม/จบเทศกาล → สลับเอง (setTimeout รอได้ไม่เกิน ~24 วัน)
  [LOY_START, LOY_END].forEach(function (at) {
    var wait = at - Date.now();
    if (loyForce === null && wait > 0 && wait < 2e9) setTimeout(function () { apply(false); rebuild(); }, wait + 1000);
  });
  window.addEventListener("lvc:loaded", function () { apply(false); });

  function mount(header) {
    if (header.querySelector(".theme-control")) return;
    var id = "lvc-theme-menu-" + controls.length;
    var wrapper = document.createElement("div");
    wrapper.className = "theme-control";
    wrapper.innerHTML = '<button type="button" class="theme-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="' + id + '"></button>' +
      '<div class="theme-menu" id="' + id + '" role="menu" aria-label="รูปแบบหน้าจอ" hidden>' +
      '<p class="theme-menu__label" aria-hidden="true">รูปแบบหน้าจอ</p>' + menuModes().map(function (mode) {
        return '<button type="button" role="menuitemradio" class="theme-option" data-theme-option="' + mode + '" aria-checked="false" tabindex="-1">' + icon(mode) + '<span>' + labels[mode] + '</span><span class="theme-option__check" aria-hidden="true">✓</span></button>';
      }).join("") + '<p class="theme-menu__hint">' + (loyWindow() ? "ธีมลอยกระทงถึง 25 พ.ย. 06:00 แล้วกลับเป็นแบบที่เลือกไว้เอง" : "โหมดตามเครื่องเปลี่ยนอัตโนมัติ") + '</p></div>' +
      '<span class="theme-status" role="status" aria-live="polite" aria-atomic="true"></span>';
    var trigger = wrapper.querySelector(".theme-toggle");
    var menu = wrapper.querySelector(".theme-menu");
    var options = Array.from(wrapper.querySelectorAll(".theme-option"));
    var opened = false;
    function close(focus) {
      opened = false;
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (focus) trigger.focus({ preventScroll: true });
    }
    function open(at) {
      controls.forEach(function (other) { other.close(false); });
      opened = true;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      if (at === undefined) at = Math.max(0, menuModes().indexOf(loyOn() ? "loy" : preference));
      options[at].focus({ preventScroll: true });
    }
    function update() {
      var current = loyOn() ? "loy" : preference;
      trigger.innerHTML = icon(current);
      var name = "รูปแบบหน้าจอ: " + labels[current];
      trigger.setAttribute("aria-label", name);
      trigger.title = name;
      options.forEach(function (option) {
        option.setAttribute("aria-checked", String(option.dataset.themeOption === current));
      });
    }
    trigger.addEventListener("click", function () { if (opened) close(false); else open(); });
    trigger.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); open(event.key === "ArrowUp" ? options.length - 1 : 0);
      }
    });
    menu.addEventListener("keydown", function (event) {
      var at = options.indexOf(document.activeElement), next;
      if (event.key === "ArrowDown") next = (at + 1) % options.length;
      else if (event.key === "ArrowUp") next = (at + options.length - 1) % options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      if (next !== undefined) { event.preventDefault(); options[next].focus(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      // Let the native Tab move focus first, then remove the popup.
      if (event.key === "Tab") window.setTimeout(function () { close(false); }, 0);
    });
    options.forEach(function (option) {
      option.addEventListener("click", function () { close(true); setPreference(option.dataset.themeOption, trigger); });
    });
    document.addEventListener("pointerdown", function (event) {
      if (opened && !wrapper.contains(event.target)) close(false);
    });
    document.addEventListener("focusin", function (event) {
      if (opened && !wrapper.contains(event.target)) close(false);
    });
    var before = header.querySelector(".menu-toggle") || header.querySelector(".page-nav");
    header.insertBefore(wrapper, before);
    header.classList.add("has-theme-control");
    controls.push({ update: update, close: close, status: wrapper.querySelector(".theme-status"), wrapper: wrapper, header: header });
    update();
  }
  function menuModes() { return loyWindow() ? ["loy"].concat(allowed) : allowed; }
  // เทศกาลเริ่ม/จบระหว่างเปิดหน้า: สร้างเมนูใหม่ให้มี/ไม่มีตัวเลือกลอยกระทง
  function rebuild() {
    var old = controls.splice(0);
    old.forEach(function (c) { c.wrapper.remove(); mount(c.header); });
  }
  function findHeaders() {
    document.querySelectorAll(".header-inner, .page-header").forEach(mount);
    return controls.length > 0;
  }
  function ready() {
    apply(false);
    if (!findHeaders() && document.getElementById("app")) {
      // The original home page builds its header in app.js. Stop observing as
      // soon as it exists so frame-by-frame sculpture updates cost nothing here.
      var observer = new MutationObserver(function () { if (findHeaders()) observer.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("theme-ready"); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
