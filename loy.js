/* ============================================================================
 * loy.js — ลอยกระทงออนไลน์ + แม่น้ำของเรา (หน้าแรก เฉพาะช่วงเทศกาล: html[data-loy] จาก theme.js)
 *
 * - ฟอร์ม: เลือกกระทง 4 แบบ · ชื่อ ≤ 20 (ไม่ใส่ก็ได้) · คำอธิษฐาน 1–80 · กรองคำหยาบ/เบอร์โทร/ลิงก์ (loy-filter.js)
 *   ลอยได้ 1 ใบต่อ 30 วินาทีต่อเครื่อง (localStorage) · ฝั่งเซิร์ฟเวอร์ตรวจชนิด/ความยาวซ้ำด้วย firebase/firestore.rules
 * - แม่น้ำ: กระทงล่าสุด 20 + สุ่ม 20 (ไม่ซ้ำ ≤ 40 ใบ) ตัวเลขรวมจาก count() · ทุก 45 วิ (เฉพาะตอนเห็นแม่น้ำ) ดึงใบใหม่มาเพิ่ม
 *   กระทงเป็นปุ่ม (อ่านออกเสียงได้ · Tab เข้าแล้วใช้ลูกศรซ้าย/ขวา) แตะ = การ์ดคำอธิษฐาน + ปุ่มแจ้งซ่อน
 * - Firebase ยังไม่ตั้ง/ล่ม → ลอยในเครื่องตัวเอง (localStorage) และขึ้นข้อความบอก แล้วลองเชื่อมต่อใหม่เอง
 * - ผิวน้ำวาดด้วย canvas 2D ~30 ภาพ/วิ ผ่าน gsap.ticker (ตัวเดียวกับ window.__LVC) · นอกจอ/สลับแท็บ = หยุดวาด
 * - Reduced Motion: กระทงอยู่นิ่ง ผิวน้ำวาดครั้งเดียว ไม่มีการเคลื่อนไหว
 * ============================================================================ */
import * as db from "./loy-db.js?v=2026-11-20.1";
import { tidy, problem, MESSAGES } from "./loy-filter.js?v=2026-11-20.1";

const root = document.documentElement;
const L = window.__LVC || {};
const gsap = L.gsap || null;
const ST = L.ScrollTrigger || null;
const reduceQ = matchMedia("(prefers-reduced-motion: reduce)");
const MAX = 40, RATE_MS = 30000, POLL_MS = 45000;
const KEY = { last: "lvc.loy.last", mine: "lvc.loy.mine", local: "lvc.loy.local", hidden: "lvc.loy.hidden" };
const STYLES = ["ใบตอง", "ดอกบัว", "ขนมปัง", "ดาวเรือง"];

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- ภาพกระทง (SVG) 4 แบบ ---------- */
const PAL = [
  { base: "#2d5a34", petal: "#4f9a57", fold: "#2f6b39", flower: "#f4a531", core: "#ffd76a" },   // ใบตอง
  { base: "#2d5a34", petal: "#f29bb5", fold: "#d16b8c", flower: "#fff1c2", core: "#f6c94f" },   // ดอกบัว
  { base: "#a8642f", petal: "#dca063", fold: "#b97a3f", flower: "#f6d7a0", core: "#e9604e" },   // ขนมปัง
  { base: "#2d5a34", petal: "#f39a1e", fold: "#d9770f", flower: "#ffc14a", core: "#ffe28a" },   // ดาวเรือง
];
function art(style) {
  const p = PAL[style] || PAL[0];
  let body;
  if (style === 1) {          // ดอกบัว: กลีบมน ซ้อนสองชั้น
    body = `<path d="M10 44c4-10 10-14 15-15 1 7-2 13-6 17zM70 44c-4-10-10-14-15-15-1 7 2 13 6 17z" fill="${p.fold}"/>
      <path d="M22 44c0-13 6-20 11-23 3 8 1 18-3 24zM58 44c0-13-6-20-11-23-3 8-1 18 3 24z" fill="${p.petal}"/>
      <path d="M33 45c-2-12 2-21 7-26 5 5 9 14 7 26z" fill="${p.petal}"/>`;
  } else if (style === 2) {   // ขนมปัง: ก้อนกลมมีลาย
    body = `<path d="M12 44c0-12 12-19 28-19s28 7 28 19z" fill="${p.petal}"/>
      <path d="M20 36c5-3 9-3 13 0M35 33c5-3 9-3 13 0M50 36c4-2 7-2 10 0" stroke="${p.fold}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else if (style === 3) {   // ดาวเรือง: กลีบหยักเป็นวง
    body = `<path d="M12 43l3-8 4 6 3-10 5 8 3-11 5 9 5-9 3 11 5-8 3 10 4-6 3 8z" fill="${p.fold}"/>
      <circle cx="22" cy="37" r="6" fill="${p.petal}"/><circle cx="58" cy="37" r="6" fill="${p.petal}"/>`;
  } else {                    // ใบตอง: กลีบแหลมพับซ้อน
    body = `<path d="M11 43l5-15 6 13 6-16 6 15 6-17 6 17 6-15 6 16 6-13 5 15z" fill="${p.petal}"/>
      <path d="M16 28l2 13M28 25l2 15M40 23v16M52 25l-2 15M64 28l-2 13" stroke="${p.fold}" stroke-width="1.6"/>`;
  }
  return `<svg class="loy-art" viewBox="0 0 80 60" aria-hidden="true" focusable="false">
    <path d="M7 43c10 11 56 11 66 0l-3 6c-12 9-48 9-60 0z" fill="${p.base}"/>
    <ellipse cx="40" cy="44" rx="33" ry="6" fill="${p.base}"/>
    ${body}
    <circle cx="40" cy="33" r="7.5" fill="${p.flower}"/><circle cx="40" cy="33" r="3.2" fill="${p.core}"/>
    <path d="M32 33l-3-17M48 33l3-16" stroke="#7b5236" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="29" cy="15.5" r="1.1" fill="#ff8a3d"/><circle cx="51" cy="16.5" r="1.1" fill="#ff8a3d"/>
    <rect x="38.4" y="13" width="3.2" height="17" rx="1.2" fill="#fff3da"/>
    <path class="loy-flame" d="M40 1.5c3.6 4.2 4.2 7.6 0 11.2-4.2-3.6-3.6-7 0-11.2z" fill="#ffd36e"/>
    <path d="M40 6.2c1.4 1.8 1.6 3.4 0 4.8-1.6-1.4-1.4-3 0-4.8z" fill="#fff7d6"/>
  </svg>`;
}

/* ---------- เวลาแบบ "x นาทีที่แล้ว" ---------- */
const RTF = (() => { try { return new Intl.RelativeTimeFormat("th", { numeric: "auto" }); } catch (e) { return null; } })();
function ago(ms) {
  if (!ms || !RTF) return "";
  const s = Math.round((ms - Date.now()) / 1000), a = Math.abs(s);
  if (a < 45) return "เมื่อสักครู่";
  if (a < 3600) return RTF.format(Math.round(s / 60), "minute");
  if (a < 86400) return RTF.format(Math.round(s / 3600), "hour");
  return RTF.format(Math.round(s / 86400), "day");
}
const fmt = (n) => Number(n || 0).toLocaleString("th-TH");

/* ======================================================================
 *  สร้าง section
 * ====================================================================== */
function build() {
  const sec = document.createElement("section");
  sec.id = "loy";
  sec.className = "loy";
  sec.setAttribute("aria-labelledby", "loy-title");
  sec.innerHTML = `
  <div class="wrap loy__top">
    <div class="loy__intro">
      <p class="loy__eyebrow"><i aria-hidden="true"></i>ลอยกระทง 2569</p>
      <h2 id="loy-title" class="loy__title">ลอยกระทง<span>ออนไลน์</span></h2>
      <p class="loy__lead">เลือกกระทง เขียนคำอธิษฐาน แล้วปล่อยลง “แม่น้ำของเรา” กระทงทุกใบลอยอยู่ด้วยกัน ใครเข้าเว็บก็เห็น</p>
      <ul class="loy__rules" id="loy-rules">
        <li>ข้อความจะแสดงให้ทุกคนเห็น</li>
        <li>ไม่ใส่เบอร์โทร ลิงก์ หรือคำไม่สุภาพ</li>
        <li>ลอยได้ 1 ใบทุก 30 วินาที</li>
      </ul>
    </div>
    <form class="loy__form" novalidate aria-describedby="loy-rules">
      <fieldset class="loy__pick">
        <legend>เลือกกระทง</legend>
        <div class="loy__styles">${STYLES.map((n, i) => `
          <label class="loy__style"><input type="radio" name="kt" value="${i}"${i ? "" : " checked"}>
            <span class="loy__style-art">${art(i)}</span><span class="loy__style-name">${n}</span></label>`).join("")}
        </div>
      </fieldset>
      <div class="loy__field">
        <label for="loy-name">ชื่อ <small>(ไม่ใส่ก็ได้)</small></label>
        <input id="loy-name" name="name" type="text" maxlength="20" autocomplete="nickname" enterkeyhint="next" aria-describedby="loy-name-n">
        <span class="loy__n" id="loy-name-n">0/20</span>
      </div>
      <div class="loy__field">
        <label for="loy-wish">คำอธิษฐาน</label>
        <textarea id="loy-wish" name="wish" rows="2" maxlength="80" required enterkeyhint="send" aria-describedby="loy-wish-n loy-error"></textarea>
        <span class="loy__n" id="loy-wish-n">0/80</span>
      </div>
      <p class="loy__error" id="loy-error" role="alert"></p>
      <button class="loy__send" type="submit"><span class="loy__send-label">ลอยกระทง</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
    </form>
  </div>
  <div class="loy__river" id="loy-river">
    <div class="wrap loy__river-head">
      <div><h3 class="loy__river-title" id="loy-river-title">แม่น้ำของเรา</h3>
      <p class="loy__help" id="loy-river-help">แตะกระทงเพื่ออ่านคำอธิษฐาน<span class="loy__help-keys"> · กด Tab แล้วใช้ลูกศรซ้าย/ขวาเลื่อนไปใบอื่น</span></p></div>
      <p class="loy__total" aria-live="polite"><b>–</b> <span>ใบที่ลอยอยู่</span></p>
      <p class="loy__status" role="status" hidden></p>
    </div>
    <canvas class="loy__water" aria-hidden="true" data-pet-avoid="off"></canvas>
    <div class="loy__boats" role="group" aria-labelledby="loy-river-title" aria-describedby="loy-river-help"></div>
    <div class="loy__card" role="dialog" aria-modal="false" aria-labelledby="loy-card-name" hidden>
      <p class="loy__card-mine" hidden>กระทงของคุณ</p>
      <p class="loy__card-name" id="loy-card-name"></p>
      <p class="loy__card-wish"></p>
      <p class="loy__card-time"></p>
      <div class="loy__card-confirm" hidden>
        <p>ซ่อนกระทงใบนี้จากหน้าจอของคุณ และแจ้งผู้ดูแลให้ตรวจสอบ?</p>
        <div class="loy__card-actions">
          <button type="button" class="loy__btn loy__btn--warn" data-act="report-yes">ซ่อนและแจ้ง</button>
          <button type="button" class="loy__btn" data-act="report-no">ยกเลิก</button>
        </div>
      </div>
      <div class="loy__card-actions loy__card-main">
        <button type="button" class="loy__btn loy__btn--ghost" data-act="report">แจ้งซ่อนกระทง</button>
        <button type="button" class="loy__btn" data-act="close">ปิด</button>
      </div>
    </div>
  </div>`;
  return sec;
}

/* ======================================================================
 *  แม่น้ำ
 * ====================================================================== */
class River {
  constructor(el) {
    this.el = el;
    this.layer = el.querySelector(".loy__boats");
    this.canvas = el.querySelector(".loy__water");
    this.head = el.querySelector(".loy__river-head");
    this.ctx = this.canvas.getContext("2d");
    this.card = el.querySelector(".loy__card");
    this.boats = new Map();
    this.w = 0; this.h = 0; this.dpr = 1;
    this.active = false; this.lastDraw = 0; this.t = 0;
    this.open = null;
    this.ripples = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), w: 0.02 + Math.random() * 0.06, a: 0.05 + Math.random() * 0.12 }));
    this.sparks = Array.from({ length: 70 }, () => ({ y: Math.random(), o: Math.random() * 6.28, s: 0.6 + Math.random() * 1.6 }));
    this.tick = this.tick.bind(this);
    this.resize();
    new ResizeObserver(() => { this.resize(); this.draw(); }).observe(el);
    // นอกจอ / สลับแท็บ = หยุดวาดและหยุดกระทง
    new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this.sync(); }, { rootMargin: "60px 0px" }).observe(el);
    document.addEventListener("visibilitychange", () => this.sync());
    reduceQ.addEventListener && reduceQ.addEventListener("change", () => { this.layout(); this.sync(); this.draw(); });
    this.bindCard();
    this.bindKeys();
  }
  get still() { return reduceQ.matches; }
  sync() {
    const on = !!this.visible && !document.hidden && !this.still;
    if (on === this.active) return;
    this.active = on;
    if (on) { if (gsap) gsap.ticker.add(this.tick); else this.raf = requestAnimationFrame(this.rafTick = (t) => { this.tick(t / 1000, 16); if (this.active) this.raf = requestAnimationFrame(this.rafTick); }); }
    else { if (gsap) gsap.ticker.remove(this.tick); else cancelAnimationFrame(this.raf); }
  }
  resize() {
    const r = this.el.getBoundingClientRect(), oldW = this.w;
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    // กว้างเปลี่ยน (หมุนจอ / section เพิ่งได้ขนาดจริงหลังฉากเข้าเว็บ) → ย้ายกระทงตามสัดส่วน ไม่กองอยู่ขอบซ้าย
    if (oldW && oldW !== this.w) for (const b of this.boats.values()) b.x *= this.w / oldW;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.w > 900 ? 1.25 : 1.5);
    // ช่องลอยเริ่มใต้หัวข้อ/ข้อความแจ้ง (มือถือหัวข้อสูงกว่า)
    this.top = Math.min(0.52, Math.max(0.3, (this.head.offsetTop + this.head.offsetHeight + 40) / this.h));
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.layout();
  }
  // ช่องลอย: บนสุด = ไกล (เล็ก ช้า จางลง) · ล่าง = ใกล้
  lane(b) {
    const top = this.top || 0.3, span = 0.9 - top;
    b.depth = b.lane;
    b.y = (top + span * b.lane) * this.h;
    b.scale = (0.66 + 0.5 * b.lane) * (this.w > 900 ? 1.3 : 1);
    b.speed = (7 + 12 * b.lane) * (b.dir || 1);
    if (b.el) b.el.style.zIndex = String(10 + Math.round(b.lane * 50));
  }
  layout() {
    let i = 0;
    for (const b of this.boats.values()) {
      this.lane(b);
      if (this.still) b.x = ((i * 0.618 + 0.08) % 1) * (this.w - 60) + 30;   // นิ่ง: กระจายเต็มลำน้ำ
      i++;
      this.place(b);
    }
  }
  place(b) {
    const bob = this.still ? 0 : Math.sin(this.t * b.f + b.p) * 2.4;
    b.el.style.transform = `translate3d(${(b.x - 28).toFixed(1)}px,${(b.y - 44 + bob).toFixed(1)}px,0)`;
  }
  add(k, opts = {}) {
    if (this.boats.has(k.id)) return this.boats.get(k.id);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "loy-boat" + (k.mine ? " is-mine" : "") + (k.decor ? " is-decor" : "");
    el.tabIndex = -1;
    if (k.decor) { el.setAttribute("aria-hidden", "true"); el.disabled = true; }
    else el.setAttribute("aria-label", `กระทง${k.mine ? "ของคุณ" : ""} ${k.name || "ไม่ระบุชื่อ"}: ${k.wish}`);
    el.innerHTML = `<span class="loy-boat__body" style="--s:${(0.66 + 0.5 * (opts.lane != null ? opts.lane : 0.5)).toFixed(3)}">${art(k.style | 0)}</span>`;
    const b = { k, el, body: el.firstChild, lane: opts.lane != null ? opts.lane : Math.random(), x: opts.x != null ? opts.x : Math.random() * this.w,
      dir: 1, f: 1.1 + Math.random() * 0.8, p: Math.random() * 6.28, held: false };
    this.lane(b);
    b.body.style.setProperty("--s", b.scale.toFixed(3));
    if (this.still && opts.x == null) b.x = ((this.boats.size * 0.618 + 0.08) % 1) * (this.w - 60) + 30;
    el.addEventListener("click", () => this.show(b));
    el.addEventListener("focus", () => { b.held = true; this.roving(b); });
    el.addEventListener("blur", () => { if (this.open !== b) b.held = false; });
    this.boats.set(k.id, b);
    this.layer.appendChild(el);
    this.place(b);
    if (!this.layer.querySelector('.loy-boat[tabindex="0"]')) this.roving(b);
    if (opts.launch && gsap && !this.still) {
      gsap.fromTo(b.body, { y: -70, scale: 0.4, autoAlpha: 0, rotation: -8 }, { y: 0, scale: 1, autoAlpha: 1, rotation: 0, duration: 1.3, ease: "back.out(1.5)", clearProps: "transform,opacity,visibility" });
    } else if (opts.arrive && gsap && !this.still) {
      gsap.fromTo(b.body, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, clearProps: "opacity,visibility" });
    }
    this.trim();
    return b;
  }
  remove(id, sink) {
    const b = this.boats.get(id);
    if (!b) return;
    this.boats.delete(id);
    if (this.open === b) this.hide(false);
    const gone = () => b.el.remove();
    if (sink && gsap && !this.still) gsap.to(b.body, { y: 18, autoAlpha: 0, scale: 0.8, duration: 0.8, ease: "power2.in", onComplete: gone });
    else gone();
    if (b.el.tabIndex === 0) { const n = this.boats.values().next().value; if (n) this.roving(n); }
  }
  // ไม่เกิน MAX ใบ: เอาใบเก่าสุดที่ไม่ใช่ของเราออก
  trim() {
    if (this.boats.size <= MAX) return;
    const list = [...this.boats.values()].filter((b) => !b.k.mine && b !== this.open).sort((a, b) => (a.k.at || 0) - (b.k.at || 0));
    while (this.boats.size > MAX && list.length) this.remove(list.shift().k.id, true);
  }
  clear() { for (const id of [...this.boats.keys()]) this.remove(id); }

  tick(time, dtMs) {
    const dt = Math.min(0.05, (dtMs || 16) / 1000);
    this.t = time;
    // กันพลาด: ตรวจซ้ำทุก ~1 วิ ว่ายังอยู่ในจอ (ถ้าเหตุการณ์ของ IntersectionObserver มาช้า/หาย ก็ยังหยุดวาดได้)
    if ((this.n = (this.n || 0) + 1) % 60 === 0) {
      const r = this.el.getBoundingClientRect();
      if (r.bottom < -60 || r.top > innerHeight + 60) { this.visible = false; this.sync(); return; }
    }
    for (const b of this.boats.values()) {
      if (!b.held) {
        b.x += b.speed * dt;
        if (b.x > this.w + 50) b.x = -50; else if (b.x < -50) b.x = this.w + 50;
      }
      this.place(b);
    }
    if (time - this.lastDraw >= 1 / 30) { this.lastDraw = time; this.draw(); }
  }

  /* ผิวน้ำ: ไล่สี + ระลอก + ทางแสงจันทร์ + แสงเทียนสะท้อนใต้กระทง */
  draw() {
    const c = this.ctx, W = this.w, H = this.h, t = this.still ? 0 : this.t;
    if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(11,16,39,0)"); g.addColorStop(0.22, "#0d1838"); g.addColorStop(1, "#060b20");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // แนวน้ำไกล ๆ (เส้นขอบฟ้า)
    c.fillStyle = "rgba(160,180,255,.10)"; c.fillRect(0, H * 0.22, W, 1);
    c.lineCap = "round";
    for (const r of this.ripples) {
      const y = H * (0.24 + r.y * 0.74), k = 0.3 + r.y;
      const x = ((r.x * W + t * 9 * k) % (W + 80)) - 40;
      c.strokeStyle = `rgba(170,190,255,${(r.a * k).toFixed(3)})`;
      c.lineWidth = 0.8 + r.y;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + r.w * W * k, y); c.stroke();
    }
    // ทางแสงจันทร์ (ขวาของลำน้ำ ตรงกับพระจันทร์ในฉากหน้าแรก)
    const mx = W * 0.8;
    const mg = c.createRadialGradient(mx, H * 0.22, 0, mx, H * 0.22, H * 0.9);
    mg.addColorStop(0, "rgba(255,240,210,.20)"); mg.addColorStop(1, "rgba(255,240,210,0)");
    c.fillStyle = mg; c.fillRect(0, 0, W, H);
    for (const s of this.sparks) {
      const y = H * (0.23 + s.y * 0.76), spread = 10 + s.y * W * 0.09;
      const x = mx + Math.sin(s.o * 3.1 + s.y * 7) * spread;
      const a = Math.max(0, Math.sin(t * s.s * 2 + s.o)) * (0.25 + 0.55 * (1 - s.y * 0.5));
      if (a < 0.03) continue;
      c.fillStyle = `rgba(255,242,214,${a.toFixed(3)})`;
      c.fillRect(x, y, 4 + s.y * 14, 1.2 + s.y);
    }
    // แสงเทียนใต้กระทง: ริ้วแสงบาง ๆ บนระลอกน้ำ จางลงเมื่อห่างกระทง
    c.globalCompositeOperation = "lighter";
    for (const b of this.boats.values()) {
      const x = b.x, y = b.y + 3, len = (24 + 36 * b.lane) * b.scale, n = 8;
      for (let i = 0; i < n; i++) {
        const k = i / n, ww = (5 + 9 * b.lane) * b.scale * (1 - k * 0.55);
        const off = this.still ? 0 : Math.sin(t * 2.6 + i * 1.3 + b.p) * (1.5 + k * 3);
        c.fillStyle = `rgba(255,186,96,${((b.k.decor ? 0.16 : 0.32) * (1 - k)).toFixed(3)})`;
        c.beginPath(); c.ellipse(x + off, y + k * len, ww / 2, 0.9 + k * 0.6, 0, 0, 6.283); c.fill();
      }
    }
    c.globalCompositeOperation = "source-over";
  }

  /* ---------- การ์ดคำอธิษฐาน ---------- */
  bindCard() {
    const card = this.card;
    card.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const b = this.open;
      if (act.dataset.act === "close") this.hide(true);
      else if (act.dataset.act === "report") { card.querySelector(".loy__card-confirm").hidden = false; card.querySelector(".loy__card-main").hidden = true; card.querySelector('[data-act="report-yes"]').focus(); }
      else if (act.dataset.act === "report-no") { this.resetCard(); card.querySelector('[data-act="report"]').focus(); }
      else if (act.dataset.act === "report-yes" && b && this.onReport) this.onReport(b);
    });
    card.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); this.hide(true); } });
    document.addEventListener("pointerdown", (e) => {
      if (this.open && !card.contains(e.target) && !this.open.el.contains(e.target)) this.hide(false);
    });
  }
  resetCard() {
    this.card.querySelector(".loy__card-confirm").hidden = true;
    this.card.querySelector(".loy__card-main").hidden = false;
  }
  show(b) {
    if (b.k.decor) return;
    if (this.open && this.open !== b) this.open.held = false;
    this.open = b; b.held = true;
    const card = this.card, k = b.k;
    card.querySelector(".loy__card-mine").hidden = !k.mine;
    card.querySelector(".loy__card-name").textContent = k.name || "ไม่ระบุชื่อ";
    card.querySelector(".loy__card-wish").textContent = `“${k.wish}”`;
    card.querySelector(".loy__card-time").textContent = ago(k.at);
    card.querySelector('[data-act="report"]').hidden = !!(k.mine || k.local);
    this.resetCard();
    card.hidden = false;
    // วางเหนือกระทง ไม่ล้นขอบแม่น้ำ
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const x = Math.min(Math.max(12, b.x - cw / 2), this.w - cw - 12);
    let y = b.y - ch - 52;
    if (y < 8) y = Math.min(this.h - ch - 8, b.y + 14);
    card.style.left = x.toFixed(0) + "px";
    card.style.top = Math.max(8, y).toFixed(0) + "px";
    // opacity ไม่ใช่ autoAlpha: ต้องโฟกัสปุ่มในการ์ดได้ทันที (visibility:hidden โฟกัสไม่ได้)
    if (gsap && !this.still) gsap.fromTo(card, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "opacity,transform" });
    card.querySelector('[data-act="close"]').focus({ preventScroll: true });
  }
  hide(focusBoat) {
    const b = this.open;
    this.card.hidden = true;
    this.open = null;
    if (!b) return;
    b.held = document.activeElement === b.el;
    if (focusBoat && this.boats.has(b.k.id)) { b.el.focus({ preventScroll: true }); b.held = true; }
  }
  /* ---------- คีย์บอร์ด: Tab เข้าแม่น้ำได้ครั้งเดียว แล้วใช้ลูกศรเลื่อนใบ ---------- */
  roving(b) {
    for (const o of this.boats.values()) if (o !== b && o.el.tabIndex === 0) o.el.tabIndex = -1;
    if (!b.k.decor) b.el.tabIndex = 0;
  }
  bindKeys() {
    this.layer.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      const list = [...this.boats.values()].filter((b) => !b.k.decor).sort((a, b) => a.x - b.x);
      if (!list.length) return;
      e.preventDefault();
      const at = list.findIndex((b) => b.el === document.activeElement);
      const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length;
      list[at] && (list[at].held = false);
      list[next].el.focus();
    });
  }
}

/* ======================================================================
 *  ข้อมูล: ออนไลน์ (Firestore) / ในเครื่อง
 * ====================================================================== */
function init() {
  if (!root.hasAttribute("data-loy") || document.getElementById("loy")) return;
  const main = document.querySelector("main");
  if (!main) return;
  const sec = build();
  // ต่อจากฉาก 8 กลุ่มสาขา ก่อน "บริการที่ใช้บ่อย" (ไม่แทรกก่อนฉากที่ตรึงไว้ ตำแหน่งฉากเดิมจึงไม่เปลี่ยน)
  const services = main.querySelector(":scope > #services");
  if (services) services.before(sec); else main.append(sec);

  const $ = (s) => sec.querySelector(s);
  const form = $(".loy__form"), nameEl = $("#loy-name"), wishEl = $("#loy-wish"), errEl = $("#loy-error");
  const sendBtn = $(".loy__send"), sendLabel = $(".loy__send-label"), statusEl = $(".loy__status"), totalEl = $(".loy__total b");
  const river = new River($(".loy__river"));
  const mine = new Set(store.get(KEY.mine, []));
  const hidden = new Set(store.get(KEY.hidden, []));
  let mode = "loading", total = 0, lastErr = 0, newest = 0;   // newest = เวลาเซิร์ฟเวอร์ของใบล่าสุดที่เห็นแล้ว

  /* ---------- ตัวเลขรวม ---------- */
  const shown = { n: 0 };
  function setTotal(n) {
    total = Math.max(0, n);
    if (gsap && !reduceQ.matches) gsap.to(shown, { n: total, duration: 1.2, ease: "power2.out", overwrite: true, onUpdate: () => { totalEl.textContent = fmt(Math.round(shown.n)); } });
    else totalEl.textContent = fmt(total);
    $(".loy__total span").textContent = mode === "online" ? "ใบที่ลอยอยู่บนแม่น้ำ" : "ใบในเครื่องนี้";
  }
  function status(text, ms) {
    statusEl.textContent = text || ""; statusEl.hidden = !text;
    if (ms) setTimeout(() => { if (statusEl.textContent === text && mode === "online") status(""); }, ms);
  }

  const tag = (k) => Object.assign(k, { mine: !!k.mine || mine.has(k.id) });
  function fill(list) {
    for (const k of list) {
      if (!k.local && k.at > newest) newest = k.at;
      if (!hidden.has(k.id) && !river.boats.has(k.id)) river.add(tag(k), { arrive: mode === "online" && river.boats.size > 0 });
    }
  }

  /* ---------- ในเครื่อง ---------- */
  function goLocal(why) {
    const was = mode;
    mode = "local";
    status(why === "config"
      ? "แม่น้ำรวมยังไม่เปิดให้ใช้งาน กระทงของคุณจะลอยอยู่ในเครื่องนี้ก่อน"
      : "ตอนนี้เชื่อมต่อแม่น้ำรวมไม่ได้ กระทงของคุณจะลอยอยู่ในเครื่องนี้ก่อน แล้วระบบจะลองเชื่อมต่อใหม่เอง");
    if (was === "online") return;
    const local = store.get(KEY.local, []);
    fill(local.map((k) => Object.assign(k, { local: true, mine: true })));
    // ให้ลำน้ำไม่ว่าง: กระทงประดับ (ไม่มีข้อความ กดไม่ได้)
    for (let i = 0; i < 7; i++) river.add({ id: "decor" + i, decor: true, style: i % 4 }, { lane: (i * 0.37) % 1, x: ((i * 0.29 + 0.05) % 1) * river.w });
    setTotal(local.length);
  }

  /* ---------- ออนไลน์ ---------- */
  async function load() {
    if (!db.configured) { goLocal("config"); return; }
    try {
      const [late, rnd, n] = await Promise.all([db.latest(20), db.random(26), db.count()]);
      if (mode === "local") for (const id of [...river.boats.keys()]) if (/^decor/.test(id)) river.remove(id);   // กระทงในเครื่องยังลอยอยู่ต่อ
      mode = "online";
      status("");
      const seen = new Set();
      fill(late.concat(rnd).filter((k) => !seen.has(k.id) && seen.add(k.id)).slice(0, MAX));
      setTotal(n);
    } catch (e) {
      if (window.console) console.warn("[loy] ใช้แม่น้ำในเครื่องแทน:", e.code || "", e.message);
      lastErr = Date.now();
      if (mode !== "local") { river.clear(); goLocal("error"); }
    }
  }
  // ทุก 45 วิ เฉพาะตอนเห็นแม่น้ำ: ใบใหม่ของคนอื่น + ตัวเลขรวม · โหมดในเครื่อง = ลองเชื่อมต่อใหม่
  async function poll() {
    if (!river.visible || document.hidden || !db.configured) return;
    if (mode === "local") { if (Date.now() - lastErr > 50000) load(); return; }
    try {
      const [late, n] = await Promise.all([newest ? db.since(newest, 8) : db.latest(8), db.count()]);
      for (const k of late) if (k.at > newest) newest = k.at;
      const fresh = late.filter((k) => !river.boats.has(k.id) && !hidden.has(k.id) && !mine.has(k.id));
      for (const k of fresh.reverse()) river.add(tag(k), { arrive: true, x: -40, lane: Math.random() });
      if (fresh.length) window.dispatchEvent(new CustomEvent("lvc:krathong", { detail: { own: false, n: fresh.length } }));
      if (n !== total) setTotal(n);
    } catch (e) { /* ครั้งหน้าลองใหม่ */ }
  }
  setInterval(poll, POLL_MS);

  /* ---------- แจ้งซ่อน ---------- */
  river.onReport = async (b) => {
    const id = b.k.id;
    hidden.add(id);
    store.set(KEY.hidden, [...hidden].slice(-300));
    river.remove(id, true);
    let ok = mode === "online";
    if (ok) { try { await db.report(id); } catch (e) { ok = false; } }
    status(ok ? "ซ่อนกระทงใบนั้นแล้ว และแจ้งผู้ดูแลให้ตรวจสอบ" : "ซ่อนกระทงใบนั้นในเครื่องนี้แล้ว", 6000);
    const first = [...river.boats.values()].find((x) => !x.k.decor);
    if (first) first.el.focus({ preventScroll: true });
  };

  /* ---------- ฟอร์ม ---------- */
  const counter = (el, out, max) => { const f = () => { out.textContent = `${el.value.length}/${max}`; }; el.addEventListener("input", f); f(); };
  counter(nameEl, $("#loy-name-n"), 20);
  counter(wishEl, $("#loy-wish-n"), 80);
  function fail(msg, field) {
    errEl.textContent = msg;
    [nameEl, wishEl].forEach((el) => el.toggleAttribute("aria-invalid", el === field));
    if (field) field.focus();
  }
  [nameEl, wishEl].forEach((el) => el.addEventListener("input", () => { if (errEl.textContent) { errEl.textContent = ""; el.removeAttribute("aria-invalid"); } }));
  wishEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : sendBtn.click(); } });

  // นับถอยหลังบนปุ่มระหว่างรอ 30 วินาที
  let waitT = 0;
  function waitLeft() { return Math.max(0, RATE_MS - (Date.now() - (store.get(KEY.last, 0) || 0))); }
  function showWait() {
    clearTimeout(waitT);
    const left = waitLeft();
    if (!left) { sendBtn.disabled = false; sendLabel.textContent = "ลอยกระทง"; return; }
    sendBtn.disabled = true;
    sendLabel.textContent = `ลอยใบต่อไปได้ใน ${Math.ceil(left / 1000)} วินาที`;
    waitT = setTimeout(showWait, 1000 - (left % 1000) + 20);
  }
  showWait();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sendBtn.getAttribute("aria-busy") === "true") return;
    const name = tidy(nameEl.value), wish = tidy(wishEl.value);
    const style = Number(form.elements.kt.value) | 0;   // ชื่อ "kt" ไม่ใช่ "style" (form.style จะกลายเป็นปุ่มเลือกแทน CSS)
    if (!wish) return fail("เขียนคำอธิษฐานก่อนนะ", wishEl);
    if (wish.length > 80) return fail("คำอธิษฐานยาวเกิน 80 ตัวอักษร", wishEl);
    if (name.length > 20) return fail("ชื่อยาวเกิน 20 ตัวอักษร", nameEl);
    const bad = problem(name) ? ["name", problem(name)] : problem(wish) ? ["wish", problem(wish)] : null;
    if (bad) return fail(MESSAGES[bad[1]], bad[0] === "name" ? nameEl : wishEl);
    if (waitLeft()) { showWait(); return fail(`ลอยได้ 1 ใบทุก 30 วินาที อีก ${Math.ceil(waitLeft() / 1000)} วินาทีนะ`, null); }

    errEl.textContent = "";
    sendBtn.setAttribute("aria-busy", "true"); sendBtn.disabled = true; sendLabel.textContent = "กำลังปล่อยกระทง…";
    let k = null;
    if (mode === "online") {
      try { k = await db.add({ name, wish, style }); }
      catch (err) {
        if (err.status === 403 || err.status === 400) {
          sendBtn.removeAttribute("aria-busy"); showWait();
          return fail("ระบบไม่รับข้อความนี้ ลองแก้ข้อความแล้วลอยอีกครั้ง", wishEl);
        }
        lastErr = Date.now();
        goLocal("error");
        status("ส่งกระทงขึ้นแม่น้ำรวมไม่สำเร็จ กระทงของคุณจึงลอยอยู่ในเครื่องนี้แทน (ระบบจะลองเชื่อมต่อใหม่เอง)");
      }
    }
    if (!k) {
      k = { id: "local-" + db.newId(), name, wish, style, at: Date.now(), local: true };
      store.set(KEY.local, store.get(KEY.local, []).concat(k).slice(-20));
    } else {
      mine.add(k.id);
      store.set(KEY.mine, [...mine].slice(-50));
    }
    k.mine = true;
    store.set(KEY.last, Date.now());
    sendBtn.removeAttribute("aria-busy");
    wishEl.value = ""; wishEl.dispatchEvent(new Event("input"));
    showWait();

    // ปล่อยลงน้ำทางซ้าย แล้วเลื่อนให้เห็นแม่น้ำ
    const riverEl = river.el, r = riverEl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) riverEl.scrollIntoView({ behavior: reduceQ.matches ? "auto" : "smooth", block: "center" });
    river.add(k, { launch: true, lane: 0.72, x: Math.max(60, river.w * 0.14) });
    setTotal(total + 1);
    if (mode === "online") status("กระทงของคุณลอยบนแม่น้ำของเราแล้ว ทุกคนเห็นได้เลย", 8000);
    else if (!statusEl.textContent) status("กระทงของคุณลอยอยู่ในเครื่องนี้แล้ว");
    window.dispatchEvent(new CustomEvent("lvc:krathong", { detail: { own: true } }));
  });

  /* ---------- เปิดตัว section ตอนเลื่อนถึง (GSAP + ScrollTrigger ตัวเดียวกับหน้าแรก) ---------- */
  if (gsap && ST && !reduceQ.matches) {
    const parts = sec.querySelectorAll(".loy__eyebrow, .loy__title, .loy__lead, .loy__rules, .loy__form, .loy__river-head");
    let shown = false;
    const reveal = () => { if (shown) return; shown = true; gsap.to(parts, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", clearProps: "opacity,visibility,transform" }); };
    gsap.set(parts, { autoAlpha: 0, y: 24 });
    // เปิดหน้ามาเลยจุดนี้แล้ว (ลิงก์ #loy / กลับมาหน้าเดิม) ก็แสดงทันที
    ST.create({ trigger: sec, start: "top 78%", once: true, onEnter: reveal, onRefresh: (self) => { if (self.progress > 0) reveal(); } });
  }
  // section ใหม่ดันเนื้อหาด้านล่างลง → ให้ ScrollTrigger คำนวณตำแหน่งใหม่
  if (ST) requestAnimationFrame(() => ST.refresh());

  // หมดเทศกาลระหว่างเปิดหน้า (theme.js) → เอา section ออก
  addEventListener("lvc:themechange", (e) => {
    if (e.detail && e.detail.loy === false && sec.isConnected) { river.visible = false; river.sync(); sec.remove(); if (ST) ST.refresh(); }
  });

  load();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
