/* loy-art.js — ภาพกระทง SVG จากไฟล์ร่าง (drafts/loykrathong-draft.html) ใช้กับปุ่มเลือกฐานและแม่น้ำแบบ 2D
 * ลำดับเดียวกับ loy-models.js BASES: 0 ใบตอง · 1 กลีบบัว · 2 ขนมปัง */
const PAL = [
  { base: "#a8bd80", rim: "#6c8a4c", a: "#2e6a3b", b: "#5b9b56", vein: "#9cc88f", round: 0 },
  { base: "#a8bd80", rim: "#6c8a4c", a: "#e47f98", b: "#f7d2dc", vein: "#fff0f3", round: 1 },
  { base: "#d4a066", rim: "#9c6634", a: "#c07f40", b: "#e8bb80", vein: "#f3d3a6", round: 1 },
];
let uid = 0;
function petal(x, by, ty, w, round) {
  const c = ty + (by - ty) * (round ? 0.05 : 0.38);
  return round
    ? `M${x - w} ${by} C${x - w} ${c} ${x - w * 0.25} ${ty} ${x} ${ty} C${x + w * 0.25} ${ty} ${x + w} ${c} ${x + w} ${by}Z`
    : `M${x - w} ${by} Q${x - w * 0.55} ${c} ${x} ${ty} Q${x + w * 0.55} ${c} ${x + w} ${by}Z`;
}
/** กระทงแบบภาพ (ใบตอง/กลีบบัว/ขนมปัง) · flame=false ไม่วาดเปลวไฟ */
export function krathongSVG(base, { flame = true } = {}) {
  const p = PAL[base] || PAL[0], id = "lk" + (++uid);
  let s = `<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false"><defs>`
    + `<linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a1f"/><stop offset=".55" stop-color="#ffc24a"/><stop offset="1" stop-color="#fff3c2"/></linearGradient>`
    + `<radialGradient id="${id}g"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".75"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>`;
  s += `<ellipse cx="60" cy="90" rx="50" ry="6" fill="#000" opacity=".28"/>`;
  s += `<ellipse cx="60" cy="84" rx="48" ry="10" fill="${p.base}" stroke="${p.rim}" stroke-width="1.5"/>`;
  for (let i = 0; i < 8; i++) { const x = 24 + i * 10.3; s += `<path d="${petal(x, 76, 46 + Math.abs(i - 3.5) * 1.6, 7, p.round)}" fill="${i % 2 ? p.b : p.a}" opacity=".85"/>`; }
  s += `<circle cx="47" cy="62" r="8" fill="#f29b26"/><circle cx="47" cy="62" r="3.2" fill="#c96512"/>`
    + `<circle cx="73" cy="62" r="8" fill="#f29b26"/><circle cx="73" cy="62" r="3.2" fill="#c96512"/>`
    + `<circle cx="60" cy="66" r="7" fill="#f7b733"/><circle cx="60" cy="66" r="2.8" fill="#d77d17"/>`
    + `<circle cx="54" cy="56" r="2.4" fill="#fffaf0"/><circle cx="67" cy="56" r="2.4" fill="#fffaf0"/>`;
  s += `<path d="M49 60 L44 30" stroke="#8a5a3c" stroke-width="1.4"/><path d="M52 60 L50 28" stroke="#8a5a3c" stroke-width="1.4"/>`
    + `<circle cx="44" cy="30" r="1.4" fill="#ff5a2a"/><circle cx="50" cy="28" r="1.4" fill="#ff5a2a"/>`;
  s += `<rect x="57" y="30" width="6" height="30" rx="2" fill="#f4ead2"/><path d="M60 30v-3" stroke="#3b2c22" stroke-width="1"/>`;
  if (flame) s += `<circle cx="60" cy="20" r="14" fill="url(#${id}g)"/><path class="flame" d="M60 9 C55 16 55.5 22 60 27 C64.5 22 65 16 60 9Z" fill="url(#${id}f)"/>`;
  for (let i = 0; i < 9; i++) {
    const x = 16 + i * 11;
    s += `<path d="${petal(x, 86, 56 + Math.abs(i - 4) * 2.2, 8, p.round)}" fill="${i % 2 ? p.b : p.a}"/><path d="M${x} 84 L${x} ${62 + Math.abs(i - 4) * 2.2}" stroke="${p.vein}" stroke-width=".8" opacity=".55"/>`;
  }
  return s + "</svg>";
}
