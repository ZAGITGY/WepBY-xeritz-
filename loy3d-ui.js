/* ============================================================================
 * loy3d-ui.js — ปุ่ม/แผงควบคุมของแม่น้ำ 3D (โหลดพร้อม loy3d.js ตอนเลื่อนใกล้ section)
 *   แม่น้ำ: ปุ่ม "แต่งกระทงของคุณ" · การ์ดคำอธิษฐาน + แจ้งซ่อน
 *   แผงแต่งกระทง 3 ขั้น: 1 เลือกฐาน → 2 แต่ง (วางของ/สี/ขนาด/หมุน/ลบ/ย้อนกลับ/หมุนดู) → 3 ลอย
 *   ทุกอย่างทำได้ด้วยคีย์บอร์ด: ปุ่มของแต่งกด Enter = วางลงช่องว่างบนกระทงทันที · ปุ่มเลือกชิ้นก่อน/ถัดไป · ปุ่มหมุนดู
 * ============================================================================ */
import { createRiver3D } from "./loy3d.js?v=2026-11-21.1";
import * as M from "./loy-models.js?v=2026-11-21.1";
import { krathongSVG } from "./loy-art.js?v=2026-11-21.1";

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
        ${M.BASES.map((b, i) => `<button type="button" role="radio" aria-checked="${i ? "false" : "true"}" data-base="${i}"><span class="lb__base-art">${krathongSVG(i, { flame: false })}</span><b>${b.name}</b><small>${b.note}</small></button>`).join("")}
      </div>
    </section>
    <section class="lb__step" data-step="2" aria-labelledby="lb-h2" hidden>
      <h3 class="lb__h" id="lb-h2">แต่งกระทง <span class="lb__count"></span></h3>
      <p class="lb__hint">เลือกของ แล้วแตะบนกระทงเพื่อวาง · ลากที่ฉากเพื่อหมุนดูรอบ ๆ</p>
      <div class="lb__items" role="group" aria-label="ของแต่ง">
        ${M.ITEMS.map((it, k) => `<button type="button" aria-pressed="false" data-item="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${M.ITEM_ICONS[k]}</svg><span>${it.name}</span></button>`).join("")}
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
        <button type="button" data-act="spinl" aria-label="หมุนกระทงดูทางซ้าย">↺ หมุนดู</button>
        <button type="button" data-act="spinr" aria-label="หมุนกระทงดูทางขวา">หมุนดู ↻</button>
      </div>
    </section>
    <section class="lb__step" data-step="3" aria-labelledby="lb-h3" hidden>
      <h3 class="lb__h" id="lb-h3">ฝากคำอธิษฐาน</h3>
      <div class="lb__ritual"></div>
    </section>
  </div>
  <p class="lb__msg" role="status" aria-live="polite"></p>
  <div class="lb__nav">
    <button type="button" class="lb__back" data-act="back">ย้อนขั้น</button>
    <button type="button" class="loy__send lb__next" data-act="next-step"><span class="loy__send-label">ถัดไป</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
  </div>`;
  const msgEl = $(".lb__msg", panel), countEl = $(".lb__count", panel), selBox = $(".lb__sel", panel), swatches = $(".lb__swatches", panel);
  let msgT = 0;
  const say = (t) => { msgEl.textContent = t; clearTimeout(msgT); if (t) msgT = setTimeout(() => { msgEl.textContent = ""; }, 4200); };

  const api = {
    onReady() {
      startBtn.disabled = false; startLabel.textContent = "แต่งกระทงของคุณ";
      if (gsap) gsap.to(poster, { autoAlpha: 0, duration: 0.8, delay: 0.2 }); else poster.hidden = true;
    },
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
      $(".lb__size", panel).textContent = Math.round(info.part.s * 100) + "%";
    },
    onLost() { if (ui.onLost) ui.onLost(); },
    more: () => data.more(),
  };
  const R = createRiver3D(stage, api);
  if (!R) return null;
  // ?debug=1&n=300: กระทงทดสอบ n ใบ (สุ่มฐาน + 6–14 ชิ้น อยู่ในเครื่องนี้เท่านั้น ไม่บันทึก) ใช้วัดความลื่น
  const q = new URLSearchParams(location.search), testN = q.get("debug") === "1" ? +q.get("n") | 0 : 0;
  for (let i = 0; i < testN; i++) {
    const parts = M.defaultParts();
    for (let j = 0, m = 4 + ((i * 7) % 9); j < m; j++) {
      const k = (i + j * 3) % 4, a = j * 2.4 + i, r = 0.08 + (j % 4) * 0.07;
      parts.push({ k, x: Math.cos(a) * r, y: M.TOP, z: Math.sin(a) * r, r: (i * 37 + j * 53) % 360 - 180, s: 0.8 + (j % 3) * 0.2, c: M.ITEMS[k].colors[(i + j) % M.ITEMS[k].colors.length] });
    }
    R.feed({ id: "test" + i, name: "ทดสอบ", wish: `กระทงทดสอบใบที่ ${i + 1}`, base: i % 3, parts, at: Date.now() - i * 1000, test: true }, "page");
  }

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
    R.arm(-1);
    panel.querySelectorAll("[data-item]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (n !== 2) R.select(-1);
    if (ui.onStep) ui.onStep(n);
    layoutPanel();
    const h = panel.querySelector(`.lb__step[data-step="${n}"] .lb__h`);
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  function openBuilder() {
    panel.hidden = false;
    stage.classList.add("is-building");
    document.documentElement.classList.add("loy-building");
    showStep(step);
    R.openBuilder();
    if (gsap) gsap.fromTo(panel, { autoAlpha: 0, x: stage.classList.contains("is-wide") ? -24 : 0, y: stage.classList.contains("is-wide") ? 0 : 30 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out", clearProps: "opacity,visibility,transform" });
    // ให้ฉากเต็มจอพอดีระหว่างแต่ง (ปุ่มล่างของแผงไม่หลุดจอ)
    const r = stage.getBoundingClientRect();
    if (r.top < -10 || r.bottom > innerHeight + 10) stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeBuilder(focus = true) {
    stage.classList.remove("is-building");
    document.documentElement.classList.remove("loy-building");
    R.setPanel(0, 0);
    R.closeBuilder();
    const done = () => { panel.hidden = true; };
    if (gsap) gsap.to(panel, { autoAlpha: 0, duration: 0.3, onComplete: () => { done(); gsap.set(panel, { clearProps: "opacity,visibility" }); } }); else done();
    if (focus) startBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener("click", openBuilder);

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.base != null) {
      panel.querySelectorAll("[data-base]").forEach((b) => b.setAttribute("aria-checked", String(b === t)));
      R.setBase(+t.dataset.base);
      return;
    }
    if (t.dataset.item != null) {
      const k = +t.dataset.item, armed = t.getAttribute("aria-pressed") === "true";
      // คีย์บอร์ด (click ที่ detail = 0): วางลงช่องว่างบนกระทงทันที · เมาส์/นิ้ว: เลือกไว้แล้วแตะบนกระทง
      if (e.detail === 0) { if (R.addPart(k)) say(`วาง${M.ITEMS[k].name}แล้ว`); return; }
      panel.querySelectorAll("[data-item]").forEach((b) => b.setAttribute("aria-pressed", String(b === t && !armed)));
      R.arm(armed ? -1 : k);
      say(armed ? "" : `แตะบนกระทงเพื่อวาง${M.ITEMS[k].name}`);
      return;
    }
    if (t.dataset.color) {
      const c = t.dataset.color, f = (p) => { p.c = c; };
      f.recolor = true;
      R.editSel(f);
      return;
    }
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
      case "spinl": R.spin(-0.7); break;
      case "spinr": R.spin(0.7); break;
    }
  });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeBuilder(); } });
  new ResizeObserver(layoutPanel).observe(panel);
  new ResizeObserver(layoutPanel).observe(stage);

  /* ---------- เหตุการณ์จากข้อมูล ---------- */
  const ui = {
    R, panel, step: () => step, showStep, openBuilder, closeBuilder, say,
    // กระทงประดับ (decor) จัดการใน pool ของฉากเอง ไม่ต้องรับเหตุการณ์ decor/undecor
    event(type, d) {
      if (type === "add") R.feed(d.k, d.how);
      else if (type === "remove") R.drop(d.id);
    },
    visible: () => R.active,
    dispose: () => R.dispose(),
    onLost: null, onStep: null,
  };
  return ui;
}
