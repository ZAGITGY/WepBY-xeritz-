# LVC v9.1 — ซอร์ส React ของแฟ้มเอกสารกระจก

โฟลเดอร์นี้เป็นโครงการ React + TypeScript + Tailwind CSS v4 ที่ตั้งค่าโครงสร้าง shadcn/ui แล้ว ใช้สร้างส่วนแฟ้มเอกสารบนเว็บไซต์ LVC ชุดพร้อมเปิดใน Spck อยู่ที่โฟลเดอร์ชั้นนอก และไม่ต้องติดตั้ง Node.js เพื่อใช้งานตามปกติ

เว็บไซต์เดิมยังใช้ HTML, CSS และ JavaScript ของ v9 ส่วน React ทำงานเฉพาะบริเวณเอกสารและข้อมูลสาธารณะในหน้าแรก ซอร์สนี้จึง build เฉพาะส่วนแฟ้มเอกสาร ไม่ได้สร้าง `app.js` หรือโมเดล Three.js เดิมขึ้นใหม่

## ติดตั้งและ build

ใช้ Node.js รุ่น LTS ที่รองรับ Vite 6 เช่น Node.js 22 LTS เปิด terminal ภายในโฟลเดอร์ `source/` แล้วรัน:

```sh
npm ci
npm run build
```

`npm ci` ติดตั้งเวอร์ชันตาม `package-lock.json` และต้องใช้อินเทอร์เน็ตครั้งแรก ส่วน `npm run build` ตรวจ TypeScript ก่อนสร้างไฟล์:

- `../assets/glass-folder/documents.js` — React, ไอคอน และส่วนแฟ้มเอกสารที่รวมแล้ว
- `../assets/glass-folder/documents.css` — CSS ของส่วนที่เพิ่ม

คำสั่ง build ล้างและสร้างใหม่เฉพาะ `assets/glass-folder/` จึงไม่ควรเก็บไฟล์ทำมืออื่นไว้ในโฟลเดอร์นี้ ไฟล์ทั้งสองถูกอ้างอิงจาก `index.html` ของเว็บไซต์ไว้แล้ว หลังแก้ซอร์สและ build ให้รีโหลด Preview เพื่อดูผล

## พัฒนาและพรีวิว

```sh
npm run dev
```

เปิด URL ที่ Vite แสดงใน terminal โดยปกติคือ `http://127.0.0.1:5173`:

- `/` — เว็บไซต์ทั้งชุด ใช้ JavaScript ของแฟ้มเอกสารจาก build ล่าสุด
- `/source/` — หน้าแสดงแฟ้มเอกสารจากซอร์ส TypeScript โดยตรง รองรับการอัปเดตจาก dev server

หากต้องการให้หน้าเว็บหลักใช้การแก้ซอร์สล่าสุดระหว่างพัฒนา ให้เปิด terminal อีกหน้าหนึ่งที่ `source/` แล้วรัน `npm run watch` คำสั่งนี้สร้าง bundle ใหม่เมื่อแก้ไฟล์ จากนั้นรีโหลดหน้าเว็บหลัก

```sh
npm run check
```

ใช้คำสั่งข้างต้นเมื่อต้องการตรวจ TypeScript โดยไม่เขียน bundle ใหม่ ไม่จำเป็นต้องเปิด dev server ขณะใช้ชุดเว็บไซต์ที่ build เสร็จแล้วใน Spck

## ตำแหน่งไฟล์และ shadcn/ui

รากของโครงการ React คือ `source/` ดังนั้นตำแหน่ง `/components/ui` ของโครงการนี้ตรงกับ `source/components/ui/` ใน ZIP:

| ตำแหน่งจาก `source/` | หน้าที่ |
| --- | --- |
| `components/ui/glass-folder-cards.tsx` | คอมโพเนนต์ Glass Folder พร้อมชนิดข้อมูลและตัวสร้างลายศิลป์ |
| `components/ui/demo.tsx` | ตัวอย่างการเรียกใช้คอมโพเนนต์ |
| `components/lvc-documents.tsx` | ส่วนแฟ้ม LVC ที่ใช้งานจริง การเปิดทีละแฟ้ม และขนาดตามพื้นที่ |
| `src/documents.ts` | ชื่อกลุ่ม รายการเอกสาร ลิงก์ และสีของแฟ้ม |
| `src/main.tsx` | จุดเชื่อม React เข้ากับหน้าเว็บเดิมและการคืนลิงก์สำรองเมื่อเกิดข้อผิดพลาด |
| `styles/globals.css` | Tailwind v4 และรูปแบบส่วนแฟ้มเอกสาร |
| `lib/utils.ts` | ฟังก์ชัน `cn` สำหรับประกอบคลาสตามแนวทาง shadcn/ui |
| `components.json` | ที่อยู่คอมโพเนนต์ สไตล์ และ aliases สำหรับ shadcn CLI |
| `tsconfig.json` / `vite.config.ts` | TypeScript, alias `@/` และการ build |

คงโฟลเดอร์ `components/ui` ไว้เพื่อแยกคอมโพเนนต์ที่ใช้ซ้ำออกจากข้อมูลเฉพาะวิทยาลัย และให้ shadcn CLI กับ import เช่น `@/components/ui/glass-folder-cards` ใช้ตำแหน่งเดียวกัน สไตล์พื้นฐานของเว็บไซต์อยู่ชั้นนอกใน `style.css`, `enhance.css`, `pages.css` และ `theme.css`; Tailwind ของส่วน React ไม่เปิด Preflight เพื่อให้รูปแบบหน้าเดิมคงที่

โครงการนี้ตั้งค่า React, TypeScript, Tailwind และ aliases ครบแล้ว ไม่ต้องรัน init ซ้ำ หากต้องการเพิ่มคอมโพเนนต์ shadcn ให้รันจาก `source/` เช่น:

```sh
npx shadcn@latest add button
```

ตรวจ dependency และ CSS ที่ CLI เพิ่มก่อนนำคอมโพเนนต์ใหม่ไปใช้ โดยเฉพาะ token สีเพิ่มเติมที่คอมโพเนนต์นั้นต้องการ จากนั้นรัน `npm run build`

หากสร้างโครงการแยกใหม่ สามารถเริ่มด้วย React TypeScript ของ Vite แล้วติดตั้ง Tailwind v4 และเริ่ม shadcn CLI:

```sh
npm create vite@latest lvc-ui -- --template react-ts
cd lvc-ui
npm install
npm install tailwindcss @tailwindcss/vite lucide-react
```

เพิ่ม `tailwindcss()` จาก `@tailwindcss/vite` ใน plugins ของ Vite, import Tailwind ในไฟล์ CSS หลัก และตั้ง alias `@/` ให้ตรงกันใน TypeScript กับ Vite ก่อนรัน `npx shadcn@latest init` หากเลือกให้ alias ชี้รากโครงการเหมือนชุดนี้ ให้ใช้ `components/ui/` กับ `styles/globals.css`; หากเลือก `src/` เป็นราก ให้ใช้ตำแหน่งภายใน `src/` ให้สอดคล้องกัน แล้วคัดลอกคอมโพเนนต์และข้อมูลที่ต้องการนำไปใช้

## ข้อมูล props และ state

แฟ้มจริง 3 กลุ่มอยู่ใน `src/documents.ts`: คู่มือการเรียน, ความโปร่งใส และรับฟังทุกเสียง แต่ละกลุ่มส่ง `label`, `files`, `art`, `seed`, `tone`, `width`, `menu` และ callback ไปยัง `GlassFolder` รายการ `files` ใช้ชื่อเอกสารจริง พร้อมลิงก์ไปสำเนาใน `../documents/` หรือบริการออนไลน์ของวิทยาลัย

คอมโพเนนต์ใช้ React hooks โดยตรง ไม่ต้องใช้ Context Provider, Redux, React Query หรือบริการ backend `LVCDocuments` ควบคุม `open` เพื่อเปิดทีละแฟ้ม ส่วน menu และแอนิเมชันเป็น state ภายในคอมโพเนนต์ `files` เป็นค่าเริ่มต้นเมื่อ mount: หากแทนรายการทั้งชุดในภายหลัง ให้เปลี่ยน React `key` เพื่อสร้างแฟ้มใหม่ตามสัญญาของ props ส่วน `onFilesChange` รองรับกรณีใช้การเพิ่มไฟล์

ชุด LVC ใช้ `action="more"` เพื่อเปิดเมนูดูข้อมูลจากวิทยาลัย ไม่แสดงปุ่มเพิ่มไฟล์ตัวอย่าง ปุ่มในแฟ้มพาไปเอกสารจริง รายการชื่อเต็มใต้แฟ้มช่วยเลือกเอกสารบนจอสัมผัสและอ่านข้อความยาวได้

เลย์เอาต์เรียง 1 คอลัมน์บนมือถือ, 2 คอลัมน์ตั้งแต่ 700px และ 3 คอลัมน์ตั้งแต่ 1180px ความกว้างวัตถุแฟ้มปรับตามพื้นที่ แอนิเมชันเคารพ `prefers-reduced-motion` และใช้การเปิดแฟ้มด้วยการคลิก แตะ หรือคีย์บอร์ด

## โหมดสว่าง มืด และตามเครื่อง

`../theme.js` ทำงานก่อน CSS ของเว็บไซต์และตั้ง `data-theme` บน `<html>` มีค่า `light` หรือ `dark` ส่วน `data-theme-preference` เก็บตัวเลือก `system`, `light` หรือ `dark` ค่าเริ่มต้นคือ `system` จึงตอบสนองเมื่อการตั้งค่าของเครื่องเปลี่ยน

ตัวเลือกถูกบันทึกใน `localStorage` คีย์ `lvc.theme` และซิงก์ระหว่างแท็บของเว็บไซต์เดียวกัน ถ้าอุปกรณ์ปิดการเก็บข้อมูล การเปลี่ยนโหมดยังใช้ได้ในหน้าที่เปิดอยู่ โดยไม่รับประกันการจำค่าหลังรีโหลด

API ที่ใช้ร่วมกับส่วนอื่นได้:

```js
window.LVCTheme.getState() // { preference: "system", theme: "light" หรือ "dark" }
window.LVCTheme.setPreference("dark")
window.LVCTheme.setPreference("system")
window.addEventListener("lvc:themechange", event => {
  const { preference, theme } = event.detail
})
```

ส่วน React อ่าน `data-theme` และติดตามการเปลี่ยนด้วย `MutationObserver` เพื่อเปลี่ยน `tone` ของแฟ้ม ไฟล์ `styles/globals.css` ตั้ง Tailwind dark variant ให้ใช้ attribute เดียวกัน จึงไม่ต้องติดตั้ง theme provider เพิ่ม

## ภาพ ไอคอน และเอกสาร

ไอคอนในส่วน React มาจาก `lucide-react` ส่วนรูปทรงแฟ้มและขอบกระจกใช้ SVG/CSS ตามคอมโพเนนต์ ภาพลายแฟ้มสร้างด้วย Canvas ภายในเครื่อง ใช้สีงาช้าง แดง และแชมเปญของ LVC พร้อม cache ระหว่างแฟ้ม ไม่ต้องเรียกบริการภาพภายนอก

ชุดนี้ใช้ภาพจริงของวิทยาลัยที่มีอยู่ และลายศิลป์ที่สร้างเฉพาะงาน แฟ้มจึงไม่ต้องใช้ภาพ Unsplash ซึ่งอาจสื่อว่าเป็นสถานที่หรือกิจกรรมของวิทยาลัยโดยไม่ตรงกับข้อมูลจริง หากต้องการใช้ภาพปกที่ได้รับอนุญาต สามารถกำหนด `image` ใน props ของแฟ้มหรือของไฟล์ได้

PDF 5 ฉบับและคู่มือภาพ PNG 1 ไฟล์อยู่ใน `../documents/` รวม 39,075,991 ไบต์ ดูที่มาและ SHA-256 ใน `../documents/sources.json` สำเนาเหล่านี้เปิดอ่านจากชุดที่ดาวน์โหลดได้โดยไม่ใช้อินเทอร์เน็ต ส่วนระบบร้องเรียน ร้องทุกข์ และข้อมูล ITA ออนไลน์ยังต้องเชื่อมต่อเว็บไซต์ทางการ
