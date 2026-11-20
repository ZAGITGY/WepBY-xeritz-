/* export-lod.mjs — สร้างโมเดลเบา (lod/) สำหรับกระทงในแม่น้ำ จาก krathong-kit.js ตัวเดียวกับโมเดลเต็ม
 * วิธีใช้ (Node 18+): คัดลอก krathong-kit.js กับไฟล์นี้ไปโฟลเดอร์ว่าง → npm i three@0.180.0 → ใส่ {"type":"module"} ใน package.json
 *   → node export-lod.mjs ./lod 0.35 → คัดลอกโฟลเดอร์ lod/ ที่ได้มาแทน assets/krathong/lod/
 *   (ใส่ 1 แทน 0.35 จะได้ไฟล์เดียวกับ bases/ decor/ ทุกไบต์ ใช้ตรวจว่า kit ตรงกับโมเดลเต็ม)
 * ระดับ 0.35: กลีบ/วง/ท่อมีช่วงน้อยลง (ดอกบัว 11,200 → ~2,000 สามเหลี่ยม · ดาวเรือง 3,850 → ~600) รูปทรงและสีเหมือนเดิม */
import fs from "node:fs";
import path from "node:path";
import * as K from "./krathong-kit.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// GLTFExporter ใช้ FileReader ของเบราว์เซอร์ → ทำแบบย่อให้ Node
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((a) => { this.result = a; if (this.onloadend) this.onloadend(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((a) => { this.result = "data:application/octet-stream;base64," + Buffer.from(a).toString("base64"); if (this.onloadend) this.onloadend(); }); }
};
const out = process.argv[2] || "./lod", detail = +(process.argv[3] || 0.35);
K.setDetail(detail);
const ex = new GLTFExporter(), M = K.materials();
async function save(obj, file) {
  const buf = await ex.parseAsync(obj, { binary: true });
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), Buffer.from(buf));
  let tris = 0;
  obj.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  console.log(file, Math.round(tris), "สามเหลี่ยม");
}
for (const [k, f] of Object.entries(K.BASES)) await save(f(M), `bases/${k}.glb`);
for (const [k, f] of Object.entries(K.DECOR)) await save(f(M), `decor/${k}.glb`);
