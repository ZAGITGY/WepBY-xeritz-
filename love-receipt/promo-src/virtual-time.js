// ใส่เข้าไปในหน้าเว็บก่อนสคริปต์ของเว็บทำงาน (ใช้กับ capture-site.cjs เท่านั้น)
// ทำให้ "เวลา" ในหน้าเว็บเดินทีละเฟรมตามที่เราสั่ง ภาพที่อัดออกมาจึงลื่นทุกเฟรม ไม่กระตุกตามความเร็วเครื่อง
(() => {
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;
  const base = RealDate.now();
  let vt = 0;
  let nextId = 1;
  const timers = new Map();
  let rafQ = [];

  class VDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(base + vt); else super(...a); }
    static now() { return base + vt; }
  }
  window.Date = VDate;
  performance.now = () => vt;
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: vt + Math.max(0, Number(ms) || 0), fn, args, every: 0 });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: vt + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = nextId++; rafQ.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((r) => r.id !== id); };

  // CSS transition / animation: หยุดไว้ แล้วตั้งเวลาเองตามเวลาเสมือน
  const born = new WeakMap();
  function syncAnimations() {
    for (const a of document.getAnimations()) {
      if (!born.has(a)) {
        born.set(a, vt);
        try { a.pause(); } catch (e) { /* ignore */ }
      }
      try { a.currentTime = vt - born.get(a); } catch (e) { /* ignore */ }
    }
  }
  const flush = async () => { for (let i = 0; i < 6; i++) await null; };

  window.__vt = {
    now: () => vt,
    async advance(ms) {
      const end = vt + ms;
      for (;;) {
        let pick = null;
        for (const [id, t] of timers) if (t.at <= end && (!pick || t.at < pick[1].at)) pick = [id, t];
        if (!pick) break;
        const [id, t] = pick;
        vt = Math.max(vt, t.at);
        if (t.every) t.at += t.every; else timers.delete(id);
        try { t.fn(...t.args); } catch (e) { console.error(e); }
        await flush();
      }
      vt = end;
      const q = rafQ; rafQ = [];
      for (const r of q) { try { r.fn(vt); } catch (e) { console.error(e); } }
      await flush();
      await new Promise((r) => realSetTimeout(r, 0));
      syncAnimations();
    },
    // เลื่อนจอแบบนุ่มๆ ตามเวลาเสมือน
    scrollTo(y, dur) {
      const from = window.scrollY, t0 = vt;
      const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const step = () => {
        const k = Math.min(1, (vt - t0) / dur);
        window.scrollTo(0, from + (y - from) * ease(k));
        if (k < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    },
    // วงแตะนิ้ว (โชว์ในคลิปเท่านั้น)
    tap(x, y) {
      const d = document.createElement('div');
      d.className = '__tap';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      d.innerHTML = '<i></i><b></b>';
      document.body.append(d);
      window.setTimeout(() => d.remove(), 900);
    },
  };

  const css = document.createElement('style');
  css.textContent = `
    .__tap { position: fixed; z-index: 9999; width: 0; height: 0; pointer-events: none; }
    .__tap i, .__tap b { position: absolute; left: 0; top: 0; border-radius: 50%; transform: translate(-50%, -50%); }
    .__tap b { width: 46px; height: 46px; background: rgba(255,255,255,.55); border: 2px solid rgba(46,42,39,.45);
      box-shadow: 0 4px 14px rgba(0,0,0,.25); animation: __press .9s ease-out both; }
    .__tap i { width: 46px; height: 46px; border: 3px solid rgba(255,255,255,.9); animation: __ring .9s ease-out both; }
    @keyframes __press { 0% { opacity: 0; transform: translate(-50%,-50%) scale(1.3); } 18% { opacity: 1; transform: translate(-50%,-50%) scale(.9); }
      60% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(.9); } }
    @keyframes __ring { 0%, 15% { opacity: 0; transform: translate(-50%,-50%) scale(.8); } 25% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%,-50%) scale(2.6); } }
  `;
  document.addEventListener('DOMContentLoaded', () => document.head.append(css));
})();
