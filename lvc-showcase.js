/* ============================================================================
 * LVC v9.3 — ประติมากรรม LVC เป็นตัวเอกช่วงที่สอง (lvc-showcase.js + showcase.css)
 *
 * แนวคิดจากเว็บแบรนด์นาฬิกา: สินค้าชิ้นเดียวเล่าเรื่องทั้งช่วง ขับด้วยการเลื่อนหน้า
 *   0  มาถึง     ตัวอักษรใหญ่ LOEI / VOCATIONAL / COLLEGE เลื่อนสวนกัน โมเดลหมุนจากด้านข้างมาด้านหน้า
 *   1–3 ทีละตัว   L · V · C แยกออกมาทีละตัว หมุนอวดความหนาและขอบโลหะ พลิกเปลี่ยนตัวด้วยการหมุนเป็นสันบาง
 *   4  ห้องมืด    ทุกชิ้นแยกชั้น (หน้าแดง / เนื้องาช้าง / ฐาน) เส้นโครงสร้างเรืองแสง เส้นไหมสีแชมเปญหมุนรอบ
 *   5  ประกอบกลับ ทุกชิ้นกลับเข้าที่ ปิดท้ายด้วยปุ่มสำรวจหลักสูตร
 *
 * ใช้โมเดลตัวเดียวกับหน้าแรก (window.__LVC.createSculpture) สร้างเมื่อเลื่อนเข้าใกล้เท่านั้น
 * ตอนอยู่นอกจอไม่ render · Reduced Motion = หน้าเรียงนิ่ง ไม่ตรึงจอ · ไม่มี WebGL = ภาพสำรอง
 * ปรับความยาวช่วงเลื่อนที่ LENGTH · ท่าโมเดลแต่ละช่วงอยู่ใน pose()
 * ============================================================================ */
(function () {
  "use strict";

  var L = window.__LVC;
  var story = document.querySelector("#app .story");
  if (!L || !L.gsap || !L.ScrollTrigger || !story || document.querySelector(".lvc-show")) return;

  var gsap = L.gsap, ST = L.ScrollTrigger;
  var root = document.documentElement;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // v9.4: เฉพาะจอแคบ "แนวตั้ง" ใช้ผังโมเดลบน-ข้อความล่าง · มือถือแนวนอน (สูง ~390px) ใช้ผังซ้าย-ขวาแบบคอม
  // (ผังบน-ล่างทำให้ข้อความแต่ละบทหลุดใต้จอเมื่อจอเตี้ย)
  var narrow = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
  var LENGTH = { desktop: 5.4, mobile: 4.6 };   // ความยาวช่วงเลื่อน (เท่าของความสูงจอ)
  var T = 12;                                     // ความยาวไทม์ไลน์ภายใน (หน่วยเดียวกับ pose)
  var ARROW = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';

  /* ---------- 1) โครงหน้า ---------- */
  var section = document.createElement("section");
  section.className = "lvc-show";
  section.id = "symbol";
  section.setAttribute("aria-labelledby", "lvc-show-title");
  section.innerHTML =
    '<div class="lvc-show__stage">' +
      '<div class="lvc-show__dark" aria-hidden="true"></div>' +
      '<canvas class="lvc-show__flow" aria-hidden="true"></canvas>' +
      '<svg class="lvc-show__dial" viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="lvc-dial__track" cx="50" cy="50" r="46"/>' +
        '<path class="lvc-dial__arc" d="M50 4"/>' +
        '<path class="lvc-dial__tail lvc-dial__tail--long" d="M50 4"/>' +
        '<path class="lvc-dial__tail" d="M50 4"/>' +
        '<g class="lvc-dial__dot"><circle class="lvc-dial__halo" cx="50" cy="4" r="2.6"/><circle class="lvc-dial__core" cx="50" cy="4" r="0.95"/></g>' +
      '</svg>' +
      '<div class="lvc-show__type" aria-hidden="true">' +
        '<div class="lvc-row lvc-row--1"><span>LOEI</span></div>' +
        '<div class="lvc-row lvc-row--2"><span>VOCATIONAL</span></div>' +
        '<div class="lvc-row lvc-row--3"><span>COLLEGE</span></div>' +
        '<div class="lvc-word lvc-word--1"><span>LEARN</span></div>' +
        '<div class="lvc-word lvc-word--2"><span>VOCATION</span></div>' +
        '<div class="lvc-word lvc-word--3"><span>CREATE</span></div>' +
        '<div class="lvc-num"><span>8</span></div>' +
      '</div>' +
      '<div class="lvc-show__model" aria-hidden="true">' +
        '<img class="lvc-show__poster" src="./images/sculpture-poster.webp" alt="" width="900" height="650" loading="lazy" decoding="async">' +
      '</div>' +
      '<div class="lvc-show__front" aria-hidden="true"><div class="lvc-row lvc-row--2 lvc-row--outline"><span>VOCATIONAL</span></div></div>' +
      '<div class="lvc-show__copy wrap">' +
        '<div class="lvc-ch lvc-ch--0" data-at="0">' +
          '<p class="lvc-kicker">สัญลักษณ์ของเรา</p>' +
          '<h2 id="lvc-show-title">สามตัวอักษร<br>หนึ่งเส้นทาง</h2>' +
          '<p>เลื่อนลงเพื่อดูทีละตัวอักษร</p>' +
        '</div>' +
        '<div class="lvc-ch lvc-ch--1" data-at="3.2">' +
          '<p class="lvc-kicker"><b>L</b> · LEARN</p><h3>เรียนรู้</h3>' +
          '<p>เรียนรู้จากการลงมือทำ<br>ค้นพบสิ่งที่ใช่ด้วยตัวเอง</p>' +
        '</div>' +
        '<div class="lvc-ch lvc-ch--2" data-at="5.4">' +
          '<p class="lvc-kicker"><b>V</b> · VOCATION</p><h3>ลงมือทำ</h3>' +
          '<p>คิดให้เป็น ลงมือให้จริง<br>ฝึกทักษะในวิชาชีพที่เลือกเอง</p>' +
        '</div>' +
        '<div class="lvc-ch lvc-ch--3" data-at="7.6">' +
          '<p class="lvc-kicker"><b>C</b> · CREATE</p><h3>สร้างสรรค์</h3>' +
          '<p>ทุกการเรียนรู้คืออีกก้าวของการพัฒนาตัวเอง<br>และทุกประสบการณ์เปิดโอกาสให้ไปต่อ</p>' +
        '</div>' +
        '<div class="lvc-ch lvc-ch--4" data-at="9.9">' +
          '<p class="lvc-kicker">ประกอบขึ้นจากทักษะ</p><h3>ทุกชิ้นส่วน<br>มีที่มา</h3>' +
          '<dl class="lvc-facts"><div><dt>8</dt><dd>กลุ่มสาขาวิชา</dd></div><div><dt>3</dt><dd>ระดับการศึกษา<br>ปวช. · ปวส. · ปริญญาตรี</dd></div></dl>' +
        '</div>' +
        '<div class="lvc-ch lvc-ch--5" data-at="12">' +
          '<h3>เส้นทางของคุณ<br>เริ่มที่ LVC</h3>' +
          '<p>สำรวจสาขาจากคู่มือปีการศึกษา 2569<br>แล้วสอบถามการสมัครกับวิทยาลัย</p>' +
          '<div class="lvc-actions"><a class="button" href="./programs.html">สำรวจหลักสูตร ' + ARROW + '</a>' +
          '<a class="text-link" href="./contact.html#admissions">สอบถามการสมัคร ' + ARROW + '</a></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  story.insertAdjacentElement("afterend", section);

  var $ = function (s) { return section.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(section.querySelectorAll(s)); };
  var stage = $(".lvc-show__stage"), modelBox = $(".lvc-show__model"), poster = $(".lvc-show__poster");
  var darkLayer = $(".lvc-show__dark"), flowCanvas = $(".lvc-show__flow"), dial = $(".lvc-show__dial");
  var chapters = $$(".lvc-ch");

  /* ---------- 2) คณิตเล็ก ๆ ---------- */
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var unit = function (a, b, t) { return clamp((t - a) / (b - a), 0, 1); };
  var smooth = function (a, b, t) { var x = unit(a, b, t); return x * x * (3 - 2 * x); };
  var easeIn = function (a, b, t) { var x = unit(a, b, t); return x * x * x; };
  var easeOut = function (a, b, t) { var x = 1 - unit(a, b, t); return 1 - x * x * x; };

  /* ---------- 3) ท่าโมเดลตามเวลาไทม์ไลน์ t (0–12) ----------
   * ค่าตำแหน่งบนจอเป็นสัดส่วนของกรอบ (fx: ซ้าย-ขวา, fy: ขึ้น-ลง) · ax/ay = จุดในตัวโมเดลที่วางตรงตำแหน่งนั้น
   * ตัวอักษร: L x≈-2.07, V x≈-0.15, C x≈1.99 (หน่วยของโมเดล ก่อนขยาย) */
  var CENTER = [{ x: -2.07, y: 1.31 }, { x: -0.145, y: 1.31 }, { x: 1.985, y: 1.31 }];
  var LAYOUT = {
    desktop: { arrive: [0, -0.01, 1.0], solo: [0.17, -0.035, 1.72], burst: [0.12, -0.04, 0.66], end: [0.2, -0.01, 0.82] },
    mobile: { arrive: [0, 0.13, 1.0], solo: [0, 0.14, 2.25], burst: [0, 0.15, 0.76], end: [0, 0.16, 0.98] }
  };
  var EXPLODE = { dx: [-1.55, 0, 1.55], dy: [0.38, 0.7, 0.38], yaw: [0.16, -0.1, 0.18] };
  var SOLO_START = [2.6, 4.8, 7.0];   // ช่วงเดี่ยวของ L / V / C ยาว 1.6 หน่วย

  function pose(t, m) {
    var P = {
      yaw: -0.3, pitch: 0, scale: m.arrive[2], fx: m.arrive[0], fy: m.arrive[1], ax: 0.03, ay: 1.1,
      solo: -1, letters: [0, 1, 2].map(function () { return { dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0 }; }),
      face: 0, baseU: 0, baseH: 0, base: true, shadow: 1, edges: 0, dark: 0
    };
    var k, i;
    if (t < 2) {                                                  // 0 มาถึง: จากด้านข้างหมุนมาด้านหน้า
      k = smooth(0, 1.75, t);
      P.yaw = lerp(-1.45, -0.3, k) + Math.max(0, t - 1.75) * 0.12;
      P.scale = lerp(0.86, 1, k) * m.arrive[2];
      return P;
    }
    if (t < 2.6) {                                                // เข้าสู่ L: V/C หมุนเป็นสันแล้วหาย ฐานร่วง
      k = smooth(2, 2.6, t);
      P.yaw = lerp(-0.24, 0, k);
      P.letters[0].yaw = lerp(0, -0.55, k);
      var spin = easeIn(2, 2.3, t) * 1.57;
      P.letters[1].yaw = spin; P.letters[2].yaw = spin;
      if (t >= 2.3) P.solo = 0;
      P.baseU = P.baseH = -7 * easeIn(2, 2.36, t);
      P.base = t < 2.36;
      P.shadow = 1 - smooth(2, 2.25, t);
      P.scale = lerp(m.arrive[2], m.solo[2], k);
      P.fx = lerp(m.arrive[0], m.solo[0], k); P.fy = lerp(m.arrive[1], m.solo[1], k);
      P.ax = lerp(0.03, CENTER[0].x, k); P.ay = lerp(1.1, CENTER[0].y, k);
      return P;
    }
    if (t < 8.85) {                                               // 1–3 ทีละตัว + พลิกเปลี่ยนตัว
      var idx = 0;
      for (i = 0; i < 3; i += 1) if (t >= SOLO_START[i] - 0.3) idx = i;
      var s0 = SOLO_START[idx], letter = P.letters[idx], yaw;
      if (t < s0) yaw = lerp(-1.57, -0.55, easeOut(s0 - 0.3, s0, t));               // พลิกเข้า
      else if (t <= s0 + 1.6) yaw = lerp(-0.55, 0.55, unit(s0, s0 + 1.6, t));        // หมุนช้าตามการเลื่อน
      else yaw = lerp(0.55, 1.57, easeIn(s0 + 1.6, s0 + 1.9, t));                    // พลิกออก
      letter.yaw = yaw;
      letter.pitch = Math.sin((t - s0) * 1.4) * 0.035;
      P.solo = idx; P.base = false; P.shadow = 0; P.yaw = 0;
      P.scale = m.solo[2] * (1 + 0.07 * unit(s0, s0 + 1.6, t));
      if (idx === 2) P.scale *= lerp(1, 0.6, easeIn(8.6, 8.85, t));   // C พลิกออกพร้อมถอยกล้อง
      P.fx = m.solo[0]; P.fy = m.solo[1]; P.ax = CENTER[idx].x; P.ay = CENTER[idx].y;
      if (t >= 8.6) P.dark = smooth(8.6, 9.05, t);
      return P;
    }
    // 4 ห้องมืด: แยกชั้น → 5 ประกอบกลับ
    var into = smooth(8.85, 9.45, t);                    // เข้าท่าแยกชิ้น
    var back = smooth(10.6, 11.35, t);                   // ประกอบกลับ
    var open = into * (1 - back);
    var drift = unit(9.45, 10.6, t);
    P.dark = smooth(8.6, 9.05, t) * (1 - smooth(10.6, 11.15, t));
    P.edges = smooth(8.95, 9.45, t) * (1 - smooth(10.55, 11.0, t));
    P.face = smooth(9.05, 9.65, t) * (1 - smooth(10.6, 11.1, t)) * 0.95;
    for (i = 0; i < 3; i += 1) {
      var start = i === 1 ? 1.57 : -1.57;               // ชิ้นที่กลับเข้ามาเริ่มจากสันบาง
      var l = P.letters[i];
      l.dx = EXPLODE.dx[i] * open;
      l.dy = EXPLODE.dy[i] * open;
      l.yaw = lerp(start, EXPLODE.yaw[i] + Math.sin(drift * 3 + i) * 0.12, into) * (1 - back);
    }
    P.baseU = lerp(-6, -0.44, into) * (1 - back);
    P.baseH = lerp(-6, -0.98, into) * (1 - back);
    P.shadow = back;
    var burstScale = m.burst[2], endScale = m.end[2];
    var fromSolo = 1 - easeOut(8.85, 9.3, t);          // ถอยกล้องออกก่อน ชิ้นส่วนค่อยหมุนเข้าที่
    P.scale = lerp(lerp(burstScale, m.solo[2] * 1.07 * 0.6, fromSolo), endScale, back);
    P.fx = lerp(lerp(m.burst[0], m.solo[0], fromSolo), m.end[0], back);
    P.fy = lerp(lerp(m.burst[1], m.solo[1], fromSolo), m.end[1], back);
    P.ax = lerp(lerp(0.03, CENTER[2].x, fromSolo), 0.03, back);
    P.ay = lerp(lerp(1.2, CENTER[2].y, fromSolo), 1.1, back);
    P.yaw = lerp(lerp(-0.92, -0.5, drift) * into, -0.42, back) + Math.max(0, t - 11.35) * 0.1;
    P.pitch = 0.16 * open;
    return P;
  }

  /* ---------- 4) โมเดล 3D ---------- */
  var sculpt = null, rig = null, near = false, onScreen = false, lastKey = "";

  function buildRig(s) {
    var tilt = s.root.children[0];
    var group = tilt && tilt.children[0];
    if (!group || group.children.length < 9) throw new Error("Unexpected sculpture structure");
    var letters = [0, 1, 2].map(function (i) {
      var body = group.children[i * 3], face = group.children[i * 3 + 1], edges = group.children[i * 3 + 2];
      body.geometry.computeBoundingBox();
      var box = body.geometry.boundingBox;
      var center = body.position.clone();
      center.x += (box.min.x + box.max.x) / 2;
      center.y += (box.min.y + box.max.y) / 2;
      center.z += (box.min.z + box.max.z) / 2;
      return {
        meshes: [body, face, edges],
        origin: [body.position.clone(), face.position.clone(), edges.position.clone()],
        center: center
      };
    });
    return {
      root: s.root, group: group, top: tilt.children[1], base: tilt.children[2], shadow: s.root.children[1],
      letters: letters, edges: letters[0].meshes[2].material,
      euler: letters[0].meshes[0].rotation.clone(), v: letters[0].center.clone(), off: letters[0].center.clone(),
      rim: s.lights && s.lights.rim, hemi: s.root.parent && s.root.parent.children.filter(function (o) { return o.isHemisphereLight; })[0],
      shadowBase: s.root.children[1].material.opacity
    };
  }

  function layoutFor() {
    var cam = sculpt.camera;
    var W = cam.right - cam.left, H = cam.top - cam.bottom;
    var mobile = narrow.matches;
    var k0 = Math.min((mobile ? 0.82 : 0.62) * W / 6.7, 0.5 * H / 2.95);
    var base = mobile ? LAYOUT.mobile : LAYOUT.desktop;
    var scaled = {};
    Object.keys(base).forEach(function (key) { scaled[key] = [base[key][0], base[key][1], base[key][2] * k0]; });
    return { W: W, H: H, m: scaled, cx: (cam.left + cam.right) / 2, cy: (cam.top + cam.bottom) / 2 };
  }

  function applyPose(P) {
    var r = rig, lay = layoutFor();
    var x = lay.cx + P.fx * lay.W - P.ax * P.scale * Math.cos(P.yaw);
    var y = 0.85 + (lay.cy + P.fy * lay.H) / 0.959 - P.ay * P.scale;
    r.root.position.set(x, y, 0);
    r.root.rotation.set(P.pitch, P.yaw, 0);
    r.root.scale.setScalar(Math.max(P.scale, 0.0001));
    r.applied = [x, y, P.yaw, P.scale];
    r.group.position.set(0, 0, 0);
    r.letters.forEach(function (letter, i) {
      var st = P.letters[i], show = P.solo < 0 || P.solo === i;
      r.euler.set(st.pitch, st.yaw, 0);
      r.off.set(st.dx, st.dy, st.dz);
      letter.meshes.forEach(function (mesh, j) {
        mesh.visible = show;
        r.v.copy(letter.origin[j]).sub(letter.center);
        if (j === 1) r.v.z += P.face;
        r.v.applyEuler(r.euler).add(letter.center).add(r.off);
        mesh.position.copy(r.v);
        mesh.rotation.copy(r.euler);
      });
    });
    r.top.visible = r.base.visible = P.base;
    r.top.position.y = P.baseU;
    r.base.position.y = P.baseH;
    r.shadow.visible = P.shadow > 0.01;
    r.shadow.material.opacity = r.shadowBase * P.shadow;
    r.edges.opacity = 0.7 * P.edges;
    if (r.rim) r.rim.intensity = 2.4 + P.dark * 1.8;
    if (r.hemi) r.hemi.intensity = 1.5 - P.dark * 0.55;
    sculpt.invalidate();
  }

  /* ---------- 5) เส้นไหมหมุนรอบโมเดลในห้องมืด ----------
   * อนุภาคแบ่งเป็นแถบวงโคจร 5 แถบ แต่ละแถบโค้งพลิ้วด้วยจังหวะเดียวกัน เส้นจึงรวมเป็นริบบิ้นแทนเส้นยุ่ง ๆ */
  var BANDS = [
    { r: 0.2, w: 0.2, amp: 0.035, ph: 0.0, red: false },
    { r: 0.27, w: 0.16, amp: 0.05, ph: 1.7, red: false },
    { r: 0.34, w: 0.13, amp: 0.06, ph: 3.1, red: true },
    { r: 0.42, w: 0.11, amp: 0.055, ph: 4.4, red: false },
    { r: 0.5, w: 0.09, amp: 0.07, ph: 5.6, red: false }
  ];
  var TILT = -0.2, COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT);
  var flow = { ctx: null, parts: [], w: 0, h: 0, raf: 0, on: false, cx: 0.5, cy: 0.5, last: 0 };
  function sizeFlow() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var box = stage.getBoundingClientRect();
    flow.w = Math.max(1, box.width); flow.h = Math.max(1, box.height);
    flowCanvas.width = Math.round(flow.w * dpr); flowCanvas.height = Math.round(flow.h * dpr);
    flow.ctx = flowCanvas.getContext("2d");
    if (flow.ctx) { flow.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); flow.ctx.lineCap = "round"; }
    var count = narrow.matches ? 300 : 640;
    flow.parts = [];
    for (var i = 0; i < count; i += 1) flow.parts.push(seedPart({ band: BANDS[i % BANDS.length] }));
  }
  function seedPart(p) {
    p.j = (Math.random() - 0.5) * 0.03;
    p.a = Math.random() * Math.PI * 2;
    p.x = null;
    p.life = 3 + Math.random() * 6;
    return p;
  }
  function stepFlow(now) {
    flow.raf = 0;
    if (!flow.on || !flow.ctx) return;
    // เวลาสะสมแบบจำกัดช่วงต่อเฟรม: เครื่องช้าเห็นเส้นไหลช้าลง แต่ไม่กระโดดเป็นเส้นหยัก
    var ctx = flow.ctx, dt = Math.min(1 / 30, (now - (flow.last || now)) / 1000);
    flow.last = now;
    flow.time = (flow.time || 0) + dt;
    var time = flow.time;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(0, 0, flow.w, flow.h);
    ctx.globalCompositeOperation = "source-over";
    var U = Math.min(flow.w * 0.62, flow.h), cx = flow.cx * flow.w, cy = flow.cy * flow.h;
    ctx.lineWidth = narrow.matches ? 0.8 : 1;
    ctx.strokeStyle = "rgba(226,208,166,0.2)";
    ctx.beginPath();
    var reds = [];
    flow.parts.forEach(function (p) {
      var b = p.band;
      p.life -= dt;
      if (p.life <= 0) seedPart(p);
      p.a += b.w * dt * (1 + p.j * 6);
      var rr = (b.r + p.j + b.amp * Math.sin(p.a * 2 + b.ph + time * 0.32) + 0.02 * Math.sin(p.a * 5 - time * 0.55 + b.ph)) * U;
      var ex = Math.cos(p.a) * rr * 1.45, ey = Math.sin(p.a) * rr * 0.5;
      var nx = cx + ex * COS_T - ey * SIN_T, ny = cy + ex * SIN_T + ey * COS_T;
      if (p.x !== null) {
        if (b.red) reds.push(p.x, p.y, nx, ny);
        else { ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); }
      }
      p.x = nx; p.y = ny;
    });
    ctx.stroke();
    if (reds.length) {
      ctx.strokeStyle = "rgba(205,70,86,0.26)";
      ctx.beginPath();
      for (var i = 0; i < reds.length; i += 4) { ctx.moveTo(reds[i], reds[i + 1]); ctx.lineTo(reds[i + 2], reds[i + 3]); }
      ctx.stroke();
    }
    flow.raf = requestAnimationFrame(stepFlow);
  }
  function setFlow(level, cx, cy) {
    flowCanvas.style.opacity = level.toFixed(3);
    flow.cx = cx; flow.cy = cy;
    var want = level > 0.02 && onScreen && !motion.matches;
    if (want && !flow.on) {
      if (!flow.ctx) sizeFlow();
      flow.on = true; flow.last = 0;
      if (!flow.raf) flow.raf = requestAnimationFrame(stepFlow);
    } else if (!want && flow.on) {
      flow.on = false;
      if (flow.raf) cancelAnimationFrame(flow.raf);
      flow.raf = 0;
      if (flow.ctx) flow.ctx.clearRect(0, 0, flow.w, flow.h);
    }
  }

  /* ---------- 6) ไทม์ไลน์ข้อความ (เลื่อนแล้วเล่นตาม) ---------- */
  var tl = null, trigger = null, active = -1;
  var ranges = [[0, 2.05], [2.6, 4.3], [4.8, 6.5], [7.0, 8.7], [9.15, 10.75], [11.2, 12.01]];

  function buildTimeline() {
    tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
    tl.to({}, { duration: T }, 0);
    var rows = $$(".lvc-show__type .lvc-row--1, .lvc-show__type .lvc-row--2, .lvc-show__type .lvc-row--3");
    var outline = $(".lvc-row--outline");
    tl.fromTo(rows[0], { xPercent: -7 }, { xPercent: 7, ease: "none", duration: 2.6 }, 0)
      .fromTo([rows[1], outline], { xPercent: 9 }, { xPercent: -9, ease: "none", duration: 2.6 }, 0)
      .fromTo(rows[2], { xPercent: -5 }, { xPercent: 6, ease: "none", duration: 2.6 }, 0)
      .to(rows.concat(outline), { opacity: 0, duration: 0.45, ease: "power1.in" }, 2.0);

    // v10: เส้นวงกลมและจุดไม่ใช้ tween แยกกันแล้ว — setDial() ใน tick() วาดทั้งสองจากมุมเดียวกัน
    tl.to(dial, { opacity: 0, duration: 0.35 }, 2.0)
      // ค่าตำแหน่งเป็นฟังก์ชัน: คำนวณใหม่ทุกครั้งที่ ScrollTrigger refresh (หมุนจอ) ไม่ค้างผังเดิม
      .fromTo(dial, { left: "50%", top: function () { return narrow.matches ? "38%" : "50%"; } },
        { left: function () { return narrow.matches ? "50%" : "70%"; }, top: function () { return narrow.matches ? "36%" : "50%"; }, duration: 0.01 }, 10.9)
      .to(dial, { opacity: 1, duration: 0.6 }, 11.2);

    $$(".lvc-word").forEach(function (word, i) {
      var s = SOLO_START[i];
      tl.fromTo(word, { opacity: 0, xPercent: 10 }, { opacity: 1, xPercent: 2, duration: 0.45 }, s - 0.3)
        .to(word, { xPercent: -6, ease: "none", duration: 1.6 }, s + 0.15)
        .to(word, { opacity: 0, duration: 0.3, ease: "power1.in" }, s + 1.55);
    });
    tl.fromTo(".lvc-num", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5 }, 9.0)
      .to(".lvc-num", { yPercent: -6, ease: "none", duration: 1.3 }, 9.4)
      .to(".lvc-num", { opacity: 0, duration: 0.35 }, 10.5);

    chapters.forEach(function (ch, i) {
      var r = ranges[i];
      if (i === 0) {
        tl.to(ch, { opacity: 0, y: -24, duration: 0.35, ease: "power1.in" }, 1.7);
        return;
      }
      tl.fromTo(ch, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.45 }, r[0] + 0.05);
      if (i < chapters.length - 1) tl.to(ch, { opacity: 0, y: -26, duration: 0.3, ease: "power1.in" }, r[1] - 0.3);
    });
  }

  function length() { return (narrow.matches ? LENGTH.mobile : LENGTH.desktop) * window.innerHeight; }

  /* ---------- วงหน้าปัด: เส้นกับจุดใช้มุมเดียวกันทุกเฟรม ----------
   * v10 แก้บัค: เดิมเส้นวาดด้วย stroke-dasharray + pathLength ส่วนจุดหมุนด้วย tween อีกตัว (330° แต่เส้น 317°)
   * บน Safari/iPad ความยาวเส้นแบบ pathLength + non-scaling-stroke คำนวณไม่ตรง เส้นจึงไม่ลากตามจุด
   * ตอนนี้คำนวณมุมจากเวลาไทม์ไลน์ (ซึ่งลื่นอยู่แล้วจาก scrub) แล้ววาดเส้นเป็น path โค้งที่ปลายอยู่ใต้จุดพอดี */
  var dialArc = $(".lvc-dial__arc"), dialTails = $$(".lvc-dial__tail"), dialDots = $$(".lvc-dial__dot circle"), dialDeg = -1;
  function dialPoint(a) { var q = (a - 90) * Math.PI / 180; return [50 + 46 * Math.cos(q), 50 + 46 * Math.sin(q)]; }
  function arcPath(a0, a1) {                         // องศาตามเข็มนาฬิกา นับจาก 12 นาฬิกา
    if (a1 - a0 < 0.05) return "M50 4";
    var f = function (a) { var p = dialPoint(a); return p[0].toFixed(3) + " " + p[1].toFixed(3); };
    if (a1 - a0 >= 359.95) return "M" + f(a0) + "A46 46 0 1 1 " + f(a0 + 180) + "A46 46 0 1 1 " + f(a0 + 359.9);
    return "M" + f(a0) + "A46 46 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + f(a1);
  }
  function dialAngle(t) {
    if (t >= 11.2) { var k = Math.min(1, (t - 11.2) / 0.8); return 360 * (1 - (1 - k) * (1 - k)); }   // บทสุดท้าย: วาดครบวง
    return 330 * Math.max(0, Math.min(1, t / 2.2));                                                  // บทแรก: 0 → 330°
  }
  function setDial(t) {
    var deg = Math.round(dialAngle(t) * 20) / 20;
    if (deg === dialDeg) return;
    dialDeg = deg;
    dialArc.setAttribute("d", arcPath(0, deg));
    dialTails[0].setAttribute("d", arcPath(Math.max(0, deg - 36), deg));
    dialTails[1].setAttribute("d", arcPath(Math.max(0, deg - 14), deg));
    var p = dialPoint(deg), x = p[0].toFixed(3), y = p[1].toFixed(3);
    dialDots.forEach(function (c) { c.setAttribute("cx", x); c.setAttribute("cy", y); });
  }

  // v10: ตัวเลข 8 กลุ่มสาขา · 3 ระดับ นับขึ้นตอนห้องมืดปรากฏ (ค่าสุดท้ายตรงกับข้อมูลเดิมเสมอ)
  var facts = $$(".lvc-facts dt").map(function (dt) { return { el: dt, to: parseInt(dt.textContent, 10) || 0 }; });
  var countRaf = 0;
  function settleFacts() { cancelAnimationFrame(countRaf); countRaf = 0; facts.forEach(function (f) { f.el.textContent = String(f.to); }); }
  function countUp() {
    if (motion.matches || !facts.length) return settleFacts();
    cancelAnimationFrame(countRaf);
    var start = performance.now();
    (function step(now) {
      var k = Math.min(1, Math.max(0, (now - start) / 950)), e = 1 - Math.pow(1 - k, 3);
      facts.forEach(function (f) { f.el.textContent = String(Math.round(f.to * e)); });
      countRaf = k < 1 ? requestAnimationFrame(step) : 0;
    })(start);
  }
  function setActive(t) {
    var now = -1;
    ranges.forEach(function (r, i) { if (t >= r[0] && t < r[1]) now = i; });
    if (now === active) return;
    if (active === 4) settleFacts();
    if (now === 4) countUp();
    active = now;
    chapters.forEach(function (ch, i) { ch.classList.toggle("is-active", i === now); });
  }

  var model = null, isStatic = false;
  function staticPose(lay) {
    var P = pose(12, lay.m);
    P.fx = 0; P.fy = 0; P.scale = lay.m.arrive[2] * 0.9; P.yaw = -0.36;
    return P;
  }
  // โมเดลจัดท่าของหน้าแรกเองทุกครั้งที่กรอบเปลี่ยนขนาด (ResizeObserver ภายใน) → ตรวจแล้วจัดท่าของเราใหม่
  function overridden() {
    var a = rig && rig.applied;
    if (!a) return true;
    var p = rig.root.position;
    return Math.abs(p.x - a[0]) > 1e-6 || Math.abs(p.y - a[1]) > 1e-6 || Math.abs(rig.root.rotation.y - a[2]) > 1e-6;
  }
  function tick() {
    if (sculpt && rig && model && overridden()) model.dirty = true;
    if (isStatic) {
      if (sculpt && rig && near && model && model.dirty) { model.dirty = false; applyPose(staticPose(layoutFor())); }
      return;
    }
    if (!tl) return;
    var t = tl.time();
    setActive(t);
    setDial(t);
    var lay = sculpt ? layoutFor() : null;
    var P = pose(t, lay ? lay.m : LAYOUT[narrow.matches ? "mobile" : "desktop"]);
    // ห้องมืดเปิดเป็นวงจากตัวโมเดลแบบม่านตากล้อง แทนการจางผ่านสีเทา
    var iris = P.dark <= 0.001 ? "circle(0% at 50% 50%)" :
      "circle(" + (P.dark * 150).toFixed(2) + "% at " + (50 + P.fx * 100).toFixed(1) + "% " + (50 - P.fy * 100).toFixed(1) + "%)";
    darkLayer.style.clipPath = flowCanvas.style.clipPath = iris;
    darkLayer.style.visibility = P.dark > 0.001 ? "visible" : "hidden";
    stage.classList.toggle("is-dark", P.dark > 0.5);
    setFlow(P.dark > 0.001 ? 1 : 0, 0.5 + P.fx, 0.5 - P.fy * 1.0);
    if (!sculpt || !rig || !near) return;
    var key = t.toFixed(4) + "|" + lay.W.toFixed(3) + "|" + lay.H.toFixed(3);
    if (key === lastKey && !model.dirty) return;
    lastKey = key; model.dirty = false;
    applyPose(P);
  }

  function makeStatic() {
    isStatic = true;
    if (model) model.dirty = true;
    section.classList.add("is-static");
    if (trigger) { trigger.kill(true); trigger = null; }
    if (tl) { tl.progress(1).kill(); tl = null; }
    setFlow(0, 0.5, 0.5);
    darkLayer.style.visibility = "hidden";
    stage.classList.remove("is-dark");
    chapters.forEach(function (ch) { ch.style.opacity = ""; ch.style.transform = ""; ch.classList.add("is-active"); });
    ST.refresh();
  }

  /* ---------- 7) สร้างโมเดลเมื่อใกล้ถึง ---------- */
  function createModel() {
    if (model || !L.createSculpture) return;
    model = { dirty: true };
    L.createSculpture(modelBox).then(function (s) {
      sculpt = s;
      try { rig = buildRig(s); }
      catch (error) { s.dispose(); sculpt = null; section.classList.add("no-gl"); return; }
      // createSculpture วาดเฟรมแรกก่อนส่งค่ากลับ (sculpture-ready เกิดไปแล้ว) จึงซ่อนภาพสำรองตรงนี้
      modelBox.addEventListener("sculpture-error", function () { section.classList.remove("has-gl"); section.classList.add("no-gl"); }, { once: true });
      section.classList.add("has-gl");
      model.dirty = true;
      if (section.classList.contains("is-static")) makeStatic();
      else tick();
    }).catch(function () { section.classList.add("no-gl"); });
  }

  var watch = new IntersectionObserver(function (entries) {
    near = entries[0].isIntersecting;
    if (near) {
      if (!root.classList.contains("lvc-loading")) createModel();
      model && (model.dirty = true);
      tick();
    } else setFlow(0, 0.5, 0.5);
  }, { rootMargin: "120% 0px 120% 0px" });
  watch.observe(section);
  new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; }).observe(stage);
  // กรอบโมเดลเปลี่ยนขนาด (หมุนจอ / แถบเบราว์เซอร์มือถือ / โหมดนิ่ง) → จัดท่าใหม่หลังโมเดลคำนวณกล้องแล้ว
  if (window.ResizeObserver) new ResizeObserver(function () { if (model) model.dirty = true; }).observe(modelBox);
  window.addEventListener("lvc:loaded", function () { if (near) createModel(); }, { once: true });
  window.addEventListener("resize", function () {
    if (model) model.dirty = true;
    if (flow.ctx) { flow.ctx = null; if (flow.on) { flow.on = false; setFlow(parseFloat(flowCanvas.style.opacity) || 0, flow.cx, flow.cy); } }
  });

  /* ---------- 8) ตรึงจอ + เลื่อนตาม ---------- */
  if (motion.matches) {
    makeStatic();
  } else {
    buildTimeline();
    trigger = ST.create({
      trigger: section,
      start: "top top",
      end: function () { return "+=" + length(); },
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.9,
      invalidateOnRefresh: true,
      refreshPriority: -1,
      animation: tl
    });
    tick();
  }
  gsap.ticker.add(tick, false, true);       // ก่อนตัว render ของโมเดล
  if (motion.addEventListener) motion.addEventListener("change", function () { if (motion.matches) makeStatic(); });

  // แป้นพิมพ์: โฟกัสลิงก์ในบทที่ยังไม่แสดง → เลื่อนไปยังบทนั้นก่อน
  $(".lvc-show__copy").addEventListener("focusin", function (event) {
    var ch = event.target.closest(".lvc-ch");
    if (!ch || !trigger || ch.classList.contains("is-active")) return;
    var at = parseFloat(ch.getAttribute("data-at")) || 0;
    window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * (at / T), behavior: "instant" });
  });

  window.__LVC_SHOWCASE = {
    get time() { return tl ? tl.time() : null; },
    get ready() { return !!rig; },
    get trigger() { return trigger; },
    get debug() { return { root: rig ? [rig.root.position.x, rig.root.position.y, rig.root.rotation.y, rig.root.scale.x] : null, isStatic: isStatic, near: near, dirty: !!(model && model.dirty) }; },
    pose: pose
  };
  requestAnimationFrame(function () { ST.refresh(); });
})();
