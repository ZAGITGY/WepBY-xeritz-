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
import * as db from "./loy-db.js?v=2026-11-22.2";
import { tidy, problem, MESSAGES } from "./loy-filter.js?v=2026-11-20.1";
import { krathongSVG } from "./loy-art.js?v=2026-11-21.1";

const root = document.documentElement;
const L = window.__LVC || {};
const gsap = L.gsap || null;
const ST = L.ScrollTrigger || null;
const reduceQ = matchMedia("(prefers-reduced-motion: reduce)");
const MAX = 40, PAGE = 100, FEED_MAX = 600, RATE_MS = 30000, POLL_MS = 45000;   // FEED_MAX: ดึงไม่เกิน 6 หน้าต่อการเข้าชม (คุมโควตาอ่าน)
const KEY = { last: "lvc.loy.last", mine: "lvc.loy.mine", local: "lvc.loy.local", hidden: "lvc.loy.hidden" };
// ตัวเลือกแบบ 2D ตามไฟล์ร่าง (เลข = ฐานเดียวกับแบบ 3D: 0 ใบตอง · 1 ดอกบัว · 2 ขนมปัง)
const CHOICES = [[0, "ใบตอง", "พับกลีบซ้อนเป็นชั้น แบบดั้งเดิม"], [2, "ขนมปัง", "ปั้นเป็นกลีบดอกไม้"], [1, "ดอกบัว", "พับจากกลีบดอกบัว"]];
const baseOf = (k) => (k.base != null ? Math.min(2, Math.max(0, k.base | 0)) : [0, 1, 2, 0][k.style | 0] || 0);

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

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
  sec.className = "loy loy--2d";
  sec.setAttribute("aria-labelledby", "loy-title");
  sec.innerHTML = `
  <div class="wrap">
    <p class="loy__eyebrow"><i aria-hidden="true"></i>ลอยกระทงออนไลน์</p>
    <h2 id="loy-title" class="loy__title">เลือกกระทง แล้วฝากคำอธิษฐาน</h2>
    <p class="loy__lead">กระทงในเว็บไม่มีขยะลงแม่น้ำจริง ลอยได้ทั้งคืนโดยไม่ต้องห่วงสายน้ำ</p>
    <div class="loy__grid">
      <form class="loy__form" novalidate>
        <fieldset class="loy__pick">
          <legend>1. เลือกกระทง</legend>
          <div class="loy__styles">${CHOICES.map(([v, n, d], i) => `
            <label class="loy__style"><input type="radio" name="kt" value="${v}"${i ? "" : " checked"}>
              <span class="loy__style-art">${krathongSVG(v)}</span><b class="loy__style-name">${n}</b><small>${d}</small></label>`).join("")}
          </div>
        </fieldset>
        <div class="loy__field">
          <label for="loy-wish">2. คำอธิษฐาน <span class="loy__n" id="loy-wish-n">0/80</span></label>
          <textarea id="loy-wish" name="wish" rows="3" maxlength="80" required enterkeyhint="send" placeholder="เช่น ขอให้สอบผ่านทุกวิชาเทอมนี้" aria-describedby="loy-wish-hint loy-error"></textarea>
          <p class="loy__hint" id="loy-wish-hint">คนอื่นจะเห็นข้อความนี้ อย่าใส่เบอร์โทร ลิงก์ หรือข้อมูลส่วนตัว · ลอยได้ 1 ใบทุก 30 วินาที</p>
          <p class="loy__error" id="loy-error" role="alert"></p>
        </div>
        <div class="loy__field">
          <label for="loy-name">3. ชื่อที่จะแสดง <span class="loy__n"><span id="loy-name-n">0/20</span> · ไม่ใส่ก็ได้</span></label>
          <input id="loy-name" name="name" type="text" maxlength="20" autocomplete="nickname" enterkeyhint="next" placeholder="เช่น เบส ปวส.1">
        </div>
        <button class="loy__send" type="submit"><span class="loy__send-label">ปล่อยกระทงลงน้ำ</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M5 13l7 7 7-7"/></svg></button>
      </form>
      <div class="loy__preview" aria-hidden="true">
        <p class="loy__preview-wish"></p>
        <div class="loy__preview-water"></div>
        <div class="loy__preview-boat"><span class="loy-boat__glow"></span><span class="loy__preview-svg"></span></div>
      </div>
    </div>
    <div class="loy__head loy__river-head">
      <div>
        <p class="loy__eyebrow"><i aria-hidden="true"></i>แม่น้ำของเรา</p>
        <h3 class="loy__title loy__river-title" id="loy-river-title">กระทงที่ลอยอยู่ตอนนี้</h3>
        <p class="loy__lead" id="loy-river-help">แตะกระทงเพื่ออ่านคำอธิษฐาน ลากนิ้วบนผิวน้ำแล้วจะเห็นระลอกน้ำ<span class="loy__help-keys"> · กด Tab แล้วใช้ลูกศรซ้าย/ขวาเลื่อนไปใบอื่น</span></p>
      </div>
      <p class="loy__total" aria-live="polite" hidden><b>–</b> <span>ใบที่ลอยแล้ว</span></p>
      <p class="loy__status" role="status" hidden></p>
    </div>
  </div>
  <div class="loy__river" id="loy-river">
    <canvas class="loy__water" aria-hidden="true" data-pet-avoid="off"></canvas>
    <div class="loy__moon" aria-hidden="true"></div>
    <div class="loy__boats" role="group" aria-labelledby="loy-river-title" aria-describedby="loy-river-help"></div>
    <p class="loy__river-hint" aria-hidden="true">แตะกระทงเพื่ออ่าน</p>
    <div class="loy__card loy__card--moon" role="dialog" aria-modal="false" aria-labelledby="loy-card-name" hidden>
      <p class="loy__card-mine" hidden>กระทงของคุณ</p>
      <p class="loy__card-wish"></p>
      <p class="loy__card-name" id="loy-card-name"></p>
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
    this.ctx = this.canvas.getContext("2d");
    this.card = el.querySelector(".loy__card");
    this.boats = new Map();
    this.w = 0; this.h = 0; this.dpr = 1;
    this.active = false; this.lastDraw = 0; this.t = 0;
    this.open = null;
    // ตามไฟล์ร่าง: เส้นแสงพลิ้วทั้งผิวน้ำ + ระลอกจากการแตะ/ลากนิ้ว
    this.streaks = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), l: 20 + Math.random() * 90, p: Math.random() * 6 }));
    this.rip = [];
    this.tick = this.tick.bind(this);
    this.resize();
    new ResizeObserver(() => { this.resize(); this.draw(); }).observe(el);
    // นอกจอ / สลับแท็บ = หยุดวาดและหยุดกระทง
    new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this.sync(); }, { rootMargin: "60px 0px" }).observe(el);
    document.addEventListener("visibilitychange", () => this.sync());
    reduceQ.addEventListener && reduceQ.addEventListener("change", () => { this.layout(); this.sync(); this.draw(); });
    this.bindCard();
    this.bindKeys();
    let last = 0;
    el.addEventListener("pointermove", (e) => {
      const now = performance.now();
      if (now - last < 90 || this.still) return;
      last = now;
      const r = el.getBoundingClientRect();
      this.ripple(e.clientX - r.left, e.clientY - r.top, 0.5);
    });
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".loy-boat, .loy__card") || this.still) return;
      const r = el.getBoundingClientRect();
      this.ripple(e.clientX - r.left, e.clientY - r.top, 1);
    });
  }
  ripple(x, y, k) { this.rip.push({ x, y, r: 4, a: 0.55 * k, k }); if (this.rip.length > 24) this.rip.shift(); }
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
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.layout();
  }
  // ช่องลอย (ตามไฟล์ร่าง): บนสุด = ไกล (เล็ก ช้า) · ล่าง = ใกล้ · b.y = ระดับน้ำใต้กระทง
  lane(b) {
    b.depth = b.lane;
    b.scale = 0.55 + b.lane * 0.6;
    b.y = 30 + 64 * b.scale + b.lane * Math.max(60, this.h - 150);
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
    const bob = this.still ? 0 : Math.sin(this.t * 1.3 + b.p) * 3, rot = this.still ? 0 : Math.sin(this.t * 0.9 + b.p) * 3;
    b.el.style.transform = `translate3d(${(b.x - 48).toFixed(1)}px,${(b.y - 72 + bob).toFixed(1)}px,0) scale(${b.scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
  }
  add(k, opts = {}) {
    if (this.boats.has(k.id)) return this.boats.get(k.id);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "loy-boat" + (k.mine ? " is-mine" : "") + (k.decor ? " is-decor" : "");
    el.tabIndex = -1;
    if (k.decor) { el.setAttribute("aria-hidden", "true"); el.disabled = true; }
    else el.setAttribute("aria-label", `กระทง${k.mine ? "ของคุณ" : ""} ${k.name || "ไม่ระบุชื่อ"}: ${k.wish}`);
    el.innerHTML = `<span class="loy-boat__body"><span class="loy-boat__glow"></span>${krathongSVG(baseOf(k))}</span>${k.mine ? '<span class="loy-boat__tag">กระทงของคุณ</span>' : ""}`;
    const b = { k, el, body: el.firstChild, lane: opts.lane != null ? opts.lane : Math.random(), x: opts.x != null ? opts.x : Math.random() * this.w,
      dir: 1, f: 1.1 + Math.random() * 0.8, p: Math.random() * 6.28, held: false };
    this.lane(b);
    if (this.still && opts.x == null) b.x = ((this.boats.size * 0.618 + 0.08) % 1) * (this.w - 60) + 30;
    el.addEventListener("click", () => this.show(b));
    el.addEventListener("focus", () => { b.held = true; this.roving(b); });
    el.addEventListener("blur", () => { if (this.open !== b) b.held = false; });
    this.boats.set(k.id, b);
    this.layer.appendChild(el);
    this.place(b);
    if (!this.layer.querySelector('.loy-boat[tabindex="0"]')) this.roving(b);
    if (opts.launch && gsap && !this.still) {
      gsap.fromTo(b.body, { y: -90, scale: 0.5, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 1, ease: "back.out(1.5)", clearProps: "transform,opacity,visibility" });
      this.ripple(b.x, b.y, 1.4); this.ripple(b.x, b.y, 0.9);
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
  // ไม่เกิน MAX ใบ (จอแคบลดตามความกว้าง ~1 ใบต่อ 36px: มือถือ ~12 ใบ): เอาใบเก่าสุดที่ไม่ใช่ของเราออก
  trim() {
    const max = Math.max(12, Math.min(MAX, Math.round(this.w / 36)));
    if (this.boats.size <= max) return;
    const list = [...this.boats.values()].filter((b) => !b.k.mine && b !== this.open).sort((a, b) => (a.k.at || 0) - (b.k.at || 0));
    while (this.boats.size > max && list.length) this.remove(list.shift().k.id, true);
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
    if (time - this.lastDraw >= 1 / 30) { this.draw(Math.min(0.1, time - this.lastDraw)); this.lastDraw = time; }
  }

  /* ผิวน้ำ (ตามไฟล์ร่าง): เส้นแสงพลิ้ว + เงาจันทร์ทอดลงน้ำ + ระลอกน้ำ · แสงเทียนใต้กระทงเป็น CSS (.loy-boat__glow) */
  draw(dt = 0) {
    const c = this.ctx, w = this.w, h = this.h, t = this.still ? 0 : this.t;
    if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    for (const s of this.streaks) {
      const a = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.p));
      c.fillStyle = `rgba(170,195,235,${a.toFixed(3)})`;
      c.fillRect(((s.x + t * 0.004 * (0.5 + s.y)) % 1) * w, s.y * h, s.l * (0.4 + s.y), 1);
    }
    const mx = w * 0.5;
    for (let y = 2; y < h; y += 4) {
      const f = y / h, wob = Math.sin(t * 1.6 + y * 0.09) * (6 + f * 18), len = (26 + f * 150) * (0.55 + 0.45 * Math.sin(t * 2.1 + y * 0.21));
      c.fillStyle = `rgba(244,234,210,${(0.42 * (1 - f * 0.7)).toFixed(3)})`;
      c.fillRect(mx - len / 2 + wob, y, len, 2);
    }
    for (let i = this.rip.length - 1; i >= 0; i--) {
      const r = this.rip[i];
      r.r += (40 + 50 * r.k) * dt; r.a -= 0.45 * dt;
      if (r.a <= 0) { this.rip.splice(i, 1); continue; }
      c.strokeStyle = `rgba(244,234,210,${r.a.toFixed(3)})`; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2); c.stroke();
      if (r.r > 18) { c.beginPath(); c.ellipse(r.x, r.y, r.r * 0.6, r.r * 0.19, 0, 0, Math.PI * 2); c.stroke(); }
    }
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
    card.querySelector(".loy__card-name").textContent = "— " + (k.name || "ไม่ระบุชื่อ");
    card.querySelector(".loy__card-wish").textContent = k.wish;
    card.querySelector(".loy__card-time").textContent = ago(k.at);
    card.querySelector('[data-act="report"]').hidden = !!(k.mine || k.local);
    this.resetCard();
    card.hidden = false;
    // วางเหนือกระทง ไม่ล้นขอบแม่น้ำ
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const x = Math.min(Math.max(12, b.x - cw / 2), this.w - cw - 12);
    let y = b.y - 72 * b.scale - ch - 12;
    if (y < 8) y = Math.min(this.h - ch - 8, b.y + 14);
    card.style.left = x.toFixed(0) + "px";
    card.style.top = Math.max(8, y).toFixed(0) + "px";
    card.style.setProperty("--ax", Math.max(-cw / 2 + 20, Math.min(cw / 2 - 20, b.x - x - cw / 2)).toFixed(0) + "px");
    this.ripple(b.x, b.y, 0.8);
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
 *  หน้าแรกช่วงเทศกาล (ตามไฟล์ร่าง): หัวข้อ/ปุ่ม/นับถอยหลังใน hero + section "ถ้าจะไปลอยที่ท่าน้ำ"
 *  แก้ข้อความในองค์ประกอบเดิมของ app.js (ไม่สร้างใหม่) แอนิเมชันเปิดตัวและการเลื่อนเดิมจึงทำงานเหมือนเดิม
 * ====================================================================== */
const NIGHT_START = Date.parse("2026-11-24T18:00:00+07:00"), NIGHT_END = Date.parse("2026-11-25T06:00:00+07:00");
function countdownText() {
  const now = Date.now(), ms = NIGHT_START - now;
  if (ms > 0) {
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return `อีก ${d} วัน ${h} ชั่วโมง ${m} นาที ถึงคืนลอยกระทง`;
  }
  return now < NIGHT_END ? "คืนนี้คืนลอยกระทง ลอยได้เลย" : "ปีนี้ลอยกันไปแล้ว พบกันปีหน้า";
}
function festivalHero() {
  const op = document.querySelector(".scene-opening");
  if (!op) return () => {};
  const $ = (s) => op.querySelector(s);
  const eyebrow = $(".eyebrow"), spans = op.querySelectorAll("h1 > span"), lead = $(":scope > p:not(.hero-note)");
  const cta = $(".hero-actions a"), ctaLabel = cta && (cta.querySelector(".lvc-metal__label") || cta), note = $(".hero-note");
  const undo = [];
  const set = (el, prop, value) => { if (!el) return; undo.push([el, prop, el[prop]]); el[prop] = value; };
  set(eyebrow, "textContent", "ลอยกระทง 2569 · คืนวันเพ็ญเดือนสิบสอง");
  if (spans.length >= 2) {
    set(spans[0], "textContent", "ลอยความตั้งใจ");
    set(spans[1], "textContent", "ไปกับสายน้ำ");
    set(spans[1], "className", "accent");
    // style.display ไม่ใช่ hidden: CSS ของ hero ตั้ง display:block ให้ทุกบรรทัด
    for (let i = 2; i < spans.length; i++) { undo.push([spans[i].style, "display", spans[i].style.display]); spans[i].style.display = "none"; set(spans[i], "className", spans[i].className.replace(/\baccent\b/, "").trim()); }
  }
  set(lead, "textContent", "เลือกกระทง เขียนคำอธิษฐาน แล้วปล่อยลงแม่น้ำของวิทยาลัยอาชีวศึกษาเลย ทุกคนที่เข้าเว็บจะเห็นกระทงของคุณลอยอยู่ด้วยกัน");
  if (cta) { undo.push([cta, "href", cta.getAttribute("href")]); cta.setAttribute("href", "#loy"); }
  set(ctaLabel, "textContent", "ลอยกระทงของคุณ ");
  let timer = 0;
  if (note) {
    const mark = note.querySelector(".note-mark");
    const text = document.createElement("span");
    text.className = "loy-countdown";
    undo.push([note, "innerHTML", note.innerHTML]);
    note.textContent = "";
    if (mark) note.append(mark);
    note.append(text);
    note.classList.add("is-loy");
    const tick = () => { text.textContent = countdownText(); };
    tick(); timer = setInterval(tick, 30000);
  }
  return () => { clearInterval(timer); if (note) note.classList.remove("is-loy"); for (const [el, prop, v] of undo.reverse()) { if (prop === "href") el.setAttribute("href", v); else el[prop] = v; } };
}
const ECO = [
  ['<path d="M12 21c-4-3-7-7-7-11a7 7 0 0 1 14 0c0 4-3 8-7 11Z"/><path d="M12 21V9"/>', "ใช้วัสดุธรรมชาติ", "ใบตอง กาบกล้วย ดอกไม้สด ย่อยสลายได้เองในน้ำ"],
  ['<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>', "ไม่ใช้โฟมและลวด", "ยึดกลีบด้วยไม้กลัดแทนเข็มหมุดหรือลวดเย็บ"],
  ['<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/>', "ครอบครัวเดียว กระทงเดียว", "ลอยร่วมกันหนึ่งใบ ขยะในแม่น้ำก็น้อยลง"],
];
function ecoSection() {
  const sec = document.createElement("section");
  sec.className = "loy-eco";
  sec.setAttribute("aria-labelledby", "loy-eco-title");
  sec.innerHTML = `<div class="wrap">
    <p class="loy__eyebrow"><i aria-hidden="true"></i>ลอยจริงก็ดูแลน้ำได้</p>
    <h2 id="loy-eco-title" class="loy-eco__title">ถ้าจะไปลอยที่ท่าน้ำ</h2>
    <ul class="loy-eco__list">${ECO.map(([icon, h, p]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><h3>${h}</h3><p>${p}</p></li>`).join("")}</ul>
  </div>`;
  return sec;
}

/* ======================================================================
 *  ข้อมูล: ออนไลน์ (Firestore) / ในเครื่อง — ใช้ร่วมกันทั้งแม่น้ำ 3D และแม่น้ำ 2D
 *  เหตุการณ์: add {k, how: load|arrive|own} · remove {id} · total n · mode · status {text, ms} · decor / undecor
 * ====================================================================== */
function createData() {
  const T = new EventTarget(), emit = (t, d) => T.dispatchEvent(new CustomEvent(t, { detail: d }));
  const mine = new Set(store.get(KEY.mine, [])), hidden = new Set(store.get(KEY.hidden, []));
  const list = new Map();
  let mode = "loading", total = 0, lastErr = 0, newest = 0, oldest = Infinity, exhausted = false;   // newest/oldest = เวลาเซิร์ฟเวอร์ของใบใหม่สุด/เก่าสุดที่โหลดแล้ว
  const D = {
    get mode() { return mode; }, get total() { return total; }, list, mine,
    on(type, fn) { T.addEventListener(type, (e) => fn(e.detail)); },
    status(text, ms) { emit("status", { text, ms }); },
  };
  const tag = (k) => Object.assign(k, { mine: !!k.mine || mine.has(k.id) });
  function put(k, how) {
    if (!k.local && k.at > newest) newest = k.at;
    if (!k.local && k.at < oldest) oldest = k.at;
    if (hidden.has(k.id) || list.has(k.id)) return;
    list.set(k.id, tag(k));
    emit("add", { k, how });
  }
  function setTotal(n) { total = Math.max(0, n); emit("total", total); }

  function goLocal(why) {
    const was = mode;
    mode = "local"; emit("mode", mode);
    // ข้อความสั้นพอให้อยู่บรรทัดเดียวใต้ปุ่มบนแม่น้ำ (จอ 360px)
    D.status(why === "config"
      ? "แม่น้ำรวมยังไม่เปิด ตอนนี้กระทงลอยในเครื่องนี้ก่อน"
      : "เชื่อมต่อแม่น้ำรวมไม่ได้ กระทงลอยในเครื่องนี้ก่อน");
    if (was === "online") return;
    const local = store.get(KEY.local, []);
    for (const k of local) put(Object.assign(k, { local: true, mine: true }), "load");
    // ไม่เติมกระทงประดับ: แม่น้ำแสดงเฉพาะกระทงที่ลอยจริง
    setTotal(local.length);
  }
  D.load = async () => {
    if (!db.configured) { goLocal("config"); return; }
    try {
      // หน้าแรก 100 ใบล่าสุด · ฉาก 3D ขอหน้าถัดไปเองเมื่อแสดงครบรอบ (D.more) · แม่น้ำ 2D ใช้ไม่เกิน 40 ใบ
      const [late, n] = await Promise.all([db.latest(PAGE), db.count()]);
      if (mode === "local") emit("undecor");          // กระทงในเครื่องยังลอยอยู่ต่อ
      mode = "online"; emit("mode", mode);
      D.status("");
      exhausted = late.length < PAGE;
      for (const k of late) put(k, "load");
      setTotal(n);
    } catch (e) {
      if (window.console) console.warn("[loy] ใช้แม่น้ำในเครื่องแทน:", e.code || "", e.message);
      lastErr = Date.now();
      if (mode !== "local") goLocal("error");
    }
  };
  // ทุก 45 วิ เฉพาะตอนเห็นแม่น้ำ: ใบใหม่ของคนอื่น + ตัวเลขรวม · โหมดในเครื่อง = ลองเชื่อมต่อใหม่
  D.poll = async (visible) => {
    if (!visible || document.hidden || !db.configured) return;
    if (mode === "local") { if (Date.now() - lastErr > 50000) D.load(); return; }
    try {
      const [late, n] = await Promise.all([newest ? db.since(newest, 8) : db.latest(8), db.count()]);
      const fresh = late.filter((k) => !list.has(k.id) && !hidden.has(k.id) && !mine.has(k.id));
      for (const k of fresh.reverse()) put(k, "arrive");
      for (const k of late) if (k.at > newest) newest = k.at;
      if (fresh.length) window.dispatchEvent(new CustomEvent("lvc:krathong", { detail: { own: false, n: fresh.length } }));
      if (n !== total) setTotal(n);
    } catch (e) { /* ครั้งหน้าลองใหม่ */ }
  };
  /** หน้าถัดไป (เก่ากว่าที่โหลดแล้ว) → คืนจำนวนใบที่ได้เพิ่ม */
  D.more = async () => {
    if (mode !== "online" || exhausted || !isFinite(oldest)) return 0;
    try {
      const got = await db.page(oldest, PAGE);
      if (got.length < PAGE) exhausted = true;
      let n = 0;
      for (const k of got) if (!list.has(k.id) && !hidden.has(k.id)) { put(k, "page"); n++; }
      if (list.size >= FEED_MAX) exhausted = true;     // พอแล้ว: ฉากวนใช้ชุดเดิม (ใบใหม่ยังเข้ามาทาง poll)
      return n;
    } catch (e) { return 0; }
  };
  /* ---------- แจ้งซ่อน: ซ่อนในเครื่องทันที + ส่งให้ผู้ดูแลตรวจ ---------- */
  D.report = async (id) => {
    hidden.add(id);
    store.set(KEY.hidden, [...hidden].slice(-300));
    list.delete(id);
    emit("remove", { id });
    let ok = mode === "online";
    if (ok) { try { await db.report(id); } catch (e) { ok = false; } }
    D.status(ok ? "ซ่อนกระทงใบนั้นแล้ว และแจ้งผู้ดูแลแล้ว" : "ซ่อนกระทงใบนั้นในเครื่องนี้แล้ว", 6000);
  };
  /* ---------- ตรวจข้อความ / จำกัดเวลา ---------- */
  D.waitLeft = () => Math.max(0, RATE_MS - (Date.now() - (store.get(KEY.last, 0) || 0)));
  D.check = (nameRaw, wishRaw) => {
    const name = tidy(nameRaw), wish = tidy(wishRaw);
    if (!wish) return { field: "wish", msg: "เขียนคำอธิษฐานก่อนนะ" };
    if (wish.length > 80) return { field: "wish", msg: "คำอธิษฐานยาวเกิน 80 ตัวอักษร" };
    if (name.length > 20) return { field: "name", msg: "ชื่อยาวเกิน 20 ตัวอักษร" };
    if (problem(name)) return { field: "name", msg: MESSAGES[problem(name)] };
    if (problem(wish)) return { field: "wish", msg: MESSAGES[problem(wish)] };
    if (D.waitLeft()) return { field: null, msg: `ลอยได้ 1 ใบทุก 30 วินาที อีก ${Math.ceil(D.waitLeft() / 1000)} วินาทีนะ` };
    return null;
  };
  /** ลอยกระทง → คืน { k } หรือ { error } (ข้อความที่ระบบไม่รับ) · Firebase ล่ม = ลอยในเครื่องแทน */
  D.add = async ({ name, wish, base = 0, parts = [] }) => {
    name = tidy(name); wish = tidy(wish);
    let k = null;
    if (mode === "online") {
      try { k = await db.add({ name, wish, base, parts }); }
      catch (err) {
        if (err.status === 403 || err.status === 400) return { error: "ระบบไม่รับข้อความนี้ ลองแก้ข้อความแล้วลอยอีกครั้ง" };
        lastErr = Date.now();
        goLocal("error");
        D.status("ส่งขึ้นแม่น้ำรวมไม่สำเร็จ กระทงลอยในเครื่องนี้แทน");
      }
    }
    if (!k) {
      k = { id: "local-" + db.newId(), name, wish, base, parts, at: Date.now(), local: true };
      store.set(KEY.local, store.get(KEY.local, []).concat(k).slice(-20));
    } else {
      mine.add(k.id);
      store.set(KEY.mine, [...mine].slice(-50));
    }
    k.mine = true;
    store.set(KEY.last, Date.now());
    list.set(k.id, k);
    setTotal(total + 1);
    if (mode === "online") D.status("กระทงของคุณลอยบนแม่น้ำรวมแล้ว ทุกคนเห็นได้", 8000);
    emit("add", { k, how: "own" });
    window.dispatchEvent(new CustomEvent("lvc:krathong", { detail: { own: true } }));
    return { k };
  };
  return D;
}

/* ======================================================================
 *  แม่น้ำ 2D + ฟอร์ม (ใช้เมื่อไม่มี WebGL2 หรือเปิด Reduced Motion)
 * ====================================================================== */
function mount2D(sec, data) {
  const $ = (s) => sec.querySelector(s);
  const form = $(".loy__form"), nameEl = $("#loy-name"), wishEl = $("#loy-wish"), errEl = $("#loy-error");
  const sendBtn = $(".loy__send"), sendLabel = $(".loy__send-label"), statusEl = $(".loy__status"), totalEl = $(".loy__total b");
  const river = new River($(".loy__river"));
  bindStatus(statusEl, data);
  bindTotal(totalEl, $(".loy__total span"), data);
  data.on("add", ({ k, how }) => {
    if (how === "page") return;                     // แม่น้ำ 2D ไม่โหลดหน้าเพิ่ม
    if (how === "own") {
      const r = river.el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) river.el.scrollIntoView({ behavior: reduceQ.matches ? "auto" : "smooth", block: "center" });
      river.add(k, { launch: true, lane: 0.72, x: Math.max(60, river.w * 0.14) });
    } else if (how === "arrive") river.add(k, { arrive: true, x: -40, lane: Math.random() });
    else river.add(k, { arrive: data.mode === "online" && river.boats.size > 0 });
  });
  data.on("remove", ({ id }) => {
    river.remove(id, true);
    const first = [...river.boats.values()].find((x) => !x.k.decor);
    if (first && sec.contains(document.activeElement)) first.el.focus({ preventScroll: true });
  });
  data.on("decor", () => { for (let i = 0; i < 7; i++) river.add({ id: "decor" + i, decor: true, base: i % 3 }, { lane: (i * 0.37) % 1, x: ((i * 0.29 + 0.05) % 1) * river.w }); });
  data.on("undecor", () => { for (const id of [...river.boats.keys()]) if (/^decor/.test(id)) river.remove(id); });
  river.onReport = (b) => data.report(b.k.id);
  setInterval(() => data.poll(river.visible), POLL_MS);

  const counter = (el, out, max) => { const f = () => { out.textContent = `${el.value.length}/${max}`; }; el.addEventListener("input", f); f(); };
  counter(nameEl, $("#loy-name-n"), 20);
  counter(wishEl, $("#loy-wish-n"), 80);

  // ตัวอย่างกระทง (ตามไฟล์ร่าง): คำอธิษฐาน + กระทงที่เลือก ลอยขึ้นลงช้า ๆ
  const pvWish = $(".loy__preview-wish"), pvBoat = $(".loy__preview-boat"), pvSvg = $(".loy__preview-svg");
  const still = () => reduceQ.matches || !gsap;
  const curBase = () => Number(form.elements.kt.value) | 0;   // ชื่อ "kt" ไม่ใช่ "style" (form.style จะกลายเป็นปุ่มเลือกแทน CSS)
  function preview(swap) {
    const t = tidy(wishEl.value), n = tidy(nameEl.value);
    pvWish.textContent = "";
    if (t) {
      pvWish.append(t);
      const sm = document.createElement("small"); sm.textContent = "— " + (n || "ไม่ระบุชื่อ"); pvWish.append(sm);
    } else pvWish.innerHTML = '<span class="loy__ph">คำอธิษฐานของคุณจะขึ้นตรงนี้</span>';
    if (swap) {
      pvSvg.innerHTML = krathongSVG(curBase());
      if (!still()) gsap.fromTo(pvBoat, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "back.out(1.6)" });
    }
  }
  form.addEventListener("change", (e) => { if (e.target.name === "kt") preview(true); });
  wishEl.addEventListener("input", () => preview(false));
  nameEl.addEventListener("input", () => preview(false));
  preview(true);
  if (!still()) gsap.to(pvSvg, { y: -6, rotation: 1.5, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
  function fail(msg, field) {
    errEl.textContent = msg;
    [nameEl, wishEl].forEach((el) => el.toggleAttribute("aria-invalid", el === field));
    if (field) field.focus();
  }
  [nameEl, wishEl].forEach((el) => el.addEventListener("input", () => { if (errEl.textContent) { errEl.textContent = ""; el.removeAttribute("aria-invalid"); } }));
  wishEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : sendBtn.click(); } });
  const showWait = waitButton(sendBtn, sendLabel, "ปล่อยกระทงลงน้ำ", data);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sendBtn.getAttribute("aria-busy") === "true") return;
    const bad = data.check(nameEl.value, wishEl.value);
    if (bad) { if (!bad.field) showWait(); return fail(bad.msg, bad.field === "name" ? nameEl : bad.field === "wish" ? wishEl : null); }
    errEl.textContent = "";
    sendBtn.setAttribute("aria-busy", "true"); sendBtn.disabled = true; sendLabel.textContent = "กำลังปล่อยกระทง…";
    // กระทงตัวอย่างยกขึ้นแล้วจุ่มลงน้ำ (พร้อมกับการบันทึก) แล้วไปโผล่ในแม่น้ำ
    if (!still()) gsap.timeline().to(pvBoat, { y: -22, scale: 1.06, duration: 0.35, ease: "power2.out" }).to(pvBoat, { y: 60, autoAlpha: 0, duration: 0.45, ease: "power2.in" })
      .set(pvBoat, { y: 0, scale: 1 }).to(pvBoat, { autoAlpha: 1, duration: 0.5, delay: 0.6 });
    const res = await data.add({ name: nameEl.value, wish: wishEl.value, base: curBase() });
    sendBtn.removeAttribute("aria-busy");
    showWait();
    if (res.error) {
      if (!still()) { gsap.killTweensOf(pvBoat); gsap.set(pvBoat, { autoAlpha: 1, y: 0, scale: 1 }); }
      return fail(res.error, wishEl);
    }
    wishEl.value = ""; wishEl.dispatchEvent(new Event("input"));
    if (data.mode !== "online" && statusEl.hidden) data.status("กระทงของคุณลอยอยู่ในเครื่องนี้แล้ว");
  });
  return { visible: () => river.visible };
}

/* ---------- ส่วนที่ใช้ร่วมกันทั้ง 2D/3D ---------- */
function bindStatus(el, data) {
  data.on("status", ({ text, ms }) => {
    el.textContent = text || ""; el.hidden = !text;
    if (ms) setTimeout(() => { if (el.textContent === text && data.mode === "online") { el.textContent = ""; el.hidden = true; } }, ms);
  });
}
function bindTotal(numEl, labelEl, data) {
  const shown = { n: 0 }, box = numEl.closest(".loy__total");
  data.on("total", (n) => {
    box.hidden = !n;                                 // ยังไม่มีกระทง → ไม่โชว์เลข 0
    if (gsap && !reduceQ.matches) gsap.to(shown, { n, duration: 1.2, ease: "power2.out", overwrite: true, onUpdate: () => { numEl.textContent = fmt(Math.round(shown.n)); } });
    else numEl.textContent = fmt(n);
    labelEl.textContent = data.mode === "online" ? "ใบที่ลอยแล้ว" : "ใบในเครื่องนี้";
  });
}
// ปุ่มลอยกระทง: นับถอยหลังระหว่างรอ 30 วินาที
function waitButton(btn, label, text, data) {
  let t = 0;
  const show = () => {
    clearTimeout(t);
    const left = data.waitLeft();
    if (!left) { btn.disabled = false; label.textContent = text; return; }
    btn.disabled = true;
    label.textContent = `ลอยใบต่อไปได้ใน ${Math.ceil(left / 1000)} วินาที`;
    t = setTimeout(show, 1000 - (left % 1000) + 20);
  };
  show();
  return show;
}
export const shared = { bindStatus, bindTotal, waitButton, ago, fmt, reduceQ, POLL_MS };

/* ======================================================================
 *  แม่น้ำ 3D (loy3d-ui.js โหลดเมื่อเลื่อนใกล้ section เท่านั้น)
 * ====================================================================== */
function webgl2() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
}
function build3D() {
  const sec = document.createElement("section");
  sec.id = "loy";
  sec.className = "loy loy--3d";
  sec.setAttribute("aria-labelledby", "loy-title");
  sec.innerHTML = `
  <div class="wrap loy__head">
    <div>
      <p class="loy__eyebrow"><i aria-hidden="true"></i>ลอยกระทงออนไลน์ · แม่น้ำของเรา</p>
      <h2 id="loy-title" class="loy__title">เลือกกระทง แล้วฝากคำอธิษฐาน</h2>
      <p class="loy__lead">กระทงในเว็บไม่มีขยะลงแม่น้ำจริง ลอยได้ทั้งคืนโดยไม่ต้องห่วงสายน้ำ</p>
    </div>
    <p class="loy__total" aria-live="polite" hidden><b>–</b> <span>ใบที่ลอยแล้ว</span></p>
  </div>
  <div class="loy3d" id="loy-river" role="region" aria-label="แม่น้ำของเรา: กระทงที่ลอยอยู่ตอนนี้">
    <div class="loy3d__poster" aria-hidden="true"></div>
    <canvas class="loy3d__gl" aria-hidden="true" data-pet-avoid="off"></canvas>
    <div class="loy3d__boats" role="group" aria-label="กระทงในแม่น้ำ" aria-describedby="loy-river-help"></div>
    <div class="loy3d__cta">
      <p class="loy__help" id="loy-river-help">แตะกระทงเพื่ออ่านคำอธิษฐาน · แตะผิวน้ำแล้วจะเห็นระลอกน้ำ<span class="loy__help-keys"> · กด Tab แล้วใช้ลูกศรซ้าย/ขวาเลือกกระทง</span></p>
      <button class="loy__send loy3d__start" type="button" disabled><span class="loy__send-label">กำลังเตรียมแม่น้ำ…</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
      <p class="loy__status loy3d__note" role="status" hidden></p>
    </div>
    <div class="loy3d__panel" hidden></div>
    <div class="loy__card loy__card--moon" role="dialog" aria-modal="false" aria-labelledby="loy-card-name" hidden>
      <p class="loy__card-mine" hidden>กระทงของคุณ</p>
      <p class="loy__card-wish"></p>
      <p class="loy__card-name" id="loy-card-name"></p>
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
function mount3D(sec, data, fallback) {
  const stage = sec.querySelector(".loy3d");
  let ui = null, started = false;
  bindStatus(sec.querySelector(".loy__status"), data);
  bindTotal(sec.querySelector(".loy__total b"), sec.querySelector(".loy__total span"), data);
  // ระหว่างรอโหลดฉาก เก็บเหตุการณ์ไว้ก่อน
  const queue = [];
  for (const t of ["add", "remove", "decor", "undecor"]) data.on(t, (d) => { if (ui) ui.event(t, d); else queue.push([t, d]); });
  const start = () => {
    if (started) return;
    started = true;
    import("./loy3d-ui.js?v=2026-11-22.3").then((m) => {
      ui = m.mount(stage, data, shared);
      if (!ui) throw new Error("WebGL");
      for (const [t, d] of queue.splice(0)) ui.event(t, d);
      ui.onLost = () => fallback();
    }).catch((e) => { if (window.console) console.warn("[loy] ใช้แม่น้ำ 2D แทน:", e.message); fallback(); });
  };
  // โหลดฉาก 3D เมื่อเลื่อนเข้าใกล้ (ไม่แย่งโหลดกับหน้าแรก)
  new IntersectionObserver((en, io) => { if (en[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "900px 0px" }).observe(stage);
  setInterval(() => data.poll(!!(ui && ui.visible())), POLL_MS);
  return { dispose: () => ui && ui.dispose() };
}

function init() {
  if (!root.hasAttribute("data-loy") || document.getElementById("loy")) return;
  const main = document.querySelector("main");
  if (!main) return;
  const restoreHero = festivalHero();
  const data = createData();
  // 3D เมื่อมี WebGL2 และไม่ได้เปิด Reduced Motion · ?loy2d บังคับแบบ 2D (ใช้ทดสอบ)
  const use3D = webgl2() && !reduceQ.matches && !/[?&]loy2d(=|&|$)/.test(location.search);
  let sec = use3D ? build3D() : build();
  // ต่อจากฉาก 8 กลุ่มสาขา ก่อน "บริการที่ใช้บ่อย" (ไม่แทรกก่อนฉากที่ตรึงไว้ ตำแหน่งฉากเดิมจึงไม่เปลี่ยน)
  const services = main.querySelector(":scope > #services");
  if (services) services.before(sec); else main.append(sec);
  const eco = ecoSection();
  sec.after(eco);
  // ฉาก 3D ใช้ไม่ได้ (โหลดไม่สำเร็จ / WebGL หลุด) → สลับเป็นแบบ 2D ที่จุดเดิม พร้อมกระทงชุดเดิม
  const to2D = () => {
    if (!sec.classList.contains("loy--3d") || !sec.isConnected) return;
    const flat = build();
    sec.replaceWith(flat);
    sec = flat;
    mount2D(sec, data);
    data.list.clear();
    data.load();
    if (ST) ST.refresh();
  };
  if (use3D) mount3D(sec, data, to2D); else mount2D(sec, data);

  /* ---------- เปิดตัว section ตอนเลื่อนถึง (GSAP + ScrollTrigger ตัวเดียวกับหน้าแรก) ---------- */
  if (gsap && ST && !reduceQ.matches) {
    const parts = sec.querySelectorAll(".loy__head > *, .loy__eyebrow:not(.loy3d .loy__eyebrow), .loy__title, .loy__lead, .loy__form, .loy__preview");
    gsap.set(eco.querySelectorAll(".loy__eyebrow, .loy-eco__title, li"), { autoAlpha: 0, y: 24 });
    ST.batch(eco.querySelectorAll(".loy__eyebrow, .loy-eco__title, li"), { start: "top 88%", once: true,
      onEnter: (b) => gsap.to(b, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", overwrite: true, clearProps: "opacity,visibility,transform" }) });
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
    if (e.detail && e.detail.loy === false && sec.isConnected) { sec.remove(); eco.remove(); restoreHero(); if (ST) ST.refresh(); }
  });

  data.load();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
