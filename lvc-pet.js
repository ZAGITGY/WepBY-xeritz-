/* lvc-pet.js — ตัวการ์ตูนเดินเล่นบนเว็บ (Sweetie Belle) · v13.2
 *
 * โครง
 * - ตัวละคร 3D (three.js r180, assets/pet/sweetie-belle.glb) วาดในแคนวาสเล็กที่เลื่อนตามตัว
 *   คลิปที่มี: Idle / Walk / Happy / Held + morph หน้า 8 ตัว + หมุนกระดูกหลัง mixer.update() (หัว คอ ผม กระโปรง)
 * - ท่าใหญ่ (กระโดด ตก วิ่ง ตีลังกา ย่อ-ยืด) ทำที่ชั้น DOM ไม่ทำในฉาก 3D (แคนวาสแคบ จะโดนตัด)
 * - ท่าทั้งหมดเป็นข้อมูลใน pet-reactions.js · บทพูดใน pet-lines.js
 * - ตำแหน่งอิงขอบล่างจอ (bottom:0 + translate) · ซูมสองนิ้ว = จางหาย ไม่บันทึก
 * - เข้า/ออกพร้อมริบบิ้นเปลี่ยนหน้า (lvc:tx-open / lvc:tx-leave) · โหมดผู้ชมในฉาก lvc-journey · หลบของสำคัญ
 * - ?petdebug=1 แสดงค่าวัดและเมนูเล่นทุกท่า
 */
import LINES from "./pet-lines.js?v=2026-11-08.2";
import ACTS from "./pet-reactions.js?v=2026-11-08.2";

const VERSION = "2026-11-08.2";
// อ้างอิงจากตำแหน่งไฟล์นี้ ใช้ได้แม้หน้า 404 ที่อยู่ลึกกว่า
const here = (p) => new URL(p, import.meta.url).href;
const THREE_URL = here("./vendor/three/three.module.min.js");
const GLTF_URL = here("./vendor/three/addons/GLTFLoader.min.js");
const MESHOPT_URL = here("./vendor/three/addons/meshopt_decoder.module.min.js");
const MODEL_URL = here("./assets/pet/sweetie-belle.glb?v=2026-11-08.1");
const STORE_KEY = "lvc-pet";          // localStorage: ax ab hidden (รูปแบบเดิม)
const HIST_KEY = "lvc-pet-moves";     // localStorage: ประวัติท่าเข้า/ออก + เข้าเว็บล่าสุด
const SESS_KEY = "lvc-pet-s";         // sessionStorage: ประโยคที่พูดแล้ว ทักแล้ว ท่าล่าสุด โหมดเงียบ

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
const mm = (q) => (window.matchMedia ? matchMedia(q) : { matches: false, addEventListener() {} });
const motionQ = mm("(prefers-reduced-motion: reduce)");
const coarseQ = mm("(pointer: coarse)");
const fineQ = mm("(hover: hover) and (pointer: fine)");
const DEBUG = /[?&]petdebug=1(&|$)/.test(location.search);

/* หน้าไหน (ใช้เลือกคำทักทาย) */
const PAGE = (() => {
  const m = /([a-z0-9-]+)\.html?$/i.exec(location.pathname);
  const p = m ? m[1].toLowerCase() : /\/$/.test(location.pathname) ? "index" : "404";
  return ["index", "programs", "news", "contact"].includes(p) ? p : "404";
})();

/* วันพิเศษ */
const SPECIAL = (() => {
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  if (m === 1 && day === 1) return "newyear";
  if (m === 2 && day === 14) return "valentine";
  if (m === 4 && day >= 13 && day <= 15) return "songkran";
  return null;
})();

const jsonStore = (area, key) => ({
  read() { try { return JSON.parse(window[area].getItem(key) || "{}") || {}; } catch (e) { return {}; } },
  write(v) { try { window[area].setItem(key, JSON.stringify(v)); } catch (e) {} },
});
const store = {
  read() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { return {}; } },
  write(patch) { try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(this.read(), patch))); } catch (e) {} },
};
const hist = jsonStore("localStorage", HIST_KEY);
const sess = jsonStore("sessionStorage", SESS_KEY);

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
const SELF = ".lvc-pet,.lvc-pet-bubble,.lvc-pet-show,.lvc-pet-debug";

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const lineList = (key) => key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), LINES);
const isTyping = () => {
  const a = doc.activeElement;
  if (!a) return false;
  if (a.isContentEditable || a.tagName === "TEXTAREA" || a.tagName === "SELECT") return true;
  return a.tagName === "INPUT" && !/^(button|checkbox|radio|submit|reset|range|color|file|image)$/i.test(a.type);
};

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
/* สัญลักษณ์ (DOM/SVG เล็ก ๆ ขยับแค่ transform/opacity · สีตามธีมเว็บ) */
.lvc-pet-sym{position:absolute;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;pointer-events:none;opacity:0;
  color:var(--ink,#241f20);font:700 17px/16px var(--f-text,system-ui,sans-serif);text-align:center;will-change:transform,opacity}
.lvc-pet-sym svg{display:block;width:100%;height:100%;overflow:visible}
.lvc-pet-sym--heart{color:var(--red,#9b182a);animation:lvc-pet-float 1.2s ease-out forwards}
.lvc-pet-sym--bang{color:var(--red,#9b182a);font-size:21px;animation:lvc-pet-pop 1.1s ease-out forwards}
.lvc-pet-sym--q{font-size:20px;animation:lvc-pet-pop 1.4s ease-out forwards}
.lvc-pet-sym--note{color:var(--ink,#241f20);animation:lvc-pet-note 1.3s ease-out forwards}
.lvc-pet-sym--spark{color:var(--gold,#cbb27d);width:14px;height:14px;margin:-7px 0 0 -7px;animation:lvc-pet-twinkle .9s ease-out forwards}
.lvc-pet-sym--chase{color:var(--gold,#cbb27d);width:15px;height:15px;margin:-7px 0 0 -7px;animation:lvc-pet-chase 1.25s ease-in-out forwards}
.lvc-pet-sym--orbit{width:0;height:0;margin:0;opacity:1;animation:lvc-pet-orbit 1.4s linear forwards}
.lvc-pet-sym--orbit i{position:absolute;left:-6px;top:-6px;width:12px;height:12px;color:var(--gold,#cbb27d)}
.lvc-pet-sym--zz{color:var(--muted,#686d72);font-size:13px;animation:lvc-pet-z 1.6s ease-out forwards}
.lvc-pet-sym--sweat{color:var(--muted,#686d72);width:10px;height:12px;margin:-6px 0 0 -5px;animation:lvc-pet-sweat 1s ease-in forwards}
.lvc-pet-sym--dust{width:9px;height:9px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--muted,#686d72);animation:lvc-pet-dust .7s ease-out forwards}
.lvc-pet-sym--drop{color:var(--acc-ocean,#2a93bd);width:10px;height:13px;margin:-6px 0 0 -5px;animation:lvc-pet-float 1.1s ease-out forwards}
@keyframes lvc-pet-float{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx,0px),-48px) scale(1.1)}}
@keyframes lvc-pet-pop{0%{opacity:0;transform:translateY(4px) scale(.4)}18%{opacity:1;transform:translateY(-4px) scale(1.25)}30%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-6px) scale(1)}}
@keyframes lvc-pet-note{0%{opacity:0;transform:translate(0,0) rotate(-10deg) scale(.6)}20%{opacity:1}55%{transform:translate(calc(var(--dx,0px)*.5),-22px) rotate(10deg)}100%{opacity:0;transform:translate(var(--dx,0px),-44px) rotate(-6deg)}}
@keyframes lvc-pet-twinkle{0%{opacity:0;transform:scale(0) rotate(0)}35%{opacity:1;transform:scale(1.15) rotate(45deg)}100%{opacity:0;transform:translate(var(--dx,0px),var(--dy,-8px)) scale(.2) rotate(110deg)}}
@keyframes lvc-pet-chase{0%{opacity:0;transform:translate(var(--sx,40px),var(--sy,-30px)) scale(.5)}15%{opacity:1}50%{transform:translate(calc(var(--sx,40px)*.55),calc(var(--sy,-30px) - 16px)) scale(1) rotate(60deg)}90%{opacity:1;transform:translate(0,0) scale(1) rotate(140deg)}100%{opacity:0;transform:translate(0,0) scale(1.6) rotate(160deg)}}
@keyframes lvc-pet-orbit{0%{transform:rotate(0)}100%{transform:rotate(720deg)}}
@keyframes lvc-pet-z{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-34px) scale(1.2)}}
@keyframes lvc-pet-sweat{0%{opacity:0;transform:translate(0,-4px)}20%{opacity:.9}100%{opacity:0;transform:translate(2px,12px)}}
@keyframes lvc-pet-dust{0%{opacity:.5;transform:translate(0,0) scale(.3)}100%{opacity:0;transform:translate(var(--dx,0px),-6px) scale(1.5)}}
@keyframes lvc-pet-fade{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){.lvc-pet-sym,.lvc-pet-sym--orbit{animation:lvc-pet-fade 1.4s linear forwards!important}}
.lvc-pet.is-debug{outline:1px dashed #e0475c}.lvc-pet.is-debug .lvc-pet__hit{outline:1px dotted #3b8eea}
.lvc-pet-debug{position:fixed;top:8px;right:8px;z-index:2147483646;width:236px;max-height:calc(100vh - 16px);overflow:auto;padding:8px;
  border-radius:10px;background:rgba(18,14,16,.9);color:#f4efe6;font:11px/1.35 ui-monospace,Menlo,monospace;box-shadow:0 8px 30px -10px #000}
.lvc-pet-debug pre{margin:0 0 6px;white-space:pre-wrap}
.lvc-pet-debug b{display:block;margin:6px 0 2px;color:#e3c48d;font-weight:600}
.lvc-pet-debug button{margin:0 3px 3px 0;padding:2px 6px;border:1px solid #6b5c55;border-radius:6px;background:#2a2226;color:#f4efe6;font:inherit;cursor:pointer}
.lvc-pet-debug button:hover{background:#4a3a40}
@media print{.lvc-pet,.lvc-pet-show,.lvc-pet-bubble,.lvc-pet-debug{display:none!important}}
`;

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.2.3.6.3.8 0 .7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const SVG = {
  heart: HEART_SVG,
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0z"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V7.6l8-2v7.7a3.5 3.5 0 1 0 2 3.2V1z"/></svg>',
  drop: '<svg viewBox="0 0 20 26" aria-hidden="true"><path fill="currentColor" d="M10 0C8 6 2 11 2 17a8 8 0 0 0 16 0C18 11 12 6 10 0z"/></svg>',
};

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
    this.cur = { text, kind, g, n: 0, t: 0, shownAt: Date.now(), hold: opts.hold || clamp(2.5 + g.length * 0.11, 2.5, 8), typing: true };
    // วัดขนาดจากข้อความเต็มก่อน กล่องจะไม่ขยายระหว่างพิมพ์
    const el = this.el;
    el.style.width = el.style.height = "";
    this.txt.textContent = text;
    el.style.visibility = "hidden"; el.classList.add("is-on");
    const rc = el.getBoundingClientRect();
    const w = Math.ceil(rc.width) + 1, h = Math.ceil(rc.height);           // ปัดขึ้น กันข้อความตกบรรทัดเพราะเศษพิกเซล
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
    if (c.typing) { c.n = c.g.length; this.txt.textContent = c.text; c.typing = false; c.t = 0; c.hold = Math.min(c.hold, 2.2); c.skipped = true; }
    else this.close(true);
  }
  close(byUser) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.el.classList.remove("is-on");
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
    const hx = p.fx + (p.mo.dx + p.moAdd.dx) * h;
    const headTop = p.fb + (p.mo.db + p.moAdd.db + p.base.db) * h + h * 0.98 * p.mo.sy * k;   // ระยะจากขอบล่างถึงกลางหัวด้านบน
    const minTop = p.headerBottom + 8;
    let side = "up", x = hx - this.w / 2, b = headTop + 12;
    if (p.state === "held" || p.state === "fly") {                          // ถูกจับ/โยน: ตัวแกว่ง และนิ้วอยู่แถวหัว → ไว้ด้านข้าง
      side = hx < vw / 2 ? "r" : "l";
      x = side === "r" ? hx + 0.55 * h : hx - 0.55 * h - this.w;
      b = headTop - 0.35 * h - this.h / 2;
    } else if (vh - b - this.h < minTop) {                                  // ด้านบนไม่พอ → ด้านข้าง
      side = hx < vw / 2 ? "r" : "l";
      x = side === "r" ? hx + 0.34 * h : hx - 0.34 * h - this.w;
      b = headTop - 0.2 * h - this.h / 2;
      b = clamp(b, 8, vh - minTop - this.h);
    }
    // ชิดขอบจอ: หัวอยู่ชิดขอบจนกล่องบังหัวไม่ได้ → สลับไปอีกข้าง
    if (side === "up" && (hx < 18 || hx > vw - 18)) { side = hx < vw / 2 ? "r" : "l"; x = side === "r" ? hx + 0.34 * h : hx - 0.34 * h - this.w; b = headTop - 0.2 * h - this.h / 2; }
    x = clamp(x, 8, Math.max(8, vw - this.w - 8));
    b = clamp(b, 8, Math.max(8, vh - minTop - this.h));                      // อยู่ในจอเสมอ ไม่ทับแถบเมนู
    el.dataset.side = side;
    if (side === "up") el.style.setProperty("--tail", clamp(hx - x, 14, this.w - 14).toFixed(1) + "px");
    else el.style.setProperty("--tail", clamp((b + this.h) - (headTop - 0.2 * h), 12, this.h - 12).toFixed(1) + "px");
    el.style.transform = `translate3d(${Math.round(x)}px,${-Math.round(b)}px,0)`;
  }
}

/* ---------- ตัวการ์ตูน ---------- */
let pet = null;
const GROUPS = ["business", "digital", "arts", "home-economics", "tourism", "food", "fashion", "logistics"];
const SECTIONS = { index: ["programs", "news", "achievements"], news: ["achievements"], contact: ["admissions"], programs: GROUPS };
const HAIR = ["头发001", "头发L001", "头发R001", "鬓角L001", "鬓角R001", "刘海001", "刘海003"];
const SKIRT = ["裙子1001", "裙子2L001", "裙子2R001", "裙子3L001", "裙子3R001", "裙子4L001", "裙子4R001", "裙子5001"];

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
    this.scene.add(this.model);
    // กระดูก: ราก (ย่อเงาตอนลอย) · หัว/คอ (มองตาม) · ผม/กระโปรง (สปริง)
    const bones = {};
    this.model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    this.rootBone = Object.values(bones).find((b) => /^本模型/.test(b.name)) || null;
    this.tmpV = new THREE.Vector3();
    this.rootRestY = this.rootBone ? this.rootBone.getWorldPosition(this.tmpV).y : 0;
    this.headBone = bones["头骨"]; this.neckBone = bones["颈椎002"];
    // รูม่านตา: เลื่อนกระดูก 眼球 เล็กน้อยตามทิศที่มอง (ค่าพักเก็บไว้ คิดใหม่ทุกเฟรม)
    this.eyeBones = [bones["眼球L"], bones["眼球R"]].filter(Boolean);
    this.eyeRest = this.eyeBones.map((b) => b.position.clone());
    this.eyeK = 1;
    this.lookBones = [this.neckBone, this.headBone].filter(Boolean);
    this.springs = [
      { bones: HAIR.map((n) => bones[n]).filter(Boolean), k: 52, c: 6, g: 1 / 7000, x: 0, vx: 0, z: 0, vz: 0, lim: 0.42 },
      { bones: SKIRT.map((n) => bones[n]).filter(Boolean), k: 78, c: 8.5, g: 1 / 14000, x: 0, vx: 0, z: 0, vz: 0, lim: 0.26 },
    ];
    // กระดูกที่หมุนเพิ่มหลัง mixer: รีเซ็ตเป็นท่าพักก่อน mixer ทุกเฟรม (คลิปที่ไม่แตะกระดูกนี้จะไม่สะสมค่า)
    this.postBones = [...this.lookBones, ...this.springs.flatMap((s) => s.bones)];
    this.postRest = this.postBones.map((b) => b.quaternion.clone());

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (clip.name === "Happy") { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[clip.name] = a;
    }
    this.current = null;

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
    this.stateT = 1e9;
    this.dir = 1;
    this.targetX = 0;
    this.walkV = 0;
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
    this.moAdd = { dx: 0, db: 0, rot: 0, sy: 0 };   // สั่น/แกว่งเพิ่มของท่า (คิดใหม่ทุกเฟรม)
    this.motion = null;
    this.base = { db: 0 };                 // ค่าค้าง (เช่นมุดลงเหลือแค่หัวในโหมดผู้ชม)
    this.dim = 0; this.dimT = 0;           // ไม่มีที่ว่าง → ย่อ 75% และจาง
    this.menuDim = 0;                      // เมนู/dialog เปิด → จางครึ่งหนึ่ง
    this.headerBottom = 0;
    this.act = null;
    this.headFx = { yaw: 0, pitch: 0, roll: 0 };
    this.actLook = null;
    /* หลบของสำคัญ */
    this.overT = 0; this.lastMove = 0; this.lastScroll = 0; this.lastSearch = 0; this.tickAcc = 0;
    /* อินพุต/เวลา */
    const now = performance.now();
    this.input = { mx: 0, my: 0, mt: -1e9, tx: 0, ty: 0, tt: -1e9, glance: null, scrollV: 0, scrollDir: 0, scrollT: -1e9 };
    this.lastInput = now;
    this.nextIdle = now + rand(8000, 20000);
    this.sleepAfter = rand(30000, 40000);
    this.pinged = false;
    this.taps = [];
    this.webCool = {};
    this.lastWeb = 0;
    this.lastLine = {};
    this.S = Object.assign({ said: [], lastSelf: 0, quiet: false, quick: 0, greeted: {}, recent: {} }, sess.read());
    /* หันหัวมองตาม: หมุนกระดูกหลัง mixer.update() ทุกเฟรม (ไม่บวกสะสม) */
    this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0, target: null };
    this.q = { p: new THREE.Quaternion(), m: new THREE.Quaternion(), mi: new THREE.Quaternion(), d: new THREE.Quaternion(), w: new THREE.Quaternion(), e: new THREE.Euler() };
    this.prevPos = null; this.prevVel = { x: 0, y: 0 }; this.acc2 = { x: 0, y: 0 };
    this.bubble = new Bubble(this);
    this.talkT = 0;
    this.place();
    this.play("Idle", 0);

    this.bind();
    this.bindWeb();
    this.checkZoom();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    if (DEBUG) this.buildDebug();
    // สร้างแบบซ่อนไว้ก่อน คอมไพล์ shader ล่วงหน้า แล้วค่อยเล่นท่าเข้า (enter)
    this.exited = true;
    this.waitingEnter = false;
    try { renderer.compile(this.scene, this.camera); } catch (e) {}
    this.mixer.update(0);
    renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  defaultBottom() { return 10; }
  saveSess() { sess.write(this.S); }

  /* ======================================================================
   *  พูด (B1): ลำดับความสำคัญ แตะ > เหตุการณ์ > พูดเล่น · พูดเองห่าง ≥ 25 วิ · ไม่ซ้ำใน session
   * ====================================================================== */
  kindFor(def) { return def.cat === "tap" || def.cat === "zone" ? "tap" : /^(idle|sleep|ping)$/.test(def.cat) ? "idle" : "event"; }

  muted() {
    return (ARRIVING && !txOpen) || root.classList.contains("lvc-loading") || !!doc.querySelector("dialog[open]") ||
      isTyping() || this.exited || this.spectating;
  }

  sayKey(key, kind = "event", opts = {}) {
    const list = lineList(key);
    if (!Array.isArray(list) || !list.length) return false;
    const self = kind !== "tap";
    let pool = self ? list.filter((t) => !this.S.said.includes(t)) : list;
    if (!pool.length) return false;
    const last = this.lastLine[key];
    if (pool.length > 1) pool = pool.filter((t) => t !== last);                // สุ่มไม่ซ้ำติดกัน
    const text = pool[Math.floor(Math.random() * pool.length)];
    if (!this.say(text, kind, opts)) return false;
    this.lastLine[key] = text;
    return true;
  }

  say(text, kind = "event", opts = {}) {
    if (!text || this.hidden || this.zoomed) return false;
    if (this.exited && !opts.force) return false;
    const self = kind !== "tap";
    const now = Date.now();
    if (self) {
      if (this.S.quiet) return false;                                       // ผู้ใช้ปิดกล่องเร็ว ๆ 2 ครั้ง → เงียบทั้ง session
      if (!opts.force && (this.muted() || now - (this.S.lastSelf || 0) < 25000)) return false;
      if (opts.allowTyping !== true && isTyping() && !opts.force) return false;
      if (this.S.said.includes(text)) return false;
    }
    if (!this.bubble.show(text, kind, { live: kind === "tap" })) return false;
    if (self) { this.S.lastSelf = now; this.S.said.push(text); this.saveSess(); }
    return true;
  }

  onBubbleClosed(c, byUser) {
    if (!byUser || c.kind === "tap" || Date.now() - c.shownAt > 2500) return;
    this.S.quick = (this.S.quick || 0) + 1;
    if (this.S.quick >= 2) this.S.quiet = true;
    this.saveSess();
  }

  /* ======================================================================
   *  หันหัวมองตาม (B4) + ท่าหัวของแต่ละท่า
   * ====================================================================== */
  lookAt(x, y) { this.look.target = x == null ? null : { x, y }; }

  lookSource(now) {
    const h = this.size.charH, hx = this.fx + (this.mo.dx + this.moAdd.dx) * h;
    const hy = innerHeight - (this.fb + (this.mo.db + this.moAdd.db + this.base.db) * h + 0.82 * h);
    if (this.actLook) {
      if (this.actLook === "up") return { x: hx, y: hy - 700 };
      if (this.actLook === "down") return { x: hx, y: hy + 700 };
      if (this.actLook === "chase" && this.chaseEl && this.chaseEl.isConnected) {
        const r = this.chaseEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return null;
    }
    if (this.spectating) return this.look.target;
    const free = this.state === "idle" || this.state === "walk";
    if (this.searchBox) return this.searchBox;
    const I = this.input;
    if (this.hovered && now - I.mt < 4000) return { x: I.mx, y: I.my };
    if (I.glance && now - I.glance.t < 1300) return I.glance;
    if (!free) return null;
    if (fineQ.matches && now - I.mt < 2500) return { x: I.mx, y: I.my };
    if (now - I.tt < 2000) return { x: I.tx, y: I.ty };
    if (now - I.scrollT < 700 && I.scrollDir) return { x: hx, y: hy + I.scrollDir * 600 };
    return null;
  }

  updateLook(dt, now) {
    const L = this.look, h = this.size.charH;
    const t = this.lookSource(now);
    if (t) {
      const hx = this.fx + (this.mo.dx + this.moAdd.dx) * h;
      const hy = innerHeight - (this.fb + (this.mo.db + this.moAdd.db + this.base.db) * h + 0.82 * h);
      const D = Math.max(260, h * 2.6);
      L.ty = clamp(Math.atan2(t.x - hx, D) - this.yaw, -0.85, 0.85);
      L.tp = clamp(Math.atan2(t.y - hy, D), -0.32, 0.42);
      if (Math.abs(this.yaw) > 2) { L.ty = 0; L.tp = 0; }                    // หันหลังอยู่: ไม่บิดคอ
    } else { L.ty = 0; L.tp = 0; }
    L.yaw = damp(L.yaw, L.ty, 6, dt);
    L.pitch = damp(L.pitch, L.tp, 6, dt);
  }

  resetPostBones() {
    for (let i = 0; i < this.postBones.length; i++) this.postBones[i].quaternion.copy(this.postRest[i]);
    for (let i = 0; i < this.eyeBones.length; i++) this.eyeBones[i].position.copy(this.eyeRest[i]);
  }

  // เลื่อนรูม่านตาไปทางที่มอง (ส่วนที่คอ/หัวหมุนไม่ถึง) ในแกนของตัวละคร แล้วแปลงเป็นแกนของพ่อกระดูก
  applyEyes() {
    const L = this.look;
    if (!this.eyeBones.length || !this.eyeK || (Math.abs(L.ty) < 0.02 && Math.abs(L.tp) < 0.02)) return;
    const v = this.tmpV, q = this.q;
    const ex = clamp(L.ty / 0.85, -1, 1) * 0.011 * this.eyeK, ey = -clamp(L.tp / 0.42, -1, 1) * 0.007 * this.eyeK;
    this.model.getWorldQuaternion(q.m);
    for (let i = 0; i < this.eyeBones.length; i++) {
      const b = this.eyeBones[i];
      b.parent.updateWorldMatrix(true, false);
      v.copy(this.eyeRest[i]); b.parent.localToWorld(v);
      const off = (this.tmpE || (this.tmpE = new this.T.Vector3())).set(ex, ey, 0).applyQuaternion(q.m).multiplyScalar(this.model.getWorldScale(this.tmpS || (this.tmpS = new this.T.Vector3())).x);
      v.add(off);
      b.parent.worldToLocal(v);
      b.position.copy(v);
    }
  }

  // หมุนกระดูกเพิ่มตามแกนของโลก/ตัวละคร → แปลงเป็นแกนของพ่อกระดูก แล้วคูณหน้า (คิดใหม่ทุกเฟรมจากค่าที่ mixer ตั้ง)
  rotateBone(bone, qWorld) {
    const q = this.q;
    bone.parent.getWorldQuaternion(q.p);
    q.d.copy(q.p).invert().multiply(qWorld).multiply(q.p);
    bone.quaternion.premultiply(q.d);
  }

  applyLook() {
    const L = this.look, F = this.headFx;
    const yaw = L.yaw + F.yaw, pitch = L.pitch + F.pitch, roll = F.roll;
    if (!this.lookBones.length || (Math.abs(yaw) < 1e-3 && Math.abs(pitch) < 1e-3 && Math.abs(roll) < 1e-3)) return;
    const q = this.q;
    this.model.getWorldQuaternion(q.m);
    q.mi.copy(q.m).invert();
    const share = this.lookBones.length > 1 ? [0.35, 0.65] : [1];
    this.lookBones.forEach((bone, i) => {
      const k = share[i];
      q.d.setFromEuler(q.e.set(pitch * k, yaw * k, roll * k, "YXZ"));      // ในพื้นที่ของตัวละคร
      q.w.copy(q.m).multiply(q.d).multiply(q.mi);                          // → พื้นที่โลก
      this.rotateBone(bone, q.w);
    });
  }

  /* ผม/กระโปรงแกว่งแบบสปริง (ตามความเร่งของตัวบนจอ + เลื่อนจอเร็ว) */
  updateSprings(dt) {
    const h = this.size.charH;
    const px = this.fx + (this.mo.dx + this.moAdd.dx) * h, py = this.fb + (this.mo.db + this.moAdd.db + this.base.db) * h;
    let ax = 0, ay = 0;
    if (this.prevPos && dt > 0) {
      const vx = (px - this.prevPos.x) / dt, vy = (py - this.prevPos.y) / dt;
      ax = (vx - this.prevVel.x) / dt; ay = (vy - this.prevVel.y) / dt;
      this.prevVel = { x: vx, y: vy };
    }
    this.prevPos = { x: px, y: py };
    this.acc2.x = damp(this.acc2.x, clamp(ax, -12000, 12000), 20, dt);
    this.acc2.y = damp(this.acc2.y, clamp(ay, -12000, 12000), 20, dt);
    const sv = this.input.scrollV;
    const flutter = Math.abs(sv) > 900 ? Math.sin(performance.now() / 70) * clamp(Math.abs(sv) / 5000, 0, 1) * 4000 : 0;
    let active = false;
    for (const s of this.springs) {
      if (!s.bones.length) continue;
      const zEq = clamp(-(this.acc2.x + flutter) * s.g, -s.lim, s.lim);
      const xEq = clamp(this.acc2.y * s.g * 0.6, -s.lim, s.lim);
      s.vz += (-s.k * (s.z - zEq) - s.c * s.vz) * dt; s.z = clamp(s.z + s.vz * dt, -s.lim, s.lim);
      s.vx += (-s.k * (s.x - xEq) - s.c * s.vx) * dt; s.x = clamp(s.x + s.vx * dt, -s.lim, s.lim);
      if (Math.abs(s.z) + Math.abs(s.x) + Math.abs(s.vz) * 0.05 + Math.abs(s.vx) * 0.05 > 0.002) active = true;
    }
    this.springsActive = active;
  }

  applySprings() {
    if (!this.springsActive) return;
    const q = this.q;
    for (const s of this.springs) {
      if (Math.abs(s.z) < 1e-3 && Math.abs(s.x) < 1e-3) continue;
      q.w.setFromEuler(q.e.set(s.x, 0, s.z, "XYZ"));                       // แกนของจอ (โลก)
      for (const b of s.bones) this.rotateBone(b, q.w);
    }
  }

  /* ======================================================================
   *  หลบของสำคัญ (A6)
   * ====================================================================== */
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
    if (Math.abs(b - this.fb) < 3 && Math.abs(x - this.fx) < 200 && !this.reduced) { this.walkTo(x); return; }
    this.jumpTo(x, b);
  }

  // กระโดดข้ามไปที่ใหม่ (ทำที่ชั้น DOM)
  jumpTo(x, b, dur = 0.75) {
    const h = this.size.charH;
    const dx0 = (this.fx - x) / h, db0 = (this.fb - b) / h;
    this.stopAct();
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
      { t: dur * 0.82, dx: 0, db: 0, e: "in", do: () => { this.play("Idle", 0.1); this.sym("dust", 3, "feet"); } },
      { t: dur * 0.82, sx: 1, sy: 1 },
      { t: dur * 0.9, sx: 1.1, sy: 0.88 },
      { t: dur, sx: 1, sy: 1 },
    ], dur, () => this.idle(rand(2, 4)));
  }

  avoidTick(now) {
    if (this.state !== "idle" || this.spectating) { this.overT = 0; return; }
    // ยืนนิ่งและหน้าไม่ขยับ: ใช้ผลเดิม ตรวจใหม่ทุก 1.5 วิ (เลื่อนจออยู่ = ตรวจทุก 250 ms)
    const sig = Math.round(this.fx) + "," + Math.round(this.fb) + "," + Math.round(window.scrollY) + "," + innerWidth + "x" + innerHeight;
    let hit;
    if (sig === this.avSig && now - this.avAt < 1500) hit = this.avHit;
    else { hit = this.blocked(this.bodyRect(this.fx, this.fb)); this.avSig = sig; this.avAt = now; this.avHit = hit; }
    this.overT = hit ? this.overT + 0.25 : 0;
    if (!hit && this.dimT) this.dimT = 0;
    // ค้นหาที่ว่างใหม่เมื่อมีอะไรเปลี่ยน (เลื่อน/ย่อจอ) · หาไม่เจอแล้วหน้าเดิม = ไม่ค้นซ้ำ (ทบทวนทุก 6 วิ)
    const again = sig !== this.searchSig || now - this.lastSearch > 6000;
    if (this.overT >= 0.4 && now - this.lastMove > 1500 && now - this.lastSearch > 1200 && again) {
      this.lastSearch = now;
      const spot = this.findFree();
      if (spot) { this.dimT = 0; this.overT = 0; this.searchSig = null; this.moveTo(spot.x, spot.b); }
      else { this.dimT = 1; this.searchSig = sig; }
      return;
    }
    // บ้านว่างแล้ว และผู้ใช้หยุดเลื่อน ~1 วิ → กลับบ้าน
    if (!hit && this.displaced() && now - this.lastScroll > 1000 && now - this.lastMove > 1800) {
      if (sig !== this.homeSig || now - this.homeAt > 1500) {                // บ้านยังไม่ว่างและหน้าไม่ขยับ: ไม่ตรวจซ้ำถี่
        this.homeSig = sig; this.homeAt = now;
        if (!this.blocked(this.bodyRect(this.anchorX, this.anchorB))) this.moveTo(this.anchorX, this.anchorB);
      }
    }
  }

  /* ======================================================================
   *  โหมดผู้ชม (ฉาก lvc-journey ตอนตรึงจอ)
   * ====================================================================== */
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
    if (!this.wowSaid && J.p > 0.95) { this.wowSaid = true; this.sayKey("scene.wow", "event", { force: true }); }
  }

  startSpectate() {
    this.stopAct();
    this.spectating = true;
    this.wowSaid = false;
    this.preSpectate = { x: this.fx, b: this.fb };
    this.dimT = 0;
    this.spectating = false;                       // ให้ประโยคเข้าฉากพูดได้ก่อนเข้าโหมดเงียบ
    this.sayKey("scene.enter", "event", { force: true });
    this.spectating = true;
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
      { t: 1.25, db: -1.3, e: "in", do: () => { this.fx = corner.x; this.fb = b0; this.prevPos = null; } },
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
      this.enter("return");                     // กระโดดกลับจุดเดิมด้วยท่าเข้าแบบสุ่ม
    });
  }

  // แตะตอนเป็นผู้ชม: โผล่ขึ้นมาแป๊บเดียวแล้วมุดกลับ
  spectatePeek() {
    if (this.state === "peek") return;
    if (this.base.db > -0.1) { this.sayKey("tap.shh", "tap"); return; }   // ยังมุดไม่เสร็จ
    this.setState("peek", 3);
    this.setFace({ happyEyes: 1, smile: 1 });
    this.sayKey("tap.shh", "tap");
    this.runMotion([
      { t: 0, db: 0 }, { t: 0.25, db: 0.62, e: "out" }, { t: 1.25, db: 0.62 }, { t: 1.55, db: 0, e: "in" },
    ], 1.55, () => { this.setState("spectate", 1e9); this.setFace({ smile: 0.5 }); });
  }

  /* ======================================================================
   *  ตำแหน่ง + ท่าใหญ่ที่ชั้น DOM
   * ====================================================================== */
  // .lvc-pet ติดขอบล่างด้วย CSS (bottom:0) แล้วเลื่อนขึ้นตามระยะเท้า → แถบเบราว์เซอร์ยุบ/ขยายไม่ทำให้เท้าคลาด
  place() {
    const h = this.size.charH, mo = this.mo || MO_DEF, ad = this.moAdd || { dx: 0, db: 0 };
    const x = Math.round(this.fx + (mo.dx + ad.dx) * h - this.size.w / 2);
    const y = Math.round(this.footB - (this.fb + (mo.db + ad.db + this.base.db) * h));
    this.el.style.transform = `translate3d(${x}px,${y}px,0)`;
  }

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
    const m = this.mo, a = this.moAdd || { rot: 0, sy: 0 }, k = 1 - 0.25 * this.dim;
    const sx = m.sx * k, sy = (m.sy + a.sy) * k, rot = m.rot + a.rot;
    const tf = rot || sx !== 1 || sy !== 1 ? `rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})` : "";
    if (tf !== this._fxTf) { this.fxEl.style.transform = tf; this._fxTf = tf; }
    const o = m.op * (1 - 0.5 * this.dim) * (1 - 0.5 * this.menuDim);
    const op = o >= 0.999 ? "" : o.toFixed(3);
    if (op !== this._fxOp) { this.fxEl.style.opacity = op; this._fxOp = op; }
  }

  /* ======================================================================
   *  ท่า (pet-reactions.js): คลิป สีหน้า การเคลื่อนที่ สัญลักษณ์ ประโยค เวลา
   * ====================================================================== */
  actCtx(def, opts) {
    const h = this.size.charH, w = this.size.w;
    const side = opts.side || (this.fx <= this.vw - this.fx ? -1 : 1);      // ขอบที่ใกล้
    const E = side < 0 ? (-w * 0.6 - this.fx) / h : (this.vw + w * 0.6 - this.fx) / h;
    const P = side < 0 ? (0 - this.fx) / h : (this.vw - this.fx) / h;
    const T = (innerHeight - this.fb) / h + 0.15;
    let dir = this.dir || 1;
    if (/^enter/.test(def.cat)) dir = -side;
    if (/^exit/.test(def.cat)) dir = side;
    return { E, P, T, dir, side };
  }

  resolve(v, ctx) {
    if (typeof v === "number") return v;
    const m = /^(-?)([EPT])(?:\*(-?[\d.]+))?$/.exec(String(v));
    if (!m) return 0;
    let x = ctx[m[2]] || 0;
    if (m[1]) x = -x;
    if (m[3]) x *= +m[3];
    return x;
  }

  resolveKey(k, ctx, def) {
    const o = Object.assign({}, k);
    for (const p of ["dx", "db"]) if (p in o) {
      const sym = typeof o[p] === "string";
      o[p] = this.resolve(o[p], ctx);
      if (p === "dx" && def.rel && !sym) o.dx *= ctx.dir;
    }
    if (def.rel && "rot" in o) o.rot *= ctx.dir;
    return o;
  }

  pickAct(cat, filter) {
    const recent = (cat === "enter" || cat === "exit" ? hist.read()[cat] : this.S.recent[cat]) || [];
    let ids = Object.keys(ACTS).filter((id) => ACTS[id].cat === cat && (!filter || filter(ACTS[id], id)));
    if (!ids.length) return null;
    const fresh = ids.filter((id) => !recent.slice(-3).includes(id));             // ห้ามซ้ำ 3 ครั้งล่าสุดของหมวด
    if (fresh.length) ids = fresh;
    const wt = (id) => (ACTS[id].w != null ? ACTS[id].w : ACTS[id].rare ? 0.5 : 1);
    let r = Math.random() * ids.reduce((s, id) => s + wt(id), 0);
    for (const id of ids) { r -= wt(id); if (r <= 0) return id; }
    return ids[ids.length - 1];
  }

  remember(cat, id) {
    if (cat === "enter" || cat === "exit") {
      const H = hist.read(); H[cat] = (H[cat] || []).concat(id).slice(-6); hist.write(H);
    } else {
      this.S.recent[cat] = (this.S.recent[cat] || []).concat(id).slice(-6); this.saveSess();
    }
  }

  playAct(id, opts = {}) {
    const def = ACTS[id];
    if (!def || this.hidden || this.zoomed) return false;
    this.stopAct();
    this.cancelMotion();
    const ctx = this.actCtx(def, opts);
    const red = this.reduced;
    const a = (this.act = { id, def, t: 0, ctx, steps: (def.steps || []).slice().sort((x, y) => x.at - y.at), zzT: 0 });
    this.remember(opts.cat || def.cat.replace(/-special$/, ""), id);
    this.setState("act", def.sleep ? 1e9 : (def.dur || 1) + 1.2);
    this.el.classList.add("is-acting");
    if (def.origin === "center") this.fxEl.style.transformOrigin = `${this.size.w / 2}px ${this.footY - this.size.charH * 0.5}px`;
    // หันตัว
    if (def.yaw === "back") this.yawTarget = Math.PI;
    else if (def.yaw === "travel") { this.dir = ctx.dir; this.yawTarget = ctx.dir * WALK_YAW; if (/^enter/.test(def.cat)) this.yaw = this.yawTarget; }
    else if (def.yaw !== "keep") this.yawTarget = typeof def.yaw === "number" ? def.yaw : 0;
    // คลิป สีหน้า ประโยค
    if (!red && def.clip) this.play(def.clip[0], def.clip[1] != null ? def.clip[1] : 0.2, def.clip[2] || 1, true);
    else if (red) this.play("Idle", 0.3);
    if (def.face) this.setFace(def.face);
    const say = opts.say !== undefined ? opts.say : def.say;
    const force = /^(enter|exit|bye)/.test(def.cat);
    if (say) this.sayKey(say, this.kindFor(def), { force });
    // การเคลื่อนที่
    if (!red && def.move) this.runMotion(def.move.map((k) => this.resolveKey(k, ctx, def)), def.dur);
    else if (red && /^enter/.test(def.cat)) this.runMotion([{ t: 0, op: 0 }, { t: 0.45, op: 1, e: "lin" }], 0.45);
    else if (red && /^(exit|bye)/.test(def.cat)) this.runMotion([{ t: 0, op: 1 }, { t: 0.3, op: 0, e: "lin" }], 0.3);
    if (def.spin && !red) a.spin = { turns: def.spin, at: def.spinAt || [0, def.dur], from: this.yaw, dir: ctx.dir || 1 };
    this.updateAct(0);
    return true;
  }

  applyStep(s, a) {
    const red = this.reduced;
    if (s.clip && !red) this.play(s.clip[0], s.clip[1] != null ? s.clip[1] : 0.2, s.clip[2] || 1, true);
    if (s.face) this.setFace(s.face);
    if (s.fx) this.sym(s.fx[0], s.fx[1] || 1, s.fx[2] || "head");
    if (s.say) this.sayKey(s.say, this.kindFor(a.def), { force: /^(enter|exit|bye)/.test(a.def.cat) });
    if (s.look) this.actLook = s.look === "clear" ? null : s.look;
    if (s.yaw !== undefined) this.yawTarget = s.yaw;
  }

  updateAct(dt) {
    const a = this.act;
    if (!a) return;
    a.t += dt;
    const def = a.def, red = this.reduced;
    while (a.steps.length && a.steps[0].at <= a.t) this.applyStep(a.steps.shift(), a);
    if (!this.act || this.act !== a) return;
    // หมุนตัว (3D)
    if (a.spin) {
      const [s0, s1] = a.spin.at;
      const u = clamp((a.t - s0) / Math.max(0.01, s1 - s0), 0, 1);
      this.yaw = this.yawTarget = a.spin.from + a.spin.turns * 2 * Math.PI * EASE.inOut(u) * a.spin.dir;
      if (u >= 1) { this.yaw = this.yawTarget = 0; a.spin = null; }
    }
    // สั่น/แกว่ง + ท่าหัว (คิดใหม่ทุกเฟรม ไม่บวกสะสม)
    const add = this.moAdd, hf = this.headFx;
    add.dx = add.db = add.rot = add.sy = 0; hf.yaw = hf.pitch = hf.roll = 0;
    if (!red) {
      const env = (from, to) => clamp(Math.min((a.t - from) / 0.15, (to - a.t) / 0.15), 0, 1);
      for (const o of def.osc || []) {
        if (a.t < o.from || a.t > o.to) continue;
        let v = o.amp * Math.sin(2 * Math.PI * o.hz * (a.t - o.from)) * env(o.from, o.to);
        if (o.decay) v *= 1 - (a.t - o.from) / Math.max(0.01, o.to - o.from);
        add[o.p] = (add[o.p] || 0) + (def.rel && (o.p === "dx" || o.p === "rot") ? v * a.ctx.dir : v);
      }
      for (const hd of def.head || []) {
        if (a.t < hd.from || a.t > hd.to) continue;
        const e = env(hd.from, hd.to);
        for (const k of ["yaw", "pitch", "roll"]) {
          const v = hd[k];
          if (v == null) continue;
          hf[k] += (Array.isArray(v) ? v[0] * Math.sin(2 * Math.PI * v[1] * (a.t - hd.from)) : v) * e;
        }
      }
    }
    if (def.sleep) {                                                      // หลับรอจนผู้ใช้ขยับ
      a.zzT -= dt;
      if (a.zzT <= 0 && a.t > 0.6) { a.zzT = 1.8; this.sym("zz", 1, "head"); }
      return;
    }
    if (a.t >= def.dur) this.finishAct();
  }

  clearActFx() {
    const add = this.moAdd, hf = this.headFx;
    add.dx = add.db = add.rot = add.sy = 0; hf.yaw = hf.pitch = hf.roll = 0;
    this.actLook = null;
    this.chaseEl = null;
    this.el.classList.remove("is-acting");
    this.fxEl.style.transformOrigin = `${this.size.w / 2}px ${this.footY}px`;
  }

  // ตัดท่าที่กำลังเล่น (ไม่ต่อท่าถัดไป)
  stopAct() {
    const a = this.act;
    if (!a) return;
    this.act = null;
    if (a.spin) { this.yaw = this.yawTarget = 0; }
    this.clearActFx();
  }

  finishAct() {
    const a = this.act;
    if (!a) return;
    const def = a.def;
    this.act = null;
    this.clearActFx();
    if (def.ends && def.ends.dx) {                                         // ถอย/ก้าวแล้วยืนที่ใหม่
      this.fx += this.resolve(def.ends.dx, a.ctx) * this.size.charH * (def.rel ? a.ctx.dir : 1);
      this.cancelMotion();
      this.clampPos();
    }
    if (def.cat === "bye") { this.reallyHide(); return; }
    if (/^exit/.test(def.cat)) { this.afterExit(); return; }
    if (def.then) { this.playAct(def.then); return; }
    this.idle(rand(2, 4));
  }

  wake() {
    const a = this.act;
    if (!a || !a.def.sleep) return false;
    this.playAct(a.def.wake || "idle.wake");
    this.sleepAfter = rand(30000, 40000);
    return true;
  }

  /* ---------- สัญลักษณ์ ♥ ! ? ♪ ✦ zZ เหงื่อ ฝุ่น ---------- */
  sym(kind, n = 1, where = "head") {
    if (SPECIAL === "valentine" && kind === "heart") n *= 2;
    const u = this.size.charH, cx = this.size.w / 2, fy = this.footY;
    const at = {
      head: [cx, fy - u * 1.05], side: [cx + u * 0.3, fy - u * 0.95], feet: [cx, fy - u * 0.02],
      around: [cx, fy - u * 0.6], chase: [cx, fy - u * 0.82],
    }[where] || [cx, fy - u];
    for (let i = 0; i < n; i++) {
      const s = doc.createElement("span");
      let cls = kind;
      if (kind === "spark" && where === "chase") cls = "chase";
      s.className = "lvc-pet-sym lvc-pet-sym--" + cls;
      let x = at[0], y = at[1];
      if (kind === "orbit") {
        s.innerHTML = Array.from({ length: n }, (_, k) => `<i style="transform:rotate(${(360 / n) * k}deg) translateX(${(u * 0.32).toFixed(1)}px)">${SVG.spark}</i>`).join("");
        y = fy - u * 0.95;
        i = n;
      } else if (kind === "heart" || kind === "note" || kind === "drop" || kind === "spark") {
        s.innerHTML = SVG[kind];
      } else if (kind === "bang") s.textContent = "!";
      else if (kind === "q") s.textContent = "?";
      else if (kind === "zz") s.textContent = "z";
      else if (kind === "sweat") s.innerHTML = SVG.drop;
      if (kind === "heart" || kind === "note" || kind === "drop") { x += (i - (n - 1) / 2) * u * 0.16; s.style.setProperty("--dx", ((i - (n - 1) / 2) * 14 + rand(-4, 4)).toFixed(0) + "px"); }
      if (kind === "spark" && where !== "chase") {
        const ang = rand(0, Math.PI * 2), r = where === "around" ? u * rand(0.25, 0.5) : u * rand(0.1, 0.28);
        x += Math.cos(ang) * r; y += Math.sin(ang) * r * (where === "around" ? 1.4 : 0.6);
        s.style.setProperty("--dx", rand(-8, 8).toFixed(0) + "px"); s.style.setProperty("--dy", rand(-14, -4).toFixed(0) + "px");
      }
      if (where === "chase") {
        s.style.setProperty("--sx", (this.fx < this.vw / 2 ? 1 : -1) * u * 0.7 + "px"); s.style.setProperty("--sy", -u * 0.55 + "px");
        this.chaseEl = s;
      }
      if (kind === "sweat") { x += u * 0.16; y += u * 0.08; }
      if (kind === "dust") { x += (i - (n - 1) / 2) * u * 0.14; s.style.setProperty("--dx", ((i - (n - 1) / 2) * 12).toFixed(0) + "px"); }
      if (kind === "zz") { x += u * 0.14 + i * 6; }
      s.style.left = x.toFixed(1) + "px";
      s.style.top = y.toFixed(1) + "px";
      s.style.animationDelay = (kind === "orbit" ? 0 : i * 0.11).toFixed(2) + "s";
      this.el.appendChild(s);
      setTimeout(() => s.remove(), 2200);
    }
  }

  /* ======================================================================
   *  ท่าเข้า / ท่าออก (B2) · ห้ามซ้ำ 3 ครั้งล่าสุด (จำใน localStorage ข้ามหน้า/ข้ามวัน)
   * ====================================================================== */
  greetingKey(kind) {
    if (kind === "return" || kind === "call") return null;
    const S = this.S;
    let key = null;
    if (!S.firstDone) {
      S.firstDone = true;
      const H = hist.read();
      if (SPECIAL) key = "special." + SPECIAL;
      else if (H.seen && Date.now() - H.seen > 30 * 60 * 1000) key = "back";
      else { const hr = new Date().getHours(); if (hr >= 5 && hr < 10) key = "morning"; else if (hr >= 22 || hr < 4) key = "night"; }
    }
    if (!key && !S.greeted["page:" + PAGE]) key = "greet." + PAGE;
    S.greeted["page:" + PAGE] = 1;
    this.saveSess();
    return key;
  }

  enter(kind = "first") {
    this.exited = false;
    this.waitingEnter = false;
    this.hiding = false;
    this.stopAct();
    this.cancelMotion();
    this.base.db = 0;
    this.el.style.visibility = "";
    this.el.classList.remove("is-gone");
    this.el.classList.add("is-ready");
    if (this.clock) this.clock.getDelta();
    this.yawTarget = 0;
    this.prevPos = null;
    this.lastInput = this.enteredAt = performance.now();
    const H = hist.read();
    const away = H.seen ? Date.now() - H.seen : 0;
    H.seen = Date.now(); hist.write(H);
    if (kind === "first" && away > 24 * 3600 * 1000) {                  // ไม่ได้เข้าเว็บเกิน 1 วัน: นอนรออยู่ที่เดิม
      this.S.firstDone = true; this.S.greeted["page:" + PAGE] = 1; this.saveSess();
      this.playAct("enter.sleep");
      return;
    }
    const greet = this.greetingKey(kind);
    if (kind === "walk-in" && !this.reduced) {                          // โหลดไม่ทันริบบิ้น: เดินเข้าจากขอบจอ
      const target = this.fx;
      const fromLeft = target < this.vw / 2;
      this.fx = fromLeft ? -this.size.w / 2 : this.vw + this.size.w / 2;
      this.yaw = (fromLeft ? 1 : -1) * WALK_YAW;
      this.walkTo(target, true);
      if (greet) this.sayKey(greet, "event", { force: true });
      return;
    }
    let id;
    if (kind === "call") id = this.pickAct("enter", (d, i) => i === "enter.pop" || i === "enter.sparkle");
    else {
      const quick = kind === "tx" || kind === "return" || kind === "walk-in";   // เปลี่ยนหน้า: ต้องจบใน ~1.2 วิ
      id = this.pickAct("enter", (d) => !quick || d.tx);
    }
    this.playAct(id, { say: kind === "call" ? "enter.call" : greet || undefined });
  }

  leave(detail = {}) {
    if (this.hidden || this.exited) return;
    this.bubble.close(false);
    if (this.spectating) { this.spectating = false; this.lookAt(null); }
    this.base.db = 0;
    saveTxState(this);
    this.el.classList.remove("is-held", "show-ui");
    this.stopAct();
    this.cancelMotion();
    this.exited = true;                         // loop ยังวาดต่อจนท่าออกจบ
    const link = this.lastLink && this.lastLink.isConnected ? this.lastLink : null;
    const cheer = /admissions/.test(detail.href || "") || (link && /สมัคร/.test(link.textContent || ""));
    const id = cheer ? "exit.cheer" : this.pickAct("exit");
    this.playAct(id, { cat: "exit" });
  }

  afterExit() {
    this.el.style.visibility = "hidden";
    this.el.classList.remove("is-ready");
    this.cancelMotion();
    this.debugReturn();
  }

  // ?petdebug=1: ทดสอบท่าออก/บ๊ายบายแล้ว เอาตัวกลับมา
  debugReturn() {
    if (!this.dbgReturn) return;
    this.dbgReturn = false;
    setTimeout(() => { this.hidden = false; this.hiding = false; if (showBtn) showBtn.hidden = true; this.enter("return"); }, 500);
  }

  /* ======================================================================
   *  พฤติกรรมตอนว่าง + เดินแบบมีเป้าหมาย (B3/B4)
   * ====================================================================== */
  setState(s, t) { this.state = s; this.stateT = t; }

  idle(t = rand(2.5, 6)) {
    this.setState("idle", t);
    this.yawTarget = 0;
    this.play("Idle", 0.35);
    this.setFace({ smile: Math.random() < 0.5 ? 0.35 : 0 });
  }

  walkTo(x, keepYaw) {
    this.targetX = x;
    this.dir = x > this.fx ? 1 : -1;
    this.yawTarget = this.dir * WALK_YAW;
    if (!keepYaw && this.reduced) { this.fx = x; this.idle(); return; }
    this.walkV = 0;
    this.setState("walk", 25);
    this.play("Walk", 0.3, WALK_TS * 0.4);
    this.setFace({ smile: 0.6 });
  }

  // เดินไปทางที่น่าสนใจ: ทางเมาส์ / จุดที่เพิ่งแตะ / ที่ว่างรอบบ้าน (ไม่สุ่มซ้ายขวาแคบ ๆ)
  wander(now) {
    if (this.reduced || this.displaced() || this.dimT) return false;
    const I = this.input, h = this.size.charH, w = this.size.w;
    const minX = w * 0.32 + 4, maxX = this.vw - w * 0.32 - 4;
    const reach = clamp(this.vw * 0.32, 120, 420);
    let tx = null;
    if (fineQ.matches && now - I.mt < 4000 && I.my > innerHeight * 0.35) tx = I.mx;
    else if (now - I.tt < 6000) tx = I.tx;
    if (tx != null) tx -= Math.sign(tx - this.fx) * h * 0.45;              // หยุดก่อนถึงจุด ไม่ทับนิ้ว/เมาส์
    else tx = this.anchorX + rand(-reach, reach);
    tx = clamp(clamp(tx, this.anchorX - reach, this.anchorX + reach), minX, maxX);
    if (Math.abs(tx - this.fx) < 40 || this.blocked(this.bodyRect(tx, this.fb))) return false;
    this.walkTo(tx);
    return true;
  }

  idleTick(now) {
    if (this.state !== "idle" || this.act || this.spectating || this.exited || this.hiding) return;
    if (this.bubble.busy || now - this.lastScroll < 1500) return;          // ไม่เริ่มตอนผู้ใช้เลื่อน
    const quiet = now - this.lastInput;
    if (quiet > this.sleepAfter) { this.playAct("idle.sleepy"); return; }
    if (quiet > 20000 && !this.pinged) { this.pinged = true; this.playAct("idle.ping"); return; }
    if (now < this.nextIdle) return;
    this.nextIdle = now + rand(8000, 20000);
    if (Math.random() < 0.45 && this.wander(now)) return;
    const id = this.pickAct("idle");
    if (id) this.playAct(id);
  }

  onUserInput(now = performance.now()) {
    this.lastInput = now;
    this.pinged = false;
    if (this.act && this.act.def.sleep) this.wake();
  }

  /* ======================================================================
   *  แตะ (B3): จุดที่แตะ · แตะค้าง · ลูบหัว · แตะรัว
   * ====================================================================== */
  zoneAt(clientY) {
    const r = this.hit.getBoundingClientRect();
    const k = (clientY - r.top) / Math.max(1, r.height);
    return k < 0.3 ? "head" : k > 0.82 ? "foot" : "body";
  }

  tap(zone, e) {
    if (this.state === "held" || this.state === "fly" || this.exited || this.hiding) return;
    const now = performance.now();
    const sleeping = this.act && this.act.def.sleep;
    this.onUserInput(now);
    this.showUi();
    if (e) { this.input.tx = e.clientX; this.input.ty = e.clientY; this.input.tt = now; }
    if (this.spectating) { this.spectatePeek(); return; }
    if (sleeping || (this.act && /wake$/.test(this.act.id) && this.act.t < 1)) return;   // แตะตอนหลับ = แค่ปลุก
    this.taps = this.taps.filter((t) => now - t < 6000).concat(now);
    if (SPECIAL === "songkran") this.sym("drop", 2, "head");
    if (this.taps.length >= 10) { this.taps = []; this.playAct("tap.sulk"); return; }
    if (this.act && /^tap\.sulk/.test(this.act.id)) return;               // งอนอยู่: ไม่สนใจ
    if (this.taps.filter((t) => now - t < 3000).length >= 5) { this.playAct("tap.dizzy"); return; }
    if (zone === "head") { this.playAct("tap.pat"); return; }
    if (zone === "foot") { this.playAct("tap.foot"); return; }
    const id = this.pickAct("tap");
    if (id) this.playAct(id);
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
      const zone = this.zoneAt(e.clientY);
      down = { x: e.clientX, y: e.clientY, t: performance.now(), dragging: false, id: e.pointerId, zone, px: e.clientX, sx: 0, ext: e.clientX, segOk: false, segs: 0, rub: false, long: false };
      down.longT = setTimeout(() => {                                       // แตะค้าง ~0.6 วิ = เอียงหัว "?"
        if (!down || down.dragging || down.rub) return;
        down.long = true;
        if (!this.spectating && !this.exited) this.playAct("tap.hold");
      }, 600);
      this.onUserInput();
    });
    hit.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (down.zone === "head" && !down.dragging) {                         // ลูบหัว: ถูไปมาซ้ายขวา (ช่วงละ ≥ 5 px)
        const s = Math.sign(e.clientX - down.px);
        if (s) {
          if (s !== down.sx) { down.sx = s; down.ext = down.px; down.segOk = false; }   // เปลี่ยนทิศ: เริ่มช่วงใหม่จากจุดกลับตัว
          if (!down.segOk && Math.abs(e.clientX - down.ext) >= 5) { down.segOk = true; down.segs++; }
        }
        down.px = e.clientX;
        if (down.segs >= 3 && !down.rub) { down.rub = true; clearTimeout(down.longT); if (!this.spectating) this.playAct("tap.rub"); }   // กลับทิศ 2 ครั้ง
      }
      const far = down.zone === "head" ? Math.abs(dy) > 14 || Math.abs(dx) > 28 : dx * dx + dy * dy > 49;
      if (!down.dragging && !down.rub && far) {
        down.dragging = true;
        clearTimeout(down.longT);
        this.startHold(e);
      }
      if (down.dragging) this.moveHold(e);
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down; down = null;
      clearTimeout(d.longT);
      if (d.dragging) { if (this.state === "held") this.endHold(); }
      else if (e.type === "pointerup" && !this.zoomed && !d.rub && !d.long) this.tap(d.zone, e);
    };
    hit.addEventListener("pointerup", up);
    hit.addEventListener("pointercancel", up);
    hit.addEventListener("contextmenu", (e) => e.preventDefault());
    hit.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { this.hovered = true; if (this.state === "idle" && !this.act) this.setFace({ smile: 0.7 }); } });
    hit.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") this.hovered = false; });
    hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.tap("body"); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const s = e.key === "ArrowLeft" ? -1 : 1;
        this.anchorX = clamp(this.fx + s * 90, 0, this.vw);   // ย้ายบ้านแค่แกน x (ความสูงบ้านที่ผู้ใช้ลากไว้คงเดิม)
        this.clampPos();
        this.saveAnchor();
        this.stopAct();
        if (this.reduced) { this.fx = this.anchorX; return; }
        this.walkTo(this.anchorX);
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
        if (this.state !== "held" && this.state !== "fly" && !this.spectating) this.fb = this.anchorB;
        this.clampPos();
      });
    };
    addEventListener("resize", () => { if (!this.checkZoom()) relayout(); });
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", () => { const was = this.zoomed; if (!this.checkZoom() && was) relayout(); });
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.destroy(); }, false);
  }

  /* ======================================================================
   *  ตอบสนองกับเว็บ (B3)
   * ====================================================================== */
  webAct(id, key, coolMs = 20000) {
    const now = performance.now();
    if (now - (this.webCool[key] || -1e9) < coolMs || now - this.lastWeb < 5000) return false;
    if (this.exited || this.hiding || this.spectating || this.state === "held" || this.state === "fly") return false;
    if (this.act && !/^(idle|web|group)\./.test(this.act.id)) return false;   // ไม่ตัดท่าที่ผู้ใช้สั่ง
    this.webCool[key] = now; this.lastWeb = now;
    return this.playAct(id);
  }

  bindWeb() {
    const I = this.input;
    addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") { I.mx = e.clientX; I.my = e.clientY; I.mt = performance.now(); }
      this.onUserInput();
    }, { passive: true });
    addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { I.tx = e.clientX; I.ty = e.clientY; I.tt = performance.now(); } this.onUserInput(); }, { passive: true });
    addEventListener("keydown", () => this.onUserInput(), { passive: true });
    // กดลิงก์ตรงไหน = เหลียวมองตาม
    doc.addEventListener("click", (e) => {
      if (!e.target || !e.target.closest || e.target.closest(SELF)) return;
      I.glance = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.lastLink = e.target.closest("a[href]");
      const save = e.target.closest("[data-save]");                       // หน้าหลักสูตร: บันทึกลงสมุดสำรวจ
      if (save) setTimeout(() => { if (save.getAttribute("aria-pressed") === "true") this.webAct("web.saved", "saved", 1500); }, 0);
    }, true);
    // เลื่อน: เร็ว / ขึ้นบนสุด / สุดหน้า
    let lastY = window.scrollY, lastT = performance.now();
    addEventListener("scroll", () => {
      const now = performance.now(), y = window.scrollY;
      const v = ((y - lastY) / Math.max(16, now - lastT)) * 1000;
      lastY = y; lastT = now;
      this.lastScroll = now;
      I.scrollV = v; I.scrollDir = Math.sign(v); I.scrollT = now;
      this.onUserInput(now);
      if (this.zoomed) return;
      if (Math.abs(v) > 3200) this.webAct("web.fast", "fast", 15000);
      if (y < 60 && v < -2200) this.webAct("web.top", "top", 15000);
      const maxY = (doc.scrollingElement || root).scrollHeight - innerHeight;
      if (maxY > 400 && y >= maxY - 6 && !this.S.greeted["bottom:" + PAGE]) {
        if (this.webAct("web.bottom", "bottom", 60000)) { this.S.greeted["bottom:" + PAGE] = 1; this.saveSess(); }
      }
    }, { passive: true });
    // ธีม
    addEventListener("lvc:themechange", (e) => {
      const th = e.detail && e.detail.theme;
      this.webAct(th === "dark" ? "web.dark" : "web.light", "theme", 4000);
    });
    // สลับแท็บไปเกิน 30 วิ = หลับรอแล้วสะดุ้งตื่น
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) { this.hiddenAt = Date.now(); return; }
      if (this.clock) this.clock.getDelta();
      if (this.hiddenAt && Date.now() - this.hiddenAt > 30000) this.webAct("web.tabBack", "tab", 30000);
      this.hiddenAt = 0;
      this.onUserInput();
    });
    // หมุนจอ
    const onRotate = () => this.webAct("web.rotate", "rotate", 4000);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", onRotate);
    else addEventListener("orientationchange", onRotate);
    // ค้นหาในหน้าหลักสูตร: มองช่องค้นหา · ไม่เจอผล = "?" (พูดหลังเลิกพิมพ์)
    const sb = doc.getElementById("program-search");
    if (sb) {
      const empty = () => { const el = doc.querySelector(".empty-results"); return !!(el && !el.hidden); };
      sb.addEventListener("focus", () => { this.searchOn = true; this.sayKey("search.look", "event", { allowTyping: true, force: true }); });
      sb.addEventListener("blur", () => { this.searchOn = false; this.searchBox = null; if (empty()) this.sayKey("search.none", "event"); });
      let st = 0;
      sb.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => { if (empty()) this.webAct("web.noResult", "noResult", 6000); }, 600); });
      this.searchInput = sb;
    }
    // ทักแต่ละ section ครั้งเดียวต่อ session
    const ids = SECTIONS[PAGE] || [];
    const els = ids.map((id) => doc.getElementById(id)).filter(Boolean);
    if (els.length && "IntersectionObserver" in window) {
      this.secOn = new Set();
      const io = new IntersectionObserver((list) => {
        for (const en of list) {
          if (en.isIntersecting) { this.secOn.add(en.target.id); this.onSection(en.target.id); }
          else this.secOn.delete(en.target.id);
        }
      }, { rootMargin: "-35% 0px -45% 0px" });
      els.forEach((el) => io.observe(el));
    }
  }

  onSection(id) {
    const key = (PAGE === "programs" ? "group:" : "sec:") + id;
    if (this.S.greeted[key] || this.exited || this.hiding || this.spectating || this.muted()) return;
    if (this.state !== "idle" && this.state !== "walk") return;
    if (performance.now() - (this.enteredAt || 0) < 4000) return;          // เพิ่งเข้ามา: พักก่อน ไม่ทำท่าซ้อน
    if (PAGE === "programs") {
      if (!ACTS["group." + id]) return;
      if (this.webAct("group." + id, "group", 9000)) { this.S.greeted[key] = 1; this.saveSess(); }
      return;
    }
    if (this.sayKey("section." + id, "event")) { this.S.greeted[key] = 1; this.saveSess(); }
  }

  /* ======================================================================
   *  ลาก (A2 + B3) · โยน (B4)
   * ====================================================================== */
  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.loop = () => {};
    this.el.remove();
    this.bubble.el.remove(); this.bubble.sr.remove();
    if (this.dbg) this.dbg.remove();
    try { this.renderer.dispose(); } catch (e) {}
    if (pet === this) { pet = null; window.__LVC_PET = null; }
  }

  startHold(e) {
    if (this.exited || this.hiding) return;
    this.stopAct();
    this.cancelMotion();
    if (this.spectating) { this.spectating = false; this.lookAt(null); this.fb += this.base.db * this.size.charH; }
    this.base.db = 0;
    this.dimT = 0;
    this.setState("held", 0);
    this.el.classList.add("is-held");
    this.play("Held", 0.15);
    this.setFace({ squeeze: 1, open: 1, blush: 0.6 });
    this.yawTarget = 0;
    this.sayKey("drag.start", "tap");
    this.held = { t: 0, long: false, high: false, samples: [] };
    // จับที่แถว ๆ มือ/ศีรษะ (แกน y นับจากขอบล่าง)
    this.grab = { ox: this.fx - e.clientX, ob: this.fb - (innerHeight - e.clientY) };
    this.holdX = this.fx; this.holdB = this.fb;
    // จุดหมุน = จุดที่จับ (พิกัดใน .lvc-pet ซึ่งเท้าอยู่ที่ (w/2, footY))
    this.body.style.transformOrigin = `${(this.size.w / 2 - this.grab.ox).toFixed(1)}px ${(this.footY + this.grab.ob).toFixed(1)}px`;
    this.dragV = 0; this.dragA = 0;
  }

  moveHold(e) {
    this.holdX = e.clientX + this.grab.ox;
    this.holdB = innerHeight - e.clientY + this.grab.ob;
    const s = this.held.samples, now = performance.now();
    s.push({ t: now, x: this.holdX, b: this.holdB });
    while (s.length > 2 && now - s[0].t > 120) s.shift();
  }

  endHold() {
    this.el.classList.remove("is-held");
    this.actions.Held.timeScale = 1;
    const s = this.held ? this.held.samples : [];
    if (s.length >= 2 && !this.reduced) {
      const a = s[0], b = s[s.length - 1], dt = Math.max(0.016, (b.t - a.t) / 1000);
      const vx = (b.x - a.x) / dt, vb = (b.b - a.b) / dt;
      if (Math.hypot(vx, vb) > 1100 && performance.now() - b.t < 90) { this.throwPet(vx, vb); return; }   // โยน
    }
    this.clampPos();
    this.anchorX = this.fx;
    this.anchorB = this.fb;
    this.saveAnchor();
    this.idle(rand(1.5, 3));
    this.setFace({ smile: 0.8, blush: 0.3 });
    this.sayKey("drag.drop", "tap");
  }

  throwPet(vx, vb) {
    this.setState("fly", 6);
    this.fly = { vx: clamp(vx, -2600, 2600), vb: clamp(vb, -2000, 2600), rot: 0, bonk: false };
    this.play("Held", 0.1);
    this.setFace({ squeeze: 0.6, open: 0.8, browsUp: 0.6 });
  }

  updateFly(dt) {
    const f = this.fly, w = this.size.w, h = this.size.charH;
    const minX = w * 0.32 + 4, maxX = this.vw - w * 0.32 - 4, top = innerHeight - h - 8, floor = this.defaultBottom();
    f.vb -= 2600 * dt;
    this.fx += f.vx * dt; this.fb += f.vb * dt;
    f.rot += f.vx * dt * 0.25;
    const bonk = () => {
      this.sym("sweat", 1, "head");
      if (!f.bonk) { f.bonk = true; this.sayKey("drag.bonk", "tap"); this.setFace({ squeeze: 1, open: 0.6 }); }
    };
    if (this.fx < minX) { this.fx = minX; f.vx = Math.abs(f.vx) * 0.5; bonk(); }
    if (this.fx > maxX) { this.fx = maxX; f.vx = -Math.abs(f.vx) * 0.5; bonk(); }
    if (this.fb > top) { this.fb = top; f.vb = -Math.abs(f.vb) * 0.4; }
    this.moAdd.rot = clamp(f.rot, -540, 540) % 360;
    if (this.fb <= floor && f.vb < 0) {                                      // ถึงพื้น: ย่อตัว
      this.fb = floor;
      this.moAdd.rot = 0;
      this.fly = null;
      this.anchorX = clamp(this.fx, minX, maxX); this.anchorB = floor; this.fx = this.anchorX;
      this.saveAnchor();
      this.setState("act", 1.5);
      this.play("Idle", 0.1);
      this.setFace({ squeeze: 0.5, smile: 0.6 });
      this.sym("dust", 4, "feet");
      this.runMotion([{ t: 0, sx: 1.18, sy: 0.8 }, { t: 0.18, sx: 0.95, sy: 1.06 }, { t: 0.32, sx: 1, sy: 1 }], 0.4, () => { this.idle(2); this.sayKey("drag.drop", "tap"); });
    }
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
      if (z) this.bubble.close(false);
      if (z && (this.state === "held" || this.state === "fly")) {   // ซูมกลางการลาก: ยกเลิก ไม่ย้ายบ้าน
        this.el.classList.remove("is-held");
        this.fly = null; this.moAdd.rot = 0;
        this.fx = this.anchorX; this.fb = this.anchorB;
        this.idle(2);
      }
    }
    return z;
  }

  /* ---------- ซ่อน (ปุ่ม ×) / เรียกกลับ (ปุ่มหัวใจ) ---------- */
  hide(save) {
    if (this.hidden || this.hiding) return;
    if (save) store.write({ hidden: true });
    if (this.exited || this.zoomed) { this.reallyHide(); return; }
    this.hiding = true;
    this.spectating = false; this.base.db = 0; this.lookAt(null);
    this.playAct(this.pickAct("bye"), { cat: "bye" });                   // "บ๊ายบาย~" แล้วกระโดดลงใต้ขอบจอ/หมุนหาย
  }

  reallyHide() {
    this.hiding = false;
    this.hidden = true;
    this.stopAct();
    this.cancelMotion();
    this.bubble.close(false);
    this.el.classList.add("is-gone");
    if (this.dbgReturn) { this.debugReturn(); return; }
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
    this.enter("call");                          // ท่า 1 หรือ 5 + "เรียกหนูเหรอ!"
  }

  /* ---------- ขนาดตามจอ ---------- */
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

  /* ---------- อนิเมชัน ---------- */
  play(name, fade = 0.25, ts = 1, restart = false) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = ts;
    if (this.current === next) {
      if (restart && name === "Happy") next.reset().play();               // คลิปเล่นครั้งเดียว: เริ่มใหม่
      return;
    }
    next.reset().setEffectiveWeight(1).play();
    if (this.current && fade > 0) next.crossFadeFrom(this.current, fade, false);
    else if (this.current) this.current.stop();
    this.current = next;
  }

  setFace(f) { this.faceTarget = Object.assign({ happyEyes: 0, blink: 0, smile: 0, laugh: 0, squeeze: 0, open: 0, browsUp: 0, blush: 0 }, f); }

  updateFace(dt) {
    // กะพริบตา
    const eyesBusy = this.faceTarget.happyEyes > 0.1 || this.faceTarget.squeeze > 0.1 || this.faceTarget.blink > 0.1;
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
    // ระหว่างพิมพ์ข้อความ ปากขยับ (morph "open")
    if (this.talking) { this.talkT += dt; vals.open = Math.max(vals.open, 0.18 + 0.42 * Math.abs(Math.sin(this.talkT * 15))); }
    for (const m of this.morphs) {
      const dict = m.morphTargetDictionary, inf = m.morphTargetInfluences;
      for (const k in dict) inf[dict[k]] = vals[k] || 0;
    }
  }

  /* ======================================================================
   *  เฟรม
   * ====================================================================== */
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    this.acc = (this.acc || 0) + this.clock.getDelta();
    if (this.hidden || this.zoomed || (this.exited && !this.motion && !this.act)) { this.acc = 0; return; }
    // ยืนเฉย ๆ วาดแค่ ~30 ภาพ/วินาที ประหยัดแบต (ระหว่างทำท่า/พูด/สปริงยังแกว่ง วาดเต็ม)
    const calm = (this.state === "idle" || this.state === "spectate" || (this.act && this.act.def.sleep && this.act.t > 1)) &&
      !this.motion && this.blinkPhase < 0 && !this.talking && this.dim === this.dimT && !this.springsActive && Math.abs(this.sway) < 0.002;
    if (calm && this.acc < 1 / 30) return;
    const raw = this.acc;
    const dt = Math.min(0.1, raw);
    const tdt = Math.min(0.25, raw);            // ท่า/การเคลื่อนที่ยึดเวลาจริง จบตรงเวลาแม้เครื่องช้า
    this.acc = 0;
    const now = performance.now();

    // กันค้าง: ท่าไหนเกินเวลาที่ตั้งไว้ กลับไปยืนเอง
    if (this.state === "act" || this.state === "fly") {
      this.stateT -= dt;
      if (this.stateT <= 0 && !this.exited && !this.hiding) { this.stopAct(); this.cancelMotion(); this.fly = null; this.moAdd.rot = 0; this.idle(); }
    }
    if (this.act) this.updateAct(tdt);
    this.updateMotion(tdt);
    // ตรวจทุก ~250 ms (ไม่ใช่ทุกเฟรม): โหมดผู้ชม · หลบของสำคัญ · ตอนว่าง · ตำแหน่งแถบเมนู
    this.tickAcc += raw;
    if (this.tickAcc >= 0.25 && !this.exited) {
      this.tickAcc = 0;
      const hdr = doc.querySelector(".site-header");
      this.headerBottom = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
      this.menuOpen = !!doc.querySelector("dialog[open]");
      if (this.searchOn && this.searchInput) { const r = this.searchInput.getBoundingClientRect(); this.searchBox = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      if (this.state !== "held" && this.state !== "fly") {
        this.spectateTick();
        this.avoidTick(now);
        // section ที่อยู่กลางจอแต่ยังไม่ได้ทัก (ตอนนั้นติดท่าอื่น/ช่วงพัก) → ลองใหม่
        if (this.secOn && this.secOn.size && (this.state === "idle" || this.state === "walk")) for (const id of this.secOn) this.onSection(id);
        this.idleTick(now);
      }
      if (this.dbg) this.updateDebug();
    }
    this.dim = damp(this.dim, this.dimT, 5, dt);
    if (Math.abs(this.dim - this.dimT) < 0.002) this.dim = this.dimT;
    this.menuDim = damp(this.menuDim, this.menuOpen ? 1 : 0, 6, dt);
    if (Math.abs(this.menuDim - (this.menuOpen ? 1 : 0)) < 0.002) this.menuDim = this.menuOpen ? 1 : 0;
    this.applyMo();
    this.talking = this.bubble.update(raw);

    // เดิน: เร่งตอนออกตัว ชะลอก่อนหยุด · ความเร็วคลิปตามความเร็วจริง เท้าไม่ไถล
    if (this.state === "walk") {
      const vFull = WALK_FOOT_SPEED * WALK_TS * this.size.ppu * Math.abs(Math.sin(WALK_YAW));
      const turned = Math.abs(this.yaw - this.yawTarget) < 0.35;
      const rem = Math.abs(this.targetX - this.fx);
      const want = turned ? vFull * clamp(rem / (this.size.charH * 0.45), 0.25, 1) : 0;
      const accel = (vFull / 0.4) * dt;
      this.walkV = this.walkV < want ? Math.min(want, this.walkV + accel) : Math.max(want, this.walkV - accel * 1.5);
      const step = Math.min(rem, this.walkV * dt);
      this.fx += this.dir * step;
      if (this.actions.Walk) this.actions.Walk.timeScale = WALK_TS * clamp(this.walkV / vFull, 0.3, 1);
      if (rem - step < 1.5) { this.fx = this.targetX; this.walkV = 0; this.idle(); }
    }

    // ถูกลาก: ตามนิ้ว/เมาส์แบบหน่วงนิด ๆ ตัวห้อยใต้จุดที่จับ แกว่งเหมือนลูกตุ้ม · ขาดิ้นเร็วขึ้นตามความเร็ว
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
      const H = this.held;
      H.t += dt;
      if (this.actions.Held) this.actions.Held.timeScale = 1 + clamp(Math.abs(vx) / 700, 0, 2.2);
      if (H.t > 4 && !H.long) { H.long = true; this.sayKey("drag.long", "tap"); }
      if (this.fb > innerHeight * 0.55 && !H.high) { H.high = true; this.setFace({ squeeze: 1, open: 1, browsUp: 1 }); this.sayKey("drag.high", "tap"); }
    }
    if (this.state === "fly" && this.fly) this.updateFly(dt);
    this.swing(dt, accel);

    if (!(this.act && this.act.spin)) this.yaw = damp(this.yaw, this.yawTarget, 9, dt);
    this.model.rotation.y = this.yaw;
    this.place();

    this.updateLook(dt, now);
    this.resetPostBones();
    this.mixer.update(dt);
    this.applyLook();
    this.applyEyes();
    this.updateSprings(dt);
    this.applySprings();
    this.updateFace(dt);

    let lift = 0;
    if (this.rootBone) { this.model.updateMatrixWorld(); lift = Math.max(0, this.rootBone.getWorldPosition(this.tmpV).y - this.rootRestY); }
    const upDb = this.mo.db + this.moAdd.db;               // ท่าใหญ่ลอยขึ้น/มุดลง: เงาอยู่ที่พื้นเสมอ
    const s = this.state === "held" || this.state === "fly" || upDb < -0.05 ? 0 : clamp(1 - lift * 2.2 - upDb * 1.4, 0.3, 1) * this.mo.op;
    this.shadow.style.opacity = String(+s.toFixed(3));
    this.shadow.style.transform = `translateY(${(upDb * this.size.charH).toFixed(1)}px) scale(${Math.max(s, 0.3).toFixed(3)})`;

    this.renderer.render(this.scene, this.camera);
    this.frames = (this.frames || 0) + 1;
  }

  /* ======================================================================
   *  ?petdebug=1 — ค่าที่วัดได้ + เมนูเล่นทุกท่า
   * ====================================================================== */
  buildDebug() {
    this.el.classList.add("is-debug");
    const d = (this.dbg = doc.createElement("div"));
    d.className = "lvc-pet-debug";
    const cats = {};
    for (const id of Object.keys(ACTS)) (cats[ACTS[id].cat] || (cats[ACTS[id].cat] = [])).push(id);
    d.innerHTML = "<pre></pre>" + Object.keys(cats).map((c) => `<b>${c}</b>` + cats[c].map((id) => `<button type="button" data-act="${id}">${id.replace(/^[^.]+\./, "")}</button>`).join("")).join("") +
      '<b>อื่น ๆ</b><button type="button" data-x="spectate">โหมดผู้ชม</button><button type="button" data-x="say">ทดสอบคำพูดยาว</button><button type="button" data-x="reset">ล้างความจำ session</button>';
    this.dbgPre = d.querySelector("pre");
    d.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.act) {
        const id = b.dataset.act, def = ACTS[id];
        this.S.lastSelf = 0;                                                 // ให้พูดได้ทันทีตอนทดสอบ
        this.S.said = [];
        if (/^(exit|bye)/.test(def.cat)) { this.dbgReturn = true; this.playAct(id, { cat: def.cat }); return; }   // จบแล้วกลับมาเอง
        if (/^enter/.test(def.cat)) { this.exited = false; this.el.style.visibility = ""; this.el.classList.add("is-ready"); }
        this.playAct(id);
      } else if (b.dataset.x === "say") { this.S.lastSelf = 0; this.say("ทดสอบกล่องคำพูดภาษาไทย สระ วรรณยุกต์ ไม่แตก ✓", "tap"); }
      else if (b.dataset.x === "reset") { this.S = { said: [], lastSelf: 0, quiet: false, quick: 0, greeted: {}, recent: {} }; this.saveSess(); }
      else if (b.dataset.x === "spectate") { if (this.spectating) this.endSpectate(); else this.startSpectate(); }
    });
    doc.body.appendChild(d);
    this.dbgT = performance.now(); this.dbgF = 0;
  }

  updateDebug() {
    const r = this.el.getBoundingClientRect();
    const feet = innerHeight - (r.top + this.footY);
    const vv = window.visualViewport;
    const now = performance.now();
    const fps = ((this.frames - this.dbgF) * 1000) / Math.max(1, now - this.dbgT);
    this.dbgF = this.frames; this.dbgT = now;
    this.dbgPre.textContent =
      `เท้าจากขอบล่าง ${feet.toFixed(1)} px (ตั้งไว้ ${this.fb.toFixed(1)})\n` +
      `innerHeight ${innerHeight} · vv.scale ${vv ? vv.scale.toFixed(2) : "-"}\n` +
      `แคนวาส ${this.size.w}×${this.size.h} · วาด ${fps.toFixed(0)} fps\n` +
      `สถานะ ${this.state}${this.act ? " · ท่า " + this.act.id : ""}${this.spectating ? " · ผู้ชม" : ""}\n` +
      `จาง ${this.dim.toFixed(2)} · บ้าน ${this.anchorX.toFixed(0)},${this.anchorB.toFixed(0)}${this.displaced() ? " (หลบอยู่)" : ""}\n` +
      `เงียบ ${this.S.quiet ? "ใช่" : "ไม่"} · พูดแล้ว ${this.S.said.length} ประโยค`;
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
addEventListener("lvc:tx-leave", (e) => { if (pet) pet.leave(e.detail || {}); });
// เปลี่ยนหน้าไม่สำเร็จ หรือกด Back แล้วได้หน้าเดิมจาก bfcache: ตัวเดิมกลับมา (ไม่สร้างใหม่ จึงไม่ซ้อนสองตัว)
const comeBack = () => { if (pet && pet.exited && !pet.hidden && !pet.waitingEnter) pet.enter("return"); };
addEventListener("lvc:tx-cancel", comeBack);
addEventListener("pageshow", (e) => { if (e.persisted) comeBack(); });

(function init() {
  if (window.__LVC_PET_BOOT || !hasWebGL()) return;
  window.__LVC_PET_BOOT = true;
  window.__LVC_PET_VERSION = VERSION;
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
