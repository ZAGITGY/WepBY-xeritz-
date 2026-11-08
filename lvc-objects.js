/* ============================================================================
 * lvc-objects.js — โมเดล 3D ประจำ 8 กลุ่มสาขา + หมุดวิทยาลัยหน้าติดต่อ (v12 · 2026-11-05)
 *
 * โมเดลทุกชิ้นสร้างด้วยโค้ด (ไม่มีไฟล์โมเดลให้โหลด) ใช้วัสดุชุดเดียวกับประติมากรรม LVC
 *   งาช้าง/กระเบื้อง · แดงลงรัก · โลหะแชมเปญ + สีประจำกลุ่มสาขา 1 สี
 *     01 บริหารธุรกิจ        กราฟแท่ง เหรียญ ลูกศรขึ้น      (อำพัน)
 *     02 ดิจิทัลฯ            แล็ปท็อป จอโค้ด ลูกบาศก์ลอย    (ไพลิน)
 *     03 ศิลปกรรมฯ           ปลายปากกาวาดเส้น + เส้นโค้งเบซิเยร์ (ชมพูกล้วยไม้)
 *     04 คหกรรม              กาน้ำชา ถ้วยชา จานรอง          (กุหลาบ)
 *     05 ท่องเที่ยว/โรงแรม     กระดิ่งโรงแรม เครื่องบินกระดาษ  (หยก)
 *     06 อาหาร               ชามแดง ตะเกียบ ไอร้อน          (ส้มลูกพลับ)
 *     07 แฟชั่นสิ่งทอ          หุ่นลองเสื้อ สายวัด หลอดด้าย     (อเมทิสต์)
 *     08 โลจิสติกส์           กล่องพัสดุบนพาเลท ลูกศรวน       (ฟ้าทะเล)
 *
 * วางไว้ 4 ที่ (แต่ละที่มี WebGL ของตัวเอง สร้างเมื่อใกล้เข้าจอ ทิ้งเมื่อห่างเกิน 2 จอ):
 *   1) หน้าแรก ช่วงหลักสูตร: "ตู้โชว์" แทนภาพถ่ายเดิม (ภาพถ่ายย่อเป็นการ์ดมุมล่าง)
 *      ชี้/โฟกัสรายการสาขา → เปลี่ยนโมเดล · เลื่อนหน้า (จอใหญ่) → ตามสาขาที่อยู่กลางจอ · มือถือเปลี่ยนเองทุก ~4 วิ
 *      ลากเพื่อหมุน
 *   2) หน้าหลักสูตร หัวหน้า: วงหมุนโมเดลทั้ง 8 ชิ้น มีปุ่มก่อนหน้า/ถัดไป และลิงก์ไปยังสาขา (แทนริบบิ้น)
 *   3) หน้าติดต่อ หัวหน้า: ภูมิประเทศภูเขาแบบเส้นชั้นความสูง (ภาพประกอบ ไม่ใช่แผนที่จริง)
 *      กับหมุดสีแดงที่มีตราวิทยาลัย (แทนริบบิ้น)
 *   4) หน้าแรก ช่วงข้อมูลสาธารณะ (จอ ≥ 901px): เอกสาร แว่นขยาย และตราประทับวิทยาลัย
 *
 * ประหยัดเครื่อง: หยุดวาดเมื่อพ้นจอ/สลับแท็บ · วัดเวลาเฟรมจริง: ช้า → ลดความละเอียด → ภาพนิ่ง
 *   Save-Data / RAM ≤ 1GB / Reduced Motion → ภาพนิ่ง ไม่หมุนเอง ไม่เปลี่ยนเอง (ปุ่มยังใช้ได้)
 *   ไม่มี WebGL / โหลด three.js ไม่ได้ → ไม่เพิ่มอะไร หน้าเว็บเหมือน v11.1
 * ปิดทั้งหมด: ลบ <script type="module" src="./lvc-objects.js"> ออกจาก HTML
 * ============================================================================ */

const THREE_URL = "./vendor/three/three.module.min.js";
const VERSION = "2026-11-06.13.0";

/* ---------- 1) ข้อมูลกลุ่มสาขา (สี) ---------- */
// acc = สีประจำกลุ่ม (ใช้ทั้งโมเดลและพื้นหลังตู้โชว์) · deep = สีพื้นเข้ม · ชื่อสาขาอ่านจากหน้าเว็บ
const PROGRAMS = [
  { slug: "business", acc: "#c98a2b", deep: "#3a2007" },
  { slug: "digital", acc: "#4672e6", deep: "#0d1a45" },
  { slug: "arts", acc: "#d44d8a", deep: "#3d0b26" },
  { slug: "home-economics", acc: "#e07482", deep: "#4a1520" },
  { slug: "tourism", acc: "#1e9e8b", deep: "#052d28" },
  { slug: "food", acc: "#e66b2e", deep: "#431705" },
  { slug: "fashion", acc: "#9259d8", deep: "#240e46" },
  { slug: "logistics", acc: "#2a93bd", deep: "#08283a" }
];
const BY_SLUG = Object.fromEntries(PROGRAMS.map((p, i) => [p.slug, { ...p, i }]));

const root = document.documentElement;
const motionQuery = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
const conn = navigator.connection;
const LITE = !!(conn && conn.saveData) || !!(navigator.deviceMemory && navigator.deviceMemory <= 1);
const isDark = () => root.getAttribute("data-theme") === "dark";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

let threePromise = null;
const loadThree = () => (threePromise ||= import(THREE_URL));
function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (_) { return false; }
}

/* ---------- 2) แสง วัสดุ และเครื่องมือสร้างรูปทรง ---------- */
// ห้องแสงจำลอง (แทน RoomEnvironment ที่ไม่ได้อยู่ใน vendor) → PMREM สำหรับเงาสะท้อนบนเคลือบเงา/โลหะ
function buildEnvScene(T) {
  const s = new T.Scene();
  const geo = new T.SphereGeometry(12, 48, 24);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const top = new T.Color(0xfff4e6), mid = new T.Color(0xcfc0ae), bot = new T.Color(0x3b2c2a);
  const c = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 12;
    if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.7)); else c.copy(mid).lerp(bot, Math.pow(-y, 0.8));
    col.set([c.r * 0.9, c.g * 0.9, c.b * 0.9], i * 3);
  }
  geo.setAttribute("color", new T.BufferAttribute(col, 3));
  s.add(new T.Mesh(geo, new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true })));
  const box = new T.BoxGeometry(1, 1, 1);
  const panel = (x, y, z, w, h, k, tint) => {
    const m = new T.MeshBasicMaterial({ color: tint || 0xffffff });
    m.color.multiplyScalar(k);
    const b = new T.Mesh(box, m);
    b.position.set(x, y, z);
    b.lookAt(0, 0, 0);
    b.scale.set(w, h, 0.1);
    s.add(b);
  };
  panel(0, 9, 3, 9, 5, 5.5);                // ซอฟต์บ็อกซ์ใหญ่ด้านบน
  panel(-8.5, 3, 5, 4, 6, 4.2);             // แถบแสงหลักซ้าย
  panel(8.5, 2.5, -3, 3, 5, 2.6, 0xffe2c4); // ขอบอุ่นขวาหลัง
  panel(0, 1.5, -9.5, 7, 3, 1.2, 0xffd8cf); // ผนังหลัง
  panel(5, -1.5, 8, 3, 1.4, 1.4);           // แสงเติมต่ำด้านหน้า
  return s;
}

function disposeTree(obj) {
  const seen = new Set();
  obj.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } }
      if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } }
      m.dispose();
    });
  });
}

// "ห้องแล็บ" ต่อ 1 renderer: แผนที่แสง + วัสดุใช้ร่วม + เครื่องมือรูปทรง
function createLab(T, renderer) {
  const pm = new T.PMREMGenerator(renderer);
  const envScene = buildEnvScene(T);
  const envRT = pm.fromScene(envScene, 0.035);
  pm.dispose();
  disposeTree(envScene);

  const owned = [];
  const keep = (x) => (owned.push(x), x);
  const M = {
    ivory: keep(new T.MeshPhysicalMaterial({ color: 0xf2e9da, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 })),
    porcelain: keep(new T.MeshPhysicalMaterial({ color: 0xfbf7ef, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 })),
    red: keep(new T.MeshPhysicalMaterial({ color: 0xa3122a, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 })),
    gold: keep(new T.MeshStandardMaterial({ color: 0xd9bd85, metalness: 1, roughness: 0.27 })),
    mirror: keep(new T.MeshStandardMaterial({ color: 0xe6cf9f, metalness: 1, roughness: 0.12 })),
    ink: keep(new T.MeshStandardMaterial({ color: 0x231b1f, metalness: 0.35, roughness: 0.42 })),
    kraft: keep(new T.MeshStandardMaterial({ color: 0xcda575, roughness: 0.82 })),
    linen: keep(new T.MeshPhysicalMaterial({ color: 0xeee3d1, roughness: 0.78, sheen: 1, sheenColor: new T.Color(0xffffff), sheenRoughness: 0.45 })),
    steam: keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }))
  };
  const accent = (hex, rough = 0.26) => keep(new T.MeshPhysicalMaterial({ color: hex, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.09 }));
  const glow = (hex) => keep(new T.MeshBasicMaterial({ color: hex, toneMapped: false }));

  // เงาสัมผัสพื้นแบบนุ่ม (ไม่ใช้ shadow map เพื่อประหยัดเครื่อง)
  const sc = document.createElement("canvas");
  sc.width = sc.height = 128;
  const g = sc.getContext("2d");
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, "rgba(40,18,20,.55)");
  rg.addColorStop(0.45, "rgba(40,18,20,.22)");
  rg.addColorStop(1, "rgba(40,18,20,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const shadowTex = keep(new T.CanvasTexture(sc));
  shadowTex.colorSpace = T.SRGBColorSpace;
  const shadowMat = keep(new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  const shadowGeo = keep(new T.PlaneGeometry(1, 1));

  /* เครื่องมือรูปทรง */
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const roundRect = (w, h, r) => {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  // กล่องขอบมน: w × h × d (แกน z = ความลึก)
  const rbox = (w, h, d, r = 0.05) => {
    r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    const geo = new T.ExtrudeGeometry(roundRect(w - 2 * r, h - 2 * r, r * 0.9), {
      depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 6
    });
    geo.center();
    return geo;
  };
  // ผิวหมุนรอบแกน y จากเส้นโค้ง [รัศมี, สูง] (ผ่าน Catmull-Rom ให้เนียน)
  const lathe = (pts, seg = 64, div = 48) => {
    const curve = new T.SplineCurve(pts.map(([x, y]) => new T.Vector2(x, y)));
    const list = curve.getPoints(div).map((p) => new T.Vector2(Math.max(0.0005, p.x), p.y));
    return new T.LatheGeometry(list, seg);
  };
  const tube = (pts, r, seg = 80, closed = false) =>
    new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, y, z]) => new T.Vector3(x, y, z)), closed, "catmullrom", 0.5), seg, r, 14, closed);
  // หัวลูกศรวางที่ปลายเส้นตามทิศเส้น
  const arrowHead = (pts, mat, r = 0.09, h = 0.22) => {
    const curve = new T.CatmullRomCurve3(pts.map(([x, y, z]) => new T.Vector3(x, y, z)));
    const end = curve.getPoint(1), tan = curve.getTangent(1).normalize();
    const m = new T.Mesh(new T.ConeGeometry(r, h, 32), mat);
    m.position.copy(end).addScaledVector(tan, h * 0.4);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tan);
    return m;
  };
  const shadow = (w, d, y, k = 1) => {
    const m = new T.Mesh(shadowGeo, shadowMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.position.y = y;
    m.material.opacity = k;
    m.renderOrder = -1;
    return m;
  };

  return {
    T, M, accent, glow, mesh, rbox, lathe, tube, arrowHead, shadow, roundRect,
    env: envRT.texture,
    dispose() { owned.forEach((x) => x.dispose && x.dispose()); envRT.dispose(); }
  };
}

/* ---------- 3) โมเดลประจำกลุ่มสาขา ----------
 * แต่ละฟังก์ชันคืน { group, update(t) } · ขนาดไม่ต้องเป๊ะ fit() ย่อ/ขยายและจัดกึ่งกลางให้
 * ทุกชิ้นวางบนพื้นที่ y ≈ ต่ำสุดของโมเดล (มีเงานุ่มรองใต้) */
const BUILD = {
  business(K, acc) {
    const { T, M, mesh, rbox, tube, arrowHead, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc);
    g.add(mesh(rbox(1.8, 0.12, 1.15, 0.05), M.ivory, 0, -0.66, 0));
    g.add(mesh(rbox(1.62, 0.02, 0.98, 0.008), M.gold, 0, -0.595, 0));
    const bars = [];
    [[0.46, M.porcelain], [0.78, A], [1.16, M.red]].forEach(([h, mat], i) => {
      const b = mesh(rbox(0.34, h, 0.34, 0.06), mat, -0.12 + i * 0.44, -0.585 + h / 2, -0.16);
      b.userData.h = h;
      bars.push(b);
      g.add(b);
    });
    // เหรียญซ้อน
    const coinGeo = new T.CylinderGeometry(0.27, 0.27, 0.075, 64);
    const rimGeo = new T.TorusGeometry(0.255, 0.012, 10, 64);
    for (let k = 0; k < 5; k++) {
      const c = mesh(coinGeo, M.gold, -0.6 + Math.sin(k * 2.1) * 0.025, -0.548 + k * 0.08, 0.28 + Math.cos(k * 1.7) * 0.02);
      g.add(c);
      if (k === 4) { const r = mesh(rimGeo, M.mirror, c.position.x, c.position.y + 0.04, c.position.z); r.rotation.x = Math.PI / 2; g.add(r); }
    }
    // ลูกศรขึ้น
    const path = [[-0.95, -0.2, 0.42], [-0.45, 0.02, 0.32], [-0.05, -0.02, 0.24], [0.42, 0.42, 0.16], [0.86, 0.86, 0.08]];
    const arrow = new T.Group();
    arrow.add(mesh(tube(path, 0.038, 90), M.red), arrowHead(path, M.red, 0.1, 0.24));
    g.add(arrow);
    g.add(shadow(2.6, 1.8, -0.725, 0.9));
    return {
      group: g,
      update(t) {
        bars.forEach((b, i) => {
          const s = 1 + 0.06 * Math.sin(t * 1.5 + i * 1.1);
          b.scale.y = s;
          b.position.y = -0.585 + (b.userData.h * s) / 2;
        });
        arrow.position.y = 0.03 * Math.sin(t * 1.5 + 2.4);
      }
    };
  },

  digital(K, acc) {
    const { T, M, mesh, rbox, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.2);
    g.add(mesh(rbox(1.9, 0.075, 1.25, 0.035), M.gold, 0, -0.5, 0.05));
    g.add(mesh(rbox(1.62, 0.014, 0.66, 0.006), M.ink, 0, -0.459, -0.1));
    // ปุ่มคีย์บอร์ด (แถวเล็ก ๆ)
    const keyGeo = rbox(0.1, 0.014, 0.09, 0.012);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) {
      if (r === 3 && (c < 3 || c > 9)) continue;
      g.add(mesh(keyGeo, M.porcelain, -0.72 + c * 0.12, -0.448, -0.36 + r * 0.13));
    }
    g.add(mesh(rbox(0.5, 0.01, 0.28, 0.02), M.ivory, 0, -0.459, 0.43));
    // ฝาจอ (หมุนรอบขอบหลัง)
    const hinge = new T.Group();
    hinge.position.set(0, -0.47, -0.55);
    hinge.rotation.x = -0.26;
    const lid = mesh(rbox(1.9, 1.22, 0.055, 0.03), M.gold, 0, 0.62, 0);
    hinge.add(lid);
    hinge.add(mesh(rbox(1.8, 1.1, 0.01, 0.004), M.ink, 0, 0.63, 0.03));
    // หน้าจอ: แคนวาสวาดบรรทัดโค้ดด้วยสีประจำกลุ่ม
    const cv = document.createElement("canvas");
    cv.width = 640; cv.height = 384;
    const x = cv.getContext("2d");
    const grd = x.createLinearGradient(0, 0, 640, 384);
    grd.addColorStop(0, "#0b1230");
    grd.addColorStop(1, acc);
    x.fillStyle = grd; x.fillRect(0, 0, 640, 384);
    x.globalAlpha = 0.14; x.fillStyle = "#fff";
    for (let i = 0; i < 640; i += 32) x.fillRect(i, 0, 1, 384);
    for (let i = 0; i < 384; i += 32) x.fillRect(0, i, 640, 1);
    x.globalAlpha = 1;
    const colors = ["#ffd9a0", "#ffffff", "#ff9fb0", "#a8c4ff", "#f3e6c8"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      let px = 48 + (i % 3 === 1 ? 36 : i % 3 === 2 ? 72 : 0);
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = 30 + rnd() * 110;
        x.fillStyle = colors[(i + k) % colors.length];
        x.globalAlpha = 0.85;
        x.beginPath(); x.roundRect ? x.roundRect(px, 42 + i * 34, w, 14, 7) : x.rect(px, 42 + i * 34, w, 14); x.fill();
        px += w + 14;
      }
    }
    x.globalAlpha = 1;
    x.fillStyle = "#fff";
    x.font = "600 120px Georgia, serif";
    x.textAlign = "right";
    x.fillText("</>", 600, 350);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const screenMat = new T.MeshBasicMaterial({ map: tex, toneMapped: false });
    const screen = mesh(new T.PlaneGeometry(1.7, 1.02), screenMat, 0, 0.64, 0.037);
    hinge.add(screen);
    g.add(hinge);
    // ลูกบาศก์/พิกเซลลอย
    const cubes = [];
    const cg = rbox(0.2, 0.2, 0.2, 0.04);
    [[A, 1.18, 0.95, 0.2], [M.red, 1.32, 0.42, 0.3], [M.porcelain, 1.02, 1.32, -0.1]].forEach(([mat, cx, cy, cz], i) => {
      const c = mesh(cg, mat, cx, cy, cz);
      c.scale.setScalar(1 - i * 0.18);
      c.userData.base = [cx, cy, cz];
      cubes.push(c);
      g.add(c);
    });
    g.add(shadow(2.8, 2, -0.545, 0.85));
    g.rotation.x = 0.16; // เอียงให้เห็นคีย์บอร์ด
    return {
      group: g,
      update(t) {
        cubes.forEach((c, i) => {
          const [bx, by, bz] = c.userData.base;
          c.position.set(bx + Math.sin(t * 0.7 + i) * 0.05, by + Math.sin(t * 1.3 + i * 2) * 0.07, bz);
          c.rotation.set(t * 0.6 + i, t * 0.8 + i * 2, 0);
        });
      }
    };
  },

  arts(K, acc) {
    const { T, M, mesh, rbox, tube, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.22);
    // ปลายปากกา (pen tool) ชี้ลงล่าง
    const s = new T.Shape();
    s.moveTo(0, -0.95);
    s.bezierCurveTo(0.1, -0.62, 0.44, -0.3, 0.44, 0.12);
    s.lineTo(0.44, 0.52);
    s.quadraticCurveTo(0.44, 0.66, 0.3, 0.66);
    s.lineTo(-0.3, 0.66);
    s.quadraticCurveTo(-0.44, 0.66, -0.44, 0.52);
    s.lineTo(-0.44, 0.12);
    s.bezierCurveTo(-0.44, -0.3, -0.1, -0.62, 0, -0.95);
    const hole = new T.Path();
    hole.absarc(0, -0.1, 0.095, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const slit = new T.Path();
    slit.moveTo(-0.014, -0.84); slit.lineTo(-0.014, -0.215); slit.lineTo(0.014, -0.215); slit.lineTo(0.014, -0.84); slit.lineTo(-0.014, -0.84);
    s.holes.push(slit);
    const nibGeo = new T.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 24 });
    nibGeo.center();
    const pen = new T.Group();
    pen.add(mesh(nibGeo, M.mirror, 0, 0, 0));
    pen.add(mesh(rbox(0.96, 0.3, 0.24, 0.06), M.red, 0, 0.84, 0));
    pen.add(mesh(rbox(0.82, 0.05, 0.27, 0.02), M.gold, 0, 0.69, 0));
    pen.rotation.z = 0.5;
    pen.position.set(0.12, 0.42, 0.12);
    pen.scale.setScalar(0.82);
    g.add(pen);
    // เส้นโค้งเบซิเยร์ + จุดยึด + ก้านควบคุม
    const P0 = new T.Vector3(-1.05, -0.62, 0.1), C0 = new T.Vector3(-0.55, 0.55, 0.2),
          C1 = new T.Vector3(0.05, -1.05, 0.12), P1 = new T.Vector3(0.62, -0.22, 0.12);
    const bez = new T.CubicBezierCurve3(P0, C0, C1, P1);
    g.add(new T.Mesh(new T.TubeGeometry(bez, 120, 0.036, 14, false), A));
    const anchor = rbox(0.13, 0.13, 0.13, 0.025);
    g.add(mesh(anchor, M.porcelain, P0.x, P0.y, P0.z), mesh(anchor, M.porcelain, P1.x, P1.y, P1.z));
    const knob = new T.SphereGeometry(0.055, 24, 16);
    const handle = (a, b) => {
      const d = new T.Vector3().subVectors(b, a);
      const m = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, d.length(), 8), M.gold);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      g.add(m, mesh(knob, M.red, b.x, b.y, b.z));
    };
    handle(P0, C0);
    handle(P1, new T.Vector3(1.0, 0.35, 0.12));
    // จานสีเล็ก ๆ
    const dots = [];
    [[acc, -0.95, 0.62], ["#a3122a", -0.66, 0.84], ["#d9bd85", -0.32, 0.92]].forEach(([c, dx, dy], i) => {
      const m = mesh(new T.SphereGeometry(0.1, 32, 20), i === 0 ? A : i === 1 ? M.red : M.gold, dx, dy, -0.2);
      m.userData.y = dy;
      dots.push(m);
      g.add(m);
    });
    g.add(shadow(2.6, 1.6, -0.9, 0.75));
    return {
      group: g,
      update(t) {
        pen.position.y = 0.42 + Math.sin(t * 1.2) * 0.05;
        pen.rotation.z = 0.5 + Math.sin(t * 0.9) * 0.05;
        dots.forEach((d, i) => { d.position.y = d.userData.y + Math.sin(t * 1.4 + i * 1.3) * 0.05; });
      }
    };
  },

  "home-economics"(K, acc) {
    const { T, M, mesh, lathe, tube, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.24);
    const pot = new T.Group();
    pot.add(mesh(lathe([[0.001, -0.52], [0.3, -0.52], [0.5, -0.4], [0.6, -0.14], [0.57, 0.1], [0.44, 0.28], [0.27, 0.35], [0.001, 0.36]]), M.porcelain));
    pot.add(mesh(lathe([[0.001, 0.345], [0.29, 0.345], [0.25, 0.39], [0.13, 0.44], [0.09, 0.5], [0.001, 0.52]], 64, 32), M.porcelain));
    pot.add(mesh(new T.SphereGeometry(0.075, 32, 20), M.gold, 0, 0.56, 0));
    const band = mesh(new T.TorusGeometry(0.595, 0.03, 16, 96), M.red, 0, -0.06, 0);
    band.rotation.x = Math.PI / 2;
    const band2 = mesh(new T.TorusGeometry(0.535, 0.014, 12, 96), A, 0, 0.12, 0);
    band2.rotation.x = Math.PI / 2;
    const foot = mesh(new T.TorusGeometry(0.3, 0.022, 12, 64), M.gold, 0, -0.515, 0);
    foot.rotation.x = Math.PI / 2;
    pot.add(band, band2, foot);
    pot.add(mesh(tube([[0.45, -0.2, 0], [0.7, -0.12, 0], [0.82, 0.06, 0], [0.92, 0.24, 0]], 0.085, 48), M.porcelain));
    const lip = mesh(new T.TorusGeometry(0.086, 0.016, 10, 32), M.gold, 0.925, 0.25, 0);
    lip.rotation.set(Math.PI / 2, 0.55, 0);
    pot.add(lip);
    const handle = mesh(new T.TorusGeometry(0.25, 0.045, 16, 48, Math.PI * 1.15), M.gold, -0.6, -0.02, 0);
    handle.rotation.z = Math.PI * 0.43;
    pot.add(handle);
    pot.position.set(-0.22, 0.04, -0.1);
    g.add(pot);
    // ถ้วยชา + จานรอง
    const cup = new T.Group();
    cup.add(mesh(lathe([[0.001, -0.02], [0.3, -0.02], [0.38, 0.0], [0.4, 0.025], [0.001, 0.03]], 48, 20), M.porcelain));
    cup.add(mesh(lathe([[0.001, 0.03], [0.12, 0.03], [0.17, 0.08], [0.21, 0.2], [0.23, 0.3]], 48, 24), M.porcelain));
    cup.add(new T.Mesh(lathe([[0.215, 0.29], [0.19, 0.18], [0.12, 0.08], [0.001, 0.07]], 48, 20), A));
    const rim = mesh(new T.TorusGeometry(0.225, 0.012, 10, 64), M.gold, 0, 0.3, 0);
    rim.rotation.x = Math.PI / 2;
    cup.add(rim);
    const ch = mesh(new T.TorusGeometry(0.075, 0.02, 10, 32, Math.PI * 1.3), M.porcelain, 0.23, 0.17, 0);
    ch.rotation.z = -Math.PI * 0.62;
    cup.add(ch);
    cup.position.set(0.78, -0.47, 0.42);
    g.add(cup);
    // ไอชา
    const steam = [];
    for (let i = 0; i < 2; i++) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([Math.sin(k * 0.9 + i * 2) * 0.05, k * 0.065, 0]);
      const m = mesh(tube(pts, 0.012, 40), M.steam, 0.78 + (i - 0.5) * 0.09, -0.12, 0.42);
      steam.push(m);
      g.add(m);
    }
    g.add(shadow(2.4, 1.7, -0.5, 0.85));
    return {
      group: g,
      update(t) {
        steam.forEach((m, i) => {
          const p = (t * 0.35 + i * 0.5) % 1;
          m.position.y = -0.12 + p * 0.25;
          m.scale.set(1 + p * 0.6, 0.7 + p * 0.5, 1);
          m.visible = p < 0.92;
        });
      }
    };
  },

  tourism(K, acc) {
    const { T, M, mesh, lathe, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.22);
    // กระดิ่งโรงแรม
    g.add(mesh(new T.CylinderGeometry(0.7, 0.74, 0.16, 96), M.red, 0, -0.55, 0));
    const r1 = mesh(new T.TorusGeometry(0.72, 0.02, 12, 96), M.gold, 0, -0.47, 0);
    r1.rotation.x = Math.PI / 2;
    g.add(r1);
    g.add(mesh(new T.CylinderGeometry(0.66, 0.66, 0.04, 96), M.gold, 0, -0.45, 0));
    const dome = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; dome.push([Math.cos(a) * 0.6, -0.43 + Math.sin(a) * 0.58]); }
    g.add(mesh(lathe([[0.64, -0.43], ...dome, [0.001, 0.16]], 96, 40), M.mirror));
    g.add(mesh(new T.CylinderGeometry(0.035, 0.035, 0.16, 16), M.gold, 0, 0.22, 0));
    const btn = mesh(new T.SphereGeometry(0.1, 32, 20), M.gold, 0, 0.32, 0);
    btn.scale.y = 0.55;
    g.add(btn);
    // วงโคจร + เครื่องบินกระดาษ
    const orbit = new T.Group();
    orbit.rotation.set(0.32, 0, -0.18);
    const ring = mesh(new T.TorusGeometry(1.08, 0.012, 8, 160), A);
    ring.rotation.x = Math.PI / 2;
    orbit.add(ring);
    const pg = new T.BufferGeometry();
    const nose = [0, 0, 0.36], tl = [-0.3, 0.02, -0.26], tr = [0.3, 0.02, -0.26], tc = [0, 0.05, -0.26], kb = [0, -0.1, -0.26];
    pg.setAttribute("position", new T.Float32BufferAttribute([...nose, ...tl, ...tc, ...nose, ...tc, ...tr, ...nose, ...kb, ...tc], 3));
    pg.computeVertexNormals();
    const paper = new T.MeshPhysicalMaterial({ color: 0xfbf7ef, roughness: 0.55, side: T.DoubleSide });
    const plane = new T.Mesh(pg, paper);
    plane.scale.setScalar(0.62);
    const carrier = new T.Group();
    carrier.add(plane);
    plane.position.x = 1.08;
    orbit.add(carrier);
    g.add(orbit);
    g.add(shadow(2.4, 2.2, -0.63, 0.9));
    return {
      group: g,
      update(t) {
        carrier.rotation.y = -t * 0.7;
        plane.rotation.set(0.15 * Math.sin(t * 2), Math.PI, -0.35 + 0.1 * Math.sin(t * 1.4));
        btn.position.y = 0.32 - Math.max(0, Math.sin(t * 2.2)) * 0.02;
      }
    };
  },

  food(K, acc) {
    const { T, M, mesh, lathe, tube, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.3);
    g.add(mesh(lathe([[0.001, -0.5], [0.3, -0.5], [0.33, -0.44], [0.55, -0.32], [0.74, -0.08], [0.8, 0.12]], 96, 40), M.red));
    const innerMat = M.porcelain;
    const inner = mesh(lathe([[0.77, 0.12], [0.7, -0.08], [0.5, -0.28], [0.25, -0.38], [0.001, -0.4]], 96, 40), innerMat);
    g.add(inner);
    const rim = mesh(new T.TorusGeometry(0.785, 0.028, 16, 120), M.gold, 0, 0.12, 0);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const foot = mesh(new T.TorusGeometry(0.3, 0.03, 12, 64), M.gold, 0, -0.49, 0);
    foot.rotation.x = Math.PI / 2;
    g.add(foot);
    // น้ำซุป + ท็อปปิ้ง
    const soup = mesh(new T.CircleGeometry(0.71, 64), A, 0, 0.03, 0);
    soup.rotation.x = -Math.PI / 2;
    g.add(soup);
    const herb = new T.MeshStandardMaterial({ color: 0x3f8a43, roughness: 0.5 });
    [[0.22, 0.18], [-0.3, 0.12], [0.05, -0.3], [-0.12, 0.38], [0.38, -0.1]].forEach(([x, z], i) => {
      const m = mesh(new T.TorusGeometry(0.05, 0.018, 8, 20), i % 2 ? herb : M.porcelain, x, 0.045, z);
      m.rotation.x = Math.PI / 2;
      g.add(m);
    });
    const egg = mesh(new T.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.porcelain, -0.2, 0.02, -0.12);
    egg.scale.set(1, 0.55, 1.25);
    const yolk = mesh(new T.SphereGeometry(0.085, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xf2a91c, roughness: 0.3, clearcoat: 1 }), -0.2, 0.075, -0.12);
    yolk.scale.y = 0.5;
    g.add(egg, yolk);
    // ตะเกียบ
    const stick = new T.CylinderGeometry(0.022, 0.034, 1.9, 16);
    [[0.0, 0.12], [0.12, 0.0]].forEach(([dz, rot], i) => {
      const m = mesh(stick, M.gold, 0.18, 0.2 + i * 0.04, 0.22 + dz);
      m.rotation.set(0.1, 0.4 + rot, Math.PI / 2 - 0.12);
      g.add(m);
    });
    // ไอร้อน
    const steam = [];
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([Math.sin(k * 0.8 + i * 1.7) * 0.07, k * 0.075, 0]);
      const m = mesh(tube(pts, 0.016, 48), M.steam, -0.28 + i * 0.26, 0.15, -0.15 + (i % 2) * 0.1);
      steam.push(m);
      g.add(m);
    }
    g.add(shadow(2.2, 2.2, -0.52, 0.9));
    g.rotation.x = 0.32; // เอียงเข้าหากล้องให้เห็นน้ำซุป
    return {
      group: g,
      update(t) {
        steam.forEach((m, i) => {
          const p = (t * 0.3 + i * 0.33) % 1;
          m.position.y = 0.12 + p * 0.35;
          m.scale.set(1 + p * 0.5, 0.75 + p * 0.45, 1);
          m.visible = p < 0.9;
        });
      }
    };
  },

  fashion(K, acc) {
    const { T, M, mesh, lathe, tube, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.24);
    const prof = [[0.001, -0.5], [0.33, -0.49], [0.4, -0.36], [0.38, -0.2], [0.3, -0.02], [0.29, 0.08], [0.35, 0.24], [0.4, 0.38], [0.37, 0.5], [0.22, 0.58], [0.1, 0.62], [0.001, 0.63]];
    const torso = mesh(lathe(prof, 72, 64), M.linen, 0, 0.18, 0);
    torso.scale.z = 0.72;
    g.add(torso);
    g.add(mesh(new T.CylinderGeometry(0.1, 0.11, 0.1, 32), M.gold, 0, 0.84, 0));
    g.add(mesh(new T.SphereGeometry(0.06, 24, 16), M.mirror, 0, 0.92, 0));
    g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.6, 16), M.gold, 0, -0.62, 0));
    g.add(mesh(new T.CylinderGeometry(0.4, 0.44, 0.05, 64), M.gold, 0, -0.93, 0));
    g.add(mesh(new T.CylinderGeometry(0.08, 0.1, 0.05, 32), M.gold, 0, -0.33, 0));
    // ตะเข็บแดงด้านหน้า (ตามส่วนโค้งหุ่น)
    const seam = prof.slice(1, -2).map(([r, y]) => [0, y + 0.18, r * 0.72 + 0.006]);
    g.add(mesh(tube(seam, 0.009, 60), M.red));
    // สายวัด/ผ้าคาดเฉียง
    const sash = [];
    for (let k = 0; k <= 24; k++) {
      const u = k / 24;
      const a = -0.3 + u * Math.PI * 1.25;
      const y = 0.68 - u * 0.75;
      const r = 0.36 + 0.045;
      sash.push([Math.sin(a) * r, y, Math.cos(a) * r * 0.76]);
    }
    g.add(mesh(tube(sash, 0.028, 120), A));
    // หลอดด้าย
    const spool = new T.Group();
    spool.add(mesh(new T.CylinderGeometry(0.11, 0.11, 0.22, 40), M.red));
    spool.add(mesh(new T.CylinderGeometry(0.15, 0.15, 0.035, 40), M.gold, 0, 0.125, 0), mesh(new T.CylinderGeometry(0.15, 0.15, 0.035, 40), M.gold, 0, -0.125, 0));
    spool.position.set(0.62, -0.8, 0.32);
    g.add(spool);
    const needle = mesh(new T.CylinderGeometry(0.008, 0.002, 0.5, 8), M.mirror, 0.6, -0.62, 0.3);
    needle.rotation.z = 0.5;
    g.add(needle);
    g.add(shadow(1.7, 1.5, -0.96, 0.85));
    return { group: g, update(t) { spool.rotation.y = t * 0.8; } };
  },

  logistics(K, acc) {
    const { T, M, mesh, rbox, tube, arrowHead, shadow } = K;
    const g = new T.Group();
    const A = K.accent(acc, 0.24);
    g.add(mesh(rbox(1.7, 0.1, 1.2, 0.03), M.gold, 0, -0.66, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(rbox(1.7, 0.1, 0.16, 0.02), M.gold, 0, -0.78, -0.48 + i * 0.48));
    const box = (w, h, d, x, y, z, ry) => {
      const b = new T.Group();
      b.add(mesh(rbox(w, h, d, 0.035), M.kraft));
      b.add(mesh(rbox(0.13, 0.012, d + 0.01, 0.004), M.red, 0, h / 2 + 0.003, 0));
      b.add(mesh(rbox(0.13, h * 0.38, 0.012, 0.004), M.red, 0, h * 0.31, d / 2 + 0.003));
      b.add(mesh(rbox(w * 0.32, h * 0.22, 0.012, 0.01), M.porcelain, w * 0.22, -h * 0.18, d / 2 + 0.004));
      b.position.set(x, y, z);
      b.rotation.y = ry;
      g.add(b);
      return b;
    };
    box(0.82, 0.62, 0.72, -0.3, -0.3, -0.05, 0.08);
    box(0.62, 0.48, 0.56, 0.44, -0.37, 0.12, -0.32);
    const top = box(0.52, 0.42, 0.48, -0.25, 0.22, -0.02, 0.32);
    // ลูกศรวนรอบกองพัสดุ
    const loop = new T.Group();
    const pts = [];
    for (let k = 0; k <= 30; k++) { const a = 0.3 + (k / 30) * Math.PI * 1.55; pts.push([Math.cos(a) * 1.06, 0.06 * Math.sin(a * 2), Math.sin(a) * 0.82]); }
    loop.add(mesh(tube(pts, 0.035, 120), A), arrowHead(pts, A, 0.09, 0.24));
    loop.position.y = 0.05;
    loop.rotation.x = 0.18;
    g.add(loop);
    g.add(shadow(2.4, 1.9, -0.84, 0.9));
    return {
      group: g,
      update(t) {
        loop.rotation.y = -t * 0.45;
        top.position.y = 0.22 + Math.max(0, Math.sin(t * 1.6)) * 0.04;
      }
    };
  }
};

// จัดกึ่งกลางและย่อให้พอดี size (ความกว้าง/สูงมากสุด)
function fit(T, built, size) {
  const g = built.group;
  if (built.update) built.update(0);
  g.updateMatrixWorld(true);
  const box = new T.Box3();
  g.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) box.expandByObject(o); });
  const s = box.getSize(new T.Vector3());
  const c = box.getCenter(new T.Vector3());
  const k = size / Math.max(s.x, s.y * 1.08, s.z * 0.9);
  const wrap = new T.Group();
  g.position.sub(c);
  wrap.add(g);
  wrap.scale.setScalar(k);
  wrap.userData.update = built.update;
  return wrap;
}

function buildModel(K, slug) {
  const info = BY_SLUG[slug];
  const fn = info && BUILD[slug];
  if (!fn) return null;
  return fit(K.T, fn(K, info.acc), 2);
}

/* ---------- 4) โครงร่างร่วมของทุกที่ (สร้างเมื่อใกล้ ทิ้งเมื่อไกล วัดเฟรม) ---------- */
class Place {
  // watch = องค์ประกอบที่ใช้ตรวจว่าใกล้จอ (ตู้โชว์ซ่อนอยู่จนพร้อม จึงดูจากกรอบภาพแทน)
  constructor(el, watch) {
    this.el = el;
    const target = watch || el;
    this.built = false;
    this.visible = false;
    this.static = LITE || motionQuery.matches;
    this.quality = 2;
    this.frames = 0;
    this.frameSum = 0;
    this.time = 0;
    this.last = 0;
    this.near = new IntersectionObserver((e) => { this.visible = e[e.length - 1].isIntersecting; if (this.visible && !this.built) this.build(); this.updateLoop(); }, { rootMargin: "25% 0px" });
    this.far = new IntersectionObserver((e) => { if (!e[e.length - 1].isIntersecting && this.built) this.teardown(); }, { rootMargin: "200% 0px" });
    this.near.observe(target);
    this.far.observe(target);
  }

  async build() {
    if (this.building || this.built || this.failed) return;
    this.building = true;
    let T;
    try { T = await loadThree(); } catch (_) { this.failed = true; this.building = false; return; }
    if (!this.el.isConnected) { this.building = false; return; }
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" }); }
    catch (_) { this.failed = true; this.building = false; return; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.dprCap);
    const canvas = renderer.domElement;
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.teardown(true); }, false);
    this.T = T;
    this.renderer = renderer;
    this.K = createLab(T, renderer);
    this.scene = new T.Scene();
    this.scene.environment = this.K.env;
    const key = new T.DirectionalLight(0xfff3e4, 1.3);
    key.position.set(-3, 5, 4);
    this.scene.add(key);
    this.camera = new T.PerspectiveCamera(28, 1, 0.1, 60);
    this.stageEl().appendChild(canvas);
    this.setup();
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); if (!this.running) this.render(); });
    this.ro.observe(this.stageEl());
    this.built = true;
    this.building = false;
    this.el.classList.add("is-ready");
    this.onReady && this.onReady();
    this.render();
    this.updateLoop();
  }

  stageEl() { return this.el; }

  resize() {
    if (!this.renderer) return;
    const s = this.stageEl();
    const w = Math.max(1, s.clientWidth), h = Math.max(1, s.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frame && this.frame(w, h);
    this.camera.updateProjectionMatrix();
  }

  updateLoop() {
    const want = this.built && this.visible && !document.hidden && !this.static && !this.paused;
    if (want === this.running) return;
    this.running = want;
    if (want) { this.last = performance.now(); this.renderer.setAnimationLoop((t) => this.tick(t)); }
    else if (this.renderer) { this.renderer.setAnimationLoop(null); this.render(); }
  }

  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.watch(dt);
    this.step(dt);
    this.render();
  }

  // วัดเวลาเฟรมจริง 90 เฟรม: ช้า → ความละเอียด 1x → ภาพนิ่ง
  watch(dt) {
    this.frames++;
    this.frameSum += dt;
    if (this.frames < 90) return;
    const avg = (this.frameSum / this.frames) * 1000;
    this.frames = 0;
    this.frameSum = 0;
    if (avg > 30 && this.quality === 2) { this.quality = 1; this.renderer.setPixelRatio(1); this.resize(); }
    else if (avg > 48 && this.quality === 1) { this.quality = 0; this.setStatic(true); }
  }

  render() { if (this.renderer) this.renderer.render(this.scene, this.camera); }

  setStatic(on) {
    this.static = on || LITE || this.quality === 0;
    this.onStatic && this.onStatic();
    this.updateLoop();
    this.render();
  }

  teardown(lost) {
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    if (this.ro) this.ro.disconnect();
    this.cleanup && this.cleanup();
    disposeTree(this.scene);
    this.K.dispose();
    this.renderer.dispose();
    if (!lost) this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.renderer = this.scene = this.camera = this.K = null;
    this.built = false;
    this.running = false;
    this.el.classList.remove("is-ready");
    this.onTeardown && this.onTeardown();
  }
}

// ลากแนวนอนเพื่อหมุน (แนวตั้งยังเลื่อนหน้าได้: touch-action: pan-y)
function dragSpin(target, onSpin, onTap) {
  let id = null, x0 = 0, y0 = 0, lx = 0, moved = false, lt = 0;
  target.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    id = e.pointerId; x0 = lx = e.clientX; y0 = e.clientY; moved = false; lt = performance.now();
  });
  target.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    if (!moved && Math.abs(e.clientX - x0) > 8 && Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0)) {
      moved = true;
      try { target.setPointerCapture(id); } catch (_) {}
    }
    if (moved) {
      const now = performance.now();
      onSpin(e.clientX - lx, Math.max(1, now - lt), false);
      lx = e.clientX; lt = now;
    }
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    if (moved) onSpin(0, 16, true); else if (e.type === "pointerup" && onTap) onTap(e);
    id = null;
  };
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
}

/* ---------- 5) ตู้โชว์ หน้าแรก ช่วงหลักสูตร ---------- */
class ShowCase extends Place {
  constructor(fig) {
    const el = document.createElement("div");
    el.className = "lvc-case";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="lvc-case__bg"></div><span class="lvc-case__num">01</span>' +
      '<div class="lvc-case__stage"></div>' +
      '<div class="lvc-case__meta"><span class="lvc-case__k">กลุ่มสาขา <b>01</b> / 08</span><strong></strong><span class="lvc-case__hint">ลากเพื่อหมุน</span></div>' +
      '<div class="lvc-case__dots">' + PROGRAMS.map(() => "<i></i>").join("") + "</div>";
    fig.insertBefore(el, fig.firstChild);
    super(el, fig);
    this.fig = fig;
    this.rows = Array.from(document.querySelectorAll("#programs .program-row"));
    this.slugs = this.rows.map((r) => (r.getAttribute("href") || "").split("#")[1]).filter((s) => BY_SLUG[s]);
    if (!this.slugs.length) this.slugs = PROGRAMS.map((p) => p.slug);
    this.titles = this.rows.map((r) => {
      const s = r.querySelector("strong");
      if (!s) return "";
      const c = s.cloneNode(true);
      c.querySelectorAll(".number").forEach((n) => n.remove());
      return c.textContent.trim();
    });
    this.active = 0;
    this.hover = -1;
    this.spin = 0;
    this.spinV = 0;
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.applyMeta(0, true);

    this.rows.forEach((row, i) => {
      row.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { this.hover = i; this.setActive(i); } });
      row.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && this.hover === i) this.hover = -1; });
      row.addEventListener("focus", () => this.setActive(i));
    });
    // จอใหญ่ (ภาพติดอยู่ขณะเลื่อน): ตามสาขาที่อยู่กลางจอ
    this.onScroll = () => {
      if (this.scrollQueued) return;
      this.scrollQueued = true;
      requestAnimationFrame(() => { this.scrollQueued = false; this.followScroll(); });
    };
    window.addEventListener("scroll", this.onScroll, { passive: true });
    const stage = el.querySelector(".lvc-case__stage");
    dragSpin(stage, (dx, dtMs, end) => {
      if (end) return;
      this.spinV = (dx / dtMs) * 0.012 * 16;
      this.spin += dx * 0.012;
      this.lastUser = performance.now();
      if (this.static) { this.layout(); this.render(); }
    }, () => { if (!this.sticky()) { this.lastUser = performance.now(); this.setActive((this.active + 1) % this.slugs.length); } });
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      this.tilt.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      this.tilt.tx = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    });
    stage.addEventListener("pointerleave", () => { this.tilt.tx = this.tilt.ty = 0; });
  }

  stageEl() { return this.el.querySelector(".lvc-case__stage"); }

  // จอใหญ่: ภาพติดจอขณะเลื่อน (position: sticky) · อ่านค่าใหม่เมื่อขนาดเปลี่ยนเท่านั้น
  sticky() {
    if (this.isSticky === undefined) {
      try { this.isSticky = getComputedStyle(this.fig).position === "sticky"; } catch (_) { this.isSticky = false; }
    }
    return this.isSticky;
  }

  applyMeta(i, instant) {
    const info = BY_SLUG[this.slugs[i]] || PROGRAMS[i];
    const num = String(i + 1).padStart(2, "0");
    this.el.style.setProperty("--case-acc", info.acc);
    this.el.style.setProperty("--case-deep", info.deep);
    this.el.querySelector(".lvc-case__num").textContent = num;
    this.el.querySelector(".lvc-case__k b").textContent = num;
    const strong = this.el.querySelector(".lvc-case__meta strong");
    strong.textContent = this.titles[i] || "";
    if (!instant) {
      this.el.classList.remove("is-swap");
      void this.el.offsetWidth;
      this.el.classList.add("is-swap");
    }
    this.el.querySelectorAll(".lvc-case__dots i").forEach((d, k) => d.classList.toggle("is-on", k === i));
    this.rows.forEach((r, k) => r.classList.toggle("is-case", k === i));
  }

  setActive(i) {
    if (i === this.active || i < 0 || i >= this.slugs.length) return;
    const prev = this.active;
    this.active = i;
    this.applyMeta(i);
    if (!this.built) return;
    this.ensure(i);
    this.swap = { from: prev, to: i, t: 0 };
    if (this.static) { this.swap = null; this.layout(); this.render(); }
  }

  followScroll() {
    if (!this.visible || this.hover >= 0 || !this.sticky()) return;
    const vh = window.innerHeight || 1;
    let best = -1, bd = Infinity;
    this.rows.forEach((r, i) => {
      const b = r.getBoundingClientRect();
      if (b.bottom < 0 || b.top > vh) return;
      const d = Math.abs(b.top + b.height / 2 - vh * 0.48);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) this.setActive(best);
  }

  ensure(i) {
    if (this.models[i]) return this.models[i];
    const m = buildModel(this.K, this.slugs[i]);
    m.visible = false;
    this.holder.add(m);
    this.models[i] = m;
    return m;
  }

  setup() {
    const T = this.T;
    this.models = [];
    this.holder = new T.Group();
    this.scene.add(this.holder);
    this.camera.position.set(0, 0.55, 7.4);
    this.camera.lookAt(0, -0.05, 0);
    this.ensure(this.active).visible = true;
    this.enter = this.static ? 1 : 0;
    this.layout();
  }

  frame(w, h) {
    this.isSticky = undefined;
    // ให้โมเดลกว้าง ~2.4 หน่วยพอดีจอทั้งแนวตั้งและแนวนอน
    const a = w / h;
    const fovY = (this.camera.fov * Math.PI) / 180;
    // มือถือ: ชื่อสาขาอยู่ล่างตู้ → โมเดลเล็กลงและยกขึ้น
    const low = !this.sticky();
    const need = low ? 3.05 : 2.55;
    const distH = need / 2 / Math.tan(fovY / 2);
    const distW = need / 2 / (Math.tan(fovY / 2) * a);
    const d = Math.max(distH, distW) * 1.18;
    this.camera.position.set(0, d * 0.075, d);
    this.camera.lookAt(0, low ? -0.62 : -0.06, 0);
  }

  layout() {
    const t = this.time;
    const base = this.static ? -0.45 : -0.45 + t * 0.32;
    this.models.forEach((m, i) => { if (m) m.visible = false; });
    const show = (i, s, ry, y) => {
      const m = this.models[i];
      if (!m) return;
      m.visible = s > 0.002;
      m.scale.setScalar(Math.max(0.0001, s) * (m.userData.k0 || (m.userData.k0 = m.scale.x)));
      m.rotation.set(this.tilt.x, base + this.spin + ry, 0);
      m.position.y = y + (this.static ? 0 : Math.sin(t * 1.15) * 0.05);
      if (!this.static && m.userData.update) m.userData.update(t);
    };
    const e = easeOutBack(clamp(this.enter, 0, 1));
    if (this.swap) {
      const p = clamp(this.swap.t, 0, 1);
      const out = clamp(p / 0.45, 0, 1);
      const inn = clamp((p - 0.25) / 0.75, 0, 1);
      show(this.swap.from, (1 - easeInOut(out)) * e, out * 2.4, -out * 0.35);
      show(this.swap.to, easeOutBack(inn) * e, -(1 - inn) * 2.2, (1 - inn) * 0.25);
    } else show(this.active, e, 0, 0);
  }

  step(dt) {
    if (this.enter < 1) this.enter = Math.min(1, this.enter + dt / 1.1);
    if (this.swap) { this.swap.t += dt / 0.95; if (this.swap.t >= 1) this.swap = null; }
    this.spinV *= Math.exp(-dt * 3.2);
    this.spin += this.spinV * dt * 6;
    this.tilt.x = damp(this.tilt.x, this.tilt.tx, 5, dt);
    this.tilt.y = damp(this.tilt.y, this.tilt.ty, 5, dt);
    this.holder.rotation.y = this.tilt.y;
    // มือถือ/แท็บเล็ต (ภาพไม่ติดจอ): เปลี่ยนสาขาเองทุก ~4 วินาที
    if (!this.sticky()) {
      this.auto = (this.auto || 0) + dt;
      const idle = !this.lastUser || performance.now() - this.lastUser > 6000;
      if (this.auto > 4.2 && idle && !this.swap) { this.auto = 0; this.setActive((this.active + 1) % this.slugs.length); }
    }
    this.layout();
  }

  onStatic() { if (this.built) { this.enter = 1; this.swap = null; this.layout(); } }
  onReady() { this.fig.classList.add("has-case"); }
  onTeardown() { this.models = []; }
}

/* ---------- 6) วงหมุนหน้าหลักสูตร ---------- */
class Carousel extends Place {
  constructor(host) {
    const el = document.createElement("div");
    el.className = "lvc-tt";
    const items = Array.from(document.querySelectorAll(".program-detail[data-program]"));
    const slugs = items.map((s) => s.getAttribute("data-program")).filter((s) => BY_SLUG[s]);
    el.innerHTML =
      '<div class="lvc-tt__glow" aria-hidden="true"></div><div class="lvc-tt__stage" aria-hidden="true"></div>' +
      '<div class="lvc-tt__bar" role="group" aria-label="โมเดลประจำกลุ่มสาขา">' +
      '<button type="button" class="lvc-tt__btn" data-dir="-1" aria-label="กลุ่มสาขาก่อนหน้า"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<a class="lvc-tt__label" href="#"><span class="lvc-tt__n">01 / 08</span><strong></strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M5 13l7 7 7-7"/></svg></a>' +
      '<button type="button" class="lvc-tt__btn" data-dir="1" aria-label="กลุ่มสาขาถัดไป"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>';
    host.insertAdjacentElement("afterend", el); // จอใหญ่: ลอยด้านขวาของหัวหน้า · มือถือ: ต่อท้ายหัวหน้า
    super(el);
    this.slugs = slugs.length ? slugs : PROGRAMS.map((p) => p.slug);
    this.titles = this.slugs.map((s) => { const h = document.getElementById("title-" + s); return h ? h.textContent.trim() : s; });
    this.active = 0;
    this.angle = 0;
    this.drag = 0;
    this.hold = false;
    this.applyMeta();
    el.querySelectorAll(".lvc-tt__btn").forEach((b) => b.addEventListener("click", () => {
      this.lastUser = performance.now();
      this.go(this.active + Number(b.dataset.dir));
    }));
    const stage = el.querySelector(".lvc-tt__stage");
    dragSpin(stage, (dx, _dt, end) => {
      this.lastUser = performance.now();
      if (end) { this.snap(); return; }
      this.drag += dx * 0.006;
      if (this.static) { this.layout(); this.render(); }
    }, (e) => this.pick(e));
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") this.hold = true; });
    el.addEventListener("pointerleave", () => { this.hold = false; });
    el.addEventListener("focusin", () => { this.hold = true; });
    el.addEventListener("focusout", () => { this.hold = false; });
  }

  stageEl() { return this.el.querySelector(".lvc-tt__stage"); }

  applyMeta() {
    const i = this.active;
    const info = BY_SLUG[this.slugs[i]];
    this.el.style.setProperty("--tt-acc", info.acc);
    this.el.style.setProperty("--tt-deep", info.deep);
    const a = this.el.querySelector(".lvc-tt__label");
    a.href = "#" + this.slugs[i];
    a.querySelector(".lvc-tt__n").textContent = String(i + 1).padStart(2, "0") + " / " + String(this.slugs.length).padStart(2, "0");
    a.querySelector("strong").textContent = this.titles[i];
    a.setAttribute("aria-label", "ไปที่กลุ่มสาขา " + this.titles[i]);
  }

  // ปล่อยนิ้ว/เมาส์หลังลาก: ค้างที่ชิ้นที่ใกล้ด้านหน้าที่สุด
  snap() {
    const n = this.slugs.length, step = (Math.PI * 2) / n;
    this.angle += this.drag;
    this.drag = 0;
    const idx = Math.round(-this.angle / step);
    this.target = -idx * step;
    const k = ((idx % n) + n) % n;
    if (k !== this.active) { this.active = k; this.applyMeta(); }
    this.auto = 0;
    if (this.static) { this.angle = this.target; this.layout(); this.render(); }
  }

  go(i) {
    const n = this.slugs.length;
    const k = ((i % n) + n) % n;
    if (k === this.active) return;
    // หมุนทางสั้นที่สุด
    const step = (Math.PI * 2) / n;
    let delta = k - this.active;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    this.target = (this.target ?? this.angle) - delta * step;
    this.active = k;
    this.auto = 0;
    this.applyMeta();
    if (this.static) { this.angle = this.target; this.layout(); this.render(); }
  }

  pick(e) {
    if (!this.built) return;
    const r = this.stageEl().getBoundingClientRect();
    const T = this.T;
    const v = new T.Vector3();
    let best = -1, bd = Infinity;
    this.models.forEach((m, i) => {
      m.getWorldPosition(v);
      v.y += 0.6 * m.scale.x;
      v.project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
      const d = Math.hypot(sx - e.clientX, sy - e.clientY);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0 || bd > r.width * 0.2) return;
    this.lastUser = performance.now();
    if (best === this.active) {
      const t = document.getElementById(this.slugs[best]);
      if (t) t.scrollIntoView({ behavior: motionQuery.matches ? "auto" : "smooth", block: "start" });
    } else this.go(best);
  }

  setup() {
    const T = this.T;
    const n = this.slugs.length;
    this.R = 3.05;
    this.ring = new T.Group();
    this.scene.add(this.ring);
    this.models = this.slugs.map((s, i) => {
      const m = buildModel(this.K, s);
      const a = (i / n) * Math.PI * 2;
      const holder = new T.Group();
      holder.position.set(Math.sin(a) * this.R, 0, Math.cos(a) * this.R);
      holder.add(m);
      holder.userData.k0 = m.scale.x;
      holder.userData.m = m;
      this.ring.add(holder);
      return holder;
    });
    const disc = new T.Mesh(new T.TorusGeometry(this.R, 0.012, 8, 220), this.K.M.gold);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = -0.98;
    this.ring.add(disc);
    const disc2 = new T.Mesh(new T.TorusGeometry(this.R + 0.55, 0.006, 8, 220), this.K.M.gold);
    disc2.rotation.x = Math.PI / 2;
    disc2.position.y = -0.98;
    this.ring.add(disc2);
    this.target = this.angle = -this.active * ((Math.PI * 2) / n);
    this.enter = this.static ? 1 : 0;
    this.layout();
  }

  frame(w, h) {
    const a = w / h;
    // จอแคบ: กล้องเข้าใกล้ ชิ้นด้านหน้าใหญ่ ชิ้นข้าง ๆ โผล่ที่ขอบ
    const narrow = w < 640;
    const d = narrow ? 8.6 : a < 1.15 ? 12.8 / Math.max(0.7, a) : 11.6;
    this.camera.position.set(0, d * (narrow ? 0.25 : 0.21), d);
    if (narrow) this.camera.lookAt(0, -0.42, 1.3); else this.camera.lookAt(0, -0.1, 0);
  }

  layout() {
    const n = this.slugs.length;
    const step = (Math.PI * 2) / n;
    this.ring.rotation.y = this.angle + this.drag;
    const e = easeOutBack(clamp(this.enter, 0, 1));
    this.models.forEach((h, i) => {
      const a = i * step + this.ring.rotation.y;
      const front = (Math.cos(a) + 1) / 2;
      const isAct = i === this.active;
      const s = (0.46 + 0.56 * Math.pow(front, 4)) * e;
      const m = h.userData.m;
      m.scale.setScalar(Math.max(0.0001, h.userData.k0 * s));
      m.position.y = -0.98 + 1.0 * s + (this.static ? 0 : Math.sin(this.time * 1.2 + i) * 0.05 * front);
      m.rotation.y = -this.ring.rotation.y + (this.static ? -0.35 : -0.35 + Math.sin(this.time * 0.5 + i) * 0.5 + (isAct ? this.time * 0.4 : 0));
      if (!this.static && m.userData.update && front > 0.35) m.userData.update(this.time + i);
    });
  }

  step(dt) {
    if (this.enter < 1) this.enter = Math.min(1, this.enter + dt / 1.4);
    this.angle = damp(this.angle, this.target, 4.2, dt);
    const idle = !this.lastUser || performance.now() - this.lastUser > 7000;
    if (!this.hold && idle) {
      this.auto = (this.auto || 0) + dt;
      if (this.auto > 4.6) { this.auto = 0; this.go(this.active + 1); }
    }
    this.layout();
  }

  onStatic() { if (this.built) { this.enter = 1; this.angle = this.target; this.layout(); } }
}

/* ---------- 7) หมุดวิทยาลัย หน้าติดต่อ ---------- */
const TERRAIN_VERT = /* glsl */ `
uniform float uTime;
uniform float uRise;
varying float vH;
varying vec2 vXZ;
varying vec3 vWorld;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
float heightAt(vec2 xz){
  float r = length(xz);
  float ridge = 1.0 - abs(fbm(xz * 0.42 + 3.1) * 2.0 - 1.0);
  float h = pow(ridge, 2.2) * 1.35 + fbm(xz * 0.9) * 0.35;
  float valley = smoothstep(0.6, 2.4, r);
  return h * valley * uRise;
}
void main(){
  vec3 p = position;
  float h = heightAt(p.xz);
  p.y += h;
  vH = h;
  vXZ = p.xz;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TERRAIN_FRAG = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uLine;
uniform vec3 uMajor;
uniform vec3 uShade;
uniform float uFade;
varying float vH;
varying vec2 vXZ;
varying vec3 vWorld;
void main(){
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  float lit = clamp(dot(n, normalize(vec3(-0.5, 0.9, 0.4))) * 0.5 + 0.55, 0.0, 1.0);
  vec3 col = mix(uShade, uPaper, lit);
  float k = vH / 0.075;
  float f = abs(fract(k - 0.5) - 0.5) / fwidth(k);
  float line = 1.0 - clamp(f, 0.0, 1.0);
  float mk = vH / 0.375;
  float fm = abs(fract(mk - 0.5) - 0.5) / fwidth(mk);
  float major = 1.0 - clamp(fm * 0.7, 0.0, 1.0);
  col = mix(col, uLine, line * 0.75 * step(0.02, vH));
  col = mix(col, uMajor, major * 0.85 * step(0.05, vH));
  float r = length(vXZ);
  float grid = 0.0;
  vec2 g = abs(fract(vXZ * 1.0 - 0.5) - 0.5) / fwidth(vXZ * 1.0);
  grid = (1.0 - clamp(min(g.x, g.y), 0.0, 1.0)) * 0.12 * (1.0 - smoothstep(0.3, 1.0, vH));
  col = mix(col, uLine, grid);
  float a = (1.0 - smoothstep(3.0, 4.9, r)) * uFade;
  gl_FragColor = vec4(col, a);
}`;

class PinScene extends Place {
  constructor(host) {
    const el = document.createElement("div");
    el.className = "lvc-pin";
    el.innerHTML = '<div class="lvc-pin__stage" aria-hidden="true"></div>' +
      '<p class="lvc-pin__tag"><span class="lvc-pin__dot" aria-hidden="true"></span><span><strong>วิทยาลัยอาชีวศึกษาเลย</strong><small>อ.เมือง จ.เลย · ภาพประกอบ ไม่ใช่แผนที่จริง</small></span></p>';
    host.insertAdjacentElement("afterend", el);
    super(el);
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      this.mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  stageEl() { return this.el.querySelector(".lvc-pin__stage"); }

  palette() {
    const d = isDark();
    const c = (hex) => new this.T.Color().setStyle(hex, this.T.LinearSRGBColorSpace); // ShaderMaterial ไม่แปลงสี: ใช้ค่า sRGB ตรง ๆ
    return d
      ? { paper: c("#2a2427"), line: c("#6d5a4b"), major: c("#d8bd85"), shade: c("#141113") }
      : { paper: c("#fbf7ef"), line: c("#d9c8a8"), major: c("#b2414f"), shade: c("#d9cdbb") };
  }

  setup() {
    const T = this.T, K = this.K;
    const pal = this.palette();
    this.tu = {
      uTime: { value: 0 }, uRise: { value: this.static ? 1 : 0 }, uFade: { value: this.static ? 1 : 0 },
      uPaper: { value: pal.paper }, uLine: { value: pal.line }, uMajor: { value: pal.major }, uShade: { value: pal.shade }
    };
    const tmat = new T.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: this.tu, transparent: true, depthWrite: true });
    const geo = new T.PlaneGeometry(10, 10, 220, 220);
    geo.rotateX(-Math.PI / 2);
    this.terrain = new T.Mesh(geo, tmat);
    this.scene.add(this.terrain);

    // หมุด: หยดน้ำแดงลงรัก + ตราวิทยาลัยบนเหรียญแชมเปญ
    const pin = new T.Group();
    const r = 0.42, cy = 1.15;
    const tipAng = Math.asin(r / cy);
    const prof = [[0.001, 0]];
    for (let i = 0; i <= 28; i++) {
      const a = -Math.PI / 2 + tipAng + (i / 28) * (Math.PI - tipAng);
      prof.push([Math.max(0.001, Math.cos(a) * r), cy + Math.sin(a) * r]);
    }
    const pts = prof.map(([x, y]) => new T.Vector2(x, y));
    pin.add(new T.Mesh(new T.LatheGeometry(pts, 72), K.M.red));
    const medal = new T.Group();
    medal.position.set(0, cy, r * 0.97);
    const coin = new T.Mesh(new T.CylinderGeometry(0.29, 0.29, 0.06, 64), K.M.mirror);
    coin.rotation.x = Math.PI / 2;
    medal.add(coin);
    const tex = new T.TextureLoader().load("./images/crest.png", () => { if (!this.running) this.render(); });
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new T.Mesh(new T.CircleGeometry(0.245, 64), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    face.position.z = 0.032;
    medal.add(face);
    const ringM = new T.Mesh(new T.TorusGeometry(0.29, 0.016, 10, 64), K.M.gold);
    ringM.position.z = 0.0;
    medal.add(ringM);
    pin.add(medal);
    this.pin = pin;
    this.scene.add(pin);
    this.pinShadow = K.shadow(1.1, 1.1, 0.005, 0.9);
    this.scene.add(this.pinShadow);
    // วงคลื่นที่ฐานหมุด
    this.waves = [0, 1, 2].map(() => {
      const m = new T.Mesh(new T.RingGeometry(0.92, 1, 96), new T.MeshBasicMaterial({ color: 0xb3172b, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.01;
      this.scene.add(m);
      return m;
    });
    this.drop = this.static ? 1 : 0;
    this.pose();
  }

  frame(w, h) {
    const a = w / h;
    this.dist = a < 1.1 ? 10.2 : 8.6;
  }

  pose() {
    const t = this.time;
    const orbit = this.static ? 0.5 : 0.5 + Math.sin(t * 0.12) * 0.22 + this.mouse.x * 0.12;
    const elev = 0.62 + (this.static ? 0 : this.mouse.y * -0.05);
    const d = this.dist || 8.6;
    this.camera.position.set(Math.sin(orbit) * d * Math.cos(elev), Math.sin(elev) * d, Math.cos(orbit) * d * Math.cos(elev));
    this.camera.lookAt(0, 0.85, 0);
    // หมุดหล่นลงแล้วเด้ง
    const p = clamp(this.drop, 0, 1);
    const bounce = p < 1 ? (1 - easeOutBounce(p)) * 3.2 : 0;
    const bob = this.static ? 0 : Math.sin(t * 1.6) * 0.06;
    this.pin.position.y = 0.06 + bounce + bob + 0.05;
    this.pin.rotation.y = orbit + (this.static ? 0 : Math.sin(t * 0.8) * 0.25);
    const sh = 1 - clamp((this.pin.position.y - 0.1) / 3, 0, 0.8);
    this.pinShadow.scale.set(1.1 * sh, 1.1 * sh, 1);
    this.pinShadow.material.opacity = 0.9 * sh;
    this.waves.forEach((m, i) => {
      const q = this.static ? 0.5 + i * 0.15 : ((t * 0.45 + i / 3) % 1);
      m.scale.setScalar(0.25 + q * 1.6);
      m.material.opacity = (p >= 1 ? 1 : 0) * (1 - q) * 0.55;
    });
  }

  step(dt) {
    this.tu.uRise.value = Math.min(1, this.tu.uRise.value + dt / 2.2);
    this.tu.uFade.value = Math.min(1, this.tu.uFade.value + dt / 0.9);
    if (this.tu.uRise.value > 0.45) this.drop = Math.min(1, this.drop + dt / 1.25);
    this.mouse.x = damp(this.mouse.x, this.mouse.tx, 2.5, dt);
    this.mouse.y = damp(this.mouse.y, this.mouse.ty, 2.5, dt);
    this.pose();
  }

  onStatic() { if (this.built) { this.tu.uRise.value = 1; this.tu.uFade.value = 1; this.drop = 1; this.pose(); } }
  retheme() {
    if (!this.tu) return;
    const p = this.palette();
    this.tu.uPaper.value = p.paper; this.tu.uLine.value = p.line; this.tu.uMajor.value = p.major; this.tu.uShade.value = p.shade;
    if (!this.running) this.render();
  }
}

function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}


/* ---------- 7.5) เอกสาร + แว่นขยาย + ตราประทับ (หน้าแรก ช่วงข้อมูลสาธารณะ "เปิดเผย ตรวจสอบได้") ---------- */
class Seal extends Place {
  constructor(host) {
    const el = document.createElement("div");
    el.className = "lvc-seal";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="lvc-seal__stage"></div>';
    host.appendChild(el);
    super(el);
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !this.visible) return;
      const r = el.getBoundingClientRect();
      this.tilt.ty = clamp(((e.clientX - r.left) / r.width - 0.5), -1, 1) * 0.35;
      this.tilt.tx = clamp(((e.clientY - r.top) / r.height - 0.5), -1, 1) * 0.2;
    }, { passive: true });
  }

  stageEl() { return this.el.querySelector(".lvc-seal__stage"); }

  setup() {
    const T = this.T, K = this.K, M = K.M;
    const g = new T.Group();
    const lineMat = new T.MeshStandardMaterial({ color: 0xd3c7b6, roughness: 0.7 });
    const sheet = (x, y, z, rz, lines) => {
      const s = new T.Group();
      s.add(K.mesh(K.rbox(1.5, 2.0, 0.04, 0.018), M.porcelain));
      if (lines) {
        s.add(K.mesh(K.rbox(0.62, 0.075, 0.012, 0.006), M.red, -0.31, 0.74, 0.026));
        for (let i = 0; i < 7; i++) s.add(K.mesh(K.rbox(i % 3 === 2 ? 0.7 : 1.08, 0.035, 0.01, 0.004), lineMat, i % 3 === 2 ? -0.19 : 0, 0.5 - i * 0.16, 0.025));
        s.add(K.mesh(K.rbox(1.08, 0.012, 0.01, 0.004), M.gold, 0, -0.66, 0.025));
      }
      s.position.set(x, y, z);
      s.rotation.z = rz;
      g.add(s);
      return s;
    };
    sheet(0.22, -0.06, -0.12, -0.12, false);
    const front = sheet(0, 0, 0, 0.05, true);
    // ตราประทับครั่งแดง + ตราวิทยาลัย
    const wax = new T.Group();
    wax.add(K.mesh(new T.CylinderGeometry(0.3, 0.32, 0.07, 48), M.red));
    const tex = new T.TextureLoader().load("./images/crest.png", () => { if (!this.running) this.render(); });
    tex.colorSpace = T.SRGBColorSpace;
    const face = new T.Mesh(new T.CircleGeometry(0.22, 48), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.037;
    wax.add(face);
    const rim = K.mesh(new T.TorusGeometry(0.235, 0.012, 8, 48), M.gold, 0, 0.037, 0);
    rim.rotation.x = Math.PI / 2;
    wax.add(rim);
    wax.rotation.x = Math.PI / 2;
    wax.position.set(0.45, -0.68, 0.06);
    front.add(wax);
    // แว่นขยาย
    const lens = new T.Group();
    const ring = K.mesh(new T.TorusGeometry(0.42, 0.05, 20, 72), M.mirror);
    const glass = new T.Mesh(new T.CircleGeometry(0.4, 64), new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.16, envMapIntensity: 2.2, depthWrite: false }));
    const handle = K.mesh(new T.CylinderGeometry(0.065, 0.075, 0.75, 32), M.red, 0, -0.85, 0);
    const collar = K.mesh(new T.CylinderGeometry(0.085, 0.085, 0.12, 32), M.gold, 0, -0.5, 0);
    lens.add(ring, glass, handle, collar);
    lens.rotation.z = 0.55;
    lens.position.set(-0.2, 0.25, 0.55);
    g.add(lens);
    this.lens = lens;
    g.rotation.set(-0.22, 0.35, 0);
    this.group = g;
    this.scene.add(g);
    this.enter = this.static ? 1 : 0;
    this.pose();
  }

  frame(w, h) {
    const a = w / h;
    const fovY = (this.camera.fov * Math.PI) / 180;
    const need = 2.7;
    const d = Math.max(need / 2 / Math.tan(fovY / 2), need / 2 / (Math.tan(fovY / 2) * a)) * 1.15;
    this.camera.position.set(0, 0.2, d);
    this.camera.lookAt(0, 0, 0);
  }

  pose() {
    const t = this.time;
    const e = easeOutBack(clamp(this.enter, 0, 1));
    this.group.scale.setScalar(Math.max(0.0001, e));
    this.group.rotation.set(-0.22 + this.tilt.x, 0.35 + this.tilt.y + (this.static ? 0 : Math.sin(t * 0.4) * 0.12), 0);
    this.group.position.y = this.static ? 0 : Math.sin(t * 1.1) * 0.05;
    if (!this.static) this.lens.position.set(-0.2 + Math.sin(t * 0.7) * 0.32, 0.2 + Math.sin(t * 1.1) * 0.22, 0.55);
  }

  step(dt) {
    if (this.enter < 1) this.enter = Math.min(1, this.enter + dt / 1.2);
    this.tilt.x = damp(this.tilt.x, this.tilt.tx, 3, dt);
    this.tilt.y = damp(this.tilt.y, this.tilt.ty, 3, dt);
    this.pose();
  }

  onStatic() { if (this.built) { this.enter = 1; this.pose(); } }
}

/* ---------- 8) เริ่มทำงาน ---------- */
const places = [];
function mount() {
  const fig = document.querySelector("#programs .program-image");
  if (fig && !fig.querySelector(".lvc-case") && document.querySelector("#programs .program-row")) places.push(new ShowCase(fig));
  const pub = document.querySelector("#public-info .public-layout");
  if (pub && !pub.querySelector(".lvc-seal")) places.push(new Seal(pub));
  const hero = document.body && document.body.getAttribute("data-hero3d");
  const intro = document.querySelector(".content-page .page-intro");
  if (intro && hero === "programs" && !document.querySelector(".lvc-tt")) places.push(new Carousel(intro));
  if (intro && hero === "contact" && !document.querySelector(".lvc-pin")) places.push(new PinScene(intro));
}

function boot() {
  if (!("IntersectionObserver" in window) || !("ResizeObserver" in window) || !hasWebGL()) return;
  root.classList.add("lvc-3d");
  mount();
  const app = document.getElementById("app");
  if (app && places.length < 2) {
    const mo = new MutationObserver(() => { mount(); if (places.length >= 2) mo.disconnect(); });
    mo.observe(app, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }
  document.addEventListener("visibilitychange", () => places.forEach((p) => p.updateLoop()));
  motionQuery.addEventListener && motionQuery.addEventListener("change", (e) => places.forEach((p) => p.setStatic(e.matches)));
  window.addEventListener("beforeprint", () => places.forEach((p) => p.renderer && p.renderer.setAnimationLoop(null)));
  new MutationObserver(() => places.forEach((p) => { p.retheme && p.retheme(); if (!p.running) p.render(); }))
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.__LVC_OBJECTS = { places, version: VERSION, programs: PROGRAMS };
}

// ทดสอบ/พรีวิว: สร้างโมเดลเดี่ยวลง renderer ที่กำหนด (ใช้ใน QA เท่านั้น)
export { PROGRAMS, BUILD, createLab, buildModel, loadThree };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
