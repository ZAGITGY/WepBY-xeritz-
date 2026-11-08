/* lvc-pet.js — ตัวการ์ตูนเดินเล่นมุมซ้ายล่าง (Sweetie Belle)
 *
 * - เดินไปมา หยุดยืน หันกลับ เหมือนสัตว์เลี้ยงในเกม
 * - แตะ/คลิก → กระโดดดีใจ เปลี่ยนสีหน้า
 * - ลากไปวางที่อื่นบนจอได้ (จำตำแหน่งไว้ในเครื่อง)
 * - ปุ่ม × ซ่อนตัวการ์ตูน และปุ่มเล็กมุมซ้ายล่างเรียกกลับมา (จำค่าไว้ในเครื่อง)
 *
 * โมเดล: assets/pet/sweetie-belle.glb (สร้างจาก source/pet/build_pet.py)
 * three.js r180 จาก vendor/three ใช้ชุดเดียวกับหน้าแรก
 */
const VERSION = "2026-11-08.1";
// อ้างอิงจากตำแหน่งไฟล์นี้ ใช้ได้แม้หน้า 404 ที่อยู่ลึกกว่า
const here = (p) => new URL(p, import.meta.url).href;
const THREE_URL = here("./vendor/three/three.module.min.js");
const GLTF_URL = here("./vendor/three/addons/GLTFLoader.min.js");
const MESHOPT_URL = here("./vendor/three/addons/meshopt_decoder.module.min.js");
const MODEL_URL = here("./assets/pet/sweetie-belle.glb?v=" + VERSION);
const STORE_KEY = "lvc-pet";

/* ---------- ขนาด/กล้อง (หน่วยโมเดล: สูงราว 1.82) ---------- */
const MODEL_H = 1.82;          // ปลายผมถึงพื้น
const VIEW_TOP = 2.2;          // เผื่อกระโดด/ยกแขน
const VIEW_BOTTOM = -0.08;
const VIEW_HALF_W = 0.62;
const TILT = 0.2;              // มุมกล้องก้มลงเล็กน้อย (เรเดียน)
const FOOT_PAD = -VIEW_BOTTOM / (VIEW_TOP - VIEW_BOTTOM);
const WALK_FOOT_SPEED = 0.4;   // หน่วยโมเดล/วินาที ที่ timeScale 1 (ก้าว 0.1 ทุกครึ่งรอบ 0.5 วิ)
const WALK_TS = 1.3;
const WALK_YAW = 1.2;          // หันข้างเกือบเต็ม แต่ยังเห็นหน้า

const doc = document;
const root = doc.documentElement;
const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const motionQ = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
const coarseQ = window.matchMedia ? matchMedia("(pointer: coarse)") : { matches: false };

const store = {
  read() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { return {}; } },
  write(patch) { try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(this.read(), patch))); } catch (e) {} },
};

const hasWebGL = () => {
  try { const c = doc.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
};

/* ---------- เปลี่ยนหน้า (lvc-transition.js) ---------- */
const TX = window.__LVC_TX || null;
const ARRIVING = !!(TX && TX.arriving);   // มาด้วยริบบิ้น: หน้าคลุมอยู่ รอ lvc:tx-open
const TX_KEY = "lvc-pet-tx";               // sessionStorage: ตำแหน่ง/ทิศ ตอนออกจากหน้าก่อน
const saveTxState = (p) => {
  try {
    const dir = p.yawTarget ? Math.sign(p.yawTarget) : p.dir || 1;
    sessionStorage.setItem(TX_KEY, JSON.stringify({ x: p.fx / (p.vw || 1), b: p.fb, dir, t: Date.now() }));
  } catch (e) {}
};
const takeTxState = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(TX_KEY) || "null");
    sessionStorage.removeItem(TX_KEY);
    if (v && Date.now() - v.t < 12000 && typeof v.x === "number" && typeof v.b === "number") return v;
  } catch (e) {}
  return null;
};

/* ---------- ท่าใหญ่ที่ชั้น DOM: keyframe ต่อคุณสมบัติ (dx/db เป็นหน่วย "ความสูงตัว") ---------- */
const MO_DEF = { dx: 0, db: 0, rot: 0, sx: 1, sy: 1, op: 1 };
const EASE = {
  lin: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
const sampleTrack = (arr, t, def) => {
  if (!arr) return def;
  if (t <= arr[0].t) return arr[0].v;
  for (let i = 1; i < arr.length; i++) {
    const b = arr[i];
    if (t <= b.t) {
      const a = arr[i - 1];
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return a.v + (b.v - a.v) * (EASE[b.e] || EASE.inOut)(u);
    }
  }
  return arr[arr.length - 1].v;
};

/* ---------- ตัดข้อความไทยเป็นกลุ่มอักษร (สระ/วรรณยุกต์ไม่แตก) ---------- */
const SEG = (() => { try { return new Intl.Segmenter("th", { granularity: "grapheme" }); } catch (e) { return null; } })();
const graphemes = (t) => SEG ? Array.from(SEG.segment(t), (x) => x.segment) : (t.match(/\P{M}\p{M}*/gu) || []);

/* ---------- ของสำคัญที่ห้ามยืนทับ (เพิ่มเองได้ด้วย data-pet-avoid · ยกเว้นด้วย data-pet-avoid="off") ---------- */
const AVOID = '[data-pet-avoid]:not([data-pet-avoid="off"]),h1,h2,h3,h4,p,li,a,button,input,select,textarea,label,canvas,' +
  '[role="button"],.site-header,.lvc-jr__tags a';
const SELF = ".lvc-pet,.lvc-pet-bubble,.lvc-pet-show";

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/* ---------- CSS ---------- */
const CSS = `
.lvc-pet{position:fixed;left:0;bottom:0;z-index:41;pointer-events:none;opacity:0;visibility:hidden;contain:layout style;will-change:transform}
.lvc-pet.is-zoomed{opacity:0!important;visibility:hidden!important;transition:opacity .2s ease,visibility 0s .2s}
.lvc-pet.is-zoomed *{visibility:hidden!important;pointer-events:none!important}
.lvc-pet.is-ready{opacity:1;visibility:visible}
.lvc-pet.is-gone{opacity:0;transition:opacity .25s ease}
.lvc-pet__body,.lvc-pet__fx{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.lvc-pet canvas{position:absolute;left:0;top:0;display:block;pointer-events:none}
.lvc-pet__shadow{position:absolute;border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,rgba(40,24,40,.30),rgba(40,24,40,0));transform-origin:50% 50%}
:root[data-theme="dark"] .lvc-pet__shadow{background:radial-gradient(closest-side,rgba(0,0,0,.55),rgba(0,0,0,0))}
.lvc-pet__hit{position:absolute;pointer-events:auto;cursor:grab;touch-action:none;border-radius:40% 40% 18% 18%;
  -webkit-tap-highlight-color:transparent;outline:none;-webkit-user-select:none;user-select:none}
.lvc-pet.is-held .lvc-pet__hit{cursor:grabbing}
.lvc-pet__hit:focus-visible{box-shadow:0 0 0 3px var(--gold,#c9a227)}
.lvc-pet__hide{position:absolute;width:28px;height:28px;padding:0;border:0;border-radius:50%;pointer-events:auto;cursor:pointer;
  display:grid;place-items:center;font:600 17px/1 system-ui,sans-serif;color:var(--ink,#241a1c);
  background:rgba(255,253,248,.92);box-shadow:0 4px 14px -6px rgba(36,25,28,.5);
  opacity:0;transform:scale(.7);transition:opacity .2s ease,transform .2s ease;visibility:hidden}
:root[data-theme="dark"] .lvc-pet__hide{background:rgba(40,34,38,.92);color:#f4efe6}
.lvc-pet:hover .lvc-pet__hide,.lvc-pet:focus-within .lvc-pet__hide,.lvc-pet.show-ui .lvc-pet__hide{opacity:1;transform:none;visibility:visible}
.lvc-pet.is-held .lvc-pet__hide{opacity:0;visibility:hidden}
.lvc-pet__hide:focus-visible{outline:3px solid var(--gold,#c9a227);outline-offset:2px}
.lvc-pet__heart{position:absolute;pointer-events:none;color:#ff6f9f;font:700 18px/1 system-ui,sans-serif;
  text-shadow:0 1px 0 #fff;animation:lvc-pet-heart 1.1s ease-out forwards}
@keyframes lvc-pet-heart{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx,0px),-46px) scale(1.15)}}
.lvc-pet-show{position:fixed;z-index:41;left:max(12px,env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));
  width:40px;height:40px;padding:0;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;
  color:#d6457f;background:rgba(255,253,248,.92);box-shadow:0 8px 22px -12px rgba(36,25,28,.55);
  transition:transform .2s ease,opacity .25s ease}
.lvc-pet-show[hidden]{display:none}
.lvc-pet-show:hover{transform:translateY(-2px)}
.lvc-pet-show:focus-visible{outline:3px solid var(--gold,#c9a227);outline-offset:2px}
:root[data-theme="dark"] .lvc-pet-show{background:rgba(40,34,38,.92);color:#ff8fb7}
.lvc-pet-show svg{width:20px;height:20px}
.lvc-pet-bubble{position:fixed;left:0;bottom:0;z-index:41;box-sizing:border-box;max-width:min(260px,calc(100vw - 24px));
  padding:8px 13px 9px;border-radius:14px;font:500 14px/1.45 var(--f-text,system-ui,sans-serif);color:var(--ink,#241f20);
  background:var(--surface-raised,#fffdf8);border:1px solid var(--line,#dfd9d2);box-shadow:0 10px 26px -14px rgba(36,25,28,.5);
  pointer-events:auto;cursor:pointer;opacity:0;visibility:hidden;transition:opacity .16s ease,visibility 0s .16s;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;white-space:pre-wrap;word-break:break-word}
.lvc-pet-bubble.is-on{opacity:1;visibility:visible;transition:opacity .16s ease}
.lvc-pet-bubble::before{content:"";position:absolute;left:14px;right:14px;top:-1px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,var(--gold,#cbb27d),transparent);opacity:.75}
.lvc-pet-bubble i{position:absolute;width:11px;height:11px;background:inherit;border:inherit;border-radius:0 0 3px 0;pointer-events:none}
.lvc-pet-bubble[data-side="up"] i{left:var(--tail,50%);bottom:-6px;margin-left:-6px;border-top:0;border-left:0;transform:rotate(45deg)}
.lvc-pet-bubble[data-side="r"] i{left:-6px;top:var(--tail,50%);margin-top:-6px;border-top:0;border-right:0;transform:rotate(45deg)}
.lvc-pet-bubble[data-side="l"] i{right:-6px;top:var(--tail,50%);margin-top:-6px;border-bottom:0;border-left:0;transform:rotate(45deg)}
.lvc-pet-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media print{.lvc-pet-bubble{display:none!important}}
@media print{.lvc-pet,.lvc-pet-show{display:none!important}}
`;

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.2.3.6.3.8 0 .7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

/* ---------- ปุ่มเรียกกลับ ---------- */
let showBtn = null;
const ensureShowButton = () => {
  if (showBtn) return showBtn;
  showBtn = doc.createElement("button");
  showBtn.type = "button";
  showBtn.className = "lvc-pet-show";
  showBtn.hidden = true;
  showBtn.setAttribute("aria-label", "แสดงตัวการ์ตูน");
  showBtn.title = "แสดงตัวการ์ตูน";
  showBtn.innerHTML = HEART_SVG;
  showBtn.addEventListener("click", () => {
    store.write({ hidden: false });
    showBtn.hidden = true;
    if (pet) pet.show(); else start("button");
  });
  doc.body.appendChild(showBtn);
  return showBtn;
};

/* ---------- กล่องคำพูด (DOM เหนือหัว ตามตัวไป อยู่ในจอเสมอ) ---------- */
const PRI = { idle: 1, event: 2, tap: 3 };
class Bubble {
  constructor(p) {
    this.p = p;
    const el = (this.el = doc.createElement("div"));
    el.className = "lvc-pet-bubble";
    el.dataset.side = "up";
    el.innerHTML = "<span></span><i></i>";
    el.setAttribute("aria-hidden", "true");           // ข้อความพูดเล่นไม่ต้องอ่าน คำตอบตอนแตะไปที่ live region
    this.txt = el.firstChild;
    this.sr = doc.createElement("div");
    this.sr.className = "lvc-pet-sr";
    this.sr.setAttribute("aria-live", "polite");
    doc.body.append(el, this.sr);
    this.cur = null;
    el.addEventListener("click", (e) => { e.stopPropagation(); this.tap(); });
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  get busy() { return !!this.cur; }
  // คืน true ถ้าได้พูด
  show(text, kind = "idle", opts = {}) {
    if (this.cur && PRI[kind] < PRI[this.cur.kind]) return false;
    const g = graphemes(text);
    this.cur = { text, kind, g, n: 0, t: 0, hold: opts.hold || clamp(2.5 + g.length * 0.11, 2.5, 8), typing: true, onClose: opts.onClose };
    // วัดขนาดจากข้อความเต็มก่อน กล่องจะไม่ขยายระหว่างพิมพ์
    const el = this.el;
    el.style.width = el.style.height = "";
    this.txt.textContent = text;
    el.style.visibility = "hidden"; el.classList.add("is-on");
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.width = w + "px"; el.style.height = h + "px";
    el.style.visibility = "";
    this.w = w; this.h = h;
    this.txt.textContent = "";
    if (opts.live) { this.sr.textContent = ""; setTimeout(() => { this.sr.textContent = text; }, 60); }
    this.place();
    return true;
  }
  tap() {
    const c = this.cur;
    if (!c) return;
    if (c.typing) { c.n = c.g.length; this.txt.textContent = c.text; c.typing = false; c.t = 0; c.hold = Math.min(c.hold, 2.2); }
    else this.close(true);
  }
  close(byUser) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.el.classList.remove("is-on");
    if (c.onClose) c.onClose(byUser);
    if (this.p.onBubbleClosed) this.p.onBubbleClosed(c, byUser);
  }
  update(dt) {
    const c = this.cur;
    if (!c) return false;
    if (c.typing) {
      c.t += dt;
      const step = 0.045;
      let changed = false;
      while (c.t >= step && c.n < c.g.length) { c.t -= step; c.n++; changed = true; }
      if (changed) this.txt.textContent = c.g.slice(0, c.n).join("");
      if (c.n >= c.g.length) { c.typing = false; c.t = 0; }
    } else {
      c.t += dt;
      if (c.t >= c.hold) { this.close(false); return false; }
    }
    this.place();
    return c.typing;
  }
  // ตำแหน่ง: เหนือหัว · ชิดขอบแล้วหางยังชี้ที่หัว · ไม่มีที่ด้านบน (แถบเมนู) → ไปด้านข้าง
  place() {
    const p = this.p, h = p.size.charH, el = this.el;
    const vw = p.vw, vh = innerHeight;
    const k = 1 - 0.25 * p.dim;
    const hx = p.fx + p.mo.dx * h;
    const headTop = p.fb + (p.mo.db + p.base.db) * h + h * 0.98 * p.mo.sy * k;   // ระยะจากขอบล่างถึงกลางหัวด้านบน
    const minTop = p.headerBottom + 8;
    let side = "up", x = hx - this.w / 2, b = headTop + 12;
    if (vh - b - this.h < minTop) {                                         // ด้านบนไม่พอ → ด้านข้าง
      side = hx < vw / 2 ? "r" : "l";
      x = side === "r" ? hx + 0.34 * h : hx - 0.34 * h - this.w;
      b = headTop - 0.2 * h - this.h / 2;
      b = clamp(b, 8, vh - minTop - this.h);
    }
    x = clamp(x, 8, Math.max(8, vw - this.w - 8));
    b = Math.max(b, 8);                                                     // ตัวมุดลงใต้ขอบ: กล่องยังอยู่ในจอ
    el.dataset.side = side;
    if (side === "up") el.style.setProperty("--tail", clamp(hx - x, 14, this.w - 14).toFixed(1) + "px");
    else el.style.setProperty("--tail", clamp(vh - (headTop - 0.2 * h) - (vh - b - this.h), 12, this.h - 12).toFixed(1) + "px");
    el.style.transform = `translate3d(${Math.round(x)}px,${-Math.round(b)}px,0)`;
  }
}

/* ---------- ตัวการ์ตูน ---------- */
let pet = null;

class Pet {
  constructor(THREE, gltf, opts = {}) {
    this.T = THREE;
    this.reduced = motionQ.matches;
    motionQ.addEventListener && motionQ.addEventListener("change", (e) => { this.reduced = e.matches; });

    /* DOM */
    const el = (this.el = doc.createElement("div"));
    el.className = "lvc-pet";
    el.innerHTML =
      '<div class="lvc-pet__shadow"></div><div class="lvc-pet__body"><div class="lvc-pet__fx"><canvas aria-hidden="true"></canvas>' +
      '<div class="lvc-pet__hit" role="button" tabindex="0" aria-label="ตัวการ์ตูน Sweetie Belle — กดเพื่อเล่นด้วย ลากเพื่อย้ายที่ หรือใช้ปุ่มลูกศรซ้าย/ขวา"></div></div></div>' +
      '<button type="button" class="lvc-pet__hide" aria-label="ซ่อนตัวการ์ตูน" title="ซ่อนตัวการ์ตูน">×</button>';
    doc.body.appendChild(el);
    this.canvas = el.querySelector("canvas");
    this.body = el.querySelector(".lvc-pet__body");   // ชั้นที่หมุนตอนถูกลาก (ปุ่ม × กับเงาไม่หมุนตาม)
    this.fxEl = el.querySelector(".lvc-pet__fx");     // ชั้นท่าใหญ่ (กระโดด ตก หมุน ย่อ-ยืด) จุดหมุนที่เท้า
    this.shadow = el.querySelector(".lvc-pet__shadow");
    this.hit = el.querySelector(".lvc-pet__hit");
    this.hideBtn = el.querySelector(".lvc-pet__hide");

    /* three */
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: "low-power" }));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-VIEW_HALF_W, VIEW_HALF_W, VIEW_TOP, VIEW_BOTTOM, 0.1, 40);
    this.camera.position.set(0, Math.sin(TILT) * 10, Math.cos(TILT) * 10);
    this.camera.lookAt(0, 0, 0);

    this.model = gltf.scene;
    this.morphs = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const m = o.material;
      const outline = /^OL_/.test(m.name);
      o.material = new THREE.MeshBasicMaterial({
        map: outline ? null : m.map,
        color: m.color,
        side: outline ? THREE.FrontSide : THREE.DoubleSide,
        transparent: m.transparent,
        opacity: m.opacity,
        depthWrite: !m.transparent,
      });
      if (m.transparent) o.renderOrder = 2;
      m.dispose();
      if (o.morphTargetDictionary) this.morphs.push(o);
    });
    this.pivot = new THREE.Group();
    this.pivot.add(this.model);
    this.scene.add(this.pivot);
    // กระดูกราก (ขยับขึ้นตอนกระโดด) ใช้ย่อเงาที่พื้น
    this.model.traverse((o) => { if (o.isBone && /^本模型/.test(o.name)) this.rootBone = o; });
    this.tmpV = new THREE.Vector3();
    this.rootRestY = this.rootBone ? this.rootBone.getWorldPosition(this.tmpV).y : 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (clip.name === "Happy") { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[clip.name] = a;
    }
    this.current = null;
    this.mixer.addEventListener("finished", (e) => { if (e.action === this.actions.Happy) this.onHappyDone(); });

    /* expressions */
    this.face = { happyEyes: 0, blink: 0, smile: 0, laugh: 0, squeeze: 0, open: 0, browsUp: 0, blush: 0 };
    this.faceTarget = Object.assign({}, this.face);
    this.blinkT = rand(1.5, 4);
    this.blinkPhase = -1;

    /* state */
    this.yaw = 0; this.yawTarget = 0;
    this.sway = 0; this.swayV = 0;     // มุมแกว่งตอนถูกลาก (เรเดียน) หมุนที่ DOM ไม่ใช่ในฉาก 3D
    this.dragV = 0; this.dragA = 0;
    this.state = "idle";
    this.stateT = rand(1.5, 3);
    this.dir = 1;
    this.targetX = 0;
    this.hidden = false;
    this.layout();
    const saved = store.read();
    this.anchorX = typeof saved.ax === "number" ? saved.ax * this.vw : this.size.w / 2 + 18;
    this.anchorB = typeof saved.ab === "number" ? saved.ab : this.defaultBottom();
    this.fx = this.anchorX;
    this.fb = this.anchorB;            // แกน y ทุกจุด = ระยะเท้าจากขอบล่างจอ
    if (opts.initPos) {                // มาจากหน้าก่อน: ยืนที่เดิม หันทางเดิม
      this.fx = opts.initPos.x * this.vw;
      this.fb = opts.initPos.b;
      this.dir = opts.initPos.dir || 1;
    }
    this.clampPos();
    this.mo = Object.assign({}, MO_DEF);   // ค่าเลื่อน/หมุน/ย่อของชั้นท่าใหญ่ (หน่วยความสูงตัว)
    this.motion = null;
    this.base = { db: 0 };                 // ค่าค้าง (เช่นมุดลงเหลือแค่หัวในโหมดผู้ชม)
    this.dim = 0; this.dimT = 0;           // ไม่มีที่ว่าง → ย่อ 75% และจาง
    this.headerBottom = 0;
    /* หลบของสำคัญ */
    this.overT = 0; this.lastMove = 0; this.lastScroll = 0; this.lastSearch = 0; this.tickAcc = 0;
    /* หันหัวมองตาม: หมุนกระดูกหลัง mixer.update() ทุกเฟรม (ไม่บวกสะสม) */
    this.model.traverse((o) => {
      if (!o.isBone) return;
      if (/^头骨/.test(o.name)) this.headBone = o;
      else if (/^颈椎.?002/.test(o.name)) this.neckBone = o;
    });
    this.lookBones = [this.neckBone, this.headBone].filter(Boolean);
    this.lookRest = this.lookBones.map((b) => b.quaternion.clone());
    this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0, target: null };
    this.q = { p: new THREE.Quaternion(), m: new THREE.Quaternion(), mi: new THREE.Quaternion(), d: new THREE.Quaternion(), w: new THREE.Quaternion(), e: new THREE.Euler() };
    this.bubble = new Bubble(this);
    this.talkT = 0;
    this.place();
    this.play("Idle", 0);

    this.bind();
    this.checkZoom();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    // สร้างแบบซ่อนไว้ก่อน คอมไพล์ shader ล่วงหน้า แล้วค่อยเล่นท่าเข้า (enter)
    this.exited = true;
    this.waitingEnter = false;
    try { renderer.compile(this.scene, this.camera); } catch (e) {}
    this.mixer.update(0);
    renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  defaultBottom() { return 10; }

  /* ---------- พูด ---------- */
  say(text, kind = "event", opts = {}) {
    if (!text || this.hidden || this.exited || this.zoomed) return false;
    return this.bubble.show(text, kind, opts);
  }

  /* ---------- หันหัวมองจุดบนจอ (x, y จากขอบบน) ---------- */
  lookAt(x, y) { this.look.target = x == null ? null : { x, y }; }

  updateLook(dt) {
    const L = this.look, h = this.size.charH;
    if (L.target) {
      const hx = this.fx + this.mo.dx * h;
      const hy = innerHeight - (this.fb + (this.mo.db + this.base.db) * h + 0.82 * h);
      const D = Math.max(260, h * 2.6);
      L.ty = clamp(Math.atan2(L.target.x - hx, D) - this.yaw, -0.85, 0.85);
      L.tp = clamp(Math.atan2(L.target.y - hy, D), -0.32, 0.42);
    } else { L.ty = 0; L.tp = 0; }
    L.yaw = damp(L.yaw, L.ty, 6, dt);
    L.pitch = damp(L.pitch, L.tp, 6, dt);
  }

  resetLookBones() { this.lookBones.forEach((b, i) => b.quaternion.copy(this.lookRest[i])); }

  applyLook() {
    const L = this.look;
    if (!this.lookBones.length || (Math.abs(L.yaw) < 1e-3 && Math.abs(L.pitch) < 1e-3)) return;
    const q = this.q;
    this.model.getWorldQuaternion(q.m);
    q.mi.copy(q.m).invert();
    const share = this.lookBones.length > 1 ? [0.35, 0.65] : [1];
    this.lookBones.forEach((bone, i) => {
      const k = share[i];
      q.d.setFromEuler(q.e.set(L.pitch * k, L.yaw * k, 0, "YXZ"));      // ในพื้นที่ของตัวละคร
      q.w.copy(q.m).multiply(q.d).multiply(q.mi);                          // → พื้นที่โลก
      bone.parent.getWorldQuaternion(q.p);
      q.d.copy(q.p).invert().multiply(q.w).multiply(q.p);                  // → พื้นที่ของพ่อกระดูก
      bone.quaternion.premultiply(q.d);
    });
  }

  /* ---------- หลบของสำคัญ ---------- */
  bodyRect(x, b, part = 1) {
    const u = this.size.ppu, vh = innerHeight;
    const hw = 0.3 * u, hh = 1.86 * u * part;
    return { l: x - hw, r: x + hw, t: vh - b - hh, b: vh - b };
  }

  // ใต้ตัว (สุ่ม 3×3 จุด) มีของสำคัญไหม · ยิงทีละจุดด้วย elementsFromPoint ไม่ไล่ทั้งหน้า
  blocked(rect) {
    let n = 0;
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.15, 0.5, 0.85]) {
      const x = rect.l + (rect.r - rect.l) * fx, y = rect.t + (rect.b - rect.t) * fy;
      if (x < 0 || y < 0 || x > this.vw || y > innerHeight) continue;
      const list = doc.elementsFromPoint(x, y);
      for (const e of list) {
        if (e.closest(SELF)) continue;
        if (e === root || e === doc.body) break;
        if (e.closest(AVOID) && !e.closest('[data-pet-avoid="off"]')) n++;
        break;
      }
    }
    return n;
  }

  findFree() {
    const b0 = this.defaultBottom(), w = this.size.w;
    const minX = w * 0.32 + 4, maxX = this.vw - w * 0.32 - 4;
    for (let d = 0; d < this.vw; d += 30) {
      for (const s of d ? [1, -1] : [1]) {
        const x = this.fx + s * d;
        if (x < minX || x > maxX) continue;
        if (!this.blocked(this.bodyRect(x, b0))) return { x, b: b0 };
      }
    }
    return null;
  }

  displaced() { return Math.abs(this.fx - this.anchorX) > 6 || Math.abs(this.fb - this.anchorB) > 3; }

  moveTo(x, b) {
    this.lastMove = performance.now();
    if (Math.abs(b - this.fb) < 3 && Math.abs(x - this.fx) < 200 && !this.reduced) {
      this.targetX = x; this.dir = x > this.fx ? 1 : -1;
      this.yawTarget = this.dir * WALK_YAW;
      this.setState("walk", 20);
      this.play("Walk", 0.25, WALK_TS);
      return;
    }
    this.jumpTo(x, b);
  }

  // กระโดดข้ามไปที่ใหม่ (ทำที่ชั้น DOM)
  jumpTo(x, b, dur = 0.75) {
    const h = this.size.charH;
    const dx0 = (this.fx - x) / h, db0 = (this.fb - b) / h;
    this.fx = x; this.fb = b;
    this.cancelMotion();
    this.setState("act", dur + 1);
    this.dir = dx0 < 0 ? 1 : -1;
    this.yawTarget = this.dir * 0.6;
    if (this.reduced) {
      this.runMotion([{ t: 0, op: 0 }, { t: 0.3, op: 1, e: "lin" }], 0.3, () => this.idle(2));
      return;
    }
    this.play("Held", 0.1);
    this.setFace({ smile: 0.8, open: 0.4 });
    const peak = Math.max(db0, 0) + 0.45;
    this.runMotion([
      { t: 0, dx: dx0, db: db0, sx: 1, sy: 1 },
      { t: dur * 0.12, sx: 1.08, sy: 0.9 },
      { t: dur * 0.3, sx: 0.96, sy: 1.05 },
      { t: dur * 0.48, dx: dx0 * 0.45, db: (db0 + peak) / 2 + 0.12, e: "out" },
      { t: dur * 0.82, dx: 0, db: 0, e: "in", do: () => { this.play("Idle", 0.1); } },
      { t: dur * 0.82, sx: 1, sy: 1 },
      { t: dur * 0.9, sx: 1.1, sy: 0.88 },
      { t: dur, sx: 1, sy: 1 },
    ], dur, () => this.idle(rand(2, 4)));
  }

  avoidTick(now) {
    if (this.state !== "idle" || this.spectating) { this.overT = 0; return; }
    const hit = this.blocked(this.bodyRect(this.fx, this.fb));
    this.overT = hit ? this.overT + 0.25 : 0;
    if (!hit && this.dimT) this.dimT = 0;
    if (this.overT >= 0.4 && now - this.lastMove > 1500 && now - this.lastSearch > 1200) {
      this.lastSearch = now;
      const spot = this.findFree();
      if (spot) { this.dimT = 0; this.overT = 0; this.moveTo(spot.x, spot.b); }
      else this.dimT = 1;
      return;
    }
    // บ้านว่างแล้ว และผู้ใช้หยุดเลื่อน ~1 วิ → กลับบ้าน
    if (!hit && this.displaced() && now - this.lastScroll > 1000 && now - this.lastMove > 1800 &&
        !this.blocked(this.bodyRect(this.anchorX, this.anchorB))) this.moveTo(this.anchorX, this.anchorB);
  }

  /* ---------- โหมดผู้ชม (ฉาก lvc-journey ตอนตรึงจอ) ---------- */
  journey() { const J = window.__LVC_JOURNEY; return J && J.trigger && J.trigger.isActive ? J : null; }

  spectateTick() {
    const J = this.journey();
    const free = this.state === "idle" || this.state === "walk" || this.state === "spectate" || this.state === "peek";
    if (J && !this.spectating && free && !this.reduced) this.startSpectate();
    else if (!J && this.spectating) this.endSpectate();
    if (!this.spectating || !J) return;
    // มองตามโมเดล: กลางของโมเดลที่อยู่หน้ากล้อง (ไม่มี → กลางฉาก)
    let x = this.vw * 0.5, y = innerHeight * 0.42;
    if (J.items && J.camera && J.T) {
      const v = this.tmpJ || (this.tmpJ = new J.T.Vector3());
      let sx = 0, sy = 0, n = 0;
      for (const it of J.items) {
        it.getWorldPosition(v); v.project(J.camera);
        if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) { sx += (v.x * 0.5 + 0.5) * J.W; sy += (-v.y * 0.5 + 0.5) * J.H; n++; }
      }
      if (n && J.p > 0.34 && J.p < 0.54) { x = sx / n; y = sy / n; }
    }
    this.lookAt(x, y);
    if (!this.wowSaid && J.p > 0.95) { this.wowSaid = true; this.say("ว้าว!", "event"); }
  }

  startSpectate() {
    this.spectating = true;
    this.wowSaid = false;
    this.preSpectate = { x: this.fx, b: this.fb };
    this.dimT = 0;
    this.say("ขอดูด้วยคนนะ", "event");
    // มุมล่างที่ว่างที่สุด
    const w = this.size.w, b0 = this.defaultBottom();
    const corners = [w * 0.32 + 4, this.vw - w * 0.32 - 4].map((x) => ({ x, n: this.blocked(this.bodyRect(x, b0, 0.45)) }));
    const corner = corners[0].n <= corners[1].n ? corners[0] : corners[1];
    this.cancelMotion();
    this.setState("spectate", 1e9);
    this.yawTarget = 0;
    this.play("Idle", 0.3);
    this.setFace({ smile: 0.5, browsUp: 0.4 });
    this.runMotion([
      { t: 0, db: 0 },
      { t: 0.9, db: 0 },
      { t: 1.25, db: -1.3, e: "in", do: () => { this.fx = corner.x; this.fb = b0; } },
      { t: 1.3, db: -1.3 },
      { t: 1.7, db: -0.62, e: "out" },
    ], 1.7, () => { this.base.db = -0.62; Object.assign(this.mo, MO_DEF); });
  }

  endSpectate() {
    this.spectating = false;
    this.lookAt(null);
    const back = this.preSpectate || { x: this.anchorX, b: this.anchorB };
    this.cancelMotion();
    this.setState("act", 3);
    this.runMotion([{ t: 0, db: 0 }, { t: 0.25, db: -0.7, e: "in" }], 0.25, () => {
      this.base.db = 0;
      this.fx = back.x; this.fb = back.b;
      this.clampPos();
      this.enter("return");
    });
  }

  // แตะตอนเป็นผู้ชม: โผล่ขึ้นมาแป๊บเดียวแล้วมุดกลับ
  spectatePeek() {
    if (this.state === "peek") return;
    if (this.base.db > -0.1) { this.say("ชู่ว์ ดูอยู่~", "tap", { live: true }); return; }   // ยังมุดไม่เสร็จ
    this.setState("peek", 3);
    this.setFace({ happyEyes: 1, smile: 1 });
    this.say("ชู่ว์ ดูอยู่~", "tap", { live: true });
    this.runMotion([
      { t: 0, db: 0 }, { t: 0.25, db: 0.62, e: "out" }, { t: 1.25, db: 0.62 }, { t: 1.55, db: 0, e: "in" },
    ], 1.55, () => { this.setState("spectate", 1e9); this.setFace({ smile: 0.5 }); });
  }

  onBubbleClosed() {}

  // .lvc-pet ติดขอบล่างด้วย CSS (bottom:0) แล้วเลื่อนขึ้นตามระยะเท้า → แถบเบราว์เซอร์ยุบ/ขยายไม่ทำให้เท้าคลาด
  place() {
    const h = this.size.charH, mo = this.mo || MO_DEF;
    const x = Math.round(this.fx + mo.dx * h - this.size.w / 2);
    const y = Math.round(this.footB - (this.fb + (mo.db + this.base.db) * h));
    this.el.style.transform = `translate3d(${x}px,${y}px,0)`;
  }

  /* ---------- ท่าใหญ่ที่ชั้น DOM ---------- */
  runMotion(keys, dur, done) {
    const tr = {}, cues = [];
    for (const k of keys) {
      for (const p in MO_DEF) if (p in k) (tr[p] || (tr[p] = [])).push({ t: k.t, v: k[p], e: k.e || "inOut" });
      if (k.do) cues.push({ t: k.t, fn: k.do });
    }
    for (const p in tr) tr[p].sort((a, b) => a.t - b.t);
    cues.sort((a, b) => a.t - b.t);
    this.motion = { tr, cues, t: 0, dur: dur != null ? dur : Math.max(...keys.map((k) => k.t)), done };
    this.updateMotion(0);
  }

  cancelMotion() {
    this.motion = null;
    Object.assign(this.mo, MO_DEF);
    this.applyMo();
  }

  updateMotion(dt) {
    const m = this.motion;
    if (!m) return;
    m.t += dt;
    for (const p in MO_DEF) this.mo[p] = sampleTrack(m.tr[p], m.t, MO_DEF[p]);
    while (m.cues.length && m.cues[0].t <= m.t) { const c = m.cues.shift(); try { c.fn(); } catch (e) {} }
    if (this.motion === m && m.t >= m.dur) { this.motion = null; if (m.done) m.done(); }
  }

  applyMo() {
    const m = this.mo, k = 1 - 0.25 * this.dim, sx = m.sx * k, sy = m.sy * k;
    const tf = m.rot || sx !== 1 || sy !== 1 ? `rotate(${m.rot.toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})` : "";
    if (tf !== this._fxTf) { this.fxEl.style.transform = tf; this._fxTf = tf; }
    const o = m.op * (1 - 0.5 * this.dim);
    const op = o >= 0.999 ? "" : o.toFixed(3);
    if (op !== this._fxOp) { this.fxEl.style.opacity = op; this._fxOp = op; }
  }

  /* ---------- ท่าเข้า / ท่าออก ---------- */
  enter(kind = "first") {
    this.exited = false;
    this.waitingEnter = false;
    this.cancelMotion();
    this.base.db = 0;
    this.el.style.visibility = "";
    this.el.classList.remove("is-gone");
    this.el.classList.add("is-ready");
    if (this.clock) this.clock.getDelta();
    this.yawTarget = 0;
    if (this.reduced) {                         // ลดการเคลื่อนไหว: จางเข้าอย่างเดียว
      this.setState("act", 2);
      this.play("Idle", 0);
      this.runMotion([{ t: 0, op: 0 }, { t: 0.45, op: 1, e: "lin" }], 0.45, () => this.idle(3));
      return;
    }
    if (kind === "walk-in") {                   // โหลดไม่ทันริบบิ้น: เดินเข้าจากขอบจอ
      const target = this.fx;
      const fromLeft = target < this.vw / 2;
      this.fx = fromLeft ? -this.size.w / 2 : this.vw + this.size.w / 2;
      this.targetX = target;
      this.dir = fromLeft ? 1 : -1;
      this.yaw = this.yawTarget = this.dir * WALK_YAW;
      this.setState("walk", 20);
      this.play("Walk", 0, WALK_TS);
      this.setFace({ smile: 0.7 });
      return;
    }
    // กระโดดพรวดขึ้นจากใต้ขอบจอ ลงพื้นแล้วย่อตัว
    this.setState("act", 2.5);
    this.yaw = this.dir * 0.5;
    this.play("Held", 0);
    this.setFace({ happyEyes: 1, open: 0.6 });
    this.runMotion([
      { t: 0, db: -1.25, sx: 1, sy: 1 },
      { t: 0.36, db: 0.42, e: "out" },
      { t: 0.6, db: 0, e: "in", do: () => { this.play("Idle", 0.12); this.setFace({ smile: 1, blush: 0.3 }); } },
      { t: 0.6, sx: 1, sy: 1 },
      { t: 0.7, sx: 1.12, sy: 0.86, e: "out" },
      { t: 0.86, sx: 0.97, sy: 1.04 },
      { t: 1.0, sx: 1, sy: 1 },
    ], 1.0, () => this.idle(rand(2, 4)));
  }

  leave() {
    if (this.hidden || this.exited) return;
    this.bubble.close(false);
    if (this.spectating) { this.spectating = false; this.lookAt(null); }
    this.base.db = 0;
    saveTxState(this);
    this.el.classList.remove("is-held", "show-ui");
    this.cancelMotion();
    this.exited = true;                         // loop ยังวาดต่อจนท่าออกจบ (มี motion)
    this.setState("act", 1.5);
    const done = () => { this.el.style.visibility = "hidden"; this.el.classList.remove("is-ready"); };
    if (this.reduced) { this.runMotion([{ t: 0, op: 1 }, { t: 0.3, op: 0, e: "lin" }], 0.3, done); return; }
    // กระโดดเล็ก ๆ แล้วจางหาย (≤ 0.8 วิ ก่อนริบบิ้นคลุมจอ)
    this.yawTarget = 0;
    this.playHappy();
    this.setFace({ happyEyes: 1, smile: 1 });
    this.runMotion([
      { t: 0, db: 0, sx: 1, sy: 1, op: 1 },
      { t: 0.1, sx: 1.1, sy: 0.88 },
      { t: 0.3, sx: 0.95, sy: 1.06, db: 0.32, e: "out" },
      { t: 0.45, op: 1 },
      { t: 0.62, db: 0.5, op: 0, e: "in" },
    ], 0.62, done);
  }

  /* ขนาดตามจอ */
  layout() {
    this.vw = root.clientWidth || innerWidth;
    this.vh = innerHeight;
    const charH = this.vw < 560 ? 104 : this.vw < 1024 ? 128 : 148;
    const ch = Math.round(charH * (VIEW_TOP - VIEW_BOTTOM) / MODEL_H);
    const cw = Math.round(ch * (2 * VIEW_HALF_W) / (VIEW_TOP - VIEW_BOTTOM));
    this.size = { w: cw, h: ch, charH, ppu: ch / (VIEW_TOP - VIEW_BOTTOM) };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(cw, ch, false);
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.el.style.width = cw + "px";
    this.el.style.height = ch + "px";
    const u = this.size.ppu;
    const footY = ch * (1 - FOOT_PAD);
    // พื้นที่แตะ ครอบลำตัว
    const hw = 0.3 * u, hh = 1.86 * u;
    Object.assign(this.hit.style, { left: cw / 2 - hw + "px", top: footY - hh + "px", width: hw * 2 + "px", height: hh + "px" });
    Object.assign(this.hideBtn.style, { left: cw / 2 + hw - 10 + "px", top: footY - hh - 4 + "px" });
    const sw = 0.62 * u, sh = 0.16 * u;
    Object.assign(this.shadow.style, { left: cw / 2 - sw / 2 + "px", top: footY - sh / 2 + "px", width: sw + "px", height: sh + "px" });
    this.footY = footY;
    this.footB = ch - footY;           // ขอบล่างแคนวาส → เท้า
    this.fxEl.style.transformOrigin = `${cw / 2}px ${footY}px`;
  }

  clampPos() {
    const { w } = this.size;
    const minX = w * 0.32 + 4, maxX = this.vw - w * 0.32 - 4;
    this.fx = clamp(this.fx, minX, maxX);
    this.fb = clamp(this.fb, 4, Math.max(4, this.vh - this.size.charH - 8));
    this.anchorX = clamp(this.anchorX, minX, maxX);
  }

  roamRange() {
    const r = clamp(this.vw * 0.17, 70, 230);
    const minX = this.size.w * 0.32 + 4, maxX = this.vw - this.size.w * 0.32 - 4;
    return [Math.max(minX, this.anchorX - r), Math.min(maxX, this.anchorX + r)];
  }

  /* ---------- อนิเมชัน ---------- */
  play(name, fade = 0.25, ts = 1) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = ts;
    if (this.current === next) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.current && fade > 0) next.crossFadeFrom(this.current, fade, false);
    else if (this.current) this.current.stop();
    this.current = next;
  }

  setFace(f) { this.faceTarget = Object.assign({ happyEyes: 0, blink: 0, smile: 0, laugh: 0, squeeze: 0, open: 0, browsUp: 0, blush: 0 }, f); }

  updateFace(dt) {
    // กะพริบตา
    const eyesBusy = this.faceTarget.happyEyes > 0.1 || this.faceTarget.squeeze > 0.1;
    if (this.blinkPhase < 0) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && !eyesBusy) { this.blinkPhase = 0; }
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      blink = Math.sin(Math.min(1, this.blinkPhase) * Math.PI);
      if (this.blinkPhase >= 1) { this.blinkPhase = -1; this.blinkT = Math.random() < 0.2 ? 0.25 : rand(2, 5); }
    }
    for (const k in this.face) this.face[k] = damp(this.face[k], this.faceTarget[k], 14, dt);
    const vals = Object.assign({}, this.face, { blink: Math.max(this.face.blink, eyesBusy ? 0 : blink) });
    if (this.talking) { this.talkT += dt; vals.open = Math.max(vals.open, 0.18 + 0.42 * Math.abs(Math.sin(this.talkT * 15))); }
    for (const m of this.morphs) {
      const dict = m.morphTargetDictionary, inf = m.morphTargetInfluences;
      for (const k in dict) inf[dict[k]] = vals[k] || 0;
    }
  }

  /* ---------- พฤติกรรม ---------- */
  setState(s, t) { this.state = s; this.stateT = t; }

  think() {
    if (this.reduced) { this.setState("idle", 4); this.yawTarget = 0; return; }
    const r = Math.random();
    if (this.state === "idle" && r < 0.14) { this.hop(); return; }
    if (this.displaced() || this.dimT) { this.setState("idle", rand(3, 6)); return; }   // หลบอยู่: ไม่เดินเล่น
    const [a, b] = this.roamRange();
    if (b - a < 40) { this.setState("idle", rand(3, 6)); return; }
    let tx = rand(a, b), tries = 0;
    while ((Math.abs(tx - this.fx) < 45 || this.blocked(this.bodyRect(tx, this.fb))) && tries++ < 6) tx = rand(a, b);
    if (Math.abs(tx - this.fx) < 30 || this.blocked(this.bodyRect(tx, this.fb))) { this.setState("idle", rand(2, 4)); return; }
    this.targetX = tx;
    this.dir = tx > this.fx ? 1 : -1;
    this.yawTarget = this.dir * WALK_YAW;
    this.setState("walk", 20);
    this.play("Walk", 0.3, WALK_TS);
    this.setFace({ smile: 0.6 });
  }

  idle(t = rand(2.5, 6)) {
    this.setState("idle", t);
    this.yawTarget = 0;
    this.play("Idle", 0.35);
    this.setFace({ smile: Math.random() < 0.5 ? 0.35 : 0 });
  }

  hop() {
    this.setState("hop", 3);
    this.yawTarget = 0;
    this.playHappy();
    this.setFace({ smile: 1, browsUp: 0.5 });
  }

  react() {
    if (this.state === "held" || this.exited) return;
    if (this.spectating) { this.spectatePeek(); return; }
    this.cancelMotion();
    this.showUi();
    if (this.reduced) {
      this.setFace({ happyEyes: 1, laugh: 1, blush: 1 });
      clearTimeout(this.faceTO);
      this.faceTO = setTimeout(() => this.setFace({ smile: 0.4 }), 1400);
      return;
    }
    this.setState("happy", 3);
    this.yawTarget = 0;
    this.playHappy();
    this.setFace({ happyEyes: 1, laugh: 1, blush: 1 });
    this.hearts();
  }

  playHappy() {
    const a = this.actions.Happy;
    if (this.current === a) a.reset().play();   // แตะซ้ำระหว่างกระโดด: เริ่มใหม่
    else this.play("Happy", 0.12);
  }

  onHappyDone() {
    if (this.state === "happy" || this.state === "hop") this.idle(rand(2, 4));
  }

  hearts() {
    const u = this.size.ppu;
    for (let i = 0; i < 3; i++) {
      const h = doc.createElement("span");
      h.className = "lvc-pet__heart";
      h.textContent = "♥";
      h.style.left = this.size.w / 2 + (i - 1) * 0.28 * u - 7 + "px";
      h.style.top = this.footY - 1.95 * u + "px";
      h.style.setProperty("--dx", (i - 1) * 14 + "px");
      h.style.animationDelay = i * 0.12 + "s";
      this.el.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  }

  showUi() {
    if (!coarseQ.matches) return;
    this.el.classList.add("show-ui");
    clearTimeout(this.uiTO);
    this.uiTO = setTimeout(() => this.el.classList.remove("show-ui"), 3500);
  }

  /* ---------- อินพุต ---------- */
  bind() {
    const hit = this.hit;
    let down = null;
    hit.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      hit.setPointerCapture && hit.setPointerCapture(e.pointerId);
      down = { x: e.clientX, y: e.clientY, t: performance.now(), dragging: false, id: e.pointerId };
    });
    hit.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.dragging && dx * dx + dy * dy > 49) {
        down.dragging = true;
        this.startHold(e);
      }
      if (down.dragging) this.moveHold(e);
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down; down = null;
      if (d.dragging) { if (this.state === "held") this.endHold(); }
      else if (e.type === "pointerup" && !this.zoomed) this.react();
    };
    hit.addEventListener("pointerup", up);
    hit.addEventListener("pointercancel", up);
    hit.addEventListener("contextmenu", (e) => e.preventDefault());
    hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.react(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const s = e.key === "ArrowLeft" ? -1 : 1;
        this.anchorX = clamp(this.fx + s * 90, 0, this.vw);   // ย้ายบ้านแค่แกน x (ความสูงบ้านที่ผู้ใช้ลากไว้คงเดิม)
        this.clampPos();
        this.saveAnchor();
        if (this.reduced) { this.fx = this.anchorX; return; }
        this.targetX = this.anchorX;
        this.dir = s;
        this.yawTarget = s * WALK_YAW;
        this.setState("walk", 20);
        this.play("Walk", 0.25, WALK_TS);
      }
    });
    this.hideBtn.addEventListener("click", (e) => { e.stopPropagation(); this.hide(true); });
    this.hideBtn.addEventListener("pointerdown", (e) => e.stopPropagation());

    let rt = 0;
    const relayout = () => {
      cancelAnimationFrame(rt);
      rt = requestAnimationFrame(() => {
        if (this.zoomed) return;
        const ratio = this.anchorX / (this.vw || 1);
        this.layout();
        this.anchorX = ratio * this.vw;
        // ตำแหน่งบนจออิงขอบล่างอยู่แล้ว ไม่ต้องแปลงค่าตามความสูงจอ
        // บ้านที่ผู้ใช้ลากไว้ (anchorB) ไม่ถูกแก้ แค่บีบให้อยู่ในจอเวลาจอเตี้ยลง
        if (this.state !== "held") this.fb = this.anchorB;
        this.clampPos();
      });
    };
    addEventListener("resize", () => { if (!this.checkZoom()) relayout(); });
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", () => { const was = this.zoomed; if (!this.checkZoom() && was) relayout(); });
    doc.addEventListener("visibilitychange", () => { if (!doc.hidden && this.clock) this.clock.getDelta(); });
    addEventListener("scroll", () => { this.lastScroll = performance.now(); }, { passive: true });
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.destroy(); }, false);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.loop = () => {};
    this.el.remove();
    this.bubble.el.remove(); this.bubble.sr.remove();
    try { this.renderer.dispose(); } catch (e) {}
    if (pet === this) { pet = null; window.__LVC_PET = null; }
  }

  startHold(e) {
    if (this.exited) return;
    this.cancelMotion();
    if (this.spectating) { this.spectating = false; this.lookAt(null); this.fb += this.base.db * this.size.charH; }
    this.base.db = 0;
    this.dimT = 0;
    this.setState("held", 0);
    this.el.classList.add("is-held");
    this.play("Held", 0.15);
    this.setFace({ squeeze: 1, open: 1, blush: 0.6 });
    this.yawTarget = 0;
    // จับที่แถว ๆ มือ/ศีรษะ (แกน y นับจากขอบล่าง)
    this.grab = { ox: this.fx - e.clientX, ob: this.fb - (innerHeight - e.clientY) };
    this.holdX = this.fx; this.holdB = this.fb;
    // จุดหมุน = จุดที่จับ (พิกัดใน .lvc-pet ซึ่งเท้าอยู่ที่ (w/2, footY))
    this.body.style.transformOrigin = `${(this.size.w / 2 - this.grab.ox).toFixed(1)}px ${(this.footY + this.grab.ob).toFixed(1)}px`;
    this.dragV = 0; this.dragA = 0;
    this.lastX = e.clientX;
  }

  moveHold(e) {
    this.holdX = e.clientX + this.grab.ox;
    this.holdB = innerHeight - e.clientY + this.grab.ob;
  }

  endHold() {
    this.el.classList.remove("is-held");
    this.clampPos();
    this.anchorX = this.fx;
    this.anchorB = this.fb;
    this.saveAnchor();
    this.idle(rand(1.5, 3));
    this.setFace({ smile: 0.8, blush: 0.3 });
    clearTimeout(this.faceTO);
    this.faceTO = setTimeout(() => { if (this.state === "idle") this.setFace({ smile: 0.3 }); }, 1600);
  }

  /* ลูกตุ้ม: θ'' = −ω²·sinθ + (a/L)·cosθ − c·θ'  (θ บวก = ตามเข็มนาฬิกา = เท้าเหวี่ยงไปทางซ้าย) */
  swing(dt, accel) {
    const held = this.state === "held";
    if (!held && Math.abs(this.sway) < 0.002 && Math.abs(this.swayV) < 0.01) {
      if (this.sway !== 0) { this.sway = 0; this.swayV = 0; this.body.style.transform = ""; }
      return;
    }
    const L = this.size.charH * 0.6;                 // ระยะจุดจับถึงกลางตัว (px)
    const w2 = 50, c = held ? 4.5 : 11;             // คาบแกว่งราว 0.9 วิ · ปล่อยแล้วหยุดไว
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -w2 * Math.sin(this.sway) + (accel / L) * Math.cos(this.sway) - c * this.swayV;
      this.swayV += a * h;
      this.sway = clamp(this.sway + this.swayV * h, -0.52, 0.52);   // สูงสุด ~30°
      if (Math.abs(this.sway) >= 0.52) this.swayV *= 0.3;
    }
    this.body.style.transform = `rotate(${(this.sway * 180 / Math.PI).toFixed(2)}deg)`;
  }

  saveAnchor() {
    if (this.zoomed) return;
    store.write({ ax: this.anchorX / (this.vw || 1), ab: this.anchorB });
  }

  /* ซูมสองนิ้ว: จางหาย กดไม่ได้ ไม่บันทึก ไม่คำนวณตำแหน่งใหม่ ซูมกลับแล้วอยู่ที่เดิม */
  checkZoom() {
    const vv = window.visualViewport;
    const z = !!(vv && vv.scale > 1.01);
    if (z !== this.zoomed) {
      this.zoomed = z;
      this.el.classList.toggle("is-zoomed", z);
      if (z && this.state === "held") {          // ซูมกลางการลาก: ยกเลิก ไม่ย้ายบ้าน
        this.el.classList.remove("is-held");
        this.fx = this.anchorX; this.fb = this.anchorB;
        this.idle(2);
      }
    }
    return z;
  }

  hide(save) {
    if (this.hidden) return;
    this.hidden = true;
    this.bubble.close(false);
    if (save) store.write({ hidden: true });
    this.el.classList.add("is-gone");
    const btn = ensureShowButton();
    setTimeout(() => {
      if (!this.hidden) return;
      this.el.style.visibility = "hidden";
      btn.hidden = false;
      if (doc.activeElement === this.hideBtn || this.el.contains(doc.activeElement)) btn.focus();
    }, 260);
  }

  show() {
    if (!this.hidden) return;
    this.hidden = false;
    this.enter("call");
  }

  /* ---------- เฟรม ---------- */
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    this.acc = (this.acc || 0) + this.clock.getDelta();
    if (this.hidden || this.zoomed || (this.exited && !this.motion)) { this.acc = 0; return; }
    // ยืนเฉย ๆ วาดแค่ ~30 ภาพ/วินาที ประหยัดแบต
    const calm = (this.state === "idle" || this.state === "spectate") && !this.motion && this.blinkPhase < 0 && !this.talking && this.dim === this.dimT;
    if (calm && this.acc < 1 / 30) return;
    const raw = this.acc;
    const dt = Math.min(0.1, raw);
    this.acc = 0;

    // ตัดสินใจ
    if (this.state !== "held") {
      this.stateT -= dt;
      if (this.state === "idle" && this.stateT <= 0) this.think();
      // กันค้าง: ท่าไหนเกินเวลาที่ตั้งไว้ กลับไปยืนเอง
      if (this.state === "act" && this.stateT <= 0 && !this.exited) { this.cancelMotion(); this.idle(); }
    }
    this.updateMotion(Math.min(0.25, raw));   // ท่าเข้า/ออกยึดเวลาจริง จบตรงเวลาแม้เครื่องช้า
    // ตรวจทุก ~250 ms (ไม่ใช่ทุกเฟรม): โหมดผู้ชม · หลบของสำคัญ · ตำแหน่งแถบเมนู
    this.tickAcc += raw;
    if (this.tickAcc >= 0.25 && !this.exited) {
      this.tickAcc = 0;
      const now = performance.now();
      const hdr = doc.querySelector(".site-header");
      this.headerBottom = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
      this.spectateTick();
      this.avoidTick(now);
    }
    this.dim = damp(this.dim, this.dimT, 5, dt);
    if (Math.abs(this.dim - this.dimT) < 0.002) this.dim = this.dimT;
    this.applyMo();
    this.talking = this.bubble.update(raw);

    // เดิน
    if (this.state === "walk") {
      const speed = WALK_FOOT_SPEED * WALK_TS * Math.abs(Math.sin(this.yaw)) * this.size.ppu;
      const turned = Math.abs(this.yaw - this.yawTarget) < 0.35;
      if (turned) this.fx += this.dir * speed * dt;
      if ((this.dir > 0 && this.fx >= this.targetX) || (this.dir < 0 && this.fx <= this.targetX)) {
        this.fx = this.targetX;
        this.idle();
      }
    }

    // ถูกลาก: ตามนิ้ว/เมาส์แบบหน่วงนิด ๆ ตัวห้อยใต้จุดที่จับ แกว่งเหมือนลูกตุ้ม
    let accel = 0;
    if (this.state === "held") {
      const px = this.fx;
      this.fx = damp(this.fx, this.holdX, 22, dt);
      this.fb = damp(this.fb, this.holdB, 22, dt);
      const vx = (this.fx - px) / Math.max(dt, 1e-3);
      const ax = (vx - this.dragV) / Math.max(dt, 1e-3);
      this.dragV = vx;
      this.dragA = damp(this.dragA, ax, 18, dt);
      accel = this.dragA;
    }
    this.swing(dt, accel);

    this.yaw = damp(this.yaw, this.yawTarget, 9, dt);
    this.model.rotation.y = this.yaw;

    this.updateLook(dt);
    this.resetLookBones();
    this.mixer.update(dt);
    this.applyLook();
    this.updateFace(dt);

    // ตำแหน่งบนจอ (ใช้ปลายเท้าเป็นจุดอ้างอิง)
    this.place();
    let lift = 0;
    if (this.rootBone) { this.model.updateMatrixWorld(); lift = Math.max(0, this.rootBone.getWorldPosition(this.tmpV).y - this.rootRestY); }
    const up = this.mo.db;               // ท่าใหญ่ลอยขึ้น/มุดลง: เงาอยู่ที่พื้นเสมอ
    const s = this.state === "held" || up < -0.05 ? 0 : clamp(1 - lift * 2.2 - up * 1.4, 0.3, 1) * this.mo.op;
    this.shadow.style.opacity = String(+s.toFixed(3));
    this.shadow.style.transform = `translateY(${(up * this.size.charH).toFixed(1)}px) scale(${Math.max(s, 0.3).toFixed(3)})`;

    this.renderer.render(this.scene, this.camera);
  }
}

/* ---------- เริ่มทำงาน ---------- */
// โหลดไฟล์ทันทีที่สคริปต์ทำงาน (มักอยู่ในแคชแล้ว) แต่สร้างฉาก 3D หลัง intro จบ ไม่ให้ intro สะดุด
let assetsP = null;
const loadAssets = () => assetsP || (assetsP = Promise.all([
  import(THREE_URL), import(GLTF_URL), import(MESHOPT_URL),
  fetch(MODEL_URL, { priority: "low" }).then((r) => { if (!r.ok) throw new Error("model " + r.status); return r.arrayBuffer(); }),
]));

const introGate = () => new Promise((resolve) => {
  if (!root.classList.contains("lvc-loading")) return resolve();
  const done = () => { mo.disconnect(); removeEventListener("lvc:loaded", done); resolve(); };
  const mo = new MutationObserver(() => { if (!root.classList.contains("lvc-loading")) done(); });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  addEventListener("lvc:loaded", done);
});

// เปิดเว็บครั้งแรก/รีเฟรช (ไม่มี intro): รอหน้าโหลดเสร็จ แต่ไม่เกิน 1.2 วิ
const pageGate = () => doc.readyState === "complete" ? Promise.resolve()
  : new Promise((resolve) => { addEventListener("load", resolve, { once: true }); setTimeout(resolve, 1200); });

let txOpen = !ARRIVING;
let starting = false;
async function start(how) {
  if (starting || pet) return;
  starting = true;
  try {
    const [[THREE, { GLTFLoader }, { MeshoptDecoder }, buf]] = await Promise.all([loadAssets(), introGate()]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => loader.parse(buf, here("./assets/pet/"), res, rej));
    const initPos = how === "boot" ? takeTxState() : null;
    pet = new Pet(THREE, gltf, { initPos });
    window.__LVC_PET = pet;
    if (how === "button") pet.enter("call");
    else if (ARRIVING && !txOpen) pet.waitingEnter = true;      // เข้าพร้อมริบบิ้นแหวก
    else if (ARRIVING) pet.enter("walk-in");                     // ริบบิ้นแหวกไปแล้ว: เดินเข้าจากขอบจอ
    else { await pageGate(); pet.enter("first"); }
  } catch (err) {
    console.warn("[lvc-pet] ปิดตัวการ์ตูน:", err);
    if (pet && pet.el) pet.el.remove();
    pet = null;
  } finally {
    starting = false;
  }
}

addEventListener("lvc:tx-open", () => {
  txOpen = true;
  if (pet && pet.waitingEnter) pet.enter("tx");
});
addEventListener("lvc:tx-leave", () => { if (pet) pet.leave(); });
// เปลี่ยนหน้าไม่สำเร็จ หรือกด Back แล้วได้หน้าเดิมจาก bfcache: ตัวเดิมกลับมา (ไม่สร้างใหม่ จึงไม่ซ้อนสองตัว)
const comeBack = () => { if (pet && pet.exited && !pet.hidden && !pet.waitingEnter) pet.enter("return"); };
addEventListener("lvc:tx-cancel", comeBack);
addEventListener("pageshow", (e) => { if (e.persisted) comeBack(); });

(function init() {
  if (window.__LVC_PET_BOOT || !hasWebGL()) return;
  window.__LVC_PET_BOOT = true;
  const style = doc.createElement("style");
  style.id = "lvc-pet-style";
  style.textContent = CSS;
  doc.head.appendChild(style);
  if (store.read().hidden) {
    ensureShowButton().hidden = false;
    return;
  }
  if (conn && conn.saveData) {          // ประหยัดเน็ต: ไม่โหลดเอง ให้กดเรียกเอง
    ensureShowButton().hidden = false;
    return;
  }
  start("boot");
})();
