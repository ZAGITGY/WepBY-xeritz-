/* ============================================================================
 * loy3d-ui.js — ปุ่ม/แผงควบคุมของแม่น้ำ 3D (โหลดพร้อม loy3d.js ตอนเลื่อนใกล้ section)
 *   แม่น้ำ: ปุ่ม "แต่งกระทงของคุณ" · การ์ดคำอธิษฐาน + แจ้งซ่อน
 *   แผงแต่งกระทง 3 ขั้น: 1 เลือกฐาน → 2 แต่ง (วางของ/สี/ขนาด/หมุน/ลบ/ย้อนกลับ/หมุนดู) → 3 ลอย
 *   ทุกอย่างทำได้ด้วยคีย์บอร์ด: ปุ่มของแต่งกด Enter = วางลงช่องว่างบนกระทงทันที · ปุ่มเลือกชิ้นก่อน/ถัดไป · ปุ่มหมุนดู
 * ============================================================================ */
import { createRiver3D } from "./loy3d.js?v=2026-11-22.1";
import * as M from "./loy-models.js?v=2026-11-22.1";

const L = window.__LVC || {};
const gsap = L.gsap || null;

export function mount(stage, data, S) {
  const $ = (s, el = stage) => el.querySelector(s);
  const startBtn = $(".loy3d__start"), startLabel = $(".loy3d__start .loy__send-label");
  const panel = $(".loy3d__panel"), poster = $(".loy3d__poster");
  let step = 1;

  /* ---------- การ์ดคำอธิษฐาน ---------- */
  function fillCard(el, k) {
    el.querySelector(".loy__card-mine").hidden = !k.mine;
    el.querySelector(".loy__card-wish").textContent = k.wish;
    el.querySelector(".loy__card-name").textContent = "— " + (k.name || "ไม่ระบุชื่อ");
    el.querySelector(".loy__card-time").textContent = S.ago(k.at);
    el.querySelector('[data-act="report"]').hidden = !!(k.mine || k.local);
    el.querySelector(".loy__card-confirm").hidden = true;
    el.querySelector(".loy__card-main").hidden = false;
  }
  function bindCard(el, getBoat, close) {
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const b = getBoat();
      if (act.dataset.act === "close") close(true);
      else if (act.dataset.act === "report") { el.querySelector(".loy__card-confirm").hidden = false; el.querySelector(".loy__card-main").hidden = true; el.querySelector('[data-act="report-yes"]').focus(); }
      else if (act.dataset.act === "report-no") { el.querySelector(".loy__card-confirm").hidden = true; el.querySelector(".loy__card-main").hidden = false; el.querySelector('[data-act="report"]').focus(); }
      else if (act.dataset.act === "report-yes" && b) { close(false); data.report(b.k.id); startBtn.focus({ preventScroll: true }); }
    });
    document.addEventListener("pointerdown", (e) => { const b = getBoat(); if (b && !el.contains(e.target) && !b.el.contains(e.target) && !stage.querySelector(".loy3d__gl").contains(e.target)) close(false); });
  }

  /* ---------- แผงแต่งกระทง ---------- */
  panel.innerHTML = `
  <div class="lb__top">
    <ol class="lb__steps" aria-label="ขั้นตอนแต่งกระทง">
      <li data-step="1"><b>1</b> ฐาน</li><li data-step="2"><b>2</b> แต่ง</li><li data-step="3"><b>3</b> ลอย</li>
    </ol>
    <button class="lb__close" type="button" data-act="close-builder" aria-label="ปิดการแต่งกระทง"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="lb__body">
    <section class="lb__step" data-step="1" aria-labelledby="lb-h1">
      <h3 class="lb__h" id="lb-h1">เลือกฐานกระทง</h3>
      <div class="lb__bases" role="radiogroup" aria-labelledby="lb-h1">
        ${M.BASES.map((b, i) => `<button type="button" role="radio" aria-checked="${i === 1}" data-base="${i}"><img class="lb__base-art" src="${M.thumb("base-" + b.id)}" alt="" width="80" height="80"><b>${b.name}</b><small>${b.note}</small></button>`).join("")}
      </div>
    </section>
    <section class="lb__step" data-step="2" aria-labelledby="lb-h2" hidden>
      <h3 class="lb__h" id="lb-h2">แต่งกระทง <span class="lb__count"></span></h3>
      <p class="lb__hint">แตะของแต่งเพื่อวาง · ลากชิ้นที่เลือกเพื่อย้าย · ลากพื้นที่ว่างเพื่อหมุนดู</p>
      <div class="lb__items" role="group" aria-label="ของแต่ง">
        ${M.ITEMS.map((it, k) => `<button type="button" data-item="${k}"><img src="${M.thumb(it.id)}" alt="" width="40" height="40"><span>${it.name}</span></button>`).join("")}
      </div>
      <div class="lb__sel" hidden>
        <div class="lb__sel-head">
          <b class="lb__sel-name" aria-live="polite"></b>
          <span class="lb__pair"><button type="button" data-act="prev" aria-label="ชิ้นก่อนหน้า">‹</button><button type="button" data-act="next" aria-label="ชิ้นถัดไป">›</button></span>
        </div>
        <div class="lb__swatches" role="radiogroup" aria-label="สีของชิ้นนี้"></div>
        <div class="lb__row"><span class="lb__lbl">ขนาด</span><button type="button" data-act="smaller" aria-label="เล็กลง">−</button><output class="lb__size">100%</output><button type="button" data-act="bigger" aria-label="ใหญ่ขึ้น">+</button></div>
        <div class="lb__row"><span class="lb__lbl">หมุน</span><button type="button" data-act="rotl" aria-label="หมุนชิ้นนี้ทวนเข็ม">↺</button><button type="button" data-act="rotr" aria-label="หมุนชิ้นนี้ตามเข็ม">↻</button><button type="button" class="lb__del" data-act="delete">ลบชิ้นนี้</button></div>
      </div>
      <div class="lb__row lb__tools">
        <button type="button" data-act="undo" disabled>ย้อนกลับ</button>
      </div>
    </section>
    <section class="lb__step" data-step="3" aria-labelledby="lb-h3" hidden>
      <h3 class="lb__h" id="lb-h3">ฝากคำอธิษฐาน</h3>
      <div class="loy__field lb__field">
        <label for="lb-wish">คำอธิษฐาน</label>
        <textarea id="lb-wish" maxlength="80" rows="2" placeholder="ขอให้…" aria-describedby="lb-wish-n"></textarea>
        <span class="loy__n" id="lb-wish-n" aria-hidden="true">0/80</span>
      </div>
      <div class="loy__field lb__field">
        <label for="lb-name">ชื่อ <small>(ไม่ใส่ก็ได้)</small></label>
        <input id="lb-name" maxlength="20" autocomplete="nickname" aria-describedby="lb-name-n">
        <span class="loy__n" id="lb-name-n" aria-hidden="true">0/20</span>
      </div>
      <p class="loy__error lb__err" role="alert"></p>
      <ol class="lb__rite">
        <li class="lb__rite-step" data-rite="light">
          <span class="lb__rite-n">1</span>
          <span class="lb__rite-text">แตะไส้เทียนบนกระทงเพื่อจุดไฟ</span>
          <button type="button" class="lb__light" data-act="light">จุดเทียน</button>
        </li>
        <li class="lb__rite-step" data-rite="pray">
          <span class="lb__rite-n">2</span>
          <span class="lb__rite-text">กดค้างไว้ อธิษฐานในใจ แล้วปล่อยมือ</span>
        </li>
      </ol>
    </section>
  </div>
  <p class="lb__msg" role="status" aria-live="polite"></p>
  <div class="lb__nav">
    <button type="button" class="lb__back" data-act="back">ย้อนขั้น</button>
    <button type="button" class="loy__send lb__next" data-act="next-step"><span class="loy__send-label">ถัดไป</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
    <button type="button" class="loy__send lb__pray" hidden aria-describedby="lb-pray-help">
      <svg class="lb__ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="lb__ring-fill" cx="18" cy="18" r="15" pathLength="1"/></svg>
      <span class="loy__send-label">กดค้างไว้เพื่ออธิษฐาน</span>
    </button>
    <span class="lb__sr" id="lb-pray-help">กดปุ่มนี้ค้างไว้ (หรือกด Space ค้างไว้) จนวงเต็ม แล้วปล่อยเพื่อลอยกระทง</span>
  </div>`;
  const msgEl = $(".lb__msg", panel), countEl = $(".lb__count", panel), selBox = $(".lb__sel", panel), swatches = $(".lb__swatches", panel);
  let msgT = 0;
  const say = (t) => { msgEl.textContent = t; clearTimeout(msgT); if (t) msgT = setTimeout(() => { msgEl.textContent = ""; }, 4200); };

  const api = {
    canMove: () => step === 2,
    fillCard, bindCard,
    onParts(n) {
      countEl.textContent = `${n}/${M.MAX_PARTS} ชิ้น`;
      panel.querySelectorAll("[data-item]").forEach((b) => { b.disabled = n >= M.MAX_PARTS; });
    },
    onHistory(n) { $('[data-act="undo"]', panel).disabled = !n; },
    onLimit() { say(`วางของได้ไม่เกิน ${M.MAX_PARTS} ชิ้น ลบบางชิ้นก่อนนะ`); },
    onSelect(info) {
      selBox.hidden = !info;
      if (!info) return;
      const it = M.ITEMS[info.part.k];
      $(".lb__sel-name", panel).textContent = `${it.name} · ชิ้นที่ ${info.index + 1}/${info.count}`;
      swatches.innerHTML = it.colors.map((c, i) => `<button type="button" role="radio" aria-checked="${c === info.part.c}" aria-label="สีที่ ${i + 1}" data-color="${c}" style="--c:${c}"></button>`).join("");
      swatches.hidden = !it.colors.length;
      $(".lb__size", panel).textContent = Math.round(info.part.s * 100) + "%";
    },
    onLost() { if (ui.onLost) ui.onLost(); },
    more: () => data.more(),
  };
  const R = createRiver3D(stage, api);
  if (!R) return null;
  R.ready.then(() => {
    startBtn.disabled = false; startLabel.textContent = "แต่งกระทงของคุณ";
    if (gsap) gsap.to(poster, { autoAlpha: 0, duration: 0.8, delay: 0.2 }); else poster.hidden = true;
    // ?debug=1&n=300: กระทงทดสอบ n ใบ (ไอเดียของแต่ละฐาน + ดอกไม้สุ่ม อยู่ในเครื่องนี้เท่านั้น ไม่บันทึก) ใช้วัดความลื่น
    const q = new URLSearchParams(location.search), testN = q.get("debug") === "1" ? +q.get("n") | 0 : 0;
    for (let i = 0; i < testN; i++) {
      const base = i % 3, parts = M.presetParts(R.man, base), pl = M.placeOf(R.man, base);
      for (let j = 0, m = (i * 7) % 6; j < m; j++) {
        const k = [0, 1, 2, 3, 6, 7][(i + j) % 6], a = j * 2.4 + i, r = pl.radius * (0.3 + (j % 3) * 0.3), it = M.ITEMS[k];
        parts.push({ k, x: Math.cos(a) * r, y: pl.y, z: Math.sin(a) * r, r: (i * 37 + j * 53) % 360 - 180, s: 0.8 + (j % 3) * 0.2, c: it.colors[(i + j) % it.colors.length] });
      }
      R.feed({ id: "test" + i, name: "ทดสอบ", wish: `กระทงทดสอบใบที่ ${i + 1}`, base, parts, at: Date.now() - i * 1000, test: true }, "page");
    }
  }).catch((e) => { if (window.console) console.warn("[loy] โหลดโมเดลกระทงไม่สำเร็จ:", e.message); if (ui.onLost) ui.onLost(); });

  /* ---------- เปิด/ปิด/ขั้นตอน ---------- */
  function layoutPanel() {
    // คอม: แผงชิดซ้าย → เลื่อนภาพไปขวาครึ่งความกว้างแผง · มือถือ: แผงล่าง → เลื่อนภาพขึ้น
    const wide = stage.clientWidth >= 900;
    stage.classList.toggle("is-wide", wide);
    if (panel.hidden) return;
    const r = panel.getBoundingClientRect();
    R.setPanel(wide ? (r.width + 24) / 2 : 0, wide ? 0 : r.height / 2);
  }
  function showStep(n) {
    step = n;
    panel.querySelectorAll(".lb__step").forEach((s) => { s.hidden = +s.dataset.step !== n; });
    panel.querySelectorAll(".lb__steps li").forEach((li) => {
      const k = +li.dataset.step;
      li.classList.toggle("is-done", k < n);
      if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $('[data-act="back"]', panel).hidden = n === 1;
    $(".lb__next", panel).hidden = n === 3;
    $(".lb__pray", panel).hidden = n !== 3;
    if (n !== 2) R.select(-1);
    enterRite(n === 3);
    if (ui.onStep) ui.onStep(n);
    layoutPanel();
    const h = panel.querySelector(`.lb__step[data-step="${n}"] .lb__h`);
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  async function openBuilder() {
    startBtn.setAttribute("aria-busy", "true"); startLabel.textContent = "กำลังเตรียมกระทง…";
    try { await R.prepare(); } catch (e) { startBtn.removeAttribute("aria-busy"); startLabel.textContent = "ลองอีกครั้ง"; return; }
    startBtn.removeAttribute("aria-busy"); startLabel.textContent = "แต่งกระทงของคุณ";
    panel.hidden = false;
    stage.classList.add("is-building");
    document.documentElement.classList.add("loy-building");
    showStep(step);
    R.openBuilder();
    if (gsap) gsap.fromTo(panel, { autoAlpha: 0, x: stage.classList.contains("is-wide") ? -24 : 0, y: stage.classList.contains("is-wide") ? 0 : 30 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out", clearProps: "opacity,visibility,transform" });
    // ให้ขอบล่างของฉากชิดขอบล่างจอ (ปุ่มล่างของแผงไม่หลุดจอ · ไม่พึ่ง scroll-padding ของเว็บที่ซ้อนกับ scroll-margin)
    const r = stage.getBoundingClientRect();
    if (r.top < -10 || r.bottom > innerHeight + 2) window.scrollTo({ top: scrollY + r.bottom - innerHeight, behavior: "smooth" });
  }
  function closeBuilder(focus = true) {
    if (releasing) return;
    enterRite(false);
    stage.classList.remove("is-building");
    document.documentElement.classList.remove("loy-building");
    R.setPanel(0, 0);
    R.closeBuilder();
    const done = () => { panel.hidden = true; };
    if (gsap) gsap.to(panel, { autoAlpha: 0, duration: 0.3, onComplete: () => { done(); gsap.set(panel, { clearProps: "opacity,visibility" }); } }); else done();
    if (focus) startBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener("click", () => { if (!releasing && !startBtn.hasAttribute("aria-busy")) openBuilder(); });

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.base != null) {
      panel.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-checked", String(b === t)));
      R.setBase(+t.dataset.base, true);
      return;
    }
    if (t.dataset.item != null) {
      const k = +t.dataset.item;
      if (R.addPart(k)) say(`วาง${M.ITEMS[k].name}แล้ว`);
      return;
    }
    if (t.dataset.color) { R.setSelColor(t.dataset.color); return; }
    switch (t.dataset.act) {
      case "close-builder": closeBuilder(); break;
      case "next-step": if (step < 3) showStep(step + 1); break;
      case "back": if (step > 1) showStep(step - 1); break;
      case "prev": R.selectStep(-1); break;
      case "next": R.selectStep(1); break;
      case "smaller": R.editSel((p) => { p.s -= 0.1; }); break;
      case "bigger": R.editSel((p) => { p.s += 0.1; }); break;
      case "rotl": R.editSel((p) => { p.r -= 30; }); break;
      case "rotr": R.editSel((p) => { p.r += 30; }); break;
      case "delete": R.removeSel(); say("ลบแล้ว"); break;
      case "undo": if (R.undo()) say("ย้อนกลับแล้ว"); break;
      case "light": light(); (wishEl.value.trim() ? prayBtn : wishEl).focus({ preventScroll: true }); break;   // ปุ่มถูกปิดหลังจุด → ย้ายโฟกัสไปขั้นถัดไป
    }
  });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeBuilder(); } });

  /* ---------- ขั้น 3: เขียนคำอธิษฐาน → แตะไส้เทียนจุดไฟ → กดค้างอธิษฐาน → ปล่อยมือ กระทงลงน้ำ ---------- */
  const B = R.build;
  const wishEl = $("#lb-wish", panel), nameEl = $("#lb-name", panel), errEl = $(".lb__err", panel);
  const lightBtn = $(".lb__light", panel), prayBtn = $(".lb__pray", panel), prayLabel = $(".loy__send-label", prayBtn), ringFill = $(".lb__ring-fill", prayBtn);
  const wick = Object.assign(document.createElement("span"), { className: "lb__wick", hidden: true });
  wick.setAttribute("aria-hidden", "true");
  stage.appendChild(wick);
  let releasing = false, waitT = 0, lastKey = 0, auto = false;
  const hold = { state: "idle", p: 0, tw: null };      // idle → holding → ready → (ปล่อย) busy
  const HOLD_S = 1.6;
  const counter = (el, out, max) => { const f = () => { out.textContent = `${el.value.length}/${max}`; }; el.addEventListener("input", f); f(); };
  counter(wishEl, $("#lb-wish-n", panel), 80);
  counter(nameEl, $("#lb-name-n", panel), 20);
  [nameEl, wishEl].forEach((el) => el.addEventListener("input", () => { if (errEl.textContent) { errEl.textContent = ""; el.removeAttribute("aria-invalid"); } }));
  function fail(msg, field) {
    errEl.textContent = msg;
    [nameEl, wishEl].forEach((el) => el.toggleAttribute("aria-invalid", el === field));
    if (field) field.focus();
  }
  const candles = () => B.parts.reduce((a, p, i) => { if (p.k === M.CANDLE) a.push(i); return a; }, []);
  function syncRite() {
    const lit = B.lit.size > 0;
    $('[data-rite="light"]', panel).classList.toggle("is-done", lit);
    $('[data-rite="pray"]', panel).classList.toggle("is-on", lit);
    lightBtn.disabled = lit;
    lightBtn.textContent = lit ? "จุดแล้ว" : "จุดเทียน";
    syncPray();
  }
  // ปุ่มอธิษฐาน: ต้องจุดเทียนก่อน · ระหว่างรอ 30 วินาทีแสดงเวลานับถอยหลัง
  function syncPray() {
    clearTimeout(waitT);
    if (hold.state !== "idle") return;
    const left = data.waitLeft();
    if (left) {
      prayBtn.disabled = true;
      prayLabel.textContent = `ลอยใบต่อไปได้ใน ${Math.ceil(left / 1000)} วินาที`;
      waitT = setTimeout(syncPray, 1000 - (left % 1000) + 20);
      return;
    }
    prayBtn.disabled = !B.lit.size || releasing;
    prayLabel.textContent = B.lit.size ? "กดค้างไว้เพื่ออธิษฐาน" : "จุดเทียนก่อนนะ";
  }
  function light() {
    if (B.lit.size || releasing) return;
    candles().forEach((i) => B.lit.add(i));
    if (gsap) gsap.to(B, { litAmp: 1, duration: 0.9, ease: "power2.out", overwrite: true }); else B.litAmp = 1;
    say("จุดเทียนแล้ว");
    syncRite();
  }
  function unlight() {
    if (gsap) gsap.killTweensOf(B);
    B.lit.clear(); B.litAmp = 0; B.lift = 0;
  }
  // จุดชี้ไส้เทียน (ให้รู้ว่าแตะตรงไหน) ตามตำแหน่งเทียนบนจอ
  function wickTick() {
    const at = step === 3 && !B.lit.size && !releasing && !panel.hidden ? R.wickOnScreen() : null;
    wick.hidden = !at;
    if (at) wick.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;   // translate แยกจาก scale ของแอนิเมชันกะพริบ
  }
  let ticking = false;
  function enterRite(on) {
    api.onWickTap = on ? light : null;          // นอกขั้น 3 การแตะเทียน = เลือกชิ้นตามปกติ
    if (on) {
      if (!candles().length && R.addPart(M.CANDLE)) { R.select(-1); say("เพิ่มเทียนให้ 1 เล่ม แตะไส้เทียนเพื่อจุดไฟ"); }
      syncRite();
    } else if (!releasing) { unlight(); resetHold(); }
    if (on !== ticking) {
      ticking = on;
      if (gsap) gsap.ticker[on ? "add" : "remove"](wickTick);
      if (!on) wick.hidden = true;
    }
  }
  function setRing(p) {
    hold.p = p;
    ringFill.style.strokeDashoffset = String(1 - p);
    B.lift = p;                                  // ยกกระทงขึ้นเหนือน้ำนิด ๆ ระหว่างอธิษฐาน
    B.litAmp = 1 + p * 0.6;
  }
  function resetHold() {
    if (hold.tw) hold.tw.kill();
    hold.state = "idle"; auto = false;
    prayBtn.classList.remove("is-holding", "is-ready");
    ringFill.style.strokeDashoffset = "1";
    hold.p = 0; B.lift = 0;
    syncPray();
  }
  function holdStart() {
    if (prayBtn.disabled || hold.state !== "idle" || releasing) return;
    const bad = data.check(nameEl.value, wishEl.value);
    if (bad) { if (!bad.field) syncPray(); return fail(bad.msg, bad.field === "name" ? nameEl : bad.field === "wish" ? wishEl : null); }
    hold.state = "holding";
    say("");
    prayBtn.classList.add("is-holding");
    prayLabel.textContent = "อธิษฐานในใจ…";
    if (!gsap) { setRing(1); return holdReady(); }
    const o = { p: hold.p };
    hold.tw = gsap.to(o, { p: 1, duration: HOLD_S * (1 - o.p), ease: "none", overwrite: true, onUpdate: () => setRing(o.p), onComplete: holdReady });
  }
  function holdReady() {
    hold.state = "ready";
    prayBtn.classList.add("is-ready");
    prayLabel.textContent = "ปล่อยมือเพื่อลอยกระทง";
    if (auto) launch();
  }
  function holdEnd(cancel) {
    if (hold.state === "ready" && !cancel) return launch();
    if (hold.state !== "holding" && hold.state !== "ready") return;
    if (hold.tw) hold.tw.kill();
    hold.state = "idle"; auto = false;
    prayBtn.classList.remove("is-holding", "is-ready");
    const o = { p: hold.p };
    if (gsap) hold.tw = gsap.to(o, { p: 0, duration: 0.35, ease: "power2.out", onUpdate: () => setRing(o.p) }); else setRing(0);
    say("กดค้างไว้จนวงเต็ม แล้วค่อยปล่อยนะ");
    syncPray();
  }
  prayBtn.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    try { prayBtn.setPointerCapture(e.pointerId); } catch (err) { /* ไม่เป็นไร */ }
    holdStart();
  });
  prayBtn.addEventListener("pointerup", () => holdEnd(false));
  prayBtn.addEventListener("pointercancel", () => holdEnd(true));
  prayBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  prayBtn.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault(); lastKey = Date.now();
    if (!e.repeat) holdStart();
  });
  prayBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); lastKey = Date.now(); holdEnd(false); } });
  prayBtn.addEventListener("blur", () => { if (hold.state === "holding") holdEnd(true); });
  // screen reader (แตะสองครั้ง = click เดียว กดค้างไม่ได้) → อธิษฐานให้ครบวงเองแล้วลอย
  prayBtn.addEventListener("click", (e) => {
    if (e.detail === 0 && Date.now() - lastKey > 800 && hold.state === "idle") { auto = true; holdStart(); }
  });
  wishEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); nameEl.focus(); } });

  async function launch() {
    hold.state = "busy";
    prayBtn.disabled = true;
    prayLabel.textContent = "กำลังลอยกระทง…";
    releasing = true;                           // ระหว่างนี้ data.add ส่งเหตุการณ์ add (own) มา → ฉากรับช่วงเองตอนส่งต่อ
    const st = R.state();
    const res = await data.add({ name: nameEl.value, wish: wishEl.value, base: st.base, parts: st.parts });
    if (res.error) { releasing = false; resetHold(); return fail(res.error, wishEl); }
    // เก็บแผง → กระทงลงน้ำ น้ำกระเพื่อม กล้องตามไปสักพัก → กลับมุมแม่น้ำ
    wick.hidden = true;
    stage.classList.remove("is-building");
    document.documentElement.classList.remove("loy-building");
    startBtn.disabled = true;
    const hide = () => { panel.hidden = true; };
    if (gsap) gsap.to(panel, { autoAlpha: 0, duration: 0.35, onComplete: () => { hide(); gsap.set(panel, { clearProps: "opacity,visibility" }); } }); else hide();
    R.release(res.k, () => {
      releasing = false;
      R.setPanel(0, 0);
      unlight();
      R.resetBuild();
      wishEl.value = ""; wishEl.dispatchEvent(new Event("input"));
      resetHold();
      panel.querySelectorAll("[data-base]").forEach((b, i) => b.setAttribute("aria-checked", String(i === 1)));
      step = 1;
      enterRite(false);
      startBtn.disabled = false;
      startLabel.textContent = "แต่งกระทงอีกใบ";
      startBtn.focus({ preventScroll: true });
    });
  }
  new ResizeObserver(layoutPanel).observe(panel);
  new ResizeObserver(layoutPanel).observe(stage);

  /* ---------- เหตุการณ์จากข้อมูล ---------- */
  const ui = {
    R, panel, step: () => step, showStep, openBuilder, closeBuilder, say,
    // กระทงประดับ (decor) จัดการใน pool ของฉากเอง ไม่ต้องรับเหตุการณ์ decor/undecor
    event(type, d) {
      if (type === "add") { if (!(d.how === "own" && releasing)) R.feed(d.k, d.how); }
      else if (type === "remove") R.drop(d.id);
    },
    visible: () => R.active,
    dispose: () => R.dispose(),
    onLost: null, onStep: null,
  };
  return ui;
}
