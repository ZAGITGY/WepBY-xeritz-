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
  var labels = { system: "ตามเครื่อง", light: "สว่าง", dark: "มืด" };
  var icons = {
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
    dark: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>'
  };
  function icon(mode) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' + icons[mode] + '</svg>';
  }
  function valid(value) { return allowed.indexOf(value) >= 0 ? value : "system"; }
  try { preference = valid(localStorage.getItem(key)); } catch (_) {}
  function resolved() { return preference === "system" ? (media && media.matches ? "dark" : "light") : preference; }
  function apply(announce) {
    var theme = resolved();
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-preference", preference);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#181619" : "#fbfaf7");
    controls.forEach(function (control) { control.update(); });
    window.dispatchEvent(new CustomEvent("lvc:themechange", { detail: { preference: preference, theme: theme } }));
    if (announce) controls.forEach(function (control) {
      control.status.textContent = "ตั้งค่าหน้าจอ: " + labels[preference] + (preference === "system" ? " · ขณะนี้โหมด" + labels[theme] : "");
    });
  }
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var switching = null;
  function setPreference(value, origin) {
    var before = resolved();
    preference = valid(value);
    try { localStorage.setItem(key, preference); } catch (_) {}
    var after = resolved();
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
    getState: function () { return { preference: preference, theme: resolved() }; },
    setPreference: setPreference
  };
  apply(false);
  var changed = function () { if (preference === "system") apply(false); };
  if (media) {
    if (media.addEventListener) media.addEventListener("change", changed);
    else if (media.addListener) media.addListener(changed);
  }
  window.addEventListener("storage", function (event) {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue);
    apply(false);
  });
  window.addEventListener("lvc:loaded", function () { apply(false); });

  function mount(header) {
    if (header.querySelector(".theme-control")) return;
    var id = "lvc-theme-menu-" + controls.length;
    var wrapper = document.createElement("div");
    wrapper.className = "theme-control";
    wrapper.innerHTML = '<button type="button" class="theme-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="' + id + '"></button>' +
      '<div class="theme-menu" id="' + id + '" role="menu" aria-label="รูปแบบหน้าจอ" hidden>' +
      '<p class="theme-menu__label" aria-hidden="true">รูปแบบหน้าจอ</p>' + allowed.map(function (mode) {
        return '<button type="button" role="menuitemradio" class="theme-option" data-theme-option="' + mode + '" aria-checked="false" tabindex="-1">' + icon(mode) + '<span>' + labels[mode] + '</span><span class="theme-option__check" aria-hidden="true">✓</span></button>';
      }).join("") + '<p class="theme-menu__hint">โหมดตามเครื่องเปลี่ยนอัตโนมัติ</p></div>' +
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
      options[at === undefined ? allowed.indexOf(preference) : at].focus({ preventScroll: true });
    }
    function update() {
      trigger.innerHTML = icon(preference);
      var name = "รูปแบบหน้าจอ: " + labels[preference];
      trigger.setAttribute("aria-label", name);
      trigger.title = name;
      options.forEach(function (option) {
        option.setAttribute("aria-checked", String(option.dataset.themeOption === preference));
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
    controls.push({ update: update, close: close, status: wrapper.querySelector(".theme-status") });
    update();
  }
  function findHeaders() {
    document.querySelectorAll(".header-inner, .page-header").forEach(mount);
    return controls.length > 0;
  }
  function ready() {
    apply(false);
    if (!findHeaders()) {
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
