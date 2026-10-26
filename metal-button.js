/* ============================================================================
 * LVC — ปุ่มโลหะเหลว (metal-button.js)
 *
 * พอร์ตมาจากคอมโพเนนต์ "Liquid Metal Button" (React) เป็น JavaScript ล้วน เพราะเว็บนี้ไม่ได้ใช้
 * React / Tailwind / shadcn ใช้ไลบรารี Paper Shaders ตัวเดียวกัน (vendor/paper-liquid-metal.js,
 * สัญญาอนุญาต Apache-2.0) แต่ปรับให้เข้ากับงานของเรา:
 *   • ขอบโลหะสีแชมเปญ (สีเดียวกับขอบโลหะของประติมากรรม LVC) แทนโครเมียมเทา
 *   • หน้าปุ่มสีแดงเคลือบเหมือนหน้าตัวอักษรของประติมากรรม (ปุ่มหลัก) / งาช้าง (ปุ่มใน header)
 *   • ยังเป็นลิงก์ <a> ตัวเดิม — คีย์บอร์ด, ลิงก์, screen reader ใช้ได้เหมือนเดิม
 *   • ขนาดปรับตามข้อความ (ของเดิมตายตัว 142×46)
 *   • เปิด Reduced Motion = ขอบนิ่ง ไม่ไหล · ไม่มี WebGL = ขอบไล่สีแชมเปญนิ่ง ๆ (CSS)
 *
 * ปรับหน้าตา: ค่าใน LOOK ด้านล่าง และสไตล์ในส่วน "4) ปุ่มโลหะเหลว" ของ enhance.css
 * ============================================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var S = window.__LVC_SHADER;
  var motionPreference = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = !!(motionPreference && motionPreference.matches);
  var noGL = /[?&]no-webgl(=|&|$)/.test(location.search);

  /* ---------- ค่าปรับแต่ง ---------- */
  var LOOK = {
    idle: 0.45,       // ความเร็วโลหะไหลตอนปกติ (ปุ่มหลัก)
    hover: 1.1,       // ตอนชี้ / โฟกัส
    press: 2.4,       // ตอนกด (กลับเป็นปกติใน 0.3 วินาที)
    still: 5000,      // เฟรมที่ใช้ตอนไม่ไหล (Reduced Motion / ปุ่ม header ตอนไม่ชี้) — เลือกลายที่สวยที่สุด
    uniforms: {       // โลหะแชมเปญ: ไม่มีรูปทรง (u_shape 0) ให้ลายไหลเต็มขอบ
      u_fit: 0, u_scale: 1, u_rotation: 0, u_offsetX: 0, u_offsetY: 0, u_originX: 0.5, u_originY: 0.5,
      u_worldWidth: 0, u_worldHeight: 0, u_isImage: false,
      u_colorBack: [0x9a / 255, 0x85 / 255, 0x56 / 255, 1],
      u_colorTint: [1, 0xf2 / 255, 0xd0 / 255, 1],
      u_contour: 0.4, u_distortion: 0.05, u_softness: 0.45, u_repetition: 2.2,
      u_shiftRed: 0.08, u_shiftBlue: 0.08, u_angle: 65, u_shape: 0
    }
  };

  var SELECTOR = ".hero-actions .button, .header-admission";
  var buttons = [];

  /* ---------- 1) ปรับโครง DOM ทันที (ก่อนหน้าโชว์ จะได้ไม่มี layout ขยับ) ---------- */
  function span(cls) { var s = document.createElement("span"); s.className = cls; s.setAttribute("aria-hidden", "true"); return s; }

  function build(el) {
    if (el.__lm) return;
    var light = el.classList.contains("header-admission");
    el.classList.add("lvc-metal", light ? "lvc-metal--light" : "lvc-metal--dark");

    var arrow = el.querySelector(".arrow");          // ปุ่มหลักไม่ต้องมีลูกศรต่อท้าย ข้อความบอกการกระทำชัดเจนอยู่แล้ว
    if (arrow) arrow.remove();

    var label = document.createElement("span");
    label.className = "lvc-metal__label";
    while (el.firstChild) label.appendChild(el.firstChild);

    var rim = span("lvc-metal__rim");
    var glx = span("lvc-metal__gl");
    rim.appendChild(glx);
    var face = span("lvc-metal__face");
    var fx = span("lvc-metal__fx");
    el.appendChild(rim); el.appendChild(face); el.appendChild(label); el.appendChild(fx);

    var b = { el: el, light: light, gl: glx, mount: null, hover: false, ripple: fx, still: light, pressTimer: null };
    el.__lm = b;
    buttons.push(b);
    bind(b);
  }

  /* ---------- 2) ปฏิสัมพันธ์: ชี้ / กด / ระลอก ---------- */
  function speedFor(b) {
    if (reduce) return 0;
    if (b.hover) return LOOK.hover;
    return b.still ? 0 : LOOK.idle;
  }
  function applySpeed(b) { if (b.mount && b.mount.setSpeed) b.mount.setSpeed(speedFor(b)); }

  function updateMotionPreference() {
    reduce = motionPreference.matches;
    buttons.forEach(function (b) {
      if (reduce) {
        clearTimeout(b.pressTimer);
        b.pressTimer = null;
        b.ripple.textContent = "";
        b.el.classList.remove("is-pressed");
      }
      applySpeed(b);
    });
  }
  if (motionPreference) {
    if (motionPreference.addEventListener) motionPreference.addEventListener("change", updateMotionPreference);
    else motionPreference.addListener(updateMotionPreference);
  }

  function bind(b) {
    var el = b.el;
    function on() { b.hover = true; el.classList.add("is-hover"); applySpeed(b); }
    function off() { b.hover = false; el.classList.remove("is-hover"); el.classList.remove("is-pressed"); applySpeed(b); }
    el.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") on(); });
    el.addEventListener("pointerleave", off);
    el.addEventListener("focus", function () { if (el.matches(":focus-visible")) on(); });
    el.addEventListener("blur", off);
    el.addEventListener("pointerdown", function (e) {
      el.classList.add("is-pressed");
      if (!reduce && b.mount && b.mount.setSpeed) {
        b.mount.setSpeed(LOOK.press);
        clearTimeout(b.pressTimer);
        b.pressTimer = setTimeout(function () { b.pressTimer = null; applySpeed(b); }, 300);
      }
      if (!reduce) ripple(b, e);
    });
    ["pointerup", "pointercancel"].forEach(function (t) { el.addEventListener(t, function () { el.classList.remove("is-pressed"); }); });
  }

  function ripple(b, e) {
    var r = b.el.getBoundingClientRect();
    var s = document.createElement("span");
    s.style.left = (e.clientX - r.left) + "px";
    s.style.top = (e.clientY - r.top) + "px";
    b.ripple.appendChild(s);
    s.addEventListener("animationend", function () { s.remove(); });
  }

  /* ---------- 3) ใส่ shader (หลังหน้าโหลดเผยหน้าเว็บ และเมื่อปุ่มเข้ามาใกล้จอ) ---------- */
  var pixel = null;                                  // ภาพเล็ก 1×1 ที่ shader ต้องการเป็นตัวอย่าง (ไม่ได้ใช้ลวดลายจริง)
  function withPixel(cb) {
    if (pixel && pixel.complete) return cb(pixel);
    if (!pixel) {
      pixel = new Image();
      pixel.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    }
    pixel.addEventListener("load", function () { cb(pixel); }, { once: true });
    pixel.addEventListener("error", function () { cb(null); }, { once: true });
  }

  function mount(b) {
    if (b.mount || b.failed || !S || noGL) return;
    withPixel(function (img) {
      if (b.mount || !img) return;
      try {
        var u = {};
        for (var k in LOOK.uniforms) u[k] = LOOK.uniforms[k];
        u.u_image = img;
        b.mount = new S.ShaderMount(b.gl, S.liquidMetalFragmentShader, u, undefined, speedFor(b), LOOK.still, 2);
        b.el.classList.add("is-gl");
      } catch (err) {                                // WebGL ใช้ไม่ได้ → ขอบไล่สีนิ่งของ CSS ทำงานต่อ
        b.failed = true;
        b.el.classList.remove("is-gl");
        if (window.console) console.warn("[metal-button] shader unavailable:", err && err.message);
      }
    });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    if (!S || noGL) return;
    if (!("IntersectionObserver" in window)) { buttons.forEach(mount); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { mount(en.target.__lm); io.unobserve(en.target); }
      });
    }, { rootMargin: "300px 0px" });
    buttons.forEach(function (b) { io.observe(b.el); });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), build);
    if (!root.classList.contains("lvc-loading")) return start();
    window.addEventListener("lvc:reveal", start, { once: true });   // intro.js ส่งสัญญาณตอนเริ่มเผยหน้าเว็บ
    window.addEventListener("lvc:loaded", start, { once: true });
    setTimeout(start, 22000);                                       // กันพลาดถ้าหน้าโหลดไม่ส่งสัญญาณ
  }

  // อ่านอย่างเดียว ไว้ให้การทดสอบตรวจ
  window.__LVC_METAL = {
    get buttons() { return buttons.length; },
    get mounted() { return buttons.filter(function (b) { return !!b.mount; }).length; }
  };

  init();
})();
